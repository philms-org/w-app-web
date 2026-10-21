# Event Hotspots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Organizers attach recommended nearby places ("hotspots") to an event; attendees check in at them to collect stamps, fill the activity meter, and unlock rewards; hotspots show on the Map tab.

**Architecture:** One new table `event_hotspots` links an event (`locations` row) to a place (another `locations` row). Visits are derived from existing `location_checkins` — no per-visit table. A dependency-free pure module computes progress; a thin data module + one React hook feed the UI.

**Tech Stack:** Next.js App Router (client components, inline styles + `lib/theme` tokens), Supabase (Postgres + RLS, supabase-js), Leaflet (`components/WMap.tsx`), lucide-react icons, Node 26 built-in test runner.

**Spec:** `docs/superpowers/specs/2026-09-30-event-hotspots-design.md` (approved with 7 mockup screens on 2026-09-30).

## Global Constraints

- Work only in worktree `/Users/sr/w-app-web/.worktrees/event-hotspots`, branch `feature/event-hotspots`. Never `git stash` bare; never touch other worktrees.
- **Founder-gated (CLAUDE.md):** the migration file may be written and committed, but must NOT be applied to QA until the founder says so, and never to prod without explicit go-ahead. QA project ref: `ducadjakxmkfcvrteoqz`.
- Migration number: `0034_event_hotspots.sql`.
- `note` max length: 140 characters. New-place default radius: 75 m.
- Hotspot accent color: `#FF7A45` (flame); stamped-on-map color: `#3ECF6B`; gradient `#FF7A45 → #FF3D7F` for the meter/strip.
- Organizer visitor counts are aggregates only — never user ids or names.
- Events without hotspots must render exactly as today.
- Copy is sentence case; UI copy strings are given verbatim in each task.
- Tap targets ≥ 44px.
- Never run `npm run build` (a dev server may be running in another checkout); verify with `npx tsc --noEmit -p .` and `npx eslint <files>`.

## Review Focus

1. **Late-night check-ins vs. UTC dates** — a check-in at 11:30pm local on the event's last day must count; progress uses the browser's local calendar day, not the UTC date (test in Task 2).
2. **Duplicate check-ins at one hotspot** — checking in twice (leave and return) counts as one visit (test in Task 2).
3. **Reward target above hotspot count** — `min_hotspots` of 7 with 5 hotspots shows "x / 7" and never unlocks; organizer sees a warning (test in Task 2; warning in Tasks 9–10).
4. **Undated venue trails** — check-ins made before a hotspot was added don't count (test in Task 2).
5. **Non-organizer writes** — a regular user calling insert/update/delete on `event_hotspots`, `create_hotspot_place`, or `hotspot_visit_counts` is rejected (SQL checks in Task 1, run only after founder approval).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0034_event_hotspots.sql` (create) | Table, RLS, `rewards.min_hotspots`, `hotspot_visit_counts`, `create_hotspot_place` |
| `lib/types.ts` (modify) | `EventHotspot`, `HotspotCheckin`; `Reward.min_hotspots` |
| `lib/hotspotProgress.ts` (create) | Pure progress math — only `import type` |
| `lib/hotspotProgress.test.mts` (create) | Node built-in tests for the pure module |
| `lib/hotspots.ts` (create) | Supabase reads/writes for hotspots |
| `lib/hooks/useEventHotspots.ts` (create) | Loads one event's hotspots + my progress |
| `components/hotspots/HotspotsCard.tsx` (create) | Event's hotspot list with stamps; exports `Stamp`, `HOTSPOT_ORANGE` (screen 3) |
| `components/hotspots/HotspotStrip.tsx` (create) | "Stamp collected" strip at a hotspot (screen 4) |
| `components/hotspots/HotspotPinSheet.tsx` (create) | Bottom sheet for a hotspot pin (screen 2) |
| `components/home/ActivityMeterCard.tsx` (modify) | Meter shows hotspot progress when present (screen 3) |
| `components/home/CheckedInHero.tsx` (modify) | Mount card, strip, meter override |
| `components/home/RewardsPanel.tsx` (modify) | Lock/unlock by hotspot visits (screen 5) |
| `components/WMap.tsx` (modify) | Flame marker variant, click-to-select for hotspots (screen 1) |
| `components/tabs/MapTab.tsx` (modify) | Load today's hotspots, open pin sheet |
| `app/main/venue/hotspots/page.tsx` (create) | Organizer Hotspots page (screens 6–7) |
| `app/main/organizer/page.tsx` (modify) | "Hotspots" tool link |
| `app/main/venue/rewards/page.tsx` (modify) | "Hotspots to unlock" field (screen 7) |
| `package.json` (modify) | `"test"` script |

---

### Task 1: Migration `0034_event_hotspots.sql`

**Files:**
- Create: `supabase/migrations/0034_event_hotspots.sql`

**Interfaces:**
- Produces: table `event_hotspots(id, event_id, location_id, note, sort_order, created_by, created_at)`; column `rewards.min_hotspots int`; RPC `hotspot_visit_counts(p_event_id uuid) → table(location_id uuid, visitors bigint)`; RPC `create_hotspot_place(p_event_id uuid, p_name text, p_lat double precision, p_lng double precision, p_radius int default 75, p_note text default null) → uuid` (new place id).

- [ ] **Step 1: Write the migration**

```sql
-- 0034_event_hotspots.sql
-- Event hotspots: organizer-recommended places attached to an event; visits
-- are derived from location_checkins. See
-- docs/superpowers/specs/2026-09-30-event-hotspots-design.md.
-- FOUNDER-GATED: do not apply until the founder approves. Then, on QA only:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0034_event_hotspots.sql

create table if not exists event_hotspots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references locations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  note text check (note is null or char_length(note) <= 140),
  sort_order int not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint event_hotspots_unique unique (event_id, location_id),
  constraint event_hotspots_not_self check (event_id <> location_id)
);
create index if not exists event_hotspots_event_idx on event_hotspots(event_id);
create index if not exists event_hotspots_location_idx on event_hotspots(location_id);

alter table event_hotspots enable row level security;

drop policy if exists event_hotspots_select on event_hotspots;
create policy event_hotspots_select on event_hotspots for select to authenticated
  using (true);

drop policy if exists event_hotspots_write on event_hotspots;
create policy event_hotspots_write on event_hotspots for all to authenticated
  using (is_venue_manager(event_hotspots.event_id, auth.uid()))
  with check (is_venue_manager(event_hotspots.event_id, auth.uid()));

-- Reward unlock by distinct hotspots visited. Covered by rewards_write (0009).
alter table rewards add column if not exists min_hotspots int
  check (min_hotspots is null or min_hotspots > 0);

