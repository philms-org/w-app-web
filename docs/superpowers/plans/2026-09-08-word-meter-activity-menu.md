# Word Meter + Organizer Activity Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an organizer publish a per-venue list of "activity words", let a checked-in attendee pick a few, and show them a small progress meter.

**Architecture:** Two new tables. `activity_menu_items` holds the organizer's words for one `location_id`; `attendee_activity_picks` holds which item ids a user chose at a venue. An organizer CRUD screen at `/main/venue/activities` mirrors the existing `/main/venue/zones` page. On `CheckedInHero`'s checked-in state, a new `ActivityMeterCard` renders the venue's menu as multi-select chips plus a `Meter` (`picked / 3`). Picks are saved with one RPC that replaces the user's rows for that venue atomically. RLS reuses the `is_venue_manager()` helper from migration 0011.

**Tech Stack:** Next.js 15.5 App Router, TypeScript, React client components, Supabase (`lib/data.ts` + RPC), Zustand. Supabase CLI (token auth) for the migration. Styling: `lib/theme.ts` tokens + `components/ui/primitives.tsx` (`Button`, `Input`, `Chip`). No test runner — verification is `npx tsc --noEmit` + `npm run build` + preview browser, plus `node` assertion scripts for pure helpers.

**Spec:** `docs/superpowers/specs/2026-09-08-web-parity-must-haves-design.md` §3 (open questions resolved per the doc's recommendations: per-venue not global (O3.1); meter target = 3, no hard max (O3.2); no analytics-report tile in this plan (O3.3); separate from `friday_night` / looking-for (O3.4)).

## Global Constraints

- **Light theme only.** Colour/radius/type from `lib/theme.ts` + `components/ui/primitives.tsx`. `#0D0D0F` is the only allowed hardcoded hex (on-accent text).
- **No new npm dependencies.**
- **Migration file is `0021_activity_menu.sql`.** (Migration `0020_location_requests` currently lives only in the `.worktrees/location-requests` worktree and is unmerged — if it lands first, renumber this to `0022` before applying. Check `ls supabase/migrations/` at execution time.)
- **RLS is the real gate.** `useIsOrganizer` only controls what renders. Reuse `is_venue_manager(location_id, uuid)` (defined by an earlier migration, used by `venue_zones`).
- **One RPC for picks.** `set_activity_picks(p_location_id uuid, p_item_ids uuid[])` deletes the caller's rows for that venue and inserts the new set in one statement — no client-side diffing.
- **Meter target is the constant `ACTIVITY_TARGET = 3`.** No hard cap on how many a user picks; the meter just clamps its bar at 100%.
- Apply the migration to **QA** during the task; the **prod** apply is a separate founder-confirmed step.
- After every task: `npx tsc --noEmit` + `npm run build` pass (lint + type gates on). Never `npm run build` with a dev server running.
- Commit after every task with the message in its final step.

## Reference (used across tasks)

- `useIsOrganizer(locationId): { isOrganizer, isMasterAdmin, canManage }` — `lib/hooks/useIsOrganizer.ts`.
- `venue_zones` data layer in `lib/data.ts` (the pattern to copy): `fetchVenueZones`, `createVenueZone`, `updateVenueZone`, `deleteVenueZone`.
- `app/main/venue/zones/page.tsx` — the organizer CRUD screen to mirror (header + list + add row + inline delete; already on light tokens).
- `components/home/CheckedInHero.tsx` — checked-in render. `canManage` (line ~57), the organizer chip row `{canManage && (<> …Members / Rewards / Zones… </>)}` (line ~343), the "Connections" card (line ~397+). The new card mounts inside the checked-in block, **before** the Connections card; the organizer entry chip goes in the chip row.
- `lib/types.ts` — add the two row types near `VenueZone`.

---

## File Structure

- **Create:** `supabase/migrations/0021_activity_menu.sql`
- **Modify:** `lib/types.ts` — `ActivityMenuItem`, `AttendeeActivityPick`.
- **Modify:** `lib/data.ts` — 6 helpers (see Task 2).
- **Create:** `lib/activity.ts` — `ACTIVITY_TARGET`, `meterFill(picked, target)`.
- **Create:** `scripts/verify-activity.mjs` — `meterFill` assertions.
- **Create:** `components/ui/Meter.tsx` — labelled progress bar.
- **Create:** `app/main/venue/activities/page.tsx` — organizer CRUD.
- **Create:** `components/home/ActivityMeterCard.tsx` — attendee card.
- **Modify:** `components/home/CheckedInHero.tsx` — mount the card + add the organizer chip.

---

### Task 1: Migration — tables, RLS, RPC

**Files:**
- Create: `supabase/migrations/0021_activity_menu.sql`
- Modify: `lib/types.ts`

**Interfaces:**
- Produces (DB):
  - `activity_menu_items(id uuid pk, location_id uuid → locations, label text, sort_order int, created_by uuid → profiles, created_at timestamptz)`.
  - `attendee_activity_picks(user_id uuid → profiles, location_id uuid → locations, item_id uuid → activity_menu_items on delete cascade, picked_at timestamptz)`, PK `(user_id, location_id, item_id)`.
  - `set_activity_picks(p_location_id uuid, p_item_ids uuid[]) returns void` — security definer; deletes `auth.uid()`'s rows for `p_location_id`, inserts one row per id in `p_item_ids` that belongs to that venue's menu.
- Produces (TS): `ActivityMenuItem` = `{ id: string; location_id: string; label: string; sort_order: number; created_by: string | null; created_at: string }`; `AttendeeActivityPick` = `{ user_id: string; location_id: string; item_id: string; picked_at: string }`.

- [ ] **Step 1: Write `supabase/migrations/0021_activity_menu.sql`**

```sql
-- 0021_activity_menu.sql
-- Per-venue "activity words" an organizer publishes, and the picks a
-- checked-in attendee makes. See
-- docs/superpowers/specs/2026-09-08-web-parity-must-haves-design.md §3.
-- Run manually against w-app-qa:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0021_activity_menu.sql

create table if not exists activity_menu_items (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists activity_menu_items_location_idx
  on activity_menu_items (location_id, sort_order);

alter table activity_menu_items enable row level security;

drop policy if exists activity_menu_items_select on activity_menu_items;
create policy activity_menu_items_select on activity_menu_items
  for select to authenticated using (true);

drop policy if exists activity_menu_items_write on activity_menu_items;
create policy activity_menu_items_write on activity_menu_items
  for all to authenticated
  using (is_venue_manager(activity_menu_items.location_id, auth.uid()))
  with check (is_venue_manager(activity_menu_items.location_id, auth.uid()));

create table if not exists attendee_activity_picks (
  user_id uuid not null references profiles(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  item_id uuid not null references activity_menu_items(id) on delete cascade,
  picked_at timestamptz not null default now(),
  primary key (user_id, location_id, item_id)
);

create index if not exists attendee_activity_picks_loc_idx
  on attendee_activity_picks (location_id);

alter table attendee_activity_picks enable row level security;

-- Reads: your own picks, plus organizers of the venue (for a future report).
drop policy if exists attendee_activity_picks_select on attendee_activity_picks;
create policy attendee_activity_picks_select on attendee_activity_picks
  for select to authenticated
  using (
    user_id = auth.uid()
    or is_venue_manager(attendee_activity_picks.location_id, auth.uid())
  );

-- Direct writes are blocked; go through set_activity_picks().
drop policy if exists attendee_activity_picks_write on attendee_activity_picks;
create policy attendee_activity_picks_write on attendee_activity_picks
  for all to authenticated using (false) with check (false);

create or replace function set_activity_picks(p_location_id uuid, p_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from attendee_activity_picks
    where user_id = auth.uid() and location_id = p_location_id;

  insert into attendee_activity_picks (user_id, location_id, item_id)
  select auth.uid(), p_location_id, i.id
    from activity_menu_items i
   where i.location_id = p_location_id
     and i.id = any(p_item_ids);
end;
$$;

grant execute on function set_activity_picks(uuid, uuid[]) to authenticated;
```

> Confirm `is_venue_manager(uuid, uuid)` exists first:
> `echo "select proname from pg_proc where proname = 'is_venue_manager';" | supabase db query --linked`
> It is used by `venue_zones` (migration 0011), so it should be present. If not, copy its definition from whichever migration introduced it into this file above the policies.

- [ ] **Step 2: Apply to QA + verify**

From `/Users/sr/w-app-web` (QA ref `ducadjakxmkfcvrteoqz`; `supabase link --project-ref <ref>` first if needed):
```bash
supabase db query --linked < supabase/migrations/0021_activity_menu.sql
echo "select tablename, policyname from pg_policies where tablename in ('activity_menu_items','attendee_activity_picks');" | supabase db query --linked
echo "select proname from pg_proc where proname = 'set_activity_picks';" | supabase db query --linked
```
Expect: 4 policies listed, `set_activity_picks` present.

- [ ] **Step 3: Add the TS row types**

In `lib/types.ts`, next to `VenueZone`:

```ts
export interface ActivityMenuItem {
  id: string;
  location_id: string;
  label: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

export interface AttendeeActivityPick {
  user_id: string;
  location_id: string;
  item_id: string;
  picked_at: string;
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0021_activity_menu.sql lib/types.ts
git commit -m "activity menu: migration 0021 (menu items + picks + set_activity_picks RPC)

Applied to QA. Prod apply pending founder confirmation.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Data layer

**Files:**
- Modify: `lib/data.ts`

**Interfaces:**
- Consumes: `supabase`, `getCurrentUserId` (already imported in `lib/data.ts`), `ActivityMenuItem` / `AttendeeActivityPick` from Task 1.
- Produces (add near the `venue_zones` helpers):
  - `fetchActivityMenu(locationId: string): Promise<ActivityMenuItem[]>` — `activity_menu_items` where `location_id`, ordered `sort_order`.
  - `createActivityMenuItem(locationId: string, label: string, sortOrder: number): Promise<ActivityMenuItem>` — insert, `select().single()`, `created_by` = current uid.
  - `updateActivityMenuItem(id: string, fields: Partial<Pick<ActivityMenuItem, 'label' | 'sort_order'>>): Promise<void>`.
  - `deleteActivityMenuItem(id: string): Promise<void>`.
  - `fetchMyActivityPicks(locationId: string): Promise<string[]>` — `attendee_activity_picks.item_id[]` for the current uid at `locationId`.
  - `setMyActivityPicks(locationId: string, itemIds: string[]): Promise<void>` — `supabase.rpc('set_activity_picks', { p_location_id: locationId, p_item_ids: itemIds })`.

- [ ] **Step 1: Add the helpers**

Append to the section after `deleteVenueZone` in `lib/data.ts`:

```ts
// ---- Activity menu (per-venue "activity words") ----

export async function fetchActivityMenu(locationId: string): Promise<ActivityMenuItem[]> {
  const { data, error } = await supabase
    .from('activity_menu_items')
    .select()
    .eq('location_id', locationId)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as ActivityMenuItem[];
}

export async function createActivityMenuItem(
  locationId: string,
  label: string,
  sortOrder: number,
): Promise<ActivityMenuItem> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from('activity_menu_items')
    .insert({ location_id: locationId, label, sort_order: sortOrder, created_by: uid })
    .select()
    .single();
  if (error) throw error;
  return data as ActivityMenuItem;
}

