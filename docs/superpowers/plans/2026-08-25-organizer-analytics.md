# Organizer Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the organizer report (`app/main/venue/report/page.tsx`) with five new analytics: zone movement, cross-venue movement, attendance dwell time, message counts, and QR-scan/contact-method-choice breakdowns — all anonymized/aggregated, per `docs/superpowers/specs/2026-08-25-organizer-analytics-design.md`.

**Architecture:** New Supabase migrations (0011-0014) add `venue_zones`, `zone_position_fixes`, and `connections.contact_method_type`, plus `security definer` SQL functions that do all aggregation server-side so raw per-user data never crosses into an API response. `lib/data.ts` gets new fetch functions wrapping those RPCs/queries; the report page renders the results using its existing `SectionCard`/`StatTile` components. One task touches the sibling `w-app-ios` repo (Swift) since that's the only place `connections` rows are currently written.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Postgres + RLS), no client-side map/geo library beyond the browser's built-in `navigator.geolocation` (already used elsewhere in this codebase).

## Global Constraints

- This repo has no test framework (no jest/vitest, no `test` script in `package.json`) — every other feature in this codebase has been verified via `npx tsc --noEmit`, `npm run build`, and live click-through / direct SQL verification against the QA Supabase project, not unit tests. Follow that same convention here: each task's "test" steps are type-check + build + a concrete manual/SQL verification, not a fabricated test suite.
- Apply every migration to **QA only** (`supabase link --project-ref ducadjakxmkfcvrteoqz`, ref name `w-app-qa`). Do not touch prod (`yatixschvikugckkpfum`) — prod migrations in this project go through the founder's own terminal due to a permission classifier; that's a separate, later step, not part of this plan.
- Migration numbering continues from `0010_reward_tiers.sql` — new files start at `0011`.
- Every new RLS-writeable table/column follows the existing `is_venue_manager(location_id, auth.uid())` pattern from `supabase/migrations/0001_organizer_admin_rbac.sql` / `0009_rewards_management.sql` — never a bespoke auth check.
- No task may expose raw per-user location data (`zone_position_fixes` rows) through any client-facing query or API response — only through the aggregation RPCs defined in Task 3, which return counts/averages only.
- Match existing code style: inline `style={{ ... }}` objects (no CSS modules/Tailwind in this codebase's page components), `theme` object from `@/lib/theme` for all colors, `'Montserrat, system-ui, sans-serif'` font-family on every text element — copy this exactly, don't introduce a new styling approach.

---

## File Structure

- `supabase/migrations/0011_venue_zones.sql` — new: `venue_zones` table + RLS
- `supabase/migrations/0012_zone_position_fixes.sql` — new: `zone_position_fixes` table + RLS + `record_zone_position()` RPC
- `supabase/migrations/0013_analytics_functions.sql` — new: `fetch_zone_analytics()`, `fetch_cross_venue_movement()`, `fetch_message_stats()` SQL functions
- `supabase/migrations/0014_contact_method_type.sql` — new: `connections.contact_method_type` column + RLS
- `lib/types.ts` — modify: add `VenueZone`, `ZoneAnalytics`, `CrossVenueMovementEntry`, `MessageStats`, `ContactMethodBreakdownEntry`; extend `AttendanceStats`
- `lib/data.ts` — modify: add zone CRUD + all new fetch functions; extend `fetchAttendanceStats`/`fetchEngagementStats`
- `lib/hooks/useZoneTracking.ts` — new: the geolocation-watching hook
- `components/home/CheckedInHero.tsx` — modify: mount `useZoneTracking`
- `app/main/venue/zones/page.tsx` — new: organizer zone management screen
- `app/main/venue/report/page.tsx` — modify: render all five new analytics sections
- `/Users/sr/w-app-ios/The W App/QR Code/UserLinksVC.swift` — modify (sibling repo): capture `contact_method_type` on tap

---

### Task 1: Zone management schema + CRUD UI

**Files:**
- Create: `supabase/migrations/0011_venue_zones.sql`
- Create: `app/main/venue/zones/page.tsx`
- Modify: `lib/types.ts` (add `VenueZone`)
- Modify: `lib/data.ts` (add zone CRUD functions)

**Interfaces:**
- Produces: `VenueZone { id: string; location_id: string; name: string; center_lat: number; center_lng: number; created_by?: string | null; created_at: string }`
- Produces: `fetchVenueZones(locationId: string): Promise<VenueZone[]>`, `createVenueZone(locationId: string, fields: { name: string; center_lat: number; center_lng: number }): Promise<void>`, `updateVenueZone(id: string, fields: Partial<Pick<VenueZone, 'name' | 'center_lat' | 'center_lng'>>): Promise<void>`, `deleteVenueZone(id: string): Promise<void>`

- [ ] **Step 1: Write the migration**

```sql
-- 0011_venue_zones.sql
-- Organizer-defined zones within a venue (e.g. "Bar", "Dance Floor"), used
-- to attribute GPS position fixes to a zone for anonymized occupancy/flow
-- reporting. See docs/superpowers/specs/2026-08-25-organizer-analytics-design.md.
-- Run manually against w-app-qa:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0011_venue_zones.sql

create table if not exists venue_zones (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table venue_zones enable row level security;

drop policy if exists venue_zones_select on venue_zones;
create policy venue_zones_select on venue_zones for select to authenticated
  using (true);

drop policy if exists venue_zones_write on venue_zones;
create policy venue_zones_write on venue_zones for all to authenticated
  using (is_venue_manager(venue_zones.location_id, auth.uid()))
  with check (is_venue_manager(venue_zones.location_id, auth.uid()));
```

- [ ] **Step 2: Apply to QA and verify**

Run:
```bash
supabase link --project-ref ducadjakxmkfcvrteoqz
supabase db query --linked < supabase/migrations/0011_venue_zones.sql
echo "select exists(select 1 from information_schema.tables where table_name='venue_zones') as present;" | supabase db query --linked
```
Expected: `present: true`, no errors.

- [ ] **Step 3: Add the type**

In `lib/types.ts`, after the `Banner` interface (around line 139), add:

```ts
export interface VenueZone {
  id: string;
  location_id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  created_by?: string | null;
  created_at: string;
}
```

- [ ] **Step 4: Add the data functions**

In `lib/data.ts`, near the other venue-scoped CRUD functions (e.g. after `deleteReward`), add:

```ts
export async function fetchVenueZones(locationId: string): Promise<VenueZone[]> {
  const { data, error } = await supabase
    .from('venue_zones')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as VenueZone[];
}

export async function createVenueZone(
  locationId: string,
  fields: { name: string; center_lat: number; center_lng: number }
): Promise<void> {
  const { error } = await supabase
    .from('venue_zones')
    .insert({ location_id: locationId, ...fields });
  if (error) throw error;
}

export async function updateVenueZone(
  id: string,
  fields: Partial<Pick<VenueZone, 'name' | 'center_lat' | 'center_lng'>>
): Promise<void> {
  const { error } = await supabase.from('venue_zones').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteVenueZone(id: string): Promise<void> {
  const { error } = await supabase.from('venue_zones').delete().eq('id', id);
  if (error) throw error;
}
```

Add `VenueZone` to the `import type { ... } from './types'` block at the top of `lib/data.ts`.

- [ ] **Step 5: Build the management page**

Create `app/main/venue/zones/page.tsx`. Structurally mirror `app/main/venue/rewards/page.tsx` exactly (same `Suspense` wrapper, same venue-loading/`useIsOrganizer`/`VenueSwitcher` pattern, same `inputStyle` constant, same header bar) but:
- List items show `name`, `center_lat`, `center_lng` instead of reward fields.
- Instead of a free-form lat/lng input, use a single "Set to my current location" button that calls `navigator.geolocation.getCurrentPosition` (same pattern as `components/tabs/MapTab.tsx` lines ~64-70) and fills `center_lat`/`center_lng` from the result — organizers physically stand in the zone and tap the button, rather than dropping a pin on a map. This avoids adding a map-picker UI/library for a one-time-per-zone action.
- "Add zone" form: name text input + the location button + a "Save" button that's disabled until a location has been captured.
- Existing zones: edit name inline (same `onBlur`-saves pattern as rewards), a "Re-center here" button per zone (re-runs `getCurrentPosition` and calls `updateVenueZone`), and delete.
- Import `fetchVenueZones`, `createVenueZone`, `updateVenueZone`, `deleteVenueZone` from `@/lib/data` and `VenueZone` from `@/lib/types` in place of the rewards equivalents.

- [ ] **Step 6: Verify**

Run:
```bash
npx tsc --noEmit
npm run build
```
Expected: both clean, no type errors.

Then with the dev server running against QA: sign in as an organizer, visit `/main/venue/zones?locationId=<a QA venue id>`, create a zone using "Set to my current location," confirm it appears in the list, edit its name, delete it. Confirm in the browser console there are no errors.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0011_venue_zones.sql lib/types.ts lib/data.ts app/main/venue/zones/page.tsx
git commit -m "Add venue zone management (schema + organizer CRUD)"
```

---

### Task 2: Zone position capture (client hook + RPC)

**Files:**
- Create: `supabase/migrations/0012_zone_position_fixes.sql`
- Create: `lib/hooks/useZoneTracking.ts`
- Modify: `components/home/CheckedInHero.tsx`

**Interfaces:**
- Consumes: `VenueZone` (Task 1) — used only server-side inside the SQL function, not by the client hook.
- Produces: `useZoneTracking(locationId: string | null): void` — a hook with no return value; side-effect only.

- [ ] **Step 1: Write the migration**

```sql
-- 0012_zone_position_fixes.sql
-- Write-only raw GPS fixes, matched server-side to the nearest venue_zones
-- row. Never queried by client code directly — only by the aggregation
-- function in 0013, which also purges rows older than 48h. See design doc's
-- "Storage — write-only, short retention" section.

create table if not exists zone_position_fixes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  zone_id uuid not null references venue_zones(id),
  recorded_at timestamptz not null default now()
);