-- Organizer stats: distinct visitors per hotspot within the event window.
-- Aggregates only. Dates compared in UTC here (display-only counts); the
-- attendee-facing progress uses the browser's local day.
create or replace function public.hotspot_visit_counts(p_event_id uuid)
returns table (location_id uuid, visitors bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date;
  v_end date;
begin
  if not is_venue_manager(p_event_id, auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select l.event_date::date, coalesce(l.event_end_date, l.event_date)::date
    into v_start, v_end
    from locations l where l.id = p_event_id;
  return query
    select h.location_id, count(distinct lc.user_id)::bigint
    from event_hotspots h
    left join location_checkins lc
      on lc.location_id = h.location_id
     and (
       (v_start is not null and lc.checked_in_at::date between v_start and v_end)
       or (v_start is null and lc.checked_in_at >= h.created_at)
     )
    where h.event_id = p_event_id
    group by h.location_id;
end;
$$;
revoke all on function public.hotspot_visit_counts(uuid) from public;
grant execute on function public.hotspot_visit_counts(uuid) to authenticated;

-- Organizers can't insert into locations (0002: master admins only). This is
-- the one narrow path: create a place AND link it as a hotspot of an event
-- the caller manages. locations RLS is not loosened.
create or replace function public.create_hotspot_place(
  p_event_id uuid,
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_radius int default 75,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_place_id uuid;
  v_next int;
begin
  if not is_venue_manager(p_event_id, auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name required' using errcode = '22023';
  end if;
  if p_radius is null or p_radius < 10 or p_radius > 1000 then
    raise exception 'radius must be 10-1000m' using errcode = '22023';
  end if;
  insert into locations (name, lat, lng, geofence_radius_meters, owner_id, is_event)
    values (trim(p_name), p_lat, p_lng, p_radius, auth.uid(), false)
    returning id into v_place_id;
  select coalesce(max(sort_order) + 1, 0) into v_next
    from event_hotspots where event_id = p_event_id;
  insert into event_hotspots (event_id, location_id, note, sort_order, created_by)
    values (p_event_id, v_place_id, nullif(trim(p_note), ''), v_next, auth.uid());
  return v_place_id;
end;
$$;
revoke all on function public.create_hotspot_place(uuid, text, double precision, double precision, int, text) from public;
grant execute on function public.create_hotspot_place(uuid, text, double precision, double precision, int, text) to authenticated;
```

- [ ] **Step 2: Commit the file (do NOT apply it)**

```bash
git add supabase/migrations/0034_event_hotspots.sql
git commit -m "Hotspots: migration 0032 (not applied)"
```

- [ ] **Step 3: STOP — ask the founder to approve applying 0032 to QA.** Continue with Tasks 2–10 meanwhile (they compile without the DB); Task 11 needs it applied.

- [ ] **Step 4 (after approval only): Apply to QA and run RLS checks**

```bash
supabase link --project-ref ducadjakxmkfcvrteoqz
supabase db query --linked < supabase/migrations/0034_event_hotspots.sql
```

Then, as a non-manager test user on the QA app (token from `sb-ducadjakxmkfcvrteoqz-auth-token`, never the Zustand copy):
- insert into `event_hotspots` for an event they don't manage → expect an RLS error.
- `rpc('create_hotspot_place', { p_event_id: <not theirs>, ... })` → expect `not authorized`.
- `rpc('hotspot_visit_counts', { p_event_id: <not theirs> })` → expect `not authorized`.
As the event's organizer, the same three succeed.

---

### Task 2: Types + pure progress module (TDD)

**Files:**
- Modify: `lib/types.ts` (in/after `interface Reward`, ~line 139–154)
- Create: `lib/hotspotProgress.ts`
- Create: `lib/hotspotProgress.test.mts`
- Modify: `package.json` (`scripts`)

**Interfaces:**
- Produces:
  - `interface EventHotspot { id: string; event_id: string; location_id: string; note: string | null; sort_order: number; created_at: string; place: Venue | null }`
  - `interface HotspotCheckin { location_id: string; checked_in_at: string }`
  - `Reward.min_hotspots?: number | null`
  - `type EventWindow = { event_date?: string | null; event_end_date?: string | null }`
  - `interface HotspotProgress { visited: Set<string>; count: number; total: number; target: number; nextReward: Reward | null; unlocked: Reward[] }` (`visited` holds `location_id`s)
  - `localDay(iso: string): string` → `'YYYY-MM-DD'` in the runtime's local zone
  - `visitedHotspotIds(hotspots: EventHotspot[], checkins: HotspotCheckin[], window: EventWindow): Set<string>`
  - `computeHotspotProgress(input: { hotspots: EventHotspot[]; checkins: HotspotCheckin[]; window: EventWindow; rewards: Reward[] }): HotspotProgress`
  - `hotspotMeterFill(p: HotspotProgress): number` (0–1)

- [ ] **Step 1: Add types to `lib/types.ts`**

In `interface Reward`, after `min_checkins?: number | null;` add:

```ts
  // Event hotspots (0032): unlocks once the member has visited this many
  // distinct hotspots of the reward's event. Null = no hotspot requirement.
  min_hotspots?: number | null;
```

After the `Reward` interface add:

```ts
// Event hotspots (0032): an organizer-recommended place attached to an event.
export interface EventHotspot {
  id: string;
  event_id: string;
  location_id: string;
  note: string | null;
  sort_order: number;
  created_at: string;
  place: Venue | null;
}

export interface HotspotCheckin {
  location_id: string;
  checked_in_at: string;
}
```

- [ ] **Step 2: Add the test script to `package.json`**

In `"scripts"` add: `"test": "node --test lib/*.test.mts"`

- [ ] **Step 3: Write the failing tests** — `lib/hotspotProgress.test.mts`

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeHotspotProgress, localDay, hotspotMeterFill } from './hotspotProgress.ts';

const hs = (location_id: string, created_at = '2026-01-01T00:00:00Z') => ({
  id: `h-${location_id}`, event_id: 'ev', location_id, note: null, sort_order: 0, created_at, place: null,
});
// `local` has no zone suffix → parsed as local time, like a real device clock.
const ci = (location_id: string, local: string) => ({
  location_id, checked_in_at: new Date(local).toISOString(),
});
const reward = (id: string, min_hotspots: number | null, is_active = true) => ({
  id, location_id: 'ev', name: id, is_active, display_order: 0, min_hotspots,
});

const hotspots = [hs('a'), hs('b'), hs('c'), hs('d'), hs('e')];
const dated = { event_date: '2026-10-03', event_end_date: '2026-10-04' };

test('counts distinct hotspots inside the event window only', () => {
  const p = computeHotspotProgress({
    hotspots, window: dated, rewards: [],
    checkins: [
      ci('a', '2026-10-03T10:00:00'), ci('b', '2026-10-04T12:00:00'),
      ci('c', '2026-10-02T12:00:00'), ci('d', '2026-10-05T09:00:00'),
    ],
  });
  assert.deepEqual([...p.visited].sort(), ['a', 'b']);
  assert.equal(p.count, 2);
  assert.equal(p.total, 5);
});

test('late-night local check-in on the last day counts (local day, not UTC)', () => {
  const late = ci('a', '2026-10-04T23:30:00');
  assert.equal(localDay(late.checked_in_at), '2026-10-04');
  const p = computeHotspotProgress({ hotspots, window: dated, rewards: [], checkins: [late] });
  assert.equal(p.count, 1);
});

test('end date defaults to start date', () => {
  const p = computeHotspotProgress({
    hotspots, window: { event_date: '2026-10-03' }, rewards: [],
    checkins: [ci('a', '2026-10-03T10:00:00'), ci('b', '2026-10-04T10:00:00')],
  });
  assert.equal(p.count, 1);
});

test('duplicate check-ins at one hotspot count once', () => {
  const p = computeHotspotProgress({
    hotspots, window: dated, rewards: [],
    checkins: [ci('a', '2026-10-03T10:00:00'), ci('a', '2026-10-03T15:00:00')],
  });
  assert.equal(p.count, 1);
});

test('check-ins at places that are not hotspots are ignored', () => {
  const p = computeHotspotProgress({
    hotspots, window: dated, rewards: [], checkins: [ci('zzz', '2026-10-03T10:00:00')],
  });
  assert.equal(p.count, 0);
});

test('undated trail counts check-ins at/after the hotspot was added', () => {
  const trail = [hs('a', '2026-05-01T00:00:00Z'), hs('b', '2026-05-01T00:00:00Z')];
  const p = computeHotspotProgress({
    hotspots: trail, window: {}, rewards: [],
    checkins: [
      { location_id: 'a', checked_in_at: '2026-04-30T23:59:59Z' },
      { location_id: 'b', checked_in_at: '2026-05-02T10:00:00Z' },
    ],
  });
  assert.deepEqual([...p.visited], ['b']);
});

test('target is the smallest unreached active reward; unlocked lists reached ones', () => {
  const p = computeHotspotProgress({
    hotspots, window: dated,
    rewards: [reward('big', 5), reward('small', 2), reward('off', 1, false), reward('plain', null)],
    checkins: [ci('a', '2026-10-03T10:00:00'), ci('b', '2026-10-03T11:00:00'), ci('c', '2026-10-03T12:00:00')],
  });
  assert.equal(p.count, 3);
  assert.equal(p.target, 5);
  assert.equal(p.nextReward?.id, 'big');
  assert.deepEqual(p.unlocked.map((r) => r.id), ['small']);
});

test('no hotspot rewards → target is the number of hotspots', () => {
  const p = computeHotspotProgress({ hotspots, window: dated, rewards: [], checkins: [] });
  assert.equal(p.target, 5);
  assert.equal(p.nextReward, null);
  assert.equal(hotspotMeterFill(p), 0);
});

test('reward target above hotspot count stays locked and target shows it', () => {
  const p = computeHotspotProgress({
    hotspots, window: dated, rewards: [reward('impossible', 7)],
    checkins: hotspots.map((h) => ci(h.location_id, '2026-10-03T10:00:00')),
  });
  assert.equal(p.count, 5);
  assert.equal(p.target, 7);
  assert.deepEqual(p.unlocked, []);
  assert.ok(Math.abs(hotspotMeterFill(p) - 5 / 7) < 1e-9);
});

test('all rewards reached → target falls back to hotspot total', () => {
  const p = computeHotspotProgress({
    hotspots, window: dated, rewards: [reward('r', 2)],
    checkins: [ci('a', '2026-10-03T10:00:00'), ci('b', '2026-10-03T10:00:00'), ci('c', '2026-10-03T10:00:00')],
  });
  assert.equal(p.target, 5);
  assert.equal(p.nextReward, null);
  assert.deepEqual(p.unlocked.map((r) => r.id), ['r']);
});
```

- [ ] **Step 4: Run tests — expect failure**

Run: `npm test`
Expected: FAIL — cannot find module `.../lib/hotspotProgress.ts`.

- [ ] **Step 5: Implement `lib/hotspotProgress.ts`**

```ts
// Pure hotspot-progress math. Dependency-free on purpose (type-only imports)
// so `node --test` can run it directly. See
// docs/superpowers/specs/2026-09-30-event-hotspots-design.md → "Visit rule".
import type { EventHotspot, HotspotCheckin, Reward } from './types';

export type EventWindow = { event_date?: string | null; event_end_date?: string | null };

export interface HotspotProgress {
  visited: Set<string>; // location_ids of visited hotspots
  count: number;
  total: number;
  target: number;
  nextReward: Reward | null;
  unlocked: Reward[];
}

// Calendar day in the runtime's local time zone — a check-in at 11:30pm on
// the event's last day must count even though it's the next day in UTC.
export function localDay(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function visitedHotspotIds(
  hotspots: EventHotspot[],
  checkins: HotspotCheckin[],
  window: EventWindow
): Set<string> {
  const byPlace = new Map(hotspots.map((h) => [h.location_id, h]));
  const start = window.event_date ? window.event_date.slice(0, 10) : null;
  const end = start ? (window.event_end_date ?? window.event_date)!.slice(0, 10) : null;
  const visited = new Set<string>();
  for (const c of checkins) {
    const h = byPlace.get(c.location_id);
    if (!h) continue;
    if (start && end) {
      const day = localDay(c.checked_in_at);
      if (day >= start && day <= end) visited.add(h.location_id);
    } else if (new Date(c.checked_in_at).getTime() >= new Date(h.created_at).getTime()) {
      visited.add(h.location_id);
    }
  }
  return visited;
}

export function computeHotspotProgress(input: {
  hotspots: EventHotspot[];
  checkins: HotspotCheckin[];
  window: EventWindow;
  rewards: Reward[];
}): HotspotProgress {
  const visited = visitedHotspotIds(input.hotspots, input.checkins, input.window);
  const count = visited.size;
  const total = input.hotspots.length;
  const tiers = input.rewards
    .filter((r): r is Reward & { min_hotspots: number } => r.is_active && r.min_hotspots != null)
    .sort((a, b) => a.min_hotspots - b.min_hotspots);
  const unlocked = tiers.filter((r) => count >= r.min_hotspots);
  const nextReward = tiers.find((r) => count < r.min_hotspots) ?? null;
  const target = nextReward ? nextReward.min_hotspots : total;
  return { visited, count, total, target, nextReward, unlocked };
}

export function hotspotMeterFill(p: HotspotProgress): number {
  if (p.target <= 0) return 0;
  return Math.max(0, Math.min(1, p.count / p.target));
}
```

- [ ] **Step 6: Run tests — expect pass**

Run: `npm test`
Expected: `# pass 10`, `# fail 0`.

- [ ] **Step 7: Typecheck and commit**

Run: `npx tsc --noEmit -p .` → no output.

```bash
git add lib/types.ts lib/hotspotProgress.ts lib/hotspotProgress.test.mts package.json
git commit -m "Hotspots: progress math with node:test coverage"
```

---

### Task 3: Data module `lib/hotspots.ts`

**Files:**
- Create: `lib/hotspots.ts`
- Modify: `lib/data.ts:516-519` (`updateReward` field list)

**Interfaces:**
- Consumes: `EventHotspot`, `HotspotCheckin`, `Venue` (Task 2); `supabase` (`lib/supabase`), `getCurrentUserId` (`lib/auth`).
- Produces:
  - `fetchEventHotspots(eventId: string): Promise<EventHotspot[]>` (sorted by `sort_order`)
  - `fetchHotspotParents(locationId: string): Promise<Venue[]>`
  - `fetchActiveHotspots(todayLocal: string, includeEventId?: string | null): Promise<Array<EventHotspot & { event: Venue }>>`
  - `fetchMyCheckinsAt(locationIds: string[]): Promise<HotspotCheckin[]>`
  - `addHotspot(eventId: string, locationId: string, note?: string | null): Promise<void>`
  - `createHotspotPlace(eventId: string, p: { name: string; lat: number; lng: number; radius?: number; note?: string | null }): Promise<string>`
  - `updateHotspot(id: string, fields: Partial<Pick<EventHotspot, 'note' | 'sort_order'>>): Promise<void>`
  - `removeHotspot(id: string): Promise<void>`
  - `fetchHotspotVisitCounts(eventId: string): Promise<Record<string, number>>` (keyed by `location_id`)

- [ ] **Step 1: Write `lib/hotspots.ts`**

```ts
import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import type { EventHotspot, HotspotCheckin, Venue } from './types';

// event_hotspots has two FKs to locations, so embeds name the constraint.
const HOTSPOT_SELECT =
  'id, event_id, location_id, note, sort_order, created_at, place:locations!event_hotspots_location_id_fkey(*)';

export async function fetchEventHotspots(eventId: string): Promise<EventHotspot[]> {
  const { data, error } = await supabase
    .from('event_hotspots')
    .select(HOTSPOT_SELECT)
    .eq('event_id', eventId)
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as unknown as EventHotspot[];
}

export async function fetchHotspotParents(locationId: string): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('event_hotspots')
    .select('event:locations!event_hotspots_event_id_fkey(*)')
    .eq('location_id', locationId);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ event: Venue | null }>)
    .map((r) => r.event)
    .filter((e): e is Venue => !!e);
}

// Hotspots of events running on `todayLocal` ('YYYY-MM-DD'), plus every
// hotspot of `includeEventId` (the event you're checked in at) regardless of date.
export async function fetchActiveHotspots(
  todayLocal: string,
  includeEventId?: string | null
): Promise<Array<EventHotspot & { event: Venue }>> {
  const { data, error } = await supabase
    .from('event_hotspots')
    .select(`${HOTSPOT_SELECT}, event:locations!event_hotspots_event_id_fkey(*)`)
    .order('sort_order');
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<EventHotspot & { event: Venue | null }>;
  return rows.filter((r): r is EventHotspot & { event: Venue } => {
    if (!r.event || !r.place) return false;
    if (includeEventId && r.event_id === includeEventId) return true;
    const start = r.event.event_date?.slice(0, 10);
    if (!start) return false;
    const end = (r.event.event_end_date ?? r.event.event_date)!.slice(0, 10);
    return todayLocal >= start && todayLocal <= end;
  });
}

export async function fetchMyCheckinsAt(locationIds: string[]): Promise<HotspotCheckin[]> {
  if (locationIds.length === 0) return [];
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('location_checkins')
    .select('location_id, checked_in_at')
    .eq('user_id', uid)
    .in('location_id', locationIds);
  if (error) throw error;
  return (data ?? []) as HotspotCheckin[];
}

export async function addHotspot(eventId: string, locationId: string, note?: string | null): Promise<void> {
  const uid = await getCurrentUserId();
  const { data: last, error: lastError } = await supabase
    .from('event_hotspots')
    .select('sort_order')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (lastError) throw lastError;
  const next = last?.[0]?.sort_order != null ? last[0].sort_order + 1 : 0;
  const { error } = await supabase.from('event_hotspots').insert({
    event_id: eventId,
    location_id: locationId,
    note: note?.trim() || null,
    sort_order: next,
    created_by: uid,
  });
  if (error) throw error;
}

export async function createHotspotPlace(
  eventId: string,
  p: { name: string; lat: number; lng: number; radius?: number; note?: string | null }
): Promise<string> {
  const { data, error } = await supabase.rpc('create_hotspot_place', {
    p_event_id: eventId,
    p_name: p.name,
    p_lat: p.lat,
    p_lng: p.lng,
    p_radius: p.radius ?? 75,
    p_note: p.note ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function updateHotspot(
  id: string,
  fields: Partial<Pick<EventHotspot, 'note' | 'sort_order'>>
): Promise<void> {
  const { error } = await supabase.from('event_hotspots').update(fields).eq('id', id);
  if (error) throw error;
}

export async function removeHotspot(id: string): Promise<void> {
  const { error } = await supabase.from('event_hotspots').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchHotspotVisitCounts(eventId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('hotspot_visit_counts', { p_event_id: eventId });
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ location_id: string; visitors: number }>) {
    out[row.location_id] = Number(row.visitors);
  }
  return out;
}
```

- [ ] **Step 2: Allow `min_hotspots` in `updateReward`** — `lib/data.ts:518`

```ts
  fields: Partial<Pick<Reward, 'name' | 'deal_text' | 'instructions' | 'icon_type' | 'display_order' | 'is_active' | 'min_checkins' | 'min_hotspots'>>
```

- [ ] **Step 3: Typecheck, lint, commit**

Run: `npx tsc --noEmit -p . && npx eslint lib/hotspots.ts lib/data.ts` → no output.

```bash
git add lib/hotspots.ts lib/data.ts
git commit -m "Hotspots: data module"
```

---

### Task 4: `useEventHotspots` hook

**Files:**
- Create: `lib/hooks/useEventHotspots.ts`

**Interfaces:**
- Consumes: `fetchEventHotspots`, `fetchMyCheckinsAt` (Task 3); `fetchVenue`, `fetchRewards` (`lib/data.ts`); `computeHotspotProgress`, `HotspotProgress` (Task 2).
- Produces: `useEventHotspots(eventId: string | null | undefined): { hotspots: EventHotspot[]; progress: HotspotProgress | null; event: Venue | null; loading: boolean; error: boolean; reload: () => void }`. `progress` is `null` when the event has no hotspots.

- [ ] **Step 1: Write the hook**

```ts
'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchRewards, fetchVenue } from '@/lib/data';
import { fetchEventHotspots, fetchMyCheckinsAt } from '@/lib/hotspots';
import { computeHotspotProgress, type HotspotProgress } from '@/lib/hotspotProgress';
import type { EventHotspot, Venue } from '@/lib/types';

// One event's hotspots + the signed-in user's progress. `progress` stays null
// for events without hotspots so callers render exactly what they did before.
export function useEventHotspots(eventId: string | null | undefined) {
  const [hotspots, setHotspots] = useState<EventHotspot[]>([]);
  const [event, setEvent] = useState<Venue | null>(null);
  const [progress, setProgress] = useState<HotspotProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!eventId) {
      setHotspots([]); setEvent(null); setProgress(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const list = await fetchEventHotspots(eventId);
        if (cancelled) return;
        setHotspots(list);
        if (list.length === 0) { setProgress(null); return; }
        const [ev, rewards, checkins] = await Promise.all([
          fetchVenue(eventId),
          fetchRewards(eventId),
          fetchMyCheckinsAt(list.map((h) => h.location_id)),
        ]);
        if (cancelled) return;
        setEvent(ev);
        setProgress(computeHotspotProgress({ hotspots: list, checkins, window: ev, rewards }));
      } catch (e) {
        console.error('Failed to load hotspots:', e);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, nonce]);

  return { hotspots, progress, event, loading, error, reload };
}
```

- [ ] **Step 2: Typecheck, lint, commit**

Run: `npx tsc --noEmit -p . && npx eslint lib/hooks/useEventHotspots.ts` → no output.

```bash
git add lib/hooks/useEventHotspots.ts
git commit -m "Hotspots: useEventHotspots hook"
```

---

### Task 5: Hotspots card + activity meter (screen 3)

**Files:**
- Create: `components/hotspots/HotspotsCard.tsx`
- Modify: `components/home/ActivityMeterCard.tsx`
- Modify: `components/home/CheckedInHero.tsx`
- Modify (only if missing): `app/globals.css` (`.sr-only`)

**Interfaces:**
- Consumes: `useEventHotspots` (Task 4); `hotspotMeterFill`, `HotspotProgress` (Task 2).
- Produces: default `HotspotsCard({ hotspots, progress, loading, error, onRetry })`; named exports `Stamp({ on: boolean; size?: number })` and `HOTSPOT_ORANGE = '#FF7A45'`; `ActivityMeterCard` optional prop `hotspotMeter?: { value: number; label: string; rewardText: string | null }`.

- [ ] **Step 1: Write `components/hotspots/HotspotsCard.tsx`**

```tsx
'use client';

import { Check, Flame, RotateCw } from 'lucide-react';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import type { EventHotspot } from '@/lib/types';
import type { HotspotProgress } from '@/lib/hotspotProgress';

export const HOTSPOT_ORANGE = '#FF7A45';

export function Stamp({ on, size = 28 }: { on: boolean; size?: number }) {
  return (
    <span aria-hidden style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: on ? HOTSPOT_ORANGE : 'transparent',
      border: on ? 'none' : '1.5px dashed rgba(255,255,255,0.3)',
      color: on ? '#1a0a02' : 'rgba(255,255,255,0.35)',
    }}>
      {on ? <Check size={size * 0.55} strokeWidth={3} /> : <Flame size={size * 0.5} />}
    </span>
  );
}

// Screen 3: the event's hotspots in organizer order, stamped when visited.
export default function HotspotsCard({
  hotspots, progress, loading, error, onRetry,
}: {
  hotspots: EventHotspot[];
  progress: HotspotProgress | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  if (!error && (loading || hotspots.length === 0)) return null;

  return (
    <section aria-label="Hotspots" style={{
      backgroundColor: theme.surface, borderRadius: radius.card, border: `1px solid ${theme.divider}`,
      padding: 16, marginBottom: 20, fontFamily: typeTokens.family,
    }}>
      <p style={{ color: theme.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        Hotspots
      </p>
      {error ? (
        <button onClick={onRetry} style={{
          display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, background: 'none', border: 'none',
          color: theme.text, fontSize: 14, cursor: 'pointer', fontFamily: typeTokens.family, padding: 0,
        }}>
          <RotateCw size={16} aria-hidden /> Couldn&apos;t load hotspots. Try again
        </button>
      ) : (
        hotspots.map((h, i) => {
          const on = !!progress?.visited.has(h.location_id);
          return (
            <div key={h.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
              borderBottom: i < hotspots.length - 1 ? `1px solid ${theme.divider}` : 'none',
            }}>
              <Stamp on={on} />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: theme.text, fontWeight: 700, fontSize: 14 }}>{h.place?.name ?? 'Hotspot'}</div>
                {h.note && <div style={{ color: theme.muted, fontSize: 12 }}>{h.note}</div>}
              </div>
              <span className="sr-only">{on ? 'Visited' : 'Not visited yet'}</span>
            </div>
          );
        })
      )}
    </section>
  );
}
```

If `grep -n "\.sr-only" app/globals.css` finds nothing, append:

```css
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
```

- [ ] **Step 2: Extend `components/home/ActivityMeterCard.tsx`**

Replace the signature line with:

```tsx
export default function ActivityMeterCard({
  locationId,
  hotspotMeter,
}: {
  locationId: string;
  // Event hotspots: when set, the bar shows hotspot visits toward the
  // reward target instead of picks. Chips stay.
  hotspotMeter?: { value: number; label: string; rewardText: string | null };
}) {
```

Replace `if (!loaded || items.length === 0) return null;` with:

```tsx
  if (!loaded) return null;
  if (items.length === 0 && !hotspotMeter) return null;
```

Wrap the two `<p>` headings and the chips `<div>` in `{items.length > 0 && (<> … </>)}`. Replace the `<Meter value={meterFill(...)} label={...} />` line with:

```tsx
      {hotspotMeter ? (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6, fontSize: typeTokens.caption.fontSize }}>
            <span style={{ color: theme.text, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Flame size={14} color="#FF7A45" aria-hidden /> {hotspotMeter.label}
            </span>
            {hotspotMeter.rewardText && <span style={{ color: theme.muted }}>{hotspotMeter.rewardText}</span>}
          </div>
          <Meter value={hotspotMeter.value} />
        </div>
      ) : (
        <Meter value={meterFill(picked.size, ACTIVITY_TARGET)} label={`${picked.size} / ${ACTIVITY_TARGET} picked`} />
      )}
```

Add `import { Flame } from 'lucide-react';`.

- [ ] **Step 3: Wire into `components/home/CheckedInHero.tsx`**

Add imports:

```tsx
import HotspotsCard from '@/components/hotspots/HotspotsCard';
import { useEventHotspots } from '@/lib/hooks/useEventHotspots';
import { hotspotMeterFill } from '@/lib/hotspotProgress';
```

After `const { canManage } = useIsOrganizer(selectedLocation?.id);` add:

```tsx
  const eventHotspots = useEventHotspots(selectedLocation?.id);
  const reloadHotspots = eventHotspots.reload;
  const hp = eventHotspots.progress;
  const hotspotMeter = hp
    ? {
        value: hotspotMeterFill(hp),
        label: `${hp.count} / ${hp.target} hotspots`,
        rewardText: hp.nextReward ? `Visit ${hp.nextReward.min_hotspots} → ${hp.nextReward.name}` : null,
      }
    : undefined;
```

In the check-in effect, change `.then(() => setCheckedIn(true))` to `.then(() => { setCheckedIn(true); reloadHotspots(); })` and add `reloadHotspots` to that effect's dependency array.

Replace `{checkedIn && <ActivityMeterCard locationId={selectedLocation.id} />}` with:

```tsx
        {checkedIn && <ActivityMeterCard locationId={selectedLocation.id} hotspotMeter={hotspotMeter} />}
        <HotspotsCard
          hotspots={eventHotspots.hotspots}
          progress={hp}
          loading={eventHotspots.loading}
          error={eventHotspots.error}
          onRetry={reloadHotspots}
        />
```

- [ ] **Step 4: Typecheck, lint, commit**

Run: `npx tsc --noEmit -p . && npx eslint components/hotspots/HotspotsCard.tsx components/home/ActivityMeterCard.tsx components/home/CheckedInHero.tsx` → no output.

```bash
git add components/hotspots/HotspotsCard.tsx components/home/ActivityMeterCard.tsx components/home/CheckedInHero.tsx app/globals.css
git commit -m "Hotspots: event card and activity meter"
```

---

### Task 6: "Stamp collected" strip at a hotspot (screen 4)

**Files:**
- Create: `components/hotspots/HotspotStrip.tsx`
- Modify: `components/home/CheckedInHero.tsx`

**Interfaces:**
- Consumes: `fetchHotspotParents` (Task 3); `useEventHotspots` (Task 4); `hotspotMeterFill`, `localDay` (Task 2); `Stamp` (Task 5).
- Produces: default `HotspotStrip({ locationId: string; checkedIn: boolean; onOpenEvent: (event: Venue) => void })`.

- [ ] **Step 1: Write `components/hotspots/HotspotStrip.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { fetchHotspotParents } from '@/lib/hotspots';
import { useEventHotspots } from '@/lib/hooks/useEventHotspots';
import { hotspotMeterFill, localDay } from '@/lib/hotspotProgress';
import { theme, type as typeTokens } from '@/lib/theme';
import type { Venue } from '@/lib/types';
import { Stamp } from '@/components/hotspots/HotspotsCard';

// Prefer an event running today; else the first parent.
function pickParent(events: Venue[]): Venue | null {
  const today = localDay(new Date().toISOString());
  const running = events.find((e) => {
    const s = e.event_date?.slice(0, 10);
    if (!s) return false;
    const end = (e.event_end_date ?? e.event_date)!.slice(0, 10);
    return today >= s && today <= end;
  });
  return running ?? events[0] ?? null;
}

// Screen 4: shown on a venue that is a hotspot of some event.
export default function HotspotStrip({
  locationId, checkedIn, onOpenEvent,
}: { locationId: string; checkedIn: boolean; onOpenEvent: (event: Venue) => void }) {
  const [parent, setParent] = useState<Venue | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchHotspotParents(locationId)
      .then((events) => { if (!cancelled) setParent(pickParent(events)); })
      .catch((e) => console.error('Failed to load hotspot parents:', e));
    return () => { cancelled = true; };
  }, [locationId]);

  const { progress, reload } = useEventHotspots(parent?.id);
  useEffect(() => { if (checkedIn) reload(); }, [checkedIn, reload]);

  if (!parent || !progress) return null;
  const stamped = progress.visited.has(locationId);

  return (
    <button
      onClick={() => onOpenEvent(parent)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 56, textAlign: 'left',
        margin: '0 0 16px', padding: '10px 12px', borderRadius: 14, cursor: 'pointer',
        background: 'linear-gradient(90deg, rgba(255,122,69,0.2), rgba(255,61,127,0.15))',
        border: '1px solid rgba(255,122,69,0.5)', color: theme.text, fontFamily: typeTokens.family,
      }}
    >
      <Stamp on={stamped} size={34} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 14 }}>{stamped ? 'Stamp collected!' : 'Check in to collect a stamp'}</b>
        <span style={{ fontSize: 12 }}>Hotspot for {parent.name} · {progress.count} / {progress.target}</span>
        <span aria-hidden style={{ display: 'block', height: 6, borderRadius: 99, background: theme.surface2, marginTop: 6, overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${hotspotMeterFill(progress) * 100}%`, background: 'linear-gradient(90deg,#FF7A45,#FF3D7F)' }} />
        </span>
      </span>
      <ChevronRight size={18} aria-hidden />
    </button>
  );
}
```

- [ ] **Step 2: Mount in `CheckedInHero`**

Import `HotspotStrip` and `DEFAULT_RADIUS_METERS` from `@/lib/geo`. As the first child inside `<div style={{ padding: '16px 20px 0' }}>` insert:

```tsx
        <HotspotStrip
          locationId={selectedLocation.id}
          checkedIn={checkedIn}
          onOpenEvent={(ev) => {
            handleBack();
            setSelectedLocation({
              id: ev.id, name: ev.name, description: ev.description ?? '',
              latitude: ev.lat as number, longitude: ev.lng as number,
              radius: ev.geofence_radius_meters ?? DEFAULT_RADIUS_METERS, count: 0, category: 'venue', isHot: false,
              banner_image: ev.banner_image ?? null,
            });
          }}
        />