export async function updateActivityMenuItem(
  id: string,
  fields: Partial<Pick<ActivityMenuItem, 'label' | 'sort_order'>>,
): Promise<void> {
  const { error } = await supabase.from('activity_menu_items').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteActivityMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from('activity_menu_items').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchMyActivityPicks(locationId: string): Promise<string[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('attendee_activity_picks')
    .select('item_id')
    .eq('user_id', uid)
    .eq('location_id', locationId);
  if (error) throw error;
  return (data ?? []).map((r) => (r as { item_id: string }).item_id);
}

export async function setMyActivityPicks(locationId: string, itemIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_activity_picks', {
    p_location_id: locationId,
    p_item_ids: itemIds,
  });
  if (error) throw error;
}
```

Add `ActivityMenuItem` (and `AttendeeActivityPick` if you keep it) to the existing `import type { … } from './types'` block. If `tsc` flags `AttendeeActivityPick` unused, drop it from the import.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → completes.

- [ ] **Step 3: Commit**

```bash
git add lib/data.ts
git commit -m "activity menu: data layer (fetch/create/update/delete + picks RPC wrapper)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `ACTIVITY_TARGET` + `Meter`

**Files:**
- Create: `lib/activity.ts`
- Create: `scripts/verify-activity.mjs`
- Create: `components/ui/Meter.tsx`

