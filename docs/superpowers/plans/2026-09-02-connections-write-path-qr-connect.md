# Connections Write Path + QR Connect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-existing `connections` / `friendships` tables writable through a safe server-side RPC, and ship a real QR connect flow (display + camera scan + post-scan contact-method choice) that creates connections.

**Architecture:** The tables already exist but have **no INSERT policy**, so nothing can write them. A migration adds two SECURITY DEFINER RPCs — `record_qr_scan(p_scannee_id)` and `remove_connection(p_other_user_id)` — plus a participant SELECT policy on `connections`. `record_qr_scan` derives the venue from the caller's own open check-in (never trusting a client-supplied `location_id`), requires both parties to hold an open check-in at that same venue, is idempotent per `(scanner, scannee, venue)`, and writes **two** `friendships` rows so both the one-directional reader (`startConversation`) and the bidirectional one (`is_friend_sharing`) are correct without modification. The UI is a QR image in `ConnectSheet` plus a camera scan route driving `jsQR` over `getUserMedia` frames.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `@supabase/supabase-js` ^2.110.7 (`supabase.rpc`), Supabase Postgres (plpgsql, SECURITY DEFINER), `qrcode` (generate), `jsqr` (decode). Inline `style={{}}` per this repo's convention.

**Spec:** `docs/superpowers/specs/2026-09-02-connections-graph-qr-connect-design.md`

## Global Constraints

- **No automated test suite exists in this repo.** `package.json` scripts are `dev` / `build` / `build:vercel` / `start` / `lint` only. Every task ends with `npx tsc --noEmit` (must stay clean) plus either a direct `supabase db query` assertion or a manual browser check — not a unit test. This matches every prior plan in `docs/superpowers/plans/`.
- Follow the existing inline-style convention — no Tailwind classes, no CSS modules. Colors come from `@/lib/theme`.
- `'use client'` at the top of every component/hook file using React state or browser APIs.
- Migration files: `supabase/migrations/00NN_name.sql`, applied with `supabase db query --linked` after `supabase link --project-ref <ref>`. **QA ref `ducadjakxmkfcvrteoqz`, PROD ref `yatixschvikugckkpfum`.** Run from inside `/Users/sr/w-app-web` — running from `~` silently does nothing.
- Prefer single-line `echo "...;" | supabase db query --linked` for verification queries; multi-line heredocs are fragile.
- **Check the migration number before Task 1.** This plan claims `0019`, but peer sessions commit to `main` concurrently — `0018_banners_storage_policies.sql` was taken by another session while this plan was being written. Run `ls supabase/migrations/` first; if `0019` is taken, use the next free number and update every reference in Task 1, Task 2 and Task 7 to match.
- Commit after every task (small working increments).
- **Do NOT apply the migration to PROD** until Task 7's founder gate is signed off.
- Build gates are ON (`next.config.ts`): lint and type errors fail the build.
- Do not modify `is_friend_sharing` or `startConversation`. The two-row write makes both correct as-is; changing them is out of scope.

---

### Task 1: Migration file — connections write path

**Files:**
- Create: `supabase/migrations/0019_connections_write_path.sql`

**Interfaces:**
- Produces: `record_qr_scan(p_scannee_id uuid) returns uuid`, `remove_connection(p_other_user_id uuid) returns void`, and policy `connections_select_participant`. Task 2 applies this file; Tasks 3-6 consume the RPCs.

- [ ] **Step 1: Create the migration file**