```

(`handleBack` checks out of the current place first — same as the hero's back button.)

- [ ] **Step 3: Typecheck, lint, commit**

Run: `npx tsc --noEmit -p . && npx eslint components/hotspots/HotspotStrip.tsx components/home/CheckedInHero.tsx` → no output.

```bash
git add components/hotspots/HotspotStrip.tsx components/home/CheckedInHero.tsx
git commit -m "Hotspots: stamp strip on hotspot venues"
```

---

### Task 7: Rewards panel unlocks by hotspots (screen 5)

**Files:**
- Modify: `components/home/RewardsPanel.tsx`

**Interfaces:**
- Consumes: `useEventHotspots` (Task 4); `Stamp` (Task 5).

- [ ] **Step 1: Load hotspot progress**

Add imports:

```tsx
import { useEventHotspots } from '@/lib/hooks/useEventHotspots';
import { Stamp } from '@/components/hotspots/HotspotsCard';
```

After the existing `useState` hooks add:

```tsx
  const { progress: hp } = useEventHotspots(selectedLocation?.id);
  const hotspotCount = hp?.count ?? 0;
```

- [ ] **Step 2: Extend the lock rule and hints**

Replace `const locked = reward.min_checkins != null && checkinCount < reward.min_checkins;` with:

```tsx
            const lockedByVisits = reward.min_checkins != null && checkinCount < reward.min_checkins;
            const lockedByHotspots = reward.min_hotspots != null && hotspotCount < reward.min_hotspots;
            const locked = lockedByVisits || lockedByHotspots;