**Interfaces:**
- Produces:
  - `const ACTIVITY_TARGET = 3`.
  - `function meterFill(picked: number, target: number): number` — `target <= 0 ? 0 : max(0, min(1, picked / target))`.
  - `Meter({ value, label }: { value: number; label?: string })` — a token-styled bar; `value` 0–1; fills `theme.accent` over `theme.surface2`; optional caption above.

- [ ] **Step 1: Write `scripts/verify-activity.mjs`**

```js
// Run: node scripts/verify-activity.mjs
import { ACTIVITY_TARGET, meterFill } from '../lib/activity.ts';

const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const eq = (a, b, m) => { if (a !== b) fail(`${m}: expected ${b}, got ${a}`); };

eq(ACTIVITY_TARGET, 3, 'ACTIVITY_TARGET');
eq(meterFill(0, 3), 0, '0/3');
eq(meterFill(2, 3), 2 / 3, '2/3');
eq(meterFill(3, 3), 1, '3/3');
eq(meterFill(5, 3), 1, 'clamps over target');
eq(meterFill(-1, 3), 0, 'clamps below 0');
eq(meterFill(1, 0), 0, 'target 0 -> 0');

if (!process.exitCode) console.log('OK: activity helpers verified');
```

- [ ] **Step 2: Run — expect FAIL** (`lib/activity.ts` missing).

