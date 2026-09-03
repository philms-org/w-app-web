# Connections Write Path + QR Connect (v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the already-existing `connections` / `friendships` tables writable through safe server-side RPCs, and ship a real QR connect flow — auto-refreshing QR display, camera scanner with a best-effort geotag, post-scan contact-method chooser, and a `/main/connections` list with unfriend.

**Architecture:** The tables exist but have **no INSERT policy**, so nothing can write them. Migration `0019` adds three SECURITY DEFINER RPCs — `mint_connect_token()`, `record_qr_scan(p_token, p_lat, p_lng)`, `remove_connection(p_other_user_id)` — a `connect_tokens` table, three geotag columns on `connections`, and a participant SELECT policy. The QR payload is a **90-second single-use token**, not a user id (user ids aren't secret). `record_qr_scan` validates+consumes the token, resolves the venue server-side from a best-effort client geotag (inline haversine against `locations`), is idempotent per `(scanner_id, scannee_id)`, and writes **two** `friendships` rows so both the one-directional reader (`startConversation`) and the bidirectional one (`is_friend_sharing`) stay correct untouched. UI is a `qrcode`-rendered image in `ConnectSheet` plus a camera route driving `jsQR` over `getUserMedia` frames.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `@supabase/supabase-js` ^2.110.7 (`supabase.rpc`), Supabase Postgres (plpgsql, SECURITY DEFINER, `pgcrypto`, `pg_cron`), `qrcode` (generate), `jsqr` (decode). Inline `style={{}}` per this repo's convention; colors from `@/lib/theme`.

**Spec:** `docs/superpowers/specs/2026-09-03-connections-graph-qr-connect-v2-design.md`

## Global Constraints

- **No automated test suite exists in this repo.** `package.json` scripts are `dev` / `build` / `build:vercel` / `start` / `lint` only. Every task ends with `npx tsc --noEmit` (must stay clean) plus either a direct `supabase db query` assertion or a manual browser check — never a unit test. Matches every prior plan in `docs/superpowers/plans/`.
- Follow the existing inline-style convention — no Tailwind classes, no CSS modules. Colors from `@/lib/theme` (`theme.bg` `#0d0d0f`, `theme.surface` `#1a1a1d`, `theme.surface2` `#232327`, `theme.text` `#f5f5f7`, `theme.muted`, `theme.divider`, `theme.accent` `#22c3c9`, `theme.accent2` `#EC2C91`, `theme.green` `#3ecf6b`, `theme.premium1` `#7c5cff`).
- Font family string used throughout: `'Montserrat, system-ui, sans-serif'`.
- `'use client'` at the top of every component/hook file using React state or browser APIs.
- Migration files: `supabase/migrations/00NN_name.sql`, applied with `supabase db query --linked` after `supabase link --project-ref <ref>`. **QA ref `ducadjakxmkfcvrteoqz`, PROD ref `yatixschvikugckkpfum`.** Run every `supabase` command from inside `/Users/sr/w-app-web` — running from `~` silently does nothing.
- Prefer single-line `echo "...;" | supabase db query --linked` for verification queries; multi-line heredocs are fragile.
- **Check the migration number before Task 1.** This plan claims `0019`. Run `ls supabase/migrations/` first; `0018_banners_storage_policies.sql` is the current highest. If `0019` is already taken by a peer session, use the next free number and update every `0019` reference in Tasks 1, 2, and 8.
- Commit after every task (small working increments).
- **Do NOT apply the migration to PROD** until Task 8's founder gate is signed off.
- Build gates are ON (`next.config.ts`): lint and type errors fail the build.
- **Do not modify `is_friend_sharing` or `startConversation`.** The two-row write makes both correct as-is.
- `connections` columns: `id`, `scanner_id`, `scannee_id`, `location_id`, `scanned_at`, `contact_method_type` (+ the three this migration adds). `friendships` columns: `id`, `user_id`, `friend_id`, `connected_at`, `source` with `source` CHECK `qr_scan | peek_invite | message` and `UNIQUE (user_id, friend_id)`.

---

### Task 1: Migration file — connections write path

**Files:**
- Create: `supabase/migrations/0019_connections_write_path.sql`

**Interfaces:**
- Produces: `mint_connect_token() returns text`, `record_qr_scan(p_token text, p_lat double precision default null, p_lng double precision default null) returns uuid`, `remove_connection(p_other_user_id uuid) returns void`, `purge_expired_connect_tokens() returns void`, table `connect_tokens`, policy `connections_select_participant`, columns `connections.scan_lat` / `scan_lng` / `place_label`. Task 2 applies this file; Tasks 3–8 consume the RPCs.

- [ ] **Step 1: Create the migration file**

```sql
-- 0019_connections_write_path.sql
-- The connections graph (connections + friendships) has existed since the iOS
-- era but has never been writable: connections had only
-- connections_select_organizer, friendships only friendships_select, and
-- neither had an INSERT policy. That, not a missing table, is why the
-- organizer report's "QR Scans" tile has always read 0 and ConnectSheet was a
-- stub.
--
-- Design: docs/superpowers/specs/2026-09-03-connections-graph-qr-connect-v2-design.md
--
-- Writes go through SECURITY DEFINER RPCs, not INSERT policies, because a
-- friendship needs TWO rows -- (A,B) and (B,A) -- and the reverse row has
-- user_id <> auth.uid(), which no safe with-check expression permits. Matches
-- the convention of set_master_admin / assign_venue_owner (0001) and
-- record_contact_method_choice (0015).
--
-- Apply order (run from inside /Users/sr/w-app-web):
--   supabase link --project-ref ducadjakxmkfcvrteoqz     # QA first
--   supabase db query --linked < supabase/migrations/0019_connections_write_path.sql
-- PROD (yatixschvikugckkpfum) only after the founder gate in this plan's final task.

create extension if not exists pgcrypto with schema extensions;  -- gen_random_bytes
create extension if not exists pg_cron with schema extensions;

-- ---- Schema additions -----------------------------------------------------

-- Best-effort geotag captured client-side at scan time. Retained PERMANENTLY
-- (founder decision 2026-09-03), including through remove_connection.
alter table connections
  add column if not exists scan_lat    double precision,
  add column if not exists scan_lng    double precision,
  add column if not exists place_label text;

-- connections.location_id had no ON DELETE action, so deleting a venue with
-- connection rows errored. This migration makes far more rows carry a
-- location_id, so switch to SET NULL: keep the connection event and its
-- coordinates, drop only the venue link.
do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'connections'::regclass
    and contype = 'f'
    and confrelid = 'locations'::regclass;

  if v_constraint is not null then
    execute format('alter table connections drop constraint %I', v_constraint);
  end if;

  alter table connections
    add constraint connections_location_id_fkey
    foreign key (location_id) references locations(id) on delete set null;
end $$;

-- Single-use, short-lived QR tokens. The QR payload IS one of these tokens,
-- never a bare user id (user ids are not secret -- profiles_select_auth is
-- `true`). RLS on, NO policies: reachable only via the SECURITY DEFINER RPCs.
create table if not exists connect_tokens (
  token      text primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table connect_tokens enable row level security;

-- ---- Read policy --------------------------------------------------------

-- Participants can read their own connection rows (post-scan screen +
-- /main/connections). connections_select_organizer is untouched; permissive
-- policies OR together.
drop policy if exists connections_select_participant on connections;
create policy connections_select_participant on connections for select to authenticated
  using (scanner_id = auth.uid() or scannee_id = auth.uid());

-- ---- RPCs ---------------------------------------------------------------

create or replace function mint_connect_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  -- base64 of 18 random bytes -> 24 chars; map to a URL/QR-safe alphabet
  -- ('+' -> '-', '/' -> '_', '=' padding deleted).
  v_token := translate(encode(gen_random_bytes(18), 'base64'), '+/=', '-_');

  -- Bound the table: clear this caller's own dead tokens on every mint.
  delete from connect_tokens where user_id = v_uid and expires_at < now();

  insert into connect_tokens (token, user_id, expires_at)
  values (v_token, v_uid, now() + interval '90 seconds');

  return v_token;
end;
$$;

grant execute on function mint_connect_token() to authenticated;

create or replace function record_qr_scan(
  p_token text,
  p_lat   double precision default null,
  p_lng   double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scanner     uuid := auth.uid();
  v_scannee     uuid;
  v_location    uuid;
  v_place_label text;
  v_connection  uuid;
begin
  if v_scanner is null then
    raise exception 'not_signed_in';
  end if;

  select user_id into v_scannee
  from connect_tokens
  where token = p_token and expires_at > now();

  if v_scannee is null then
    raise exception 'invalid_or_expired_token';
  end if;

  if v_scannee = v_scanner then
    raise exception 'self_scan';
  end if;

  -- Single-use: consume now. A later write failure rolls the whole
  -- transaction back (delete included) so the user retries the same code; a
  -- self_scan above does NOT consume it (owner just re-shows).
  delete from connect_tokens where token = p_token;

  -- Server-side venue resolution from the best-effort geotag. Inline haversine
  -- (earthdistance/cube not assumed installed); same formula as
  -- lib/geo.ts:haversineMeters. Nearest venue whose geofence the scan point
  -- falls inside; null if none (off-venue) or no coords.
  if p_lat is not null and p_lng is not null then
    select l.id, l.name
      into v_location, v_place_label
    from locations l
    where l.lat is not null and l.lng is not null
      and l.geofence_radius_meters is not null
      and 6371000 * 2 * asin(sqrt(
            power(sin(radians(l.lat - p_lat) / 2), 2) +
            cos(radians(p_lat)) * cos(radians(l.lat)) *
            power(sin(radians(l.lng - p_lng) / 2), 2)
          )) <= l.geofence_radius_meters
    order by 6371000 * 2 * asin(sqrt(
            power(sin(radians(l.lat - p_lat) / 2), 2) +
            cos(radians(p_lat)) * cos(radians(l.lat)) *
            power(sin(radians(l.lng - p_lng) / 2), 2)
          )) asc
    limit 1;
  end if;

  -- Idempotent per (scanner, scannee): the first scan is the canonical
  -- "where/when you connected" record; a rescan reuses it and does NOT
  -- overwrite the geotag or timestamp.
  select id into v_connection
  from connections
  where scanner_id = v_scanner and scannee_id = v_scannee
  limit 1;

  if v_connection is null then
    insert into connections (scanner_id, scannee_id, location_id, scan_lat, scan_lng, place_label)
    values (v_scanner, v_scannee, v_location, p_lat, p_lng, v_place_label)
    returning id into v_connection;
  end if;

  -- Two rows so startConversation (one-directional) and is_friend_sharing
  -- (bidirectional) are BOTH correct untouched. Runs on the reuse path too,
  -- repairing a half-missing pair.
  insert into friendships (user_id, friend_id, source)
  values (v_scanner, v_scannee, 'qr_scan')
  on conflict (user_id, friend_id) do nothing;

  insert into friendships (user_id, friend_id, source)
  values (v_scannee, v_scanner, 'qr_scan')
  on conflict (user_id, friend_id) do nothing;

  return v_connection;
end;
$$;

grant execute on function record_qr_scan(text, double precision, double precision) to authenticated;

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

  -- Both friendship directions. The connections event row(s) are left FULLY
  -- intact -- including scan_lat/scan_lng/place_label -- per the 2026-09-03
  -- founder decision (permanent geotag retention; past organizer reports
  -- already aggregated these).
  delete from friendships
  where (user_id = v_uid and friend_id = p_other_user_id)
     or (user_id = p_other_user_id and friend_id = v_uid);
end;
$$;

grant execute on function remove_connection(uuid) to authenticated;

-- ---- Token cleanup cron -------------------------------------------------

create or replace function public.purge_expired_connect_tokens()
returns void
language sql
security definer
set search_path = public
as $$
  delete from connect_tokens where expires_at < now();
$$;

grant execute on function public.purge_expired_connect_tokens() to postgres;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-expired-connect-tokens') then
    perform cron.unschedule('purge-expired-connect-tokens');
  end if;
end $$;

select cron.schedule(
  'purge-expired-connect-tokens',
  '0 * * * *',
  $$select public.purge_expired_connect_tokens();$$
);
```

- [ ] **Step 2: Verify the file parses structurally (no apply yet)**

Run: `grep -c 'create or replace function' supabase/migrations/0019_connections_write_path.sql`
Expected: `4`

Run: `grep -c "raise exception" supabase/migrations/0019_connections_write_path.sql`
Expected: `5` (three in `record_qr_scan`, one in `mint_connect_token`, one in `remove_connection`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0019_connections_write_path.sql
git commit -m "Add migration 0019: connections write path (mint_connect_token, record_qr_scan, remove_connection)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Apply to QA and prove the write path in SQL

Proves the entire server-side contract **before any UI exists**. If this passes, the rest of the plan is presentation.

**Files:**
- Modify: none (database state only)

**Interfaces:**
- Consumes: `supabase/migrations/0019_connections_write_path.sql` from Task 1.
- Produces: verified-live `mint_connect_token` / `record_qr_scan` / `remove_connection` on QA.

- [ ] **Step 1: Link to QA and apply**

```bash
supabase link --project-ref ducadjakxmkfcvrteoqz
supabase db query --linked < supabase/migrations/0019_connections_write_path.sql
```

- [ ] **Step 2: Verify the three RPCs + cleanup function exist and are SECURITY DEFINER**

Run:
```bash
echo "select proname, prosecdef from pg_proc where proname in ('mint_connect_token','record_qr_scan','remove_connection','purge_expired_connect_tokens') order by proname;" | supabase db query --linked
```
Expected: four rows, all `prosecdef` = `true`.

- [ ] **Step 3: Verify the new column set and policy**

Run:
```bash
echo "select column_name from information_schema.columns where table_name = 'connections' and column_name in ('scan_lat','scan_lng','place_label') order by column_name;" | supabase db query --linked
```
Expected: three rows — `place_label`, `scan_lat`, `scan_lng`.

Run:
```bash
echo "select polname from pg_policy where polrelid = 'connections'::regclass order by polname;" | supabase db query --linked
```
Expected: two rows — `connections_select_organizer` and `connections_select_participant`.

Run:
```bash
echo "select confdeltype from pg_constraint where conrelid='connections'::regclass and contype='f' and confrelid='locations'::regclass;" | supabase db query --linked
```
Expected: `n` (SET NULL).

- [ ] **Step 4: Verify the guard rails reject bad input**

`auth.uid()` is NULL in a plain SQL session, so the first guard fires. Confirms the function is reachable and its guards work:

```bash
echo "select mint_connect_token();" | supabase db query --linked
```
Expected: an error containing `not_signed_in`. (An error here is a **PASS**.)

```bash
echo "select record_qr_scan('nonexistent-token');" | supabase db query --linked
```
Expected: an error containing `not_signed_in` (the `auth.uid()` guard fires before the token lookup). **PASS.**

- [ ] **Step 5: Verify the cron job is scheduled**

```bash
echo "select jobname, schedule from cron.job where jobname = 'purge-expired-connect-tokens';" | supabase db query --linked
```
Expected: one row, schedule `0 * * * *`.

- [ ] **Step 6: Record the baseline row counts**

```bash
echo "select (select count(*) from connections) as connections, (select count(*) from friendships) as friendships, (select count(*) from connect_tokens) as tokens;" | supabase db query --linked
```
Expected: `connections` = 0, `friendships` = 2, `tokens` = 0. Write these down — Task 8 compares against them.

- [ ] **Step 7: Commit**

```bash
git commit --allow-empty -m "Apply migration 0019 to QA (connections write path verified in SQL)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Types, QR payload helpers, and data-layer functions

**Files:**
- Modify: `lib/types.ts` (append two interfaces at end of file)
- Create: `lib/connect.ts`
- Modify: `lib/data.ts` (append after `assignVenueOwner`, the current last function; add imports to the existing `import type { ... } from './types'` block at the top)

**Interfaces:**
- Consumes: the RPCs from Task 2; `supabase` (imported line 1 of `lib/data.ts`), `getCurrentUserId` (imported line 2 from `./auth`).
- Produces:
  ```ts
  // lib/types.ts
  interface Connection { id: string; scanner_id: string; scannee_id: string;
                         location_id: string | null; scanned_at: string;
                         contact_method_type: string | null;
                         scan_lat: number | null; scan_lng: number | null;
                         place_label: string | null }
  interface MyConnection { other_user_id: string; display_name: string | null;
                           avatar_url: string | null; place_label: string | null;
                           scanned_at: string | null }

  // lib/connect.ts
  const CONNECT_QR_PREFIX: 'w://connect/'
  function encodeConnectPayload(token: string): string
  function decodeConnectPayload(raw: string): string | null   // returns the token, or null
  function connectErrorMessage(err: unknown): string

  // lib/data.ts
  function mintConnectToken(): Promise<string>
  function recordQrScan(token: string, lat?: number, lng?: number): Promise<string>  // connection id
  function removeConnection(otherUserId: string): Promise<void>
  function fetchMyConnectionCount(): Promise<number>
  function fetchConnection(connectionId: string): Promise<Connection | null>
  function fetchMyConnections(): Promise<MyConnection[]>
  function recordContactMethodChoice(connectionId: string, type: string): Promise<void>
  ```
  Tasks 4–7 consume these.

- [ ] **Step 1: Append the two interfaces to `lib/types.ts`**

Add at the end of the file:

```ts
// ---- Connections graph ----
// `connections` is the EVENT log ("A scanned B, near here"); `friendships`
// (UNIQUE (user_id, friend_id), source qr_scan|peek_invite|message) is the
// relationship STATE. Both tables predate this repo (iOS era) — see
// supabase/migrations/0019_connections_write_path.sql.

export interface Connection {
  id: string;
  scanner_id: string;
  scannee_id: string;
  location_id: string | null;
  scanned_at: string;
  contact_method_type: string | null;
  scan_lat: number | null;
  scan_lng: number | null;
  place_label: string | null;
}

// One row for the /main/connections list: the OTHER person plus where/when the
// connection was made (null place/date if the friendship has no connections row,
// e.g. source = 'message').
export interface MyConnection {
  other_user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  place_label: string | null;
  scanned_at: string | null;
}
```

- [ ] **Step 2: Create `lib/connect.ts`**

```ts
// QR payload encoding + RPC error copy for the connect flow.
// The payload is a short-lived single-use token minted by mint_connect_token(),
// NOT a user id. The `w://connect/` prefix lets the scanner reject unrelated QR
// codes with a clear message instead of calling the RPC on arbitrary text.

export const CONNECT_QR_PREFIX = 'w://connect/';

// mint_connect_token() returns translate(base64(18 bytes), '+/=', '-_') → 24
// chars from [A-Za-z0-9_-]. Be generous on the bound in case the impl changes.
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function encodeConnectPayload(token: string): string {
  return `${CONNECT_QR_PREFIX}${token}`;
}

// Returns the token, or null if this isn't a well-formed W connect code.
export function decodeConnectPayload(raw: string): string | null {
  if (!raw.startsWith(CONNECT_QR_PREFIX)) return null;
  const token = raw.slice(CONNECT_QR_PREFIX.length).trim();
  return TOKEN_RE.test(token) ? token : null;
}

// record_qr_scan / mint_connect_token raise bare sentinel strings; Supabase
// surfaces them on error.message. Map each to copy a real person can act on.
export function connectErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (raw.includes('self_scan')) return "That's your own code.";
  if (raw.includes('invalid_or_expired_token')) return 'That code has expired — ask them to show a fresh one.';
  if (raw.includes('not_signed_in')) return 'You need to be signed in.';
  return "Couldn't connect. Try again.";
}
```

- [ ] **Step 3: Append the data-layer functions to `lib/data.ts`**

Add `Connection` and `MyConnection` to the existing `import type { ... } from './types'` block at the top of `lib/data.ts`. Then add at the end of the file (after `assignVenueOwner`):

```ts
// ---- Connections graph ----

// Mints a 90s single-use token for the current user; the QR in ConnectSheet
// encodes this. Re-called every 60s while the sheet is open.
export async function mintConnectToken(): Promise<string> {
  const { data, error } = await supabase.rpc('mint_connect_token');
  if (error) throw error;
  return data as string;
}

// Creates a connection from a scanned token. lat/lng are best-effort — omit
// them if the browser denied or failed geolocation; the connection is still
// made, just without a geotag. Idempotent per (scanner, scannee). Returns the
// connection id, which recordContactMethodChoice() then needs.
export async function recordQrScan(token: string, lat?: number, lng?: number): Promise<string> {
  const { data, error } = await supabase.rpc('record_qr_scan', {
    p_token: token,
    p_lat: lat ?? null,
    p_lng: lng ?? null,
  });
  if (error) throw error;
  return data as string;
}

// Removes both friendship rows for the pair. `connections` event rows are
// retained on purpose (permanent geotag; already aggregated into past reports).
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

// One connection row by id. Readable via connections_select_participant when
// the caller is the scanner or scannee. Returns null if not found / not theirs.
export async function fetchConnection(connectionId: string): Promise<Connection | null> {
  const { data, error } = await supabase
    .from('connections')
    .select()
    .eq('id', connectionId)
    .maybeSingle();
  if (error) throw error;
  return (data as Connection) ?? null;
}

// The /main/connections list: every person I'm connected to, plus where/when.
// Two reads + a client join (no RPC): my friend ids, then my connection rows
// for place/date, then profiles for names.
export async function fetchMyConnections(): Promise<MyConnection[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];

  const { data: friendRows, error: friendErr } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', uid);
  if (friendErr) throw friendErr;

  const friendIds = (friendRows ?? []).map((r: { friend_id: string }) => r.friend_id);
  if (friendIds.length === 0) return [];

  const { data: connRows, error: connErr } = await supabase
    .from('connections')
    .select('scanner_id, scannee_id, place_label, scanned_at')
    .or(`scanner_id.eq.${uid},scannee_id.eq.${uid}`)
    .order('scanned_at', { ascending: false });
  if (connErr) throw connErr;

  // other_user_id -> most recent connection meta (rows are already newest-first).
  const metaByOther = new Map<string, { place_label: string | null; scanned_at: string }>();
  for (const c of (connRows ?? []) as { scanner_id: string; scannee_id: string; place_label: string | null; scanned_at: string }[]) {
    const other = c.scanner_id === uid ? c.scannee_id : c.scanner_id;
    if (!metaByOther.has(other)) metaByOther.set(other, { place_label: c.place_label, scanned_at: c.scanned_at });
  }

  const { data: profs, error: profErr } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', friendIds);
  if (profErr) throw profErr;

  const profById = new Map(
    (profs ?? []).map((p: { id: string; display_name: string | null; avatar_url: string | null }) => [p.id, p])
  );

  return friendIds.map((id) => {
    const meta = metaByOther.get(id);
    const p = profById.get(id);
    return {
      other_user_id: id,
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      place_label: meta?.place_label ?? null,
      scanned_at: meta?.scanned_at ?? null,
    };
  });
}