```

Replace the existing `{locked && ( … Unlocks at {reward.min_checkins} visits … )}` element with the three blocks below. Copy the `style` object from the element you're replacing into `HINT` (declare `const HINT: React.CSSProperties = { …copied… };` at the top of the component) so the hints look identical:

```tsx
                {lockedByVisits && (
                  <p style={HINT}>Unlocks at {reward.min_checkins} visits ({checkinCount}/{reward.min_checkins})</p>
                )}
                {lockedByHotspots && (
                  <p style={HINT}>Visit {reward.min_hotspots} hotspots to unlock ({hotspotCount}/{reward.min_hotspots})</p>
                )}
                {!locked && reward.min_hotspots != null && hp && (
                  <div aria-label={`${hp.count} hotspot stamps`} style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                    {Array.from({ length: hp.count }).map((_, i) => <Stamp key={i} on size={22} />)}
                  </div>
                )}
```

- [ ] **Step 3: Typecheck, lint, commit**

Run: `npx tsc --noEmit -p . && npx eslint components/home/RewardsPanel.tsx` → no output.

```bash
git add components/home/RewardsPanel.tsx
git commit -m "Hotspots: rewards unlock by hotspot visits"
```

---

### Task 8: Map pins + pin sheet (screens 1–2)

**Files:**
- Create: `components/hotspots/HotspotPinSheet.tsx`
- Modify: `components/WMap.tsx`
- Modify: `components/tabs/MapTab.tsx`

**Interfaces:**
- Consumes: `fetchActiveHotspots`, `fetchMyCheckinsAt` (Task 3); `visitedHotspotIds`, `localDay` (Task 2); `Stamp`, `HOTSPOT_ORANGE` (Task 5).
- Produces: map location objects may carry `hotspot?: { stamped: boolean; eventName: string; note: string | null }`; default `HotspotPinSheet({ location, onClose, onCheckIn })`.

- [ ] **Step 1: Flame marker in `components/WMap.tsx`**

Below `createLocationIcon` add:

```ts
const createHotspotIcon = (stamped: boolean) => {
  const fill = stamped ? '#3ECF6B' : '#FF7A45';
  const glyph = stamped
    ? '<path d="M5 12l5 5L20 7" stroke="#0b1a0f" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    : '<path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 1 1-8 0c0-1.6.8-2.8 1.8-3.8.2 1.5 1 2.3 2 2.6C11.2 8 11 5.5 12 3z" fill="#1a0a02"/>';
  return L.divIcon({
    html: `<div style="width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${fill};border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4)"><svg width="18" height="18" viewBox="0 0 24 24" style="transform:rotate(45deg)">${glyph}</svg></div>`,
    className: 'w-hotspot-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });
};
```

In the marker effect's `locations.map((location) => { … })`, add as the first statement of the callback:

```ts
      if (location.hotspot) {
        const hotspotMarker = L.marker([location.latitude, location.longitude], {
          icon: createHotspotIcon(location.hotspot.stamped),
          title: location.name,
          keyboard: true,
        }).addTo(map);
        hotspotMarker.on('click', () => onLocationSelect(location));
        return hotspotMarker;
      }
```

Ensure `onLocationSelect` is in that effect's dependency array.

- [ ] **Step 2: Write `components/hotspots/HotspotPinSheet.tsx`**

```tsx
'use client';

import { Flame, Navigation, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { haversineMeters } from '@/lib/geo';
import { theme, type as typeTokens } from '@/lib/theme';
import { Stamp, HOTSPOT_ORANGE } from '@/components/hotspots/HotspotsCard';

export type HotspotMapLocation = {
  id: string; name: string; latitude: number; longitude: number; banner_image?: string | null;
  hotspot: { stamped: boolean; eventName: string; note: string | null };
};

// Screen 2: bottom sheet for a tapped hotspot pin.
export default function HotspotPinSheet({
  location, onClose, onCheckIn,
}: { location: HotspotMapLocation; onClose: () => void; onCheckIn: () => void }) {
  const { currentLocation, locationDenied } = useStore();
  const meters = currentLocation && !locationDenied
    ? haversineMeters(currentLocation.lat, currentLocation.lng, location.latitude, location.longitude)
    : null;
  const distance = meters == null ? null : meters < 1000 ? `${Math.round(meters)} m away` : `${(meters / 1000).toFixed(1)} km away`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;

  return (
    <div role="dialog" aria-label={location.name} style={{
      position: 'fixed', left: 0, right: 0, bottom: 'calc(64px + env(safe-area-inset-bottom))', zIndex: 1200,
      backgroundColor: theme.surface, borderRadius: '20px 20px 0 0', padding: 16,
      borderTop: `1px solid ${theme.glassHighlight}`, fontFamily: typeTokens.family, color: theme.text,
    }}>
      <button onClick={onClose} aria-label="Close" style={{
        position: 'absolute', top: 8, right: 8, width: 44, height: 44, border: 'none', background: 'none',
        color: theme.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><X size={20} /></button>
      <div style={{
        height: 88, borderRadius: 12, marginBottom: 12, display: 'flex', alignItems: 'flex-end', padding: 10,
        backgroundImage: location.banner_image
          ? `linear-gradient(rgba(0,0,0,.2),rgba(0,0,0,.5)), url(${location.banner_image})`
          : `linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
      }}>
        <b style={{ fontSize: 16, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>{location.name}</b>
      </div>
      <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px', fontSize: 13 }}>
        <Flame size={16} color={HOTSPOT_ORANGE} aria-hidden /> Hotspot for <b>{location.hotspot.eventName}</b>
      </p>
      {location.hotspot.note && <p style={{ margin: '0 0 8px', fontSize: 14 }}>&ldquo;{location.hotspot.note}&rdquo;</p>}
      <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px', fontSize: 12, color: theme.muted }}>
        <Stamp on={location.hotspot.stamped} size={20} />
        {location.hotspot.stamped ? 'Stamped' : 'Not stamped yet'}{distance ? ` · ${distance}` : ''}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCheckIn} style={{
          flex: 1, minHeight: 44, borderRadius: 12, border: 'none', backgroundColor: theme.accent, color: theme.onAccent,
          fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: typeTokens.family,
        }}>Check in</button>
        <a href={directions} target="_blank" rel="noopener noreferrer" style={{
          flex: 1, minHeight: 44, borderRadius: 12, border: `1px solid ${theme.glassHighlight}`, color: theme.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600, fontSize: 14, textDecoration: 'none',
        }}><Navigation size={16} aria-hidden /> Directions</a>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Load hotspots in `components/tabs/MapTab.tsx`**

Add imports:

```tsx
import { fetchActiveHotspots, fetchMyCheckinsAt } from '@/lib/hotspots';
import { visitedHotspotIds, localDay } from '@/lib/hotspotProgress';
import HotspotPinSheet from '@/components/hotspots/HotspotPinSheet';
```

Make sure `selectedLocation` is in the `useStore()` destructure. After the existing venue-loading effect add:

```tsx
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- map locations are untyped here, like nearbyLocations
  const [hotspotPins, setHotspotPins] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [hotspotSheet, setHotspotSheet] = useState<any | null>(null);

  useEffect(() => {
    let cancelled = false;
    const today = localDay(new Date().toISOString());
    fetchActiveHotspots(today, selectedLocation?.id ?? null)
      .then(async (rows) => {
        const checkins = await fetchMyCheckinsAt([...new Set(rows.map((r) => r.location_id))]);
        const byEvent = new Map<string, typeof rows>();
        for (const r of rows) byEvent.set(r.event_id, [...(byEvent.get(r.event_id) ?? []), r]);
        const pins = rows.map((r) => {
          const visited = visitedHotspotIds(byEvent.get(r.event_id)!, checkins, r.event);
          return {
            id: r.place!.id, name: r.place!.name, description: r.place!.description ?? '',
            latitude: r.place!.lat as number, longitude: r.place!.lng as number,
            radius: r.place!.geofence_radius_meters ?? 50, count: 0, category: 'venue', isHot: false,
            banner_image: r.place!.banner_image ?? null,
            hotspot: { stamped: visited.has(r.location_id), eventName: r.event.name, note: r.note },
          };
        });
        if (!cancelled) setHotspotPins(pins);
      })
      .catch((err) => console.error('Failed to load hotspots:', err));
    return () => { cancelled = true; };
  }, [selectedLocation?.id]);

  const mapLocations = useMemo(() => {
    const hotspotIds = new Set(hotspotPins.map((p) => p.id));
    return [...filteredLocations.filter((l) => !hotspotIds.has(l.id)), ...hotspotPins];
  }, [filteredLocations, hotspotPins]);
```

Change `<WMap locations={filteredLocations}` to `<WMap locations={mapLocations}`.

Replace `handleLocationSelect` with:

```tsx
  const handleLocationSelect = useCallback((location: any) => {
    if (location.hotspot) { setHotspotSheet(location); return; }
    setSelectedLocation(location);
    setActiveTab('home');
  }, [setSelectedLocation, setActiveTab]);
```

Before the component's closing root `</div>` add:

```tsx
      {hotspotPins.length > 0 && (
        <div style={{
          position: 'absolute', bottom: 'calc(80px + env(safe-area-inset-bottom))', left: 12, zIndex: 1000,
          display: 'flex', gap: 10, alignItems: 'center', padding: '6px 10px', borderRadius: 10,
          backgroundColor: 'rgba(12,12,14,0.9)', color: '#F5F5F7', fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: 12,
        }}>
          <span style={{ color: '#FF7A45' }} aria-hidden>●</span> Hotspot
          <span style={{ color: '#3ECF6B' }} aria-hidden>●</span> Stamped
        </div>
      )}
      {hotspotSheet && (
        <HotspotPinSheet
          location={hotspotSheet}
          onClose={() => setHotspotSheet(null)}
          onCheckIn={() => {
            const { hotspot: _hotspot, ...place } = hotspotSheet;
            setHotspotSheet(null);
            setSelectedLocation(place);
            setActiveTab('home');
          }}
        />
      )}
```

(If the location-denied notice already sits at `bottom: 96px`, move the legend to `bottom: calc(150px + env(safe-area-inset-bottom))` when `locationDenied` is true so they don't overlap.)

- [ ] **Step 4: Typecheck, lint, commit**

Run: `npx tsc --noEmit -p . && npx eslint components/WMap.tsx components/tabs/MapTab.tsx components/hotspots/HotspotPinSheet.tsx` → no output.

```bash
git add components/WMap.tsx components/tabs/MapTab.tsx components/hotspots/HotspotPinSheet.tsx
git commit -m "Hotspots: flame pins and pin sheet on the map"
```

---

### Task 9: Organizer Hotspots page (screens 6–7) + hub link

**Files:**
- Create: `app/main/venue/hotspots/page.tsx`
- Modify: `app/main/organizer/page.tsx` (`TOOLS`, ~line 57)

**Interfaces:**
- Consumes: `fetchEventHotspots`, `addHotspot`, `createHotspotPlace`, `updateHotspot`, `removeHotspot`, `fetchHotspotVisitCounts` (Task 3); `fetchVenue`, `fetchVenues`, `fetchRewards` (`lib/data.ts`); `useIsOrganizer(locationId)` → `{ canManage }`; `WMap` (Task 8 flame variant).

- [ ] **Step 1: Hub link** — in `TOOLS`, after the `Zones` entry:

```tsx
  { label: 'Hotspots', icon: Flame, href: (id) => `/main/venue/hotspots?locationId=${id}` },
```

Add `Flame` to that file's `lucide-react` import.

- [ ] **Step 2: Write `app/main/venue/hotspots/page.tsx`**

Check how `MapTab.tsx` imports `WMap` (`grep -n "WMap" components/tabs/MapTab.tsx`) and use the same import style (Leaflet needs a client-only import; if MapTab uses `next/dynamic` with `ssr: false`, do the same here).

```tsx
'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronUp, ChevronDown, X, Search, MapPinPlus } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { fetchVenue, fetchVenues, fetchRewards } from '@/lib/data';
import {
  fetchEventHotspots, addHotspot, createHotspotPlace, updateHotspot, removeHotspot, fetchHotspotVisitCounts,
} from '@/lib/hotspots';
import { theme } from '@/lib/theme';
import type { EventHotspot, Venue } from '@/lib/types';

const WMap = dynamic(() => import('@/components/WMap'), { ssr: false });
const FONT = 'Montserrat, system-ui, sans-serif';
const inputStyle: React.CSSProperties = {
  backgroundColor: theme.pill, border: 'none', borderRadius: 10, padding: '10px 14px', minHeight: 44,
  fontSize: 14, color: theme.text, fontFamily: FONT, width: '100%', boxSizing: 'border-box',
};
const iconBtn: React.CSSProperties = {
  width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'none', border: 'none', color: theme.muted, cursor: 'pointer',
};

export default function VenueHotspotsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', backgroundColor: theme.bg }} />}>
      <VenueHotspotsInner />
    </Suspense>
  );
}

function VenueHotspotsInner() {
  const router = useRouter();
  const eventId = useSearchParams().get('locationId');
  const { canManage } = useIsOrganizer(eventId);

  const [event, setEvent] = useState<Venue | null>(null);
  const [hotspots, setHotspots] = useState<EventHotspot[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [maxRewardTarget, setMaxRewardTarget] = useState<number | null>(null);
  const [allVenues, setAllVenues] = useState<Venue[]>([]);
  const [mode, setMode] = useState<'none' | 'search' | 'new'>('none');
  const [query, setQuery] = useState('');
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newRadius, setNewRadius] = useState('75');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!eventId) return;
    Promise.all([fetchVenue(eventId), fetchEventHotspots(eventId), fetchRewards(eventId)])
      .then(([ev, list, rewards]) => {
        setEvent(ev);
        setHotspots(list);
        const targets = rewards.map((r) => r.min_hotspots).filter((n): n is number => n != null);
        setMaxRewardTarget(targets.length ? Math.max(...targets) : null);
      })
      .catch((e) => { console.error(e); setError("Couldn't load hotspots — try again"); });
    fetchHotspotVisitCounts(eventId).then(setCounts).catch((e) => console.error(e));
  }, [eventId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (mode === 'search' && allVenues.length === 0) fetchVenues().then(setAllVenues).catch(console.error);
  }, [mode, allVenues.length]);

  const taken = useMemo(() => new Set([eventId, ...hotspots.map((h) => h.location_id)]), [eventId, hotspots]);
  const results = allVenues
    .filter((v) => !taken.has(v.id) && !v.is_event && v.lat != null)
    .filter((v) => v.name.toLowerCase().includes(query.trim().toLowerCase()))
    .slice(0, 20);

  const run = (p: Promise<unknown>, msg: string) => {
    setBusy(true); setError(null);
    return p.then(load).catch((e) => { console.error(e); setError(msg); }).finally(() => setBusy(false));
  };

  // Swap positions i and i+dir; rewrite both to their index so equal
  // sort_orders (e.g. both 0) still reorder.
  const move = (i: number, dir: -1 | 1) => {
    const a = hotspots[i], b = hotspots[i + dir];
    if (!a || !b) return;
    run(Promise.all([updateHotspot(a.id, { sort_order: i + dir }), updateHotspot(b.id, { sort_order: i })]),
      "Couldn't reorder — try again");
  };

  const saveNew = () => {
    if (!eventId || !pin || !newName.trim()) { setError('Drop a pin and add a name'); return; }
    const radius = parseInt(newRadius, 10);
    run(
      createHotspotPlace(eventId, { name: newName, lat: pin.lat, lng: pin.lng, radius: Number.isNaN(radius) ? 75 : radius, note: newNote }),
      "Couldn't add hotspot — try again"
    ).then(() => { setMode('none'); setPin(null); setNewName(''); setNewNote(''); setNewRadius('75'); });
  };

  if (!eventId) return null;
  if (!canManage) {
    return <p style={{ padding: 24, color: theme.muted, fontFamily: FONT }}>Only this event&apos;s organizers can manage hotspots.</p>;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, fontFamily: FONT, paddingBottom: 40 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '8px 8px 8px 4px', borderBottom: `1px solid ${theme.divider}` }}>
        <button onClick={() => router.back()} aria-label="Back" style={iconBtn}><ChevronLeft size={22} color={theme.text} /></button>
        <b style={{ fontSize: 17 }}>Hotspots</b>
        <span style={{ marginLeft: 'auto', color: theme.muted, fontSize: 13, paddingRight: 8 }}>{event?.name}</span>
      </header>

      <div style={{ display: 'flex', gap: 8, padding: 16 }}>
        <button onClick={() => setMode(mode === 'search' ? 'none' : 'search')} aria-expanded={mode === 'search'} style={{
          flex: 1, minHeight: 44, borderRadius: 12, border: 'none', backgroundColor: theme.accent, color: theme.onAccent,
          fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: FONT,
        }}><Search size={16} aria-hidden /> Add place</button>
        <button onClick={() => setMode(mode === 'new' ? 'none' : 'new')} aria-expanded={mode === 'new'} style={{
          flex: 1, minHeight: 44, borderRadius: 12, border: `1px solid ${theme.glassHighlight}`, background: 'none', color: theme.text,
          fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', fontFamily: FONT,
        }}><MapPinPlus size={16} aria-hidden /> New place</button>
      </div>

      {error && <p role="alert" style={{ color: theme.accent2, margin: '0 16px 12px', fontSize: 13 }}>{error}</p>}

      {mode === 'search' && (
        <div style={{ margin: '0 16px 16px' }}>
          <input autoFocus type="search" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Venue name" aria-label="Search venues" style={inputStyle} />
          {results.length === 0 ? (
            <p style={{ color: theme.muted, fontSize: 13, marginTop: 8 }}>No matching places. Try New place instead.</p>
          ) : results.map((v) => (
            <button key={v.id} disabled={busy}
              onClick={() => run(addHotspot(eventId, v.id), "Couldn't add hotspot — try again").then(() => setMode('none'))}
              style={{ display: 'block', width: '100%', minHeight: 44, textAlign: 'left', marginTop: 6, padding: '10px 14px',
                borderRadius: 10, border: `1px solid ${theme.divider}`, backgroundColor: theme.surface, color: theme.text, cursor: 'pointer', fontFamily: FONT }}>
              {v.name}{v.city ? ` — ${v.city}` : ''}
            </button>
          ))}
        </div>
      )}

      {mode === 'new' && (
        <div style={{ margin: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ height: 220, borderRadius: 12, overflow: 'hidden' }}>
            <WMap
              locations={pin ? [{
                id: 'new', name: newName || 'New hotspot', description: '', latitude: pin.lat, longitude: pin.lng,
                radius: Number(newRadius) || 75, count: 0, isHot: false,
                hotspot: { stamped: false, eventName: event?.name ?? '', note: null },
              }] : []}
              onLocationSelect={() => {}}
              onMapClick={(lat, lng) => setPin({ lat, lng })}
              center={pin ?? (event?.lat ? { lat: event.lat, lng: event.lng as number } : undefined)}
              zoom={16}
            />
          </div>
          <p style={{ color: theme.muted, fontSize: 12, margin: 0 }}>{pin ? 'Pin dropped. Tap the map to move it.' : 'Tap the map to drop a pin.'}</p>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Place name" aria-label="Place name" style={inputStyle} />
          <input value={newNote} maxLength={140} onChange={(e) => setNewNote(e.target.value)} placeholder="Why go? (optional)" aria-label="Why go" style={inputStyle} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: theme.muted }}>
            Check-in radius (m)
            <input type="number" min={10} max={1000} value={newRadius} onChange={(e) => setNewRadius(e.target.value)} style={{ ...inputStyle, width: 90 }} />
          </label>
          <button onClick={saveNew} disabled={busy} style={{
            minHeight: 44, borderRadius: 12, border: 'none', backgroundColor: theme.accent, color: theme.onAccent,
            fontWeight: 700, cursor: 'pointer', fontFamily: FONT,
          }}>{busy ? 'Adding…' : 'Add hotspot'}</button>
        </div>
      )}

      {maxRewardTarget != null && maxRewardTarget > hotspots.length && (
        <p role="status" style={{ margin: '0 16px 12px', padding: '10px 12px', borderRadius: 10, backgroundColor: theme.surface2, fontSize: 13 }}>
          A reward needs {maxRewardTarget} hotspots but this event has {hotspots.length}. Add more or lower the reward target.
        </p>
      )}

      <section aria-label="This event's hotspots" style={{ margin: '0 16px', backgroundColor: theme.surface, borderRadius: 14, border: `1px solid ${theme.divider}` }}>
        {hotspots.length === 0 ? (
          <p style={{ padding: 16, color: theme.muted, fontSize: 14 }}>No hotspots yet. Add a place people should visit.</p>
        ) : hotspots.map((h, i) => (
          <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 4px 6px 0',
            borderBottom: i < hotspots.length - 1 ? `1px solid ${theme.divider}` : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <button aria-label={`Move ${h.place?.name ?? 'hotspot'} up`} disabled={busy || i === 0} onClick={() => move(i, -1)} style={iconBtn}><ChevronUp size={16} /></button>
              <button aria-label={`Move ${h.place?.name ?? 'hotspot'} down`} disabled={busy || i === hotspots.length - 1} onClick={() => move(i, 1)} style={iconBtn}><ChevronDown size={16} /></button>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b style={{ fontSize: 14 }}>{h.place?.name ?? 'Hotspot'}</b>
              <input defaultValue={h.note ?? ''} maxLength={140} placeholder="Why go? (optional)" aria-label={`Note for ${h.place?.name ?? 'hotspot'}`}
                onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== h.note) run(updateHotspot(h.id, { note: v }), "Couldn't save note — try again"); }}
                style={{ ...inputStyle, minHeight: 36, padding: '6px 10px', fontSize: 12, marginTop: 4 }} />
              <div style={{ color: theme.muted, fontSize: 12, marginTop: 4 }}>
                {counts[h.location_id] ?? 0} {(counts[h.location_id] ?? 0) === 1 ? 'person' : 'people'} visited
              </div>
            </div>
            <button aria-label={`Remove ${h.place?.name ?? 'hotspot'}`} disabled={busy}
              onClick={() => run(removeHotspot(h.id), "Couldn't remove — try again")} style={iconBtn}><X size={18} /></button>
          </div>
        ))}
      </section>
      <p style={{ margin: '10px 16px', color: theme.muted, fontSize: 12 }}>Counts only. You never see who visited.</p>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck, lint, commit**

