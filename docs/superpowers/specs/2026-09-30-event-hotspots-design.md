# Event hotspots — design

**Date:** 2026-09-30
**Status:** Design approved in chat (sections 1–4); spec awaiting founder review
**Branch:** `feature/event-hotspots`

## Intent

Organizers of an event (or venue) recommend nearby places — **hotspots** — for
attendees to visit. Attendees check in at hotspots to get **credit for showing
up**: a stamp per hotspot, and progress on the event's **activity meter** toward
a reward. Hotspots live on the **Map tab** — they are the reason the map stays
in the web app.

Success looks like: an organizer sets up 3–6 hotspots for an event in a couple
of minutes; attendees see them on the map, walk to them, check in, watch the
meter fill, and unlock the organizer's reward.

## Approach

**B — an event's list of hotspots pointing at existing places.** A hotspot is a
link between an event (a `locations` row) and a place (another `locations`
row). Places stay ordinary venues, so geofenced check-in, map pins, History and
`location_checkins` are reused unchanged; one place can be a hotspot for many
events.

Rejected: (A) child-venue rows with a parent link — a place could belong to
only one event and would leak into every venue list; (C) a standalone hotspot
system — duplicates geofence and check-in logic.

## 1. Data model

Migration `supabase/migrations/0032_event_hotspots.sql`.

### `event_hotspots`

| column        | type          | notes                                              |
|---------------|---------------|----------------------------------------------------|
| `id`          | uuid pk       | `gen_random_uuid()`                                |
| `event_id`    | uuid not null | → `locations(id)` on delete cascade                |
| `location_id` | uuid not null | → `locations(id)` on delete cascade                |
| `note`        | text          | nullable, `char_length(note) <= 140`               |
| `sort_order`  | int not null  | default 0                                          |
| `created_by`  | uuid          | → `profiles(id)`                                   |
| `created_at`  | timestamptz   | not null default `now()`                           |

Constraints: `unique (event_id, location_id)`; `check (event_id <> location_id)`.
Index on `event_id`.

### RLS

- `event_hotspots_select`: `for select to authenticated using (true)` — same
  visibility as venues.
- `event_hotspots_write`: `for all to authenticated using
  (is_venue_manager(event_id, auth.uid())) with check
  (is_venue_manager(event_id, auth.uid()))` — same pattern as `venue_zones`
  (0011) and `rewards` (0009).

### Rewards

`alter table rewards add column if not exists min_hotspots int;` — nullable.
A reward with `min_hotspots` set unlocks once the member's hotspot visit count
for that event reaches it. Existing rewards (null) are unaffected. Covered by
the existing `rewards_write` policy.

### Organizer stats function

`hotspot_visit_counts(p_event_id uuid) returns table (location_id uuid,
visitors bigint)` — `security definer`, `set search_path = public`, raises
unless `is_venue_manager(p_event_id, auth.uid())`. Returns distinct visitor
counts per hotspot using the visit rule below. Aggregates only; never returns
user ids. Modeled on the 0013 analytics functions.

### New hotspot places

An organizer can create a hotspot place directly: an insert into `locations`
(name, lat, lng, `geofence_radius_meters` default 75, `owner_id` = organizer,
`is_event` false). Today only master admins may insert into `locations`
(`locations_insert_master_admin`, 0002), so the migration adds a narrowly
scoped `security definer` function
`create_hotspot_place(p_event_id uuid, p_name text, p_lat double precision,
p_lng double precision, p_radius int default 75) returns uuid` that raises
unless `is_venue_manager(p_event_id, auth.uid())`, inserts the place, inserts
the `event_hotspots` link, and returns the new place id. `locations` RLS is not
loosened. It does not depend on `location_requests` (0020), which is not on
prod.

### Visit rule (what counts as credit)

A visit = a `location_checkins` row by the user at a hotspot's `location_id`.

- Event has `event_date`: only check-ins whose local calendar day falls
  between `event_date` and `event_end_date` (inclusive; `event_end_date`
  defaults to `event_date`) count.
- No `event_date` (ongoing venue trail): check-ins at or after the hotspot's
  `created_at` count.