// Wraps the SECURITY DEFINER RPC from migration 0015, which only ever updates
// contact_method_type and only on the caller's own connection row.
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
git commit -m "Add connections types, QR token helpers, and connect data functions

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Real auto-refreshing QR in ConnectSheet

Replaces the static lucide icon + `console.log` stub with a scannable, self-refreshing code.

**Files:**
- Modify: `package.json` + `package-lock.json` (add `qrcode`, `@types/qrcode`)
- Modify: `components/home/ConnectSheet.tsx` (replace the whole file)

**Interfaces:**
- Consumes: `mintConnectToken` from `lib/data.ts` and `encodeConnectPayload` from `lib/connect.ts` (Task 3); `useStore` and `theme`, both already imported by this file.
- Produces: a working Connect panel with a live QR and a `Link` to `/main/connect/scan` (Task 5's route).

- [ ] **Step 1: Install the QR generator**

```bash
npm install qrcode@1
npm install --save-dev @types/qrcode
```

- [ ] **Step 2: Replace `components/home/ConnectSheet.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useStore } from '@/lib/store';
import { theme } from '@/lib/theme';
import { mintConnectToken } from '@/lib/data';
import { encodeConnectPayload } from '@/lib/connect';
import { Camera } from 'lucide-react';

// Token TTL is 90s (migration 0019); re-mint every 60s so the code on screen
// always has >= 30s of validity.
const REMINT_MS = 60_000;

export default function ConnectSheet() {
  const { user } = useStore();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const refresh = async () => {
      try {
        const token = await mintConnectToken();
        if (cancelledRef.current) return;
        // Rendered dark-on-white and placed on a white plate below: the app's
        // dark theme would otherwise invert the code and many scanners fail.
        const url = await QRCode.toDataURL(encodeConnectPayload(token), {
          width: 360,
          margin: 1,
          color: { dark: '#0d0d0f', light: '#ffffff' },
        });
        if (!cancelledRef.current) setQrDataUrl(url);
      } catch {
        if (!cancelledRef.current) setQrDataUrl(null);
      }
    };

    void refresh();
    const id = setInterval(() => void refresh(), REMINT_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(id);
    };
  }, []);

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
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual browser check**

Run `npm run dev`, sign in, open the Connect panel on the home tab.
Expected: a real black-on-white QR renders (not the old outline icon). Decoding it with a phone shows `w://connect/<24-char token>`. Leave it open ~70s and confirm the image visibly changes once (new token). The "Scan a code" link 404s for now — Task 5 adds the route.

Then confirm a token row was written:
```bash
echo "select count(*) from connect_tokens;" | supabase db query --linked
```
Expected: ≥ 1 (was 0 at Task 2 baseline).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json components/home/ConnectSheet.tsx
git commit -m "ConnectSheet: render a real auto-refreshing QR connect code

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Camera scan route + best-effort geotag

**Files:**
- Modify: `package.json` + `package-lock.json` (add `jsqr`)
- Modify: `next.config.ts:29` (Permissions-Policy)
- Create: `components/connect/ConnectResult.tsx` (stub — Task 6 fills it in)
- Create: `app/main/connect/scan/page.tsx`

**Interfaces:**
- Consumes: `decodeConnectPayload`, `connectErrorMessage` (Task 3, `lib/connect.ts`); `recordQrScan` (Task 3, `lib/data.ts`).
- Produces: route `/main/connect/scan`. On success it renders `<ConnectResult connectionId={id} />`. **`ConnectResult` here is a stub taking only `{ connectionId: string }`; Task 6 replaces its body but keeps that prop shape.** (The scanner never learns the scannee's user id — the payload is a token — so `ConnectResult` reads the connection row itself in Task 6.)

- [ ] **Step 1: Install the decoder**

```bash
npm install jsqr@1
```

- [ ] **Step 2: Enable the camera in `next.config.ts`**

Line 29 currently **hard-disables the camera on every route**. Replace:

```ts
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
```

with:

```ts
  // camera=(self) is required by the QR scanner at /main/connect/scan.
  // geolocation=(self) was already set (needed for the scan-time geotag).
  // microphone and payment stay fully disabled.
  { key: "Permissions-Policy", value: "geolocation=(self), camera=(self), microphone=(), payment=()" },
```

No CSP change is needed: `img-src` already allows `data:`/`blob:` for the QR image, and a `<video>` fed via `srcObject` is not subject to `media-src`.

- [ ] **Step 3: Create the stub `components/connect/ConnectResult.tsx`**

Keeps Task 5 independently testable. Task 6 replaces the body, not the props.

```tsx
'use client';

import { theme } from '@/lib/theme';

export default function ConnectResult({ connectionId }: { connectionId: string }) {
  return (
    <div style={{ color: theme.text, padding: '20px', textAlign: 'center', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <p style={{ fontWeight: 700 }}>Connected</p>
      <p style={{ color: theme.muted, fontSize: '12px' }}>{connectionId}</p>
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

// Best-effort: resolve to coords if the browser cooperates within 5s, else
// resolve undefined. Never rejects — a denied prompt must not block the scan.
function getScanCoords(): Promise<{ lat: number; lng: number } | undefined> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(undefined);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(undefined),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60_000 },
    );
  });
}

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  // The camera sees the same code every frame — guard against re-firing the
  // RPC while the first call is still in flight.
  const busyRef = useRef(false);

  const [error, setError] = useState<string | null>(null);
  const [connectionId, setConnectionId] = useState<string | null>(null);

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
        const token = decodeConnectPayload(code.data);
        if (!token) {
          setError("That's not a W code.");
        } else {
          busyRef.current = true;
          setError(null);
          getScanCoords()
            .then((coords) => recordQrScan(token, coords?.lat, coords?.lng))
            .then((id) => {
              if (cancelled) return;
              stop();
              setConnectionId(id);
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

      {connectionId ? (
        <ConnectResult connectionId={connectionId} />
      ) : (
        <>
          <div style={{ position: 'relative', margin: '0 20px', borderRadius: '16px', overflow: 'hidden', backgroundColor: theme.surface2, aspectRatio: '1 / 1' }}>
            <video ref={videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
          </div>
          <p style={{ color: theme.muted, fontSize: '13px', textAlign: 'center', padding: '16px 24px' }}>
            Point at the other person&apos;s code.
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

1. Sign in as user A, open Connect, leave the QR on screen.
2. In a second browser profile, sign in as user B.
3. As B, go to Connect → "Scan a code", allow camera (and allow location when prompted), point at A's code.

Expected: the stub result panel shows "Connected" + a uuid. Then verify server-side:

```bash
echo "select scanner_id, scannee_id, location_id, scan_lat is not null as has_geo, place_label from connections;" | supabase db query --linked
echo "select user_id, friend_id, source from friendships where source = 'qr_scan';" | supabase db query --linked
```
Expected: exactly **one** `connections` row (B=scanner, A=scannee), `has_geo` = `t` if location was allowed, and **two** `friendships` rows both `source = 'qr_scan'`.

Negative paths:
- Rescan the same code immediately → on-screen "That code has expired — ask them to show a fresh one." (token was single-use). Have A's sheet refresh a new token, rescan → succeeds, and `select count(*) from connections;` still returns **1** (idempotent per pair).
- Point the camera at any non-W QR → "That's not a W code."

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json next.config.ts app/main/connect/scan/page.tsx components/connect/ConnectResult.tsx
git commit -m "Add QR scan route with best-effort geotag, enable camera in Permissions-Policy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Post-scan contact-method chooser + "connected near X"

Fills in the `ConnectResult` stub. Supplies `connections.contact_method_type`, without which the report's contact-method panel stays empty.

**Files:**
- Modify: `components/connect/ConnectResult.tsx` (replace the Task 5 stub)

**Interfaces:**
- Consumes: `fetchConnection`, `recordContactMethodChoice` (Task 3); `fetchProfile(id)` and `fetchContactMethods(userId)` (both already in `lib/data.ts` — `fetchProfile` returns `Profile` with `display_name`; `fetchContactMethods` returns `ContactMethod[]` **unfiltered**, so filter `is_enabled` here); `getCurrentUserId` from `@/lib/auth`.
- Produces: nothing consumed by later tasks. Props stay `{ connectionId: string }`.

- [ ] **Step 1: Replace `components/connect/ConnectResult.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { theme } from '@/lib/theme';
import { getCurrentUserId } from '@/lib/auth';
import { fetchConnection, fetchProfile, fetchContactMethods, recordContactMethodChoice } from '@/lib/data';
import type { ContactMethod } from '@/lib/types';
import { Check } from 'lucide-react';

export default function ConnectResult({ connectionId }: { connectionId: string }) {
  const [name, setName] = useState<string | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [methods, setMethods] = useState<ContactMethod[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [conn, uid] = await Promise.all([fetchConnection(connectionId), getCurrentUserId()]);
        if (cancelled || !conn || !uid) return;
        setPlace(conn.place_label);
        setScannedAt(conn.scanned_at);
        const otherId = conn.scanner_id === uid ? conn.scannee_id : conn.scanner_id;
        const [profile, contactMethods] = await Promise.all([
          fetchProfile(otherId),
          fetchContactMethods(otherId),
        ]);
        if (cancelled) return;
        setName(profile?.display_name ?? null);
        setMethods(contactMethods.filter((m) => m.is_enabled));
      } catch {
        // The connection already exists — a load failure here is not a
        // "connection failed" and must not read like one.
        if (!cancelled) setMethods([]);
      }
    })();
    return () => { cancelled = true; };
  }, [connectionId]);

  const choose = (type: string) => {
    setChosen(type);
    // Best-effort analytics write.
    recordContactMethodChoice(connectionId, type).catch(() => {});
  };

  const dateLine = scannedAt
    ? new Date(scannedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

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
        {place ? `Connected near ${place}` : dateLine ? `Connected · ${dateLine}` : 'Connected'}
      </p>

      {methods.length > 0 && (
        <p style={{ color: theme.muted, fontSize: '13px', marginBottom: '12px' }}>
          How do you want to stay in touch?
        </p>
      )}

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
        <p style={{ color: theme.muted, fontSize: '12px', marginTop: '10px' }}>Saved.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual browser check**

Repeat the Task 5 two-account scan. User A needs ≥ 1 `contact_methods` row with `is_enabled = true` — insert one directly if needed:
```bash
echo "insert into contact_methods (user_id, slot_order, type, value, is_enabled) values ('<A-user-id>', 0, 'instagram', '@a_handle', true) on conflict do nothing;" | supabase db query --linked
```
Expected after scan: "Connected with «A's display_name»", a "Connected near «venue»" line if the scan resolved inside a geofence (or "Connected · «date»" otherwise), and A's enabled contact methods listed. Tapping one highlights it and shows "Saved."

Verify the write landed:
```bash
echo "select contact_method_type from connections where contact_method_type is not null;" | supabase db query --linked
```
Expected: one row with the type you tapped.

- [ ] **Step 4: Commit**

```bash
git add components/connect/ConnectResult.tsx
git commit -m "Post-scan contact-method chooser + connected-near-X line

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: `/main/connections` list screen + unfriend

The "connected near X" surface and the home for `remove_connection`.

**Files:**
- Create: `app/main/connections/page.tsx`
- Modify: `components/tabs/ProfileTab.tsx` (add one `menuItems` entry)

**Interfaces:**
- Consumes: `fetchMyConnections` (returns `MyConnection[]`) and `removeConnection` (Task 3); `theme`; `useRouter`.
- Produces: route `/main/connections`. Nothing later consumes it.

- [ ] **Step 1: Create `app/main/connections/page.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { fetchMyConnections, removeConnection } from '@/lib/data';
import type { MyConnection } from '@/lib/types';
import { theme } from '@/lib/theme';

export default function ConnectionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<MyConnection[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchMyConnections()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (otherUserId: string) => {
    setBusyId(otherUserId);
    try {
      await removeConnection(otherUserId);
      setConfirmId(null);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: theme.bg, color: theme.text, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 16px 12px' }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ background: 'none', border: 'none', color: theme.text, cursor: 'pointer', padding: 0, display: 'flex' }}>
          <ChevronLeft style={{ width: '24px', height: '24px' }} />
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: 700 }}>My Connections</h1>
      </div>

      {rows === null ? (
        <p style={{ color: theme.muted, fontSize: '13px', padding: '24px 20px' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: theme.muted, fontSize: '14px', padding: '24px 20px', lineHeight: 1.5 }}>
          You haven&apos;t connected with anyone yet. Show your code from the home screen, or scan someone else&apos;s.
        </p>
      ) : (
        <div style={{ padding: '4px 12px 40px' }}>
          {rows.map((r) => (
            <div
              key={r.other_user_id}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px', borderBottom: `1px solid ${theme.divider}`,
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '9999px', backgroundColor: theme.surface2, flexShrink: 0, overflow: 'hidden' }}>
                {r.avatar_url && <img src={r.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.display_name ?? 'Someone'}
                </div>
                <div style={{ color: theme.muted, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.place_label
                    ? `Connected near ${r.place_label}${fmtDate(r.scanned_at) ? ` · ${fmtDate(r.scanned_at)}` : ''}`
                    : fmtDate(r.scanned_at)
                      ? `Connected · ${fmtDate(r.scanned_at)}`
                      : 'Connected'}
                </div>
              </div>
              {confirmId === r.other_user_id ? (
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    onClick={() => remove(r.other_user_id)}
                    disabled={busyId === r.other_user_id}
                    style={{ background: theme.accent2, color: 'white', border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {busyId === r.other_user_id ? '…' : 'Remove'}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    style={{ background: theme.surface2, color: theme.text, border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmId(r.other_user_id)}
                  style={{ background: 'none', border: `1px solid ${theme.divider}`, color: theme.muted, borderRadius: '8px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add a `menuItems` entry in `components/tabs/ProfileTab.tsx`**

The `menuItems` array is defined around line 29. `Users` is already imported from `lucide-react` (line 9). Add as the first entry:

```tsx
    { id: 'connections', label: 'My Connections', icon: Users, action: () => router.push('/main/connections') },
```

so the array reads:

```tsx
  const menuItems = [
    { id: 'connections', label: 'My Connections', icon: Users, action: () => router.push('/main/connections') },
    { id: 'edit', label: 'Edit Profile', icon: Edit2, action: () => router.push('/profile/edit') },
    { id: 'settings', label: 'Settings', icon: Settings, action: () => router.push('/settings') },
    { id: 'notifications', label: 'Notifications', icon: Bell, action: () => router.push('/settings/notifications') },
    { id: 'privacy', label: 'Privacy & Security', icon: Shield, action: () => router.push('/settings/privacy') },
    { id: 'help', label: 'Help & Support', icon: HelpCircle, action: () => router.push('/help') },
  ];
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual browser check**

With the connected pair from Task 6: as user B, open Profile tab → "My Connections".
Expected: one row — A's name and avatar, "Connected near «venue» · «date»" (or "Connected · «date»"). Tap "Remove" → inline confirm → "Remove" → the row disappears and the list shows the empty state.

Verify server-side:
```bash
echo "select count(*) from friendships;" | supabase db query --linked
echo "select count(*) from connections;" | supabase db query --linked
```
Expected: `friendships` back to the Task 2 baseline (2); `connections` **unchanged** (the event row and its geotag are retained through unfriend).

- [ ] **Step 5: Commit**

```bash
git add app/main/connections/page.tsx components/tabs/ProfileTab.tsx
git commit -m "Add /main/connections list screen with unfriend

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Verify the organizer report, then gate PROD

The two report tiles need **no code change** — `fetchConnectionsFormed()` (`lib/data.ts:1178`) already counts these tables. This proves that and stops before PROD.

**Files:**
- Modify: none

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Seed a geofenced connection at a real QA venue**

For the "QR Scans" tile to count, a connection must resolve to a venue. Use `QA Test Venue` (`40.7128, -74.006`, r≈150 m). Redo the two-account scan (Task 5) with **user B's browser geolocation overridden to `40.7128, -74.006`** (Chrome DevTools → Sensors → Location), so `record_qr_scan` resolves `location_id` to that venue.

Confirm:
```bash
echo "select c.id, l.name from connections c join locations l on l.id = c.location_id;" | supabase db query --linked
```
Expected: one row, `name` = `QA Test Venue`.

- [ ] **Step 2: Confirm the report reads non-zero**

As a venue organizer / master-admin account, open `/main/venue/report` for `QA Test Venue`.
Expected: under "Connections Formed", the **QR Scans** tile shows `1` (previously always `0`). If Task 6's contact-method tap was on a connection now resolved to this venue, the contact-method breakdown lists that method; otherwise it may be empty — re-tap during a geofenced scan to populate it.

"Peek invites accepted" stays `0` — correct, `peek_invites` is Round 2, out of scope.

- [ ] **Step 3: Confirm idempotency against the Task 2 baseline**

Rescan the same person at the same venue (fresh token).
```bash
echo "select count(*) from connections;" | supabase db query --linked
```
Expected: the count does **not** increase; the UI still shows the connected panel.

- [ ] **Step 4: Confirm expired-token cleanup**

```bash
echo "select count(*) from connect_tokens where expires_at < now();" | supabase db query --linked
echo "select public.purge_expired_connect_tokens();" | supabase db query --linked
echo "select count(*) from connect_tokens where expires_at < now();" | supabase db query --linked
```
Expected: the second count is `0` (all expired rows gone). The hourly cron does this automatically; this just proves the function.

- [ ] **Step 5: FOUNDER GATE — do not proceed unattended**

Stop here. The two product-defining decisions were already signed off in the 2026-09-03 design session (connect-anywhere; permanent geotag). The remaining gate is a **working end-to-end demo on QA**: show the founder the QR display refreshing, a two-account scan creating a connection with a "connected near X" line, the contact-method chooser, the `/main/connections` screen with a working unfriend, and the organizer report's QR Scans tile at a non-zero value. Get an explicit "ship it."

- [ ] **Step 6: Apply to PROD (only after Step 5 sign-off)**

```bash
supabase link --project-ref yatixschvikugckkpfum
supabase db query --linked < supabase/migrations/0019_connections_write_path.sql
echo "select proname from pg_proc where proname in ('mint_connect_token','record_qr_scan','remove_connection','purge_expired_connect_tokens') order by proname;" | supabase db query --linked
echo "select jobname, schedule from cron.job where jobname = 'purge-expired-connect-tokens';" | supabase db query --linked
```
Expected: four function rows; one cron row, schedule `0 * * * *`.

- [ ] **Step 7: Commit**

```bash
git commit --allow-empty -m "Apply migration 0019 to PROD (connections write path live)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** `connect_tokens` + `mint_connect_token` + single-use/TTL (Tasks 1–2, 4); `record_qr_scan` with token validation, self-scan guard, best-effort geo, server-side venue resolution, `(scanner,scannee)` idempotency, two-row friendship write (Tasks 1–2, 5); `remove_connection` keeping the connections row fully intact (Tasks 1, 7); `connections_select_participant` (Task 1); `scan_lat`/`scan_lng`/`place_label` columns retained permanently (Task 1); FK → `ON DELETE SET NULL` (Task 1); expired-token cron (Tasks 1–2, 8); `camera=(self)` fix (Task 5); auto-refreshing QR display (Task 4); camera scanner with geo capture + stream cleanup on unmount/visibility (Task 5); post-scan contact-method chooser wiring the live 0015 RPC + "connected near X" (Task 6); `/main/connections` list + unfriend UI (Task 7); organizer-report verification + PROD gate (Task 8). Every "Plan A" scope item in the spec maps to a task. Friends feed + the `share_checkins_with_friends` toggle are Plan B; Round 2 Peek, off-venue reverse-geocoding, and the own-contact-methods editor are out of scope per the spec.
- **Type consistency:** `ConnectResult` props are `{ connectionId: string }` in both Task 5's stub and Task 6's implementation (the scanner cannot know the scannee's id — the payload is a token — so `ConnectResult` reads the connection row via `fetchConnection`). `recordQrScan(token, lat?, lng?)` returns the connection id in Task 3 and is consumed that way in Task 5. `recordContactMethodChoice(connectionId, type)` matches the live 0015 RPC's `(p_connection_id, p_type)`. `MyConnection` is defined in Task 3 and consumed with the same field names in Task 7. `fetchConnection` returns `Connection | null` (Task 3) and is handled as nullable in Task 6.
- **Deliberate deviation from the spec:** the spec's §8 lists `ConnectResult` props as `{ connectionId, scanneeId }`; the plan drops `scanneeId` because a token payload never exposes it to the scanner. `ContactMethod` filtering — the spec says "RLS already limits to owner-enabled rows" but `fetchContactMethods` is unfiltered in the code, so Task 6 filters `is_enabled` client-side.
- **Known gap, deliberate:** no reverse-geocoding — off-venue scans show the date only, per founder decision 7.