Run: `npx tsc --noEmit -p . && npx eslint app/main/venue/hotspots/page.tsx app/main/organizer/page.tsx` → no output.

```bash
git add app/main/venue/hotspots/page.tsx app/main/organizer/page.tsx
git commit -m "Hotspots: organizer page and hub link"
```

---

### Task 10: "Hotspots to unlock" on the rewards page (screen 7)

**Files:**
- Modify: `app/main/venue/rewards/page.tsx` (edit-state type ~line 68; initializer ~122; `handleFieldBlur` ~186–199; fallback ~304; field block ~334–348)

**Interfaces:**
- Consumes: `fetchEventHotspots` (Task 3); `Reward.min_hotspots` (Task 2); `updateReward` accepting `min_hotspots` (Task 3).

- [ ] **Step 1: Carry `min_hotspots` through the edit state**

- ~line 68: the record value type becomes `{ name: string; deal_text: string; instructions: string; min_checkins: string; min_hotspots: string }`.
- ~line 122 (initializer): add `min_hotspots: r.min_hotspots != null ? String(r.min_hotspots) : '',`.
- ~line 304 (fallback object): add `min_hotspots: ''`.

- [ ] **Step 2: Save it in `handleFieldBlur`**

After `parsedMinCheckins` add:

```tsx
    const parsedMinHotspots = edited.min_hotspots.trim() === '' ? null : parseInt(edited.min_hotspots, 10);
    const minHotspots = parsedMinHotspots == null || Number.isNaN(parsedMinHotspots) || parsedMinHotspots < 1 ? null : parsedMinHotspots;
```