alter table zone_position_fixes enable row level security;

-- Insert-only, own rows. No select policy for regular users at all — the
-- table is readable only by security definer functions (0013), which run
-- as the function owner and bypass RLS.
drop policy if exists zone_position_fixes_insert on zone_position_fixes;
create policy zone_position_fixes_insert on zone_position_fixes for insert to authenticated
  with check (user_id = auth.uid());

-- Finds the nearest zone (straight-line distance on lat/lng, adequate at
-- building scale) for the given location and records a fix against it. A
-- location with no zones defined is a silent no-op — the client doesn't
-- need to know whether zones exist before calling this.
create or replace function record_zone_position(
  p_location_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  nearest_zone_id uuid;
begin
  select id into nearest_zone_id
  from venue_zones
  where location_id = p_location_id
  order by ((center_lat - p_lat) ^ 2 + (center_lng - p_lng) ^ 2) asc
  limit 1;

  if nearest_zone_id is not null then
    insert into zone_position_fixes (user_id, zone_id)
    values (auth.uid(), nearest_zone_id);
  end if;
end;
$$;

grant execute on function record_zone_position(uuid, double precision, double precision) to authenticated;
```

- [ ] **Step 2: Apply to QA and verify**

```bash
supabase db query --linked < supabase/migrations/0012_zone_position_fixes.sql
echo "select exists(select 1 from pg_proc where proname='record_zone_position') as present;" | supabase db query --linked
```
Expected: `present: true`.

- [ ] **Step 3: Write the tracking hook**

Create `lib/hooks/useZoneTracking.ts`:

```ts
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const MIN_INTERVAL_MS = 10_000;
const MIN_DISTANCE_METERS = 5;

// Haversine distance in meters — good enough at the scale this needs (tens
// of meters), no external geo library required.
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// While locationId is non-null, watches position and reports throttled
// fixes to record_zone_position(). Silently does nothing if geolocation is
// denied/unavailable — this is an analytics nice-to-have, never something
// that should block or interrupt the check-in flow itself.
export function useZoneTracking(locationId: string | null): void {
  const lastSentRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!locationId || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const now = Date.now();
        const last = lastSentRef.current;
        const elapsed = last ? now - last.at : Infinity;
        const moved = last ? distanceMeters(last.lat, last.lng, latitude, longitude) : Infinity;

        if (elapsed < MIN_INTERVAL_MS && moved < MIN_DISTANCE_METERS) return;

        lastSentRef.current = { lat: latitude, lng: longitude, at: now };
        supabase
          .rpc('record_zone_position', {
            p_location_id: locationId,
            p_lat: latitude,
            p_lng: longitude,
          })
          .then(({ error }) => {
            if (error) console.error('record_zone_position failed:', error);
          });
      },
      (err) => {
        // Permission denied / position unavailable / timeout — no UI
        // interruption, just stop trying for this session.
        console.warn('Zone tracking geolocation error:', err.message);
      },
      { enableHighAccuracy: false, maximumAge: 5000 }
    );
    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      lastSentRef.current = null;
    };
  }, [locationId]);
}
```

- [ ] **Step 4: Wire it into CheckedInHero**

In `components/home/CheckedInHero.tsx`, import `useZoneTracking` from `@/lib/hooks/useZoneTracking` and call it near the top of the component body (alongside the other hooks): `useZoneTracking(isCheckedIn ? selectedLocation?.id ?? null : null);` — using whatever the component's existing checked-in-state and selected-location variables are named (read the component first; the exact variable names come from the geofence-gating logic already there, around lines 45-110).

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npm run build
```
Expected: clean.

