# Organizer Analytics — Zone Movement, Cross-Venue Flow, Messaging, QR Scans, Contact Method Choice (Design)

## Status
PROPOSED — design approved by founder in brainstorming session 2026-08-25.
Not yet built. This doc is the spec; implementation plan comes next via
superpowers:writing-plans.

## Context

The founder asked to extend the organizer report
(`app/main/venue/report/page.tsx`) with new attendee analytics: anonymous
movement tracking, message-exchange counts (DM vs. group), QR-scan counts,
and which contact method (WhatsApp/Instagram/LinkedIn/phone/etc.) attendees
chose when connecting.

**Important scope correction made during brainstorming:** an early draft of
the ask described continuous, non-anonymous, real-time GPS tracking with a
live map of named "active users." That was explicitly walked back — the
founder confirmed the actual intent is analytics for an organizer report,
restricted to organizers/co-owners the app owner has granted access to (the
existing `useIsOrganizer` gate), not a live per-person tracking tool. This
doc's design reflects that correction: **every number an organizer sees is a
count, percentage, or average — never "here's where a named person is/was."**
This is a hard constraint on every piece below, not a preference.

## The five pieces

### 1. Zone movement (new)

**Zone setup:** organizers define zones for their venue in a new management
screen (mirrors `app/main/venue/rewards/page.tsx`'s CRUD pattern) — a name
plus a single reference point (drop a pin on a map, reusing whatever map
component `components/tabs/MapTab.tsx` already uses for venue lat/lng
entry). New table:

```sql
create table venue_zones (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
```
RLS: select is public (attendees don't need zone detail, but the app may
want to label something someday); write is `is_venue_manager(location_id, auth.uid())`,
matching the `rewards_write` pattern from migration 0009.

**Detection:** while a user is checked in (`location_checkins` row with
`checked_out_at is null`) to a venue that has `venue_zones` rows, the client
runs a new `useZoneTracking` hook using `navigator.geolocation.watchPosition`,
throttled (only send an update if the position moved >5m or 10s elapsed
since the last one, whichever first — matches the founder's own throttling
requirement). Each fix is matched server-side to the *nearest* zone by
straight-line distance to `center_lat/center_lng`.

**Known, accepted limitation:** phone GPS indoors is typically only accurate
to 5-20+ meters. Zones spaced closely together (e.g. two ends of one room)
will not reliably separate. This is a property of using unassisted GPS, not
a bug — organizers should be guided (in the zone-setup UI copy) to define
zones that are physically well-separated. No beacon/QR-per-zone/manual-picker
mechanism is in scope for this build (all three were explicitly considered
and declined in favor of GPS-only).

**Storage — write-only, short retention:**
```sql
create table zone_position_fixes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  zone_id uuid not null references venue_zones(id),
  recorded_at timestamptz not null default now()
);
```
RLS: insert-only, `user_id = auth.uid()`; **no select policy for anyone
except a `service_role`-run aggregation job** — the raw table is never
queried by any user-facing code path, only by a scheduled aggregation
function. Rows older than 48 hours are purged (a small cron/scheduled
function, or a `delete ... where recorded_at < now() - interval '48 hours'`
run as part of the same aggregation job) — there's no reason to keep raw
per-fix data once it's rolled up.

**Aggregation → what the organizer sees:** a scheduled/on-demand aggregation
turns `zone_position_fixes` into:
- occupancy per zone per time bucket (e.g. hourly headcount, computed as
  distinct `user_id` count — never listing which users)
- average dwell time per zone (last-fix-minus-first-fix per user per
  zone-visit, averaged)
- transition counts between zones ("42 people moved from Bar → Dance Floor")

These three become new fields the report page renders as charts/numbers,
following the existing `AttendanceStats`/chart pattern already in
`app/main/venue/report/page.tsx`.

### 2. Cross-venue movement (new, no new schema)

For a venue, compute what % of its attendees also checked into which other
venues within a time window (same night, or a configurable N hours) — a
pure query over the existing `location_checkins` table across locations, no
new table. Output: a ranked list of "attendees at Venue A also went to:
Venue B (38%), Venue C (12%)."

### 3. Attendance timing (extends existing `AttendanceStats`)

Add average dwell time (`checked_out_at - checked_in_at`, excluding open
check-ins) to the existing `fetchAttendanceStats` in `lib/data.ts` (currently
returns `totalCheckins`/`uniqueAttendees`/`checkinsByHour` — dwell time is a
new field alongside those, same function).

### 4. Message counts, DM vs. group (new, no new schema)

Closes a known, already-documented gap: `fetchEngagementStats` in
`lib/data.ts` (lines ~1148-1156) currently hardcodes `groupsCreated` and
`groupMessagesSent` to `0`, with a comment explaining `conversations` had no
`location_id` to attribute a group to a venue. That column now exists
(migration 0008, already live — see `docs/RESUME-launch-prep.md`), so this
is now a real, closeable gap: count `conversations` where `location_id`
matches and `is_group = true` for `groupsCreated`, and count `messages`
joined through those conversation ids for `groupMessagesSent`. DM volume
(not currently in `EngagementStats` at all) can be added the same way,
filtered to `is_group = false`.

### 5. QR scans + contact method choice

**QR scans:** already fully tracked. `fetchConnectionsFormed` in `lib/data.ts`
(line ~1127) already counts `connections` rows per venue as `scans` — this
is already correct and already surfaced in the report as part of
`ConnectionsFormedStats`. Nothing new needed here beyond confirming it's
displayed clearly as "QR scans."

**Contact method choice (new):** nothing today records *which* contact
method (WhatsApp/Instagram/LinkedIn/phone/etc.) was actually used when two
people connected — `contact_methods` only stores what a profile has enabled,
not what was chosen at connection time. Add a nullable column:
```sql
alter table connections add column if not exists contact_method_type text;
```
Set when the scannee's profile/business-card view (wherever that lives in
the web app — needs confirming during planning; on iOS this is
`UserLinksVC`) is opened post-scan and a specific method is tapped. The
organizer report then aggregates counts per `contact_method_type` value
("of 60 connections: 24 WhatsApp, 18 phone, 11 Instagram, 7 LinkedIn").