```sql
-- 0019_connections_write_path.sql
-- The connections graph has existed since the iOS era but has never been
-- writable. Before this migration:
--   connections -> only `connections_select_organizer` (organizer read)
--   friendships -> only `friendships_select` (participant read)
-- Neither had an INSERT policy, so no client could ever create a connection.
-- That, not a missing table, is why the organizer report's "QR Scans" tile
-- has always read 0 and why ConnectSheet was left as a stub.
--
-- Writes go through SECURITY DEFINER RPCs rather than INSERT policies because
-- a friendship needs TWO rows -- (A,B) and (B,A) -- and the reverse row has
-- user_id <> auth.uid(), which no safe with-check expression can permit. This
-- matches the convention already set by set_master_admin / assign_venue_owner
-- (0001) and record_contact_method_choice (0015).

-- Participants can read their own connection rows. The existing organizer
-- policy is left untouched; multiple permissive policies are OR-ed.
drop policy if exists connections_select_participant on connections;
create policy connections_select_participant on connections for select to authenticated
  using (scanner_id = auth.uid() or scannee_id = auth.uid());

create or replace function record_qr_scan(p_scannee_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scanner    uuid := auth.uid();
  v_location   uuid;
  v_connection uuid;
begin
  if v_scanner is null then
    raise exception 'not_signed_in';
  end if;

  if p_scannee_id = v_scanner then
    raise exception 'self_scan';
  end if;

  -- The venue is derived from the CALLER'S own open check-in and is never
  -- passed in, so a client cannot attribute scans to an arbitrary venue and
  -- inflate that venue's organizer report.
  select location_id into v_location
  from location_checkins
  where user_id = v_scanner and checked_out_at is null
  order by checked_in_at desc
  limit 1;

  if v_location is null then
    raise exception 'scanner_not_checked_in';
  end if;

  -- Co-presence check. `profiles` is world-readable to authenticated users
  -- (profiles_select_auth is `true`), so a bare user id inside a QR payload is
  -- not a secret. Requiring the scannee to hold an open, geofence-validated
  -- check-in at the SAME venue is what stops a remote attacker forging
  -- connections from an enumerated id.
  if not exists (
    select 1 from location_checkins
    where user_id = p_scannee_id
      and location_id = v_location
      and checked_out_at is null
  ) then
    raise exception 'scannee_not_checked_in_here';
  end if;

  -- Idempotent per (scanner, scannee, venue): rescanning the same person at
  -- the same venue returns the original row rather than inflating the count.
  select id into v_connection
  from connections
  where scanner_id = v_scanner
    and scannee_id = p_scannee_id
    and location_id = v_location
  limit 1;

  if v_connection is null then
    insert into connections (scanner_id, scannee_id, location_id)
    values (v_scanner, p_scannee_id, v_location)
    returning id into v_connection;
  end if;

  -- Two rows, so the one-directional reader (startConversation, which does
  -- .eq('user_id', uid)) and the bidirectional one (is_friend_sharing) are
  -- BOTH correct with no change to either. Runs on the reuse path too, so a
  -- repeat scan repairs a half-missing pair instead of silently skipping.
  insert into friendships (user_id, friend_id, source)
  values (v_scanner, p_scannee_id, 'qr_scan')
  on conflict (user_id, friend_id) do nothing;

  insert into friendships (user_id, friend_id, source)
  values (p_scannee_id, v_scanner, 'qr_scan')
  on conflict (user_id, friend_id) do nothing;

  return v_connection;
end;
$$;

grant execute on function record_qr_scan(uuid) to authenticated;

create or replace function remove_connection(p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  -- Both directions. The `connections` event rows are deliberately RETAINED:
  -- they are venue analytics already aggregated into past organizer reports,
  -- and deleting them would retroactively change those reports.
  delete from friendships
  where (user_id = v_uid and friend_id = p_other_user_id)
     or (user_id = p_other_user_id and friend_id = v_uid);
end;
$$;

grant execute on function remove_connection(uuid) to authenticated;
```

- [ ] **Step 2: Verify the file parses structurally (no apply yet)**