- [ ] **Step 3: Write `lib/activity.ts`**

```ts
export const ACTIVITY_TARGET = 3;

export function meterFill(picked: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(1, picked / target));
}
```

- [ ] **Step 4: Run — expect `OK: activity helpers verified`.**

- [ ] **Step 5: Write `components/ui/Meter.tsx`**

```tsx
'use client';

import { theme, type as typeTokens, radius } from '@/lib/theme';

export default function Meter({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div style={{ fontFamily: typeTokens.family }}>
      {label && (
        <div style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, marginBottom: 6 }}>{label}</div>
      )}
      <div style={{ height: 8, borderRadius: radius.pill, backgroundColor: theme.surface2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: theme.accent, transition: 'width .25s ease' }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck** — `npx tsc --noEmit` → clean.

- [ ] **Step 7: Commit**

```bash
git add lib/activity.ts scripts/verify-activity.mjs components/ui/Meter.tsx
git commit -m "activity menu: ACTIVITY_TARGET + meterFill + Meter component

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Organizer CRUD screen `/main/venue/activities`

**Files:**
- Create: `app/main/venue/activities/page.tsx`

**Interfaces:**
- Consumes: `useSearchParams` for `?locationId=`, `useIsOrganizer`, `fetchActivityMenu` / `createActivityMenuItem` / `updateActivityMenuItem` / `deleteActivityMenuItem`, `Button` / `Input`, `theme`.
- Produces: `VenueActivitiesPage` — same shape as `app/main/venue/zones/page.tsx`: header with back + title "Activity menu"; a not-authorized message when `!canManage`; a list of items (label + up/down reorder + delete); an "add" row (`Input` + `Button` "Add"). Reorder swaps `sort_order` with the neighbour via two `updateActivityMenuItem` calls; a new item's `sort_order` = current max + 1.

- [ ] **Step 1: Read the zones page for structure**