Add `min_hotspots: minHotspots,` to `nextFields`, and `&& (nextFields.min_hotspots ?? null) === (reward.min_hotspots ?? null)` to `unchanged`.

- [ ] **Step 3: Load the event's hotspot count**

Find the page's current-venue id variable (`grep -n "useState<string | null>" app/main/venue/rewards/page.tsx`; sibling pages call it `selectedVenueId`). Add, using that variable:

```tsx
  const [hotspotCount, setHotspotCount] = useState<number | null>(null);
  useEffect(() => {
    if (!selectedVenueId) return;
    fetchEventHotspots(selectedVenueId).then((l) => setHotspotCount(l.length)).catch(() => setHotspotCount(null));
  }, [selectedVenueId]);
```

Import `fetchEventHotspots` from `@/lib/hotspots`.

- [ ] **Step 4: Add the field directly under the "Visits to unlock" row**

```tsx
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <label htmlFor={`hs-${reward.id}`} style={{ color: theme.muted, fontSize: '12px', fontFamily: 'Montserrat, system-ui, sans-serif', whiteSpace: 'nowrap' }}>
                      Hotspots to unlock:
                    </label>
                    <input
                      id={`hs-${reward.id}`}
                      type="number"
                      min={1}
                      value={edited.min_hotspots}
                      onChange={(e) => setEditedFields((prev) => ({ ...prev, [reward.id]: { ...edited, min_hotspots: e.target.value } }))}
                      onBlur={() => handleFieldBlur(reward)}
                      disabled={isBusy}
                      placeholder="None"
                      style={{ ...inputStyle, width: '80px' }}
                    />
                  </div>
                  {hotspotCount != null && (
                    <p style={{ color: theme.muted, fontSize: '11px', margin: '0 0 10px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                      This event has {hotspotCount} {hotspotCount === 1 ? 'hotspot' : 'hotspots'}.
                      {Number(edited.min_hotspots) > hotspotCount ? ' That target is higher than the number of hotspots.' : ''}
                    </p>
                  )}
```

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npx tsc --noEmit -p . && npx eslint app/main/venue/rewards/page.tsx` → no output.

```bash
git add app/main/venue/rewards/page.tsx
git commit -m "Hotspots: reward unlock target field"
```

---

### Task 11: End-to-end verification on the QA preview

**Prerequisite:** Task 1 Step 4 done (founder approved; 0032 applied to QA).

- [ ] **Step 1: Push and open a PR** — `git push -u origin feature/event-hotspots`; `gh pr create --base main` with a summary, the founder-gated migration called out, and a screenshots section. Bind it with the ccd_pr tools.
- [ ] **Step 2: Organizer pass** on the Vercel preview (QA backend) at 375px: organizer hub → Hotspots; add an existing place; create a new place via pin (default 75 m); edit a note; reorder; on Rewards set "Hotspots to unlock" to 2; set it above the hotspot count and confirm both warnings (rewards page hint, hotspots page banner).
- [ ] **Step 3: Attendee pass**: Map shows flame pins and legend; tap a pin → sheet with note, distance, Check in, Directions; check in at a hotspot in range → "Stamp collected!" strip with count; open the event → Hotspots card shows the stamp and the meter reads "1 / 2 hotspots · Visit 2 → {reward}"; after the second hotspot the reward shows unlocked in Rewards with stamps.
- [ ] **Step 4: Regression**: an event with no hotspots looks exactly as before (no card; meter shows picks); Map with no active hotspots has no legend.
- [ ] **Step 5**: `npm test` passes; screenshot all 7 screens and attach them to the PR (founder approves visuals only with screens).

---

## Deferred (not in this plan)

- Flame marker on Home's venue pills (`components/home/NearbyBanner.tsx`) — that file is rewritten in open PR #20 (`feature/home-main-feed`); add the marker after #20 merges to avoid a conflict.
- Prod rollout of 0032 — founder go-ahead only.