## Non-goals (explicitly out of scope)

- No live map rendering any individual attendee's real-time position, to
  anyone, at any permission level.
- No `battery_status` or any device-health tracking.
- No general-purpose location-sharing feature between users.
- No beacon/QR-per-zone/manual zone-picker mechanism (GPS-only, see zone
  movement's accepted limitation above).
- Raw `zone_position_fixes` rows are never exposed via any API response or
  UI — aggregation-only, short retention.

## Open items for planning phase

- Exact web-app screen where a scanned business card is viewed (to know
  where to hook `contact_method_type` capture) — needs a quick look during
  planning; iOS equivalent is `UserLinksVC`.
- Exact aggregation job mechanism (Postgres function run on-demand when the
  report loads vs. a scheduled job) — likely on-demand for now given QA/prod
  scale, revisit if the raw-fixes table grows large.
- Time window for "cross-venue movement" (same calendar night vs. a fixed
  N-hour window) — default to same night unless planning surfaces a reason
  otherwise.

## Critical files

- `app/main/venue/report/page.tsx` — where all five pieces surface.
- `app/main/venue/rewards/page.tsx` — CRUD UI pattern to mirror for the new
  zone-management screen.
- `lib/data.ts` — `fetchAttendanceStats`, `fetchConnectionsFormed`,
  `fetchEngagementStats` (lines ~1083-1156) — all three extended, not
  replaced.
- `lib/types.ts` — `AttendanceStats`, `EngagementStats`,
  `ConnectionsFormedStats` — extend with new fields.
- `components/tabs/MapTab.tsx` — existing one-shot `getCurrentPosition` /
  map-pin patterns to reuse for zone reference-point entry.
- `lib/store.ts` — existing "user denied geolocation" flag pattern to reuse
  for the new zone-tracking hook's permission handling.
- `next.config.ts` — `Permissions-Policy` already allows `geolocation=(self)`,
  no change needed.
- `supabase/migrations/0009_rewards_management.sql` — RLS pattern
  (`is_venue_manager`-scoped write policy) to copy for `venue_zones`.