Run: `sed -n '1,120p' app/main/venue/zones/page.tsx` — reuse its `Suspense` wrapper, header, not-authorized branch, list row, add row. The activity screen has **no** lat/lng — just `label`.

- [ ] **Step 2: Write `app/main/venue/activities/page.tsx`**

```tsx
'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import {
  fetchActivityMenu,
  createActivityMenuItem,
  updateActivityMenuItem,
  deleteActivityMenuItem,
} from '@/lib/data';
import type { ActivityMenuItem } from '@/lib/types';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Button, Input } from '@/components/ui/primitives';

function Inner() {
  const router = useRouter();
  const locationId = useSearchParams().get('locationId') ?? '';
  const { canManage } = useIsOrganizer(locationId || null);

  const [items, setItems] = useState<ActivityMenuItem[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!locationId) return;
    fetchActivityMenu(locationId).then(setItems).catch((e) => console.error('Failed to load activity menu:', e));
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => [...items].sort((a, b) => a.sort_order - b.sort_order), [items]);

  const add = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setBusy(true);
    try {
      const nextOrder = sorted.length ? sorted[sorted.length - 1].sort_order + 1 : 0;
      await createActivityMenuItem(locationId, label, nextOrder);
      setNewLabel('');
      load();
    } finally {
      setBusy(false);
    }
  };

  const move = async (item: ActivityMenuItem, dir: -1 | 1) => {
    const idx = sorted.findIndex((i) => i.id === item.id);
    const other = sorted[idx + dir];
    if (!other) return;
    setBusy(true);
    try {
      await Promise.all([
        updateActivityMenuItem(item.id, { sort_order: other.sort_order }),
        updateActivityMenuItem(other.id, { sort_order: item.sort_order }),
      ]);
      load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await deleteActivityMenuItem(id);
      load();
    } finally {
      setBusy(false);
    }
  };

  if (locationId && !canManage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: typeTokens.family }}>
        <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize }}>
          You&apos;re not authorized to manage this venue&apos;s activity menu.
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: typeTokens.family }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ padding: 8, marginLeft: -8, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
          <ChevronLeft style={{ width: 24, height: 24, color: theme.text }} />
        </button>
        <h1 style={{ fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text }}>Activity menu</h1>
      </div>

      <div style={{ padding: '8px 20px 40px', maxWidth: 480, margin: '0 auto' }}>
        <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize, marginBottom: 16 }}>
          Words checked-in guests can pick from — what they&apos;re here for, what they do, what they want to talk about.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {sorted.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: theme.surface, border: `1px solid ${theme.divider}`, borderRadius: radius.control, padding: '10px 12px' }}>
              <span style={{ flex: 1, color: theme.text, fontSize: typeTokens.body.fontSize }}>{item.label}</span>
              <button onClick={() => move(item, -1)} disabled={busy || i === 0} aria-label="Move up" style={{ background: theme.surface2, border: 'none', borderRadius: '9999px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: busy || i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.4 : 1 }}>
                <ArrowUp style={{ width: 14, height: 14, color: theme.text }} />
              </button>
              <button onClick={() => move(item, 1)} disabled={busy || i === sorted.length - 1} aria-label="Move down" style={{ background: theme.surface2, border: 'none', borderRadius: '9999px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: busy || i === sorted.length - 1 ? 'default' : 'pointer', opacity: i === sorted.length - 1 ? 0.4 : 1 }}>
                <ArrowDown style={{ width: 14, height: 14, color: theme.text }} />
              </button>
              <button onClick={() => remove(item.id)} disabled={busy} aria-label="Delete" style={{ background: 'transparent', border: 'none', borderRadius: '9999px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'default' : 'pointer' }}>
                <Trash2 style={{ width: 14, height: 14, color: theme.accent2 }} />
              </button>
            </div>
          ))}
          {sorted.length === 0 && (
            <p style={{ color: theme.muted, fontSize: typeTokens.caption.fontSize }}>No words yet — add a few below.</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Networking, Live music, First-timer" />
          </div>
          <Button onClick={add} disabled={busy || !newLabel.trim()}>Add</Button>
        </div>
      </div>
    </div>
  );
}

export default function VenueActivitiesPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit` → clean. Run: `npm run build` → completes; route table shows `/main/venue/activities`.