Run: `grep -c 'create or replace function' supabase/migrations/0019_connections_write_path.sql`
Expected: `2`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0019_connections_write_path.sql
git commit -m "Add migration 0019: connections write path (record_qr_scan, remove_connection)"
```

---

### Task 2: Apply to QA and prove the write path in SQL

Proves the entire server-side contract **before any UI exists**. If this task passes, the rest of the plan is only presentation.

**Files:**
- Modify: none (database state only)

**Interfaces:**
- Consumes: `supabase/migrations/0019_connections_write_path.sql` from Task 1.
- Produces: verified-live `record_qr_scan` / `remove_connection` on QA.

- [ ] **Step 1: Link to QA and apply**

```bash
supabase link --project-ref ducadjakxmkfcvrteoqz
supabase db query --linked < supabase/migrations/0019_connections_write_path.sql
```

- [ ] **Step 2: Verify both functions and the policy exist**

Run:
```bash
echo "select proname, prosecdef from pg_proc where proname in ('record_qr_scan','remove_connection');" | supabase db query --linked
```
Expected: two rows, both with `prosecdef` = `true`.

Run:
```bash
echo "select polname from pg_policy where polrelid = 'connections'::regclass;" | supabase db query --linked
```
Expected: two rows — `connections_select_organizer` and `connections_select_participant`.

- [ ] **Step 3: Verify the guard rails reject bad input**

`record_qr_scan` reads `auth.uid()`, which is NULL in a plain SQL session, so the first guard must fire. This confirms the function is reachable and its guards work:

Run:
```bash
echo "select record_qr_scan('00000000-0000-0000-0000-000000000000'::uuid);" | supabase db query --linked
```
Expected: an error containing `not_signed_in`. (An error here is a **PASS**.)

- [ ] **Step 4: Record the baseline row counts**

Run:
```bash
echo "select (select count(*) from connections) as connections, (select count(*) from friendships) as friendships;" | supabase db query --linked
```
Expected: `connections` = 0, `friendships` = 2. Write these down — Task 7 compares against them.

- [ ] **Step 5: Commit**

```bash
git commit --allow-empty -m "Apply migration 0019 to QA (record_qr_scan + remove_connection verified)"
```

---

### Task 3: Types, QR payload helpers, and data-layer functions

**Files:**
- Modify: `lib/types.ts` (append to the existing interface list)
- Create: `lib/connect.ts`
- Modify: `lib/data.ts` (append near the other RPC wrappers at the end of the file)

**Interfaces:**
- Consumes: the RPCs from Task 2; `getCurrentUserId()` and `supabase`, both already present in `lib/data.ts`.
- Produces:
  ```ts
  // lib/types.ts
  interface Connection { id: string; scanner_id: string; scannee_id: string;
                         location_id: string | null; scanned_at: string;
                         contact_method_type?: string | null }
  interface Friendship { id: string; user_id: string; friend_id: string;
                         connected_at: string;
                         source: 'qr_scan' | 'peek_invite' | 'message' }

  // lib/connect.ts
  const CONNECT_QR_PREFIX: 'w://connect/'
  function encodeConnectPayload(userId: string): string
  function decodeConnectPayload(raw: string): string | null
  function connectErrorMessage(err: unknown): string

  // lib/data.ts
  function recordQrScan(scanneeId: string): Promise<string>       // connection id
  function removeConnection(otherUserId: string): Promise<void>
  function fetchMyConnectionCount(): Promise<number>
  function recordContactMethodChoice(connectionId: string, type: string): Promise<void>
  ```
  Tasks 4, 5 and 6 consume these.

- [ ] **Step 1: Append the two interfaces to `lib/types.ts`**

Add at the end of the file:

```ts
// ---- Connections graph ----
// `connections` is the EVENT log ("A scanned B at venue V"); `friendships` is
// the relationship STATE. Both tables predate this repo (iOS era) — see
// supabase/migrations/0019_connections_write_path.sql.

export interface Connection {
  id: string;
  scanner_id: string;
  scannee_id: string;
  location_id: string | null;
  scanned_at: string;
  contact_method_type?: string | null;
}

export interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  connected_at: string;
  source: 'qr_scan' | 'peek_invite' | 'message';
}
```

- [ ] **Step 2: Create `lib/connect.ts`**

```ts
// QR payload encoding + RPC error copy for the connect flow.
// The `w://connect/` prefix lets the scanner reject unrelated QR codes with a
// clear message instead of attempting a profile lookup on arbitrary text.

export const CONNECT_QR_PREFIX = 'w://connect/';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeConnectPayload(userId: string): string {
  return `${CONNECT_QR_PREFIX}${userId}`;
}

// Returns the user id, or null if this isn't a well-formed W connect code.
export function decodeConnectPayload(raw: string): string | null {
  if (!raw.startsWith(CONNECT_QR_PREFIX)) return null;
  const id = raw.slice(CONNECT_QR_PREFIX.length).trim();
  return UUID_RE.test(id) ? id : null;
}

// record_qr_scan raises bare sentinel strings; Supabase surfaces them on
// error.message. Map each to copy a real person can act on.
export function connectErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (raw.includes('self_scan')) return "That's your own code.";
  if (raw.includes('scanner_not_checked_in')) return 'Check in to a venue first, then scan.';
  if (raw.includes('scannee_not_checked_in_here')) return 'You both need to be checked in here.';
  if (raw.includes('not_signed_in')) return 'You need to be signed in.';
  return "Couldn't connect. Try again.";
}
```

- [ ] **Step 3: Append the data-layer functions to `lib/data.ts`**

Add at the end of the file (after `assignVenueOwner`):

```ts
// ---- Connections graph ----