Manual check with dev server against QA: check in to a venue that has at least one zone (created in Task 1), grant location permission, wait ~10s, then run:
```bash
echo "select count(*) from zone_position_fixes;" | supabase db query --linked
```
Expected: count > 0. Check out, confirm no further rows accumulate (watch cleared).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0012_zone_position_fixes.sql lib/hooks/useZoneTracking.ts components/home/CheckedInHero.tsx
git commit -m "Add zone position capture: throttled geolocation hook + record_zone_position RPC"
```

---

### Task 3: Zone aggregation + report display

**Files:**
- Create: `supabase/migrations/0013_analytics_functions.sql` (this task only adds `fetch_zone_analytics`; the other two functions in this file are added by Tasks 4 and 6 — see note below)
- Modify: `lib/types.ts` (add `ZoneAnalytics`)
- Modify: `lib/data.ts` (add `fetchZoneAnalytics`)
- Modify: `app/main/venue/report/page.tsx`

**Interfaces:**
- Consumes: `venue_zones`, `zone_position_fixes` (Tasks 1-2)
- Produces: `ZoneAnalytics { occupancy: { zone_name: string; count: number }[]; avgDwellMinutes: { zone_name: string; minutes: number }[]; transitions: { from_zone: string; to_zone: string; count: number }[] }`, `fetchZoneAnalytics(locationId: string): Promise<ZoneAnalytics>`

Note on file layout: Tasks 3, 4, and 6 each add one SQL function to the same `0013_analytics_functions.sql` file, since they're small and conceptually one "analytics functions" migration — each task's Step 1 appends to the file rather than creating it fresh (Task 3 creates it, Tasks 4/6 append). This keeps them each independently reviewable/testable per their own `- [ ]` steps while landing in one migration file, matching how `0008_venue_group_chat.sql` bundled several related pieces.

- [ ] **Step 1: Write the migration (creates the file)**

```sql
-- 0013_analytics_functions.sql
-- Aggregation functions for the organizer report. Each function checks
-- is_venue_manager itself and raises if the caller isn't authorized —
-- these are called directly via .rpc(), not gated only by a calling page.