- [ ] **Step 4: Visual check**

Preview `/main/venue/activities?locationId=<a venue you manage>` (get an id from `/main` after checking in, or from `/admin`). Add a word → it appears. Reorder with the arrows. Delete. Reload → persists. With a `locationId` you don't manage → the not-authorized message. Check `read_console_messages`.

- [ ] **Step 5: Commit**

```bash
git add app/main/venue/activities/page.tsx
git commit -m "activity menu: organizer CRUD screen /main/venue/activities

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: `ActivityMeterCard` + wire into `CheckedInHero`

**Files:**
- Create: `components/home/ActivityMeterCard.tsx`
- Modify: `components/home/CheckedInHero.tsx`

**Interfaces:**
- Consumes: `fetchActivityMenu`, `fetchMyActivityPicks`, `setMyActivityPicks`; `Chip` (`@/components/ui/primitives`); `Meter` (Task 3); `ACTIVITY_TARGET` / `meterFill` (`@/lib/activity`); `ActivityMenuItem`.
- Produces:
  - `ActivityMeterCard({ locationId }: { locationId: string })` — loads the venue menu + the user's picks; renders `null` if the menu is empty. Otherwise: a `theme.surface` card, heading "What are you here for?", the menu items as multi-select `Chip`s (toggle updates a local `Set` and calls `setMyActivityPicks(locationId, [...set])` best-effort), and a `Meter` labelled `` `${picked.size} / ${ACTIVITY_TARGET} picked` `` at fill `meterFill(picked.size, ACTIVITY_TARGET)`.
  - `CheckedInHero`: `<ActivityMeterCard locationId={selectedLocation.id} />` mounted in the checked-in block just above the Connections card; an "Activities" `Link` added to the `{canManage && (…)}` chip row → `/main/venue/activities?locationId=${selectedLocation.id}`.

- [ ] **Step 1: Write `components/home/ActivityMeterCard.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchActivityMenu, fetchMyActivityPicks, setMyActivityPicks } from '@/lib/data';
import type { ActivityMenuItem } from '@/lib/types';
import { ACTIVITY_TARGET, meterFill } from '@/lib/activity';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Chip } from '@/components/ui/primitives';
import Meter from '@/components/ui/Meter';

export default function ActivityMeterCard({ locationId }: { locationId: string }) {
  const [items, setItems] = useState<ActivityMenuItem[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    Promise.all([fetchActivityMenu(locationId), fetchMyActivityPicks(locationId)])
      .then(([menu, mine]) => {
        setItems(menu);
        setPicked(new Set(mine));
      })
      .catch((e) => console.error('Failed to load activity menu:', e))
      .finally(() => setLoaded(true));
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  if (!loaded || items.length === 0) return null;

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setMyActivityPicks(locationId, [...next]).catch((e) => console.error('Failed to save picks:', e));
      return next;
    });
  };

  return (
    <div style={{
      backgroundColor: theme.surface,
      borderRadius: radius.card,
      border: `1px solid ${theme.divider}`,
      padding: 16,
      marginBottom: 20,
      fontFamily: typeTokens.family,
    }}>
      <p style={{ color: theme.text, fontSize: typeTokens.heading.fontSize, fontWeight: 700, marginBottom: 4 }}>
        What are you here for?
      </p>
      <p style={{ color: theme.muted, fontSize: typeTokens.caption.fontSize, marginBottom: 12 }}>
        Pick a few — other guests see what you tapped.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {items.map((it) => (
          <Chip key={it.id} selected={picked.has(it.id)} onClick={() => toggle(it.id)}>
            {it.label}
          </Chip>
        ))}
      </div>

      <Meter value={meterFill(picked.size, ACTIVITY_TARGET)} label={`${picked.size} / ${ACTIVITY_TARGET} picked`} />
    </div>
  );
}
```

- [ ] **Step 2: Mount it in `CheckedInHero`**

In `components/home/CheckedInHero.tsx`:
- Add import: `import ActivityMeterCard from '@/components/home/ActivityMeterCard';`
- Directly **before** the `<div>` that wraps the "Connections" card (the block whose first child `<p>` renders `Connections`), add:

```tsx
{checkedIn && <ActivityMeterCard locationId={selectedLocation.id} />}
```

- In the organizer chip row — the `{canManage && (<> … Zones … </>)}` group — add one more `Link` after the Zones link:

```tsx
<Link
  href={`/main/venue/activities?locationId=${selectedLocation.id}`}
  style={{
    backgroundColor: theme.surface,
    color: theme.text,
    border: `1px solid ${theme.divider}`,
    borderRadius: '9999px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'Montserrat, system-ui, sans-serif',
    textDecoration: 'none',
  }}