// Creates a connection from a scanned QR payload. The venue is derived
// server-side from the caller's open check-in — deliberately NOT passed in.
// Idempotent per (scanner, scannee, venue). Returns the connection id, which
// recordContactMethodChoice() then needs.
export async function recordQrScan(scanneeId: string): Promise<string> {
  const { data, error } = await supabase.rpc('record_qr_scan', { p_scannee_id: scanneeId });
  if (error) throw error;
  return data as string;
}

// Removes both friendship rows for the pair. `connections` event rows are
// retained on purpose (they're already aggregated into past organizer reports).
export async function removeConnection(otherUserId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_connection', { p_other_user_id: otherUserId });
  if (error) throw error;
}

// Exact because record_qr_scan writes both directions, so every friendship of
// mine has a row with user_id = me.
export async function fetchMyConnectionCount(): Promise<number> {
  const uid = await getCurrentUserId();
  if (!uid) return 0;
  const { count, error } = await supabase
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', uid);
  if (error) throw error;
  return count ?? 0;
}

// Wraps the SECURITY DEFINER RPC added in migration 0015, which only ever
// updates contact_method_type and only on the caller's own connection row.
export async function recordContactMethodChoice(connectionId: string, type: string): Promise<void> {
  const { error } = await supabase.rpc('record_contact_method_choice', {
    p_connection_id: connectionId,
    p_type: type,
  });
  if (error) throw error;
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean, no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/connect.ts lib/data.ts
git commit -m "Add connections types, QR payload helpers, and connect data functions"
```

---

### Task 4: Real QR code in ConnectSheet

Replaces the static lucide icon with a scannable code.

**Files:**
- Modify: `package.json` (add `qrcode`, `@types/qrcode`)
- Modify: `components/home/ConnectSheet.tsx` (replace the placeholder block and the `console.log` handler)

**Interfaces:**
- Consumes: `encodeConnectPayload` from `lib/connect.ts` (Task 3); `useStore` and `theme`, both already imported by this file.
- Produces: a working "Connect" panel with a real QR and a link to `/main/connect/scan` (the route Task 5 creates).

- [ ] **Step 1: Install the QR generator**

```bash
npm install qrcode@1
npm install --save-dev @types/qrcode
```

- [ ] **Step 2: Rewrite `components/home/ConnectSheet.tsx`**

Replace the whole file:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useStore } from '@/lib/store';
import { theme } from '@/lib/theme';
import { encodeConnectPayload } from '@/lib/connect';
import { Camera } from 'lucide-react';

export default function ConnectSheet() {
  const { user } = useStore();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    // Rendered dark-on-white and placed on a white plate below: the app's dark
    // theme would otherwise invert the code and many scanners fail on that.
    QRCode.toDataURL(encodeConnectPayload(user.id), {
      width: 360,
      margin: 1,
      color: { dark: '#0d0d0f', light: '#ffffff' },
    })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); });
    return () => { cancelled = true; };
  }, [user?.id]);

  return (
    <div style={{
      backgroundColor: theme.surface,
      borderRadius: '16px',
      border: `1px solid ${theme.divider}`,
      padding: '24px 20px',
      margin: '0 20px 20px',
      textAlign: 'center',
    }}>
      <h3 style={{ color: theme.text, fontSize: '16px', fontWeight: 700, marginBottom: '4px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        Connect
      </h3>
      <p style={{ color: theme.muted, fontSize: '13px', marginBottom: '20px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        Let someone scan your code to connect
      </p>

      <div style={{
        width: '180px',
        height: '180px',
        margin: '0 auto 16px',
        borderRadius: '16px',
        backgroundColor: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {qrDataUrl ? (
          <img src={qrDataUrl} alt="Your connect code" style={{ width: '164px', height: '164px', display: 'block' }} />
        ) : (
          <span style={{ color: '#0d0d0f', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            LOADING
          </span>
        )}
      </div>

      <p style={{ color: theme.text, fontSize: '14px', fontWeight: 600, marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        {user?.name ?? 'Your profile'}
      </p>

      <Link
        href="/main/connect/scan"
        style={{
          backgroundColor: theme.accent,
          color: 'white',
          border: 'none',
          borderRadius: '9999px',
          padding: '10px 24px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'Montserrat, system-ui, sans-serif',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          textDecoration: 'none',
        }}
      >
        <Camera style={{ width: '16px', height: '16px' }} />
        Scan a code
      </Link>

      <p style={{ color: theme.muted, fontSize: '11px', marginTop: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        You both need to be checked in here to connect.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual browser check**

Run `npm run dev`, sign in, open the Connect panel on the home tab.
Expected: a real black-on-white QR code renders (not the old outline icon). Scanning it with a phone camera shows the text `w://connect/<your-user-id>`. The "Scan a code" link 404s for now — Task 5 creates that route.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json components/home/ConnectSheet.tsx
git commit -m "ConnectSheet: render a real QR connect code, link to scanner"
```

---

### Task 5: Camera scan route

**Files:**
- Modify: `package.json` (add `jsqr`)
- Modify: `next.config.ts:29` (Permissions-Policy)
- Create: `app/main/connect/scan/page.tsx`

**Interfaces:**
- Consumes: `decodeConnectPayload`, `connectErrorMessage` (Task 3); `recordQrScan` (Task 3).
- Produces: route `/main/connect/scan`. On success it holds `{ connectionId, scanneeId }` in state and renders `<ConnectResult />` — the component Task 6 creates. **Task 5 stubs that import; Task 6 fills it in.**

- [ ] **Step 1: Install the decoder**

```bash
npm install jsqr@1
```

- [ ] **Step 2: Enable the camera in `next.config.ts`**

The current header **hard-disables the camera on every route**, so the scanner cannot work until this changes. Replace line 29:

```ts
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
```

with:

```ts
  // camera=(self) is required by the QR scanner at /main/connect/scan.
  // microphone and payment stay fully disabled.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=()" },
```

No CSP change is needed: `img-src` already allows `data:`/`blob:` for the QR image, and a `<video>` fed via `srcObject` (a `MediaStream`) is not subject to `media-src`.

- [ ] **Step 3: Create the placeholder result component so the route compiles**

Create `components/connect/ConnectResult.tsx`. Task 6 replaces the body; this stub keeps Task 5 independently testable.

```tsx
'use client';

import { theme } from '@/lib/theme';

export default function ConnectResult({ connectionId, scanneeId }: {
  connectionId: string;
  scanneeId: string;
}) {
  return (
    <div style={{ color: theme.text, padding: '20px', textAlign: 'center', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <p style={{ fontWeight: 700 }}>Connected</p>
      <p style={{ color: theme.muted, fontSize: '12px' }}>{connectionId} / {scanneeId}</p>
    </div>
  );
}
```

- [ ] **Step 4: Create `app/main/connect/scan/page.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import jsQR from 'jsqr';
import { theme } from '@/lib/theme';
import { decodeConnectPayload, connectErrorMessage } from '@/lib/connect';
import { recordQrScan } from '@/lib/data';
import ConnectResult from '@/components/connect/ConnectResult';
import { X } from 'lucide-react';

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // Guards against the rAF loop firing recordQrScan repeatedly while the first
  // call is still in flight — the camera sees the same code on every frame.
  const busyRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ connectionId: string; scanneeId: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const stop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };

    const tick = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height);

      if (code && !busyRef.current) {
        const scanneeId = decodeConnectPayload(code.data);
        if (!scanneeId) {
          setError("That's not a W code.");
        } else {
          busyRef.current = true;
          setError(null);
          recordQrScan(scanneeId)
            .then((connectionId) => {
              if (cancelled) return;
              stop();
              setResult({ connectionId, scanneeId });
            })
            .catch((e) => {
              if (cancelled) return;
              setError(connectErrorMessage(e));
              busyRef.current = false;
              rafRef.current = requestAnimationFrame(tick);
            });
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => {
        if (!cancelled) setError('Camera access is off. Allow camera in your browser settings, then reload.');
      });

    // Without this the camera indicator stays lit when the tab is hidden.
    const onVisibility = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      stop();
    };
  }, []);

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: theme.bg, color: theme.text, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 700 }}>Scan a code</h1>
        <button
          onClick={() => router.back()}
          aria-label="Close scanner"
          style={{ background: 'none', border: 'none', color: theme.text, cursor: 'pointer', padding: 0 }}
        >
          <X style={{ width: '22px', height: '22px' }} />
        </button>
      </div>

      {result ? (
        <ConnectResult connectionId={result.connectionId} scanneeId={result.scanneeId} />
      ) : (
        <>
          <div style={{ position: 'relative', margin: '0 20px', borderRadius: '16px', overflow: 'hidden', backgroundColor: theme.surface2, aspectRatio: '1 / 1' }}>
            <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
          <p style={{ color: theme.muted, fontSize: '13px', textAlign: 'center', padding: '16px 24px' }}>
            Point at the other person&apos;s code. You both need to be checked in here.
          </p>
          {error && (
            <p style={{ color: theme.accent2, fontSize: '13px', textAlign: 'center', padding: '0 24px 16px' }}>
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Manual browser check (needs two accounts)**

`getUserMedia` needs a secure context — `localhost` counts, so `npm run dev` is fine.

1. Sign in as user A, check in to a QA venue, open Connect, leave the QR on screen.
2. In a second browser profile, sign in as user B and check in to the **same** venue.
3. As B, go to Connect → "Scan a code", allow camera, point at A's code.

Expected: the stub result panel appears with two uuids. Then verify server-side:

```bash
echo "select scanner_id, scannee_id, location_id from connections;" | supabase db query --linked
echo "select user_id, friend_id, source from friendships where source = 'qr_scan';" | supabase db query --linked
```
Expected: exactly **one** `connections` row and **two** `friendships` rows (both directions, `source = 'qr_scan'`).

Also confirm the negative path: have B check out, then rescan. Expected on-screen: "You both need to be checked in here."

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json next.config.ts app/main/connect/scan/page.tsx components/connect/ConnectResult.tsx
git commit -m "Add QR scan route, enable camera in Permissions-Policy"
```

---

### Task 6: Post-scan contact-method chooser

Fills in the `ConnectResult` stub. This is what supplies `connections.contact_method_type`, without which the report's contact-method panel stays permanently empty.

**Files:**
- Modify: `components/connect/ConnectResult.tsx` (replace the Task 5 stub)

**Interfaces:**
- Consumes: `fetchProfile(id)` and `fetchContactMethods(userId)` (both already in `lib/data.ts`); `recordContactMethodChoice` (Task 3).
- Produces: nothing consumed by later tasks. Props stay `{ connectionId: string; scanneeId: string }`, unchanged from Task 5.

- [ ] **Step 1: Replace `components/connect/ConnectResult.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { theme } from '@/lib/theme';
import { fetchProfile, fetchContactMethods, recordContactMethodChoice } from '@/lib/data';
import type { ContactMethod } from '@/lib/types';
import { Check } from 'lucide-react';

export default function ConnectResult({ connectionId, scanneeId }: {
  connectionId: string;
  scanneeId: string;
}) {
  const [name, setName] = useState<string | null>(null);
  const [methods, setMethods] = useState<ContactMethod[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // contact_methods RLS (contacts_select) already limits this to rows the
    // owner enabled, so no extra filtering is needed here.
    Promise.all([fetchProfile(scanneeId), fetchContactMethods(scanneeId)])
      .then(([profile, contactMethods]) => {
        if (cancelled) return;
        // `Profile` uses display_name — there is no `name` field on it.
        setName(profile?.display_name ?? null);
        setMethods(contactMethods);
      })
      .catch(() => { if (!cancelled) setMethods([]); });
    return () => { cancelled = true; };
  }, [scanneeId]);

  const choose = (type: string) => {
    setChosen(type);
    // Best-effort analytics write: the connection already exists, so a failure
    // here must not read as "the connection failed".
    recordContactMethodChoice(connectionId, type).catch(() => {});
  };

  return (
    <div style={{ padding: '8px 20px 32px', textAlign: 'center', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <div style={{
        width: '56px', height: '56px', borderRadius: '9999px', backgroundColor: theme.green,
        display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px auto 14px',
      }}>
        <Check style={{ width: '28px', height: '28px', color: 'white' }} />
      </div>

      <h2 style={{ color: theme.text, fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>
        Connected with {name ?? 'them'}
      </h2>
      <p style={{ color: theme.muted, fontSize: '13px', marginBottom: '22px' }}>
        {methods.length > 0 ? 'How do you want to stay in touch?' : "You're connected."}
      </p>

      {methods.map((m) => (
        <button
          key={m.id}
          onClick={() => choose(m.type)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', padding: '14px 16px', marginBottom: '10px',
            backgroundColor: chosen === m.type ? theme.accent : theme.surface,
            color: chosen === m.type ? 'white' : theme.text,
            border: `1px solid ${theme.divider}`, borderRadius: '12px',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}
        >
          <span style={{ textTransform: 'capitalize' }}>{m.type}</span>
          <span style={{ opacity: 0.7, fontWeight: 400 }}>{m.value ?? ''}</span>
        </button>
      ))}

      {chosen && (
        <p style={{ color: theme.muted, fontSize: '12px', marginTop: '10px' }}>
          Saved.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual browser check**

Repeat the Task 5 two-account scan (user A needs at least one enabled row in `contact_methods` — insert one directly if needed).
Expected: after scanning, the panel shows "Connected with <name>" and A's enabled contact methods. Tapping one highlights it and shows "Saved."

Then verify the write landed:
```bash
echo "select contact_method_type from connections where contact_method_type is not null;" | supabase db query --linked
```
Expected: one row with the type you tapped.

- [ ] **Step 4: Commit**

```bash
git add components/connect/ConnectResult.tsx
git commit -m "Post-scan contact-method chooser, records contact_method_type"
```

---

### Task 7: Verify the organizer report, then gate PROD

The two report tiles need **no code change** — `fetchConnectionsFormed()` already counts these tables. This task proves that and stops before PROD.

**Files:**
- Modify: none

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Confirm the report reads non-zero**

As a venue organizer/master-admin account, open `/main/venue/report` for the QA venue used in Tasks 5-6.

Expected: under "Connections Formed", the **QR Scans** tile now shows a non-zero count (previously always 0), and the "Contact method chosen after scan" breakdown lists the method tapped in Task 6.

Note: "Peek invites accepted" will still read 0. That is correct and expected — `peek_invites` is written by Round 2 Peek, which is explicitly out of scope for this plan.

- [ ] **Step 2: Confirm idempotency against the Task 2 baseline**

Rescan the same person at the same venue.

```bash
echo "select count(*) from connections;" | supabase db query --linked
```
Expected: the count does **not** increase, and the UI still shows the connected panel.

- [ ] **Step 3: Verify unfriend removes both rows**

```bash
echo "select count(*) from friendships where source = 'qr_scan';" | supabase db query --linked
```
Note the number (should be 2 per connected pair). There is no unfriend UI in this plan — `remove_connection` is exercised directly:

```bash
echo "select remove_connection('<the-other-user-id>'::uuid);" | supabase db query --linked
```
Expected: this errors with `not_signed_in`, because `auth.uid()` is NULL in a plain SQL session. That is a **PASS** — it confirms the guard. Full removal is verified when Plan B adds the UI.

- [ ] **Step 4: FOUNDER GATE — do not proceed unattended**

Stop here. Before applying to PROD, the founder must sign off on the two product-defining decisions flagged in the spec's "Decisions made without human input" section:

1. **Single-opt-in** — scanning creates the connection immediately, with no accept step.
2. **Both parties must be checked in at the same venue** — you cannot connect at the door, outside, or at a venue not in the app.

Reversing either one changes the migration, so PROD must wait.

- [ ] **Step 5: Apply to PROD (only after Step 4 sign-off)**

```bash
supabase link --project-ref yatixschvikugckkpfum
supabase db query --linked < supabase/migrations/0019_connections_write_path.sql
echo "select proname from pg_proc where proname in ('record_qr_scan','remove_connection');" | supabase db query --linked
```
Expected: two rows.

- [ ] **Step 6: Commit**

```bash
git commit --allow-empty -m "Apply migration 0019 to PROD (connections write path live)"
```

---

## Self-review notes

- **Spec coverage:** two RPCs + participant policy (Tasks 1-2), types/helpers/data layer (Task 3), QR display (Task 4), scanner + the `camera=()` fix (Task 5), post-scan chooser (Task 6), report verification + PROD gate (Task 7). Every "Plan A" scope item in the spec maps to a task. Friends feed and the privacy toggle are Plan B by design; Round 2 Peek and the own-contact-methods editor are out of scope per the spec.
- **Type consistency:** `ConnectResult`'s props are `{ connectionId, scanneeId }` in both Task 5's stub and Task 6's implementation. `recordQrScan` returns the connection id in Task 3 and is consumed that way in Task 5. `recordContactMethodChoice(connectionId, type)` matches the live 0015 RPC's `(p_connection_id, p_type)`.
- **Known gap, deliberate:** there is no unfriend UI in this plan; `remove_connection` ships ahead of its surface because single-opt-in makes removal a correctness requirement, and Plan B consumes it.