-- Occupancy/dwell/transitions, computed from zone_position_fixes over the
-- last 48h, then purges fixes older than 48h as a side effect (there is no
-- product need to retain raw fixes once rolled up — see design doc).
create or replace function fetch_zone_analytics(p_location_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  with recent_fixes as (
    select zpf.*, vz.name as zone_name
    from zone_position_fixes zpf
    join venue_zones vz on vz.id = zpf.zone_id
    where vz.location_id = p_location_id
      and zpf.recorded_at > now() - interval '48 hours'
  ),
  occupancy as (
    select zone_name, count(distinct user_id) as count
    from recent_fixes
    group by zone_name
  ),
  per_user_zone_span as (
    select user_id, zone_name,
           extract(epoch from (max(recorded_at) - min(recorded_at))) / 60 as minutes
    from recent_fixes
    group by user_id, zone_name
  ),
  dwell as (
    select zone_name, avg(minutes) as minutes
    from per_user_zone_span
    where minutes > 0
    group by zone_name
  ),
  ordered_fixes as (
    select user_id, zone_name, recorded_at,
           lag(zone_name) over (partition by user_id order by recorded_at) as prev_zone_name
    from recent_fixes
  ),
  transitions as (
    select prev_zone_name as from_zone, zone_name as to_zone, count(*) as count
    from ordered_fixes
    where prev_zone_name is not null and prev_zone_name <> zone_name
    group by prev_zone_name, zone_name
  )
  select jsonb_build_object(
    'occupancy', coalesce((select jsonb_agg(jsonb_build_object('zone_name', zone_name, 'count', count)) from occupancy), '[]'::jsonb),
    'avgDwellMinutes', coalesce((select jsonb_agg(jsonb_build_object('zone_name', zone_name, 'minutes', round(minutes::numeric, 1))) from dwell), '[]'::jsonb),
    'transitions', coalesce((select jsonb_agg(jsonb_build_object('from_zone', from_zone, 'to_zone', to_zone, 'count', count)) from transitions), '[]'::jsonb)
  ) into result;

  delete from zone_position_fixes where recorded_at < now() - interval '48 hours';

  return result;
end;
$$;

grant execute on function fetch_zone_analytics(uuid) to authenticated;
```

- [ ] **Step 2: Apply to QA and verify**

```bash
supabase db query --linked < supabase/migrations/0013_analytics_functions.sql
echo "select exists(select 1 from pg_proc where proname='fetch_zone_analytics') as present;" | supabase db query --linked
```
Expected: `present: true`.

- [ ] **Step 3: Add the type**

In `lib/types.ts`, in the "Organizer report" section (near `EngagementStats`), add:

```ts
export interface ZoneAnalytics {
  occupancy: { zone_name: string; count: number }[];
  avgDwellMinutes: { zone_name: string; minutes: number }[];
  transitions: { from_zone: string; to_zone: string; count: number }[];
}
```

- [ ] **Step 4: Add the data function**

In `lib/data.ts`, near `fetchEngagementStats`:

```ts
export async function fetchZoneAnalytics(locationId: string): Promise<ZoneAnalytics> {
  const { data, error } = await supabase.rpc('fetch_zone_analytics', { p_location_id: locationId });
  if (error) throw error;
  return (data ?? { occupancy: [], avgDwellMinutes: [], transitions: [] }) as ZoneAnalytics;
}
```

- [ ] **Step 5: Render it in the report**

In `app/main/venue/report/page.tsx`:
- Add `import { ZoneAnalytics } from '@/lib/types'` to the type import block, and `fetchZoneAnalytics` to the data import block.
- Add `const [zoneAnalytics, setZoneAnalytics] = useState<ZoneAnalytics | null>(null);` alongside the other report state (near line 109).
- Add `fetchZoneAnalytics(venue.id)` to the `Promise.all` array at line ~156-160, and destructure/set it in the `.then` at line ~162-166 (5th element).
- Add a new `<SectionCard title="Zone Movement">` block (using the existing `SectionCard`/`StatTile` components defined at lines 41-95) after the existing sections, rendering: one `StatTile` per `zoneAnalytics.occupancy` entry (label = zone name, value = count), a small list of `avgDwellMinutes` ("Bar: 12.4 min avg"), and a list of `transitions` ("Bar → Dance Floor: 42"). If `zoneAnalytics` is null or all three arrays are empty, render "No zone data yet — set up zones to start tracking movement." instead (matches the empty-state pattern already used for `sorted.length === 0` elsewhere in this codebase).

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npm run build
```
Then load `/main/venue/report?locationId=<the QA venue used in Task 2>` as an organizer and confirm the Zone Movement section renders real numbers (or the empty state if no fixes yet).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0013_analytics_functions.sql lib/types.ts lib/data.ts app/main/venue/report/page.tsx
git commit -m "Add zone analytics aggregation + report section"
```

---

### Task 4: Cross-venue movement

**Files:**
- Modify: `supabase/migrations/0013_analytics_functions.sql` (append)
- Modify: `lib/types.ts` (add `CrossVenueMovementEntry`)
- Modify: `lib/data.ts` (add `fetchCrossVenueMovement`)
- Modify: `app/main/venue/report/page.tsx`

**Interfaces:**
- Produces: `CrossVenueMovementEntry { location_id: string; venue_name: string; attendee_count: number; percentage: number }`, `fetchCrossVenueMovement(locationId: string): Promise<CrossVenueMovementEntry[]>`

**Decision resolving the spec's open item:** a 12-hour rolling window from each attendee's check-in at the reference venue (not "same calendar night," which needs timezone handling this app doesn't otherwise do) — simplest thing that captures "same night out."

- [ ] **Step 1: Append the SQL function**

Append to `supabase/migrations/0013_analytics_functions.sql`:

```sql
-- What % of this venue's attendees also checked into which other venues
-- within +/- 12h of their check-in here. A rolling window, not "same
-- calendar day," to avoid timezone handling this app doesn't otherwise do.
create or replace function fetch_cross_venue_movement(p_location_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  total_attendees int;
begin
  if not is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  select count(distinct user_id) into total_attendees
  from location_checkins
  where location_id = p_location_id;

  if total_attendees = 0 then
    return '[]'::jsonb;
  end if;

  with reference_checkins as (
    select user_id, checked_in_at
    from location_checkins
    where location_id = p_location_id
  ),
  other_visits as (
    select distinct lc.location_id, rc.user_id
    from reference_checkins rc
    join location_checkins lc
      on lc.user_id = rc.user_id
     and lc.location_id <> p_location_id
     and lc.checked_in_at between rc.checked_in_at - interval '12 hours' and rc.checked_in_at + interval '12 hours'
  ),
  counted as (
    select location_id, count(*) as attendee_count
    from other_visits
    group by location_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'location_id', c.location_id,
    'venue_name', l.name,
    'attendee_count', c.attendee_count,
    'percentage', round((c.attendee_count::numeric / total_attendees) * 100, 1)
  ) order by c.attendee_count desc), '[]'::jsonb)
  into result
  from counted c
  join locations l on l.id = c.location_id;

  return result;