>
  Activities
</Link>
```

- [ ] **Step 3: Typecheck + build + lint**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → completes.
Run: `npm run lint` → no new errors.

- [ ] **Step 4: Visual check**

- As an **organizer**: check in at your venue → the "Activities" chip appears → opens the CRUD screen → add 3–4 words.
- As an **attendee** (same account is fine) checked in at that venue: the "What are you here for?" card renders with those words as chips. Tap two → the meter fills to `2 / 3`. Reload the page (still checked in) → picks persist (proves `set_activity_picks`). At a venue with **no** menu items → the card does not render at all.

- [ ] **Step 5: Commit**

```bash
git add components/home/ActivityMeterCard.tsx components/home/CheckedInHero.tsx
git commit -m "activity menu: attendee ActivityMeterCard on the checked-in home screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage** (spec §3):
- `activity_menu_items` per `location_id` → Task 1 table. ✓
- `attendee_activity_picks` PK `(user_id, location_id, item_id)` → Task 1 table. ✓
- Organizer add / reorder / delete, organizer-only → Task 4 screen; RLS `is_venue_manager` (Task 1); `useIsOrganizer` render gate. ✓
- Attendee multi-select chips on `CheckedInHero` checked-in state → Task 5 `ActivityMeterCard`. ✓
- Meter `picked / TARGET` with a bar, TARGET = 3, clamps over target → Task 3 `ACTIVITY_TARGET` + `meterFill` + `Meter`, verified by `scripts/verify-activity.mjs`. ✓
- Per-venue not global (O3.1) → every query keyed by `location_id`. Target 3, no hard max (O3.2) → constant + clamp, no pick limit. No report tile (O3.3) → not built; the picks select policy already lets an organizer read for a future report. Separate from `friday_night` (O3.4) → new tables, `profiles` untouched. ✓
- Atomic pick replace → `set_activity_picks` RPC (Task 1); `setMyActivityPicks` wrapper (Task 2); direct-write policy `false` forces callers through it. ✓

**2. Placeholder scan:** No "TBD" / "add error handling" / "similar to Task N". Task 1 Step 1's `is_venue_manager` note is a conditional with an exact remedy. Task 4 Step 1 points at the zones page for orientation, but Step 2 gives the complete file.

**3. Type consistency:** `ActivityMenuItem` fields (`id, location_id, label, sort_order, created_by, created_at`) identical across Task 1 (SQL + TS), Task 2, Task 4, Task 5. `set_activity_picks(p_location_id uuid, p_item_ids uuid[])` param names match `setMyActivityPicks`'s `supabase.rpc(...)`. `meterFill(picked, target)` / `ACTIVITY_TARGET` names match between `lib/activity.ts`, the verify script, `Meter` usage, and `ActivityMeterCard`. `Chip` (`selected`, `onClick`, children) and `Input`/`Button` props match `components/ui/primitives.tsx`. `useIsOrganizer` return `{ canManage }` matches Task 4.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-08-word-meter-activity-menu.md`. Two execution options:

**1. Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.

**2. Inline Execution** — execute here with checkpoints.

Which approach?