Visit count = number of **distinct hotspots** visited. Stamps are derived from
the same set — no new per-visit table.

## 2. Attendee experience

- **Map tab:** hotspot pins use a distinct flame marker. Shown for events
  running today (`event_date` ≤ today ≤ `event_end_date`) plus the event the user is checked in at. Tapping
  a pin opens a sheet: hotspot name, note, parent event, stamp state, **Check
  in** (existing geofenced flow) and **Directions**.
- **Checked in at the event:** a **Hotspots** card on the checked-in view
  lists the event's hotspots in `sort_order`, stamped when visited.
- **Activity meter:** when the event has hotspots, `ActivityMeterCard`'s bar
  shows hotspot visits toward the target ("2 / 5 hotspots") and names the
  reward it unlocks. The "What are you here for?" chips stay. Target = the
  smallest active `min_hotspots` reward not yet reached; if none, the number of
  hotspots.
- **Checked in at a hotspot:** a strip on that venue's view — "Hotspot for
  {event} · stamp collected · 3 / 5" — links back to the event.
- **Home:** an in-range hotspot's venue pill shows the flame marker.
- **Reward unlocked:** appears in the existing Rewards panel.

Out of scope for v1: push notifications, suggested routes, leaderboards.

## 3. Organizer setup

- New page `app/main/venue/hotspots/page.tsx`
  (`/main/venue/hotspots?locationId=…`), linked from the organizer hub.
  - **Add existing place:** search venues by name.
  - **Create new place:** drop a pin on a small map, name, radius (default 75m).
  - Edit note (≤140), reorder with up/down buttons, remove. Removing a hotspot
    does not delete the place or anyone's check-ins.
  - Each row shows "N people visited" from `hotspot_visit_counts` — never names.
- **Rewards page:** optional "Unlocks after visiting ___ hotspots" field
  (`min_hotspots`), with a hint showing the event's current hotspot count.
- **Guardrails:** page gated by `useIsOrganizer` / `is_venue_manager`; soft
  warning (still saves) when `min_hotspots` exceeds the hotspot count; an event
  can't list itself (DB check).

## 4. Data flow, errors, testing, rollout

### Code layout

- `lib/hotspots.ts`
  - `fetchEventHotspots(eventId)` → hotspots joined with their place.
  - `fetchHotspotParents(locationId)` → events this place is a hotspot for.
  - `fetchMyHotspotCheckins(locationIds)` → the user's own check-ins at those
    places (RLS already scopes `location_checkins` reads).
  - `computeHotspotProgress({ hotspots, checkins, eventDate, rewards })` —
    **pure**: visited set, count, target, next reward, unlocked rewards.
  - Organizer CRUD: add/remove/reorder/update note, `fetchHotspotVisitCounts`.
- Components: `components/hotspots/HotspotsCard.tsx`,
  `HotspotStrip.tsx`, `HotspotPinSheet.tsx`; changes to `ActivityMeterCard`,
  `CheckedInHero`, `MapTab`/`WMap`, `NearbyBanner`, the rewards page, and the
  organizer hub tool list.

### Errors

- Hotspot fetch failure → inline "Couldn't load hotspots. Try again" with retry;
  the rest of the view keeps working.
- Out of range → the existing "get closer to check in" message.
- A hotspot whose place is deleted disappears (cascade).
- Events without hotspots render exactly as today.

### Testing

- `tsc --noEmit` and eslint on changed files.
- RLS checks on QA via direct queries: a non-manager cannot insert/update/delete
  `event_hotspots`; a manager can only write their own event's rows;
  `hotspot_visit_counts` raises for non-managers.
- Browser pass on the QA preview deployment as organizer (set up hotspots +
  reward) and attendee (check in, stamps, meter, unlock).
- `computeHotspotProgress` lives in its own dependency-free file and is unit
  tested with Node's built-in runner (`node --test`, Node 26 strips TypeScript
  types natively) — no new dependencies.

### Rollout

1. Migration file in repo.
2. Applied to **QA only after founder approval** (CLAUDE.md: migrations/RLS are
   founder-gated).
3. Code ships in its own PR (separate from PR #20, the Home main-feed layout).
4. Prod migration only on founder go-ahead.