end;
$$;

grant execute on function fetch_cross_venue_movement(uuid) to authenticated;
```

- [ ] **Step 2: Apply to QA and verify**

```bash
supabase db query --linked < supabase/migrations/0013_analytics_functions.sql
echo "select exists(select 1 from pg_proc where proname='fetch_cross_venue_movement') as present;" | supabase db query --linked
```
Expected: `present: true`. (This re-runs the whole file — every `create or replace function` in it is idempotent, so re-applying after Task 3 is safe.)

- [ ] **Step 3: Add the type**

In `lib/types.ts`:

```ts
export interface CrossVenueMovementEntry {
  location_id: string;
  venue_name: string;
  attendee_count: number;
  percentage: number;
}
```

- [ ] **Step 4: Add the data function**

In `lib/data.ts`:

```ts
export async function fetchCrossVenueMovement(locationId: string): Promise<CrossVenueMovementEntry[]> {
  const { data, error } = await supabase.rpc('fetch_cross_venue_movement', { p_location_id: locationId });
  if (error) throw error;
  return (data ?? []) as CrossVenueMovementEntry[];
}
```

- [ ] **Step 5: Render it in the report**

Same pattern as Task 3 Step 5: add state, add to the `Promise.all`, add a `<SectionCard title="Cross-Venue Movement">` rendering a ranked list — "`venue_name` — `percentage`% (`attendee_count` attendees)" per entry, sorted as returned (already ordered by the SQL). Empty state: "No cross-venue data yet."

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npm run build
```
Manual: check the same test user into two different QA venues within a few minutes of each other, reload the first venue's report, confirm the second venue appears with a nonzero percentage.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0013_analytics_functions.sql lib/types.ts lib/data.ts app/main/venue/report/page.tsx
git commit -m "Add cross-venue movement analytics"
```

---

### Task 5: Attendance dwell time

**Files:**
- Modify: `lib/types.ts` (extend `AttendanceStats`)
- Modify: `lib/data.ts` (extend `fetchAttendanceStats`, lines 1083-1105)
- Modify: `app/main/venue/report/page.tsx`

**Interfaces:**
- Produces: `AttendanceStats` gains `avgDwellMinutes: number` (0 if no completed visits yet)

- [ ] **Step 1: Extend the type**

In `lib/types.ts`, change:
```ts
export interface AttendanceStats {
  totalCheckins: number;
  uniqueAttendees: number;
  checkinsByHour: { hour: string; count: number }[];
}
```
to:
```ts
export interface AttendanceStats {
  totalCheckins: number;
  uniqueAttendees: number;
  checkinsByHour: { hour: string; count: number }[];
  avgDwellMinutes: number;
}
```

- [ ] **Step 2: Extend the function**

In `lib/data.ts`, replace the `fetchAttendanceStats` function (lines 1083-1105):

```ts
export async function fetchAttendanceStats(locationId: string): Promise<AttendanceStats> {
  const { data, error } = await supabase
    .from('location_checkins')
    .select('user_id, checked_in_at, checked_out_at')
    .eq('location_id', locationId);
  if (error) throw error;

  const rows = data ?? [];
  const totalCheckins = rows.length;
  const uniqueAttendees = new Set(rows.map((r) => r.user_id)).size;

  const hourCounts = new Array(24).fill(0);
  const dwellMinutes: number[] = [];
  for (const row of rows) {
    if (!row.checked_in_at) continue;
    hourCounts[new Date(row.checked_in_at).getHours()] += 1;
    if (row.checked_out_at) {
      const minutes = (new Date(row.checked_out_at).getTime() - new Date(row.checked_in_at).getTime()) / 60000;
      if (minutes > 0) dwellMinutes.push(minutes);
    }
  }
  const checkinsByHour = hourCounts.map((count, hour) => ({
    hour: HOUR_LABEL_FORMATTER.format(new Date(2000, 0, 1, hour)),
    count,
  }));
  const avgDwellMinutes =
    dwellMinutes.length > 0 ? Math.round((dwellMinutes.reduce((a, b) => a + b, 0) / dwellMinutes.length) * 10) / 10 : 0;

  return { totalCheckins, uniqueAttendees, checkinsByHour, avgDwellMinutes };
}
```

- [ ] **Step 3: Render it in the report**

In `app/main/venue/report/page.tsx`, in the existing attendance `SectionCard` (where `totalCheckins`/`uniqueAttendees` already render as `StatTile`s), add one more: `<StatTile label="Avg. time spent" value={`${attendance.avgDwellMinutes} min`} />`.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npm run build
```
Manual: check a QA test user in and out of a venue (leaving a real `checked_out_at`), reload the report, confirm "Avg. time spent" shows a nonzero number matching the actual elapsed time.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/data.ts app/main/venue/report/page.tsx
git commit -m "Add average dwell time to attendance stats"
```

---

### Task 6: Message counts (group + approximate DM)

**Files:**
- Modify: `supabase/migrations/0013_analytics_functions.sql` (append)
- Modify: `lib/types.ts` (add `MessageStats`, or extend `EngagementStats` — see below)
- Modify: `lib/data.ts` (replace `fetchEngagementStats`, lines 1148-1156)
- Modify: `app/main/venue/report/page.tsx`

**Design correction from the spec:** the design doc described "DM vs. group volume attributable to the venue" via `conversations.location_id` for both — but `location_id` is only ever set on a venue's *own persistent group chat* (Task 2's schema enforces at most one per venue via a unique index), never on a DM. There is no way to attribute a DM to "the venue it started from" with the current schema — two people can DM regardless of location. The achievable, honest proxy: **DM conversations between two users who have both, at some point, checked in to this venue.** This is an approximation (they may have met elsewhere), and the report UI must label it as such.

**Interfaces:**
- Produces: `EngagementStats` gains `dmMessagesApprox: number` (in addition to the existing `groupsCreated`/`groupMessagesSent`, which go from hardcoded `0` to real counts)

- [ ] **Step 1: Append the SQL function**

Append to `supabase/migrations/0013_analytics_functions.sql`:

```sql
-- DM message count is an approximation: DMs between two users who have
-- both checked in to this venue at some point (DMs carry no location_id —
-- they aren't venue-scoped by nature). Group message count is exact
-- (conversations.location_id is only ever set on the venue's own chat).
create or replace function fetch_message_stats(p_location_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  group_count int;
  group_messages int;
  dm_messages int;
begin
  if not is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  select count(*) into group_count
  from conversations
  where location_id = p_location_id and is_group = true;

  select count(*) into group_messages
  from messages m
  join conversations c on c.id = m.conversation_id
  where c.location_id = p_location_id and c.is_group = true;

  with venue_attendees as (
    select distinct user_id from location_checkins where location_id = p_location_id
  ),
  dm_convos as (
    select c.id
    from conversations c
    where c.is_group = false
      and exists (
        select 1 from conversation_participants cp
        join venue_attendees va on va.user_id = cp.user_id
        where cp.conversation_id = c.id
      )
      and not exists (
        select 1 from conversation_participants cp
        where cp.conversation_id = c.id
          and cp.user_id not in (select user_id from venue_attendees)
      )
  )
  select count(*) into dm_messages
  from messages m
  where m.conversation_id in (select id from dm_convos);

  return jsonb_build_object(
    'groupsCreated', group_count,
    'groupMessagesSent', group_messages,
    'dmMessagesApprox', dm_messages
  );
end;
$$;

grant execute on function fetch_message_stats(uuid) to authenticated;
```

- [ ] **Step 2: Apply to QA and verify**

```bash
supabase db query --linked < supabase/migrations/0013_analytics_functions.sql
echo "select exists(select 1 from pg_proc where proname='fetch_message_stats') as present;" | supabase db query --linked
```
Expected: `present: true`.

- [ ] **Step 3: Extend the type**

In `lib/types.ts`:
```ts
export interface EngagementStats {
  feedPosts: number;
  groupsCreated: number;
  groupMessagesSent: number;
  dmMessagesApprox: number;
}
```

- [ ] **Step 4: Replace the function**

In `lib/data.ts`, replace `fetchEngagementStats` (lines 1148-1156):

```ts
export async function fetchEngagementStats(locationId: string): Promise<EngagementStats> {
  const { count: feedPosts, error } = await supabase
    .from('feed_posts')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId);
  if (error) throw error;

  const { data: messageStats, error: statsError } = await supabase.rpc('fetch_message_stats', {
    p_location_id: locationId,
  });
  if (statsError) throw statsError;

  return {
    feedPosts: feedPosts ?? 0,
    groupsCreated: messageStats?.groupsCreated ?? 0,
    groupMessagesSent: messageStats?.groupMessagesSent ?? 0,
    dmMessagesApprox: messageStats?.dmMessagesApprox ?? 0,
  };
}
```

- [ ] **Step 5: Render it in the report**

In `app/main/venue/report/page.tsx`, wherever `engagement.groupsCreated`/`groupMessagesSent` currently render (they were previously always 0 — find via the existing `engagement` state usage), add a `StatTile` for `dmMessagesApprox` labeled **"DMs (approx.)"** with a small caption below the tile: "Between attendees who've both checked in here — may include chats that started elsewhere." Do not label it as an exact count.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npm run build
```
Manual: with two QA test users both checked into a venue, have them DM each other and exchange a couple messages, also send a message in the venue's group chat (from Task 2's era of testing), reload the report, confirm `groupMessagesSent` and `dmMessagesApprox` both show nonzero, correct counts.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0013_analytics_functions.sql lib/types.ts lib/data.ts app/main/venue/report/page.tsx
git commit -m "Close groupsCreated/groupMessagesSent gap; add approximate DM count"
```

---

### Task 7: Contact method choice (+ QR scan labeling)

**Files:**
- Create: `supabase/migrations/0014_contact_method_type.sql`
- Modify: `lib/types.ts` (add `ContactMethodBreakdownEntry`)
- Modify: `lib/data.ts` (add `fetchContactMethodBreakdown`)
- Modify: `app/main/venue/report/page.tsx`
- Modify (sibling repo): `/Users/sr/w-app-ios/The W App/QR Code/UserLinksVC.swift`

**Interfaces:**
- Produces: `ContactMethodBreakdownEntry { contact_method_type: string; count: number }`, `fetchContactMethodBreakdown(locationId: string): Promise<ContactMethodBreakdownEntry[]>`

**Resolved open item:** the web app has no real QR-scan/connect flow (`components/home/ConnectSheet.tsx` is an explicit stub — no QR library, `requestConnection` doesn't exist). Every `connections` row today is written by the iOS app. So `contact_method_type` must be captured on the iOS side, in `UserLinksVC.swift`, the screen a scanner lands on after scanning someone's code (reached via the `openWAPContact://id=` deep link from `AppDelegate.swift`'s `openBusinessCard`) — specifically in `collectionView(_:didSelectItemAt:)` (lines 63-67), the exact moment the scanner taps a specific method.

- [ ] **Step 1: Write the migration**

```sql
-- 0014_contact_method_type.sql
-- Which contact method (whatsapp/instagram/linkedin/phone/etc.) a scanner
-- actually chose after scanning someone's code. connections rows are
-- currently only ever written by the iOS app (the web app's QR-scan flow
-- is still a stub — see components/home/ConnectSheet.tsx).

alter table connections add column if not exists contact_method_type text;

-- The scanner may update their own connection row's contact_method_type
-- after choosing a method. No existing update policy on connections.
drop policy if exists connections_update_own_contact_choice on connections;
create policy connections_update_own_contact_choice on connections for update to authenticated
  using (scanner_id = auth.uid())
  with check (scanner_id = auth.uid());
```

- [ ] **Step 2: Apply to QA and verify**

```bash
supabase db query --linked < supabase/migrations/0014_contact_method_type.sql
echo "select exists(select 1 from information_schema.columns where table_name='connections' and column_name='contact_method_type') as present;" | supabase db query --linked
```
Expected: `present: true`.

- [ ] **Step 3: Add the type and data function**

In `lib/types.ts`:
```ts
export interface ContactMethodBreakdownEntry {
  contact_method_type: string;
  count: number;
}
```

In `lib/data.ts`, near `fetchConnectionsFormed`:
```ts
export async function fetchContactMethodBreakdown(locationId: string): Promise<ContactMethodBreakdownEntry[]> {
  const { data, error } = await supabase
    .from('connections')
    .select('contact_method_type')
    .eq('location_id', locationId)
    .not('contact_method_type', 'is', null);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { contact_method_type: string }[]) {
    counts.set(row.contact_method_type, (counts.get(row.contact_method_type) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([contact_method_type, count]) => ({ contact_method_type, count }))
    .sort((a, b) => b.count - a.count);
}
```

- [ ] **Step 4: Capture the choice on iOS**

In `/Users/sr/w-app-ios/The W App/QR Code/UserLinksVC.swift`, modify `collectionView(_:didSelectItemAt:)`:

```swift
func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
    let method = methods[indexPath.row]
    guard let value = method.value, !value.isEmpty else { return }
    Task { [weak self] in
        try? await WAPData.shared.recordContactMethodChoice(scanneeId: self?.id ?? "", type: method.type)
    }
    openMethod(type: method.type, value: value)
}
```

Add a new method to `WAPData` (find the class in `The W App/Classes/` or wherever `fetchContactMethods` is defined — it's called from this same file at line 29 — add the new method alongside it):

```swift
func recordContactMethodChoice(scanneeId: String, type: String) async throws {
    guard let currentUserId = /* however this class already exposes the current authenticated user id — match the pattern used elsewhere in WAPData for the current user, e.g. wherever fetchContactMethods or a similar authenticated call gets its caller's id */ else { return }
    // Find the most recent connections row between (scanner=current user, scannee=scanneeId)
    // and set its contact_method_type. Uses the same Supabase client pattern as
    // fetchContactMethods in this same class.
    struct RecentConnection: Decodable { let id: String }
    let recent: [RecentConnection] = try await supabase
        .from("connections")
        .select("id")
        .eq("scanner_id", value: currentUserId)
        .eq("scannee_id", value: scanneeId)
        .order("scanned_at", ascending: false)
        .limit(1)
        .execute()
        .value
    guard let connectionId = recent.first?.id else { return }
    try await supabase
        .from("connections")
        .update(["contact_method_type": type])
        .eq("id", connectionId)
        .execute()
}
```

Note for whoever implements this: the exact way `WAPData` gets "the current authenticated user id" and its exact Supabase client property name must be copied from the pattern already used a few lines above in the same class for `fetchContactMethods` — read that method's surrounding class code first rather than guessing the client/session accessor name.

- [ ] **Step 5: Render it in the report**

In `app/main/venue/report/page.tsx`, extend the existing "Connections Formed" section (where `connections.scans` already renders) to also render `fetchContactMethodBreakdown` results as a small breakdown list ("WhatsApp: 24, Phone: 18, Instagram: 11, LinkedIn: 7"), and relabel the existing scans `StatTile` to say **"QR Scans"** explicitly if it doesn't already. Add the fetch call to the report's `Promise.all` and corresponding state, same pattern as every prior task.

- [ ] **Step 6: Verify**

```bash
npx tsc --noEmit
npm run build
```
For the iOS side: build via Xcode/simulator (`xcodebuild -workspace "The W App.xcworkspace" -scheme "The W App" -destination "platform=iOS Simulator,name=iPhone 16" build`), confirm it compiles.

Manual (requires two real iOS simulator accounts, mirroring how the RegisterVC/owner-benefits work in this project was verified): scan one QA test user's code from another's device, tap a contact method in `UserLinksVC`, then run:
```bash
echo "select scanner_id, scannee_id, contact_method_type from connections order by scanned_at desc limit 1;" | supabase db query --linked
```
Expected: `contact_method_type` matches whatever method was tapped. Then reload the web report and confirm the breakdown shows it.

- [ ] **Step 7: Commit**

```bash
git -C /Users/sr/w-app-web add supabase/migrations/0014_contact_method_type.sql lib/types.ts lib/data.ts app/main/venue/report/page.tsx
git -C /Users/sr/w-app-web commit -m "Add contact method choice tracking + report breakdown"
git -C /Users/sr/w-app-ios add "The W App/QR Code/UserLinksVC.swift" # plus wherever recordContactMethodChoice was added
git -C /Users/sr/w-app-ios commit -m "Record which contact method a scanner chose after viewing a business card"
```

---

## Self-Review Notes

- **Spec coverage:** all five design-doc pieces have a task (zone movement = Tasks 1-3, cross-venue = Task 4, attendance timing = Task 5, message counts = Task 6, QR scans/contact method = Task 7). All three "Open items for planning phase" are resolved: business-card-view screen is `UserLinksVC.swift` on iOS (Task 7), aggregation mechanism is on-demand `security definer` functions (Tasks 3/4/6), cross-venue window is a 12h rolling window (Task 4).
- **Design correction applied and documented:** Task 6's DM count is an approximation, not the exact "location_id-attributed" count the spec originally described — `conversations.location_id` structurally cannot be set on a DM (Task 2's unique index enforces one venue chat per location, always `is_group=true`). The report UI must label this as approximate, not present it as exact.
- **Type consistency checked:** `VenueZone`/`ZoneAnalytics`/`CrossVenueMovementEntry`/`ContactMethodBreakdownEntry` field names match between their type definitions and the functions that return them across all tasks. `EngagementStats.dmMessagesApprox` is a new field, not a rename of anything existing (existing `groupsCreated`/`groupMessagesSent` keep their names, just stop being hardcoded to 0).
