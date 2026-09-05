# Location Request / Approval Workflow — Design

**Date:** 2026-09-04
**Status:** Approved (founder, 2026-09-04)
**Repo:** `/Users/sr/w-app-web`

## Background

The map's "Add a location" button (`components/tabs/MapTab.tsx`) is visible to every
signed-in user with no permission check. Submitting it calls
`setNearbyLocations([...nearbyLocations, newLocation])` — pure local React state,
`id: Date.now().toString()`, gone on refresh, never seen by anyone else.

This is not a wiring bug. `locations`' INSERT policy
(`supabase/migrations/0002_locations_insert_policy.sql`,
`locations_insert_master_admin`) restricts venue creation to master admins only. Even
wired to the real `createVenue()` (already used by the admin panel), the button would
fail RLS for every non-admin user. The feature was never buildable as "any user creates
a venue" — it needed a request/approval step that doesn't exist yet.

This spec covers that workflow: any signed-in user can **request** a location; a master
admin approves or rejects it from a queue; the requester is notified via an automated
chat message from a "The W App" system sender.

**Categories** (the map's second broken piece — every venue is hardcoded
`category: 'venue'`, so the filter chips never match) are an explicitly separate,
independent sub-project, sequenced after this one. Not covered here.

## Scope

1. `location_requests` table + three SECURITY DEFINER RPCs (`request_location`,
   `approve_location_request`, `reject_location_request`).
2. A fixed "The W App" system profile, seeded once, used as the sender of all automated
   messages in this flow.
3. Map "+" flow repointed from local state to `request_location()`, with guideline copy
   shown in the modal.
4. A "Location Requests" admin queue (new page under `/admin`) to approve/reject.

**Explicitly out of scope:**
- Categories (separate sub-project).
- Showing a requester's own pending pins on the map.
- Editing venue radius/name/coordinates after creation (pre-existing limitation, not
  introduced here — `updateVenue()` only ever touched address/description/whatsapp/
  default_message).
- Rate-limiting beyond "none" (founder's explicit call).
- A rejection-reason UI beyond a plain optional text field in the admin queue.

## Design

### 1. Two-layer model: requests are not venues

`location_requests` is a separate table from `locations`. `locations` stays "real, live
venues only" — every existing consumer (the map, check-in/geofencing, the organizer
report, the home nearby-banner, `fetchVenues()`) keeps working completely unmodified.
Approving a request **copies** its fields into a new `locations` row; rejecting one
never touches `locations` at all. This avoids retrofitting a `status` filter into every
current reader of `locations`, which would be a much larger, riskier change for the same
outcome.

### 2. Schema

```sql
create table location_requests (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);
alter table location_requests enable row level security;
```

RLS:
- `location_requests_select_own`: `submitted_by = auth.uid()`.
- `location_requests_select_admin`: `exists (select 1 from profiles where id = auth.uid()
  and is_master_admin)` (same predicate pattern as `set_master_admin`,
  `assign_venue_owner`).
- **No client INSERT/UPDATE policy at all.** Every write goes through the three RPCs
  below — matches this repo's established convention (`record_qr_scan`,
  `set_master_admin`) for exactly the same reason: the interesting writes here (creating
  a `locations` row as a side effect, writing a message as a different sender) can't be
  expressed safely as a plain RLS `with check`.

### 3. The system sender

A fixed profile row, seeded by the migration:

```sql
-- Fixed, well-known id for the system sender — never changes once seeded.
-- Mirrored as SYSTEM_PROFILE_ID in lib/constants.ts.
insert into profiles (id, display_name, is_master_admin)
values ('00000000-0000-4000-8000-00000000a99d', 'The W App', false)
on conflict (id) do nothing;
```

`00000000-0000-4000-8000-00000000a99d` is the fixed, well-known id — chosen once here,
never regenerated, and mirrored as `SYSTEM_PROFILE_ID` in `lib/constants.ts` for
anywhere client code needs to recognize it (e.g. to avoid double-creating a
conversation). It has no email/phone, is not a master admin, and should never be
selectable as a DM recipient in any "start a conversation" picker — none of those
pickers query `profiles` unfiltered by anything relevant here, so no change is needed to
exclude it, but this is worth a manual check during implementation.

### 4. The three RPCs

**`request_location(p_name text, p_description text, p_lat double precision, p_lng
double precision) returns uuid`** — SECURITY DEFINER.

1. `v_uid := auth.uid()`; raise `not_signed_in` if null.
2. Insert into `location_requests` (`submitted_by = v_uid`, the given fields,
   `status = 'pending'`); capture `v_request_id`.
3. Find-or-create a 1:1 system conversation for this user: look for a `conversations`
   row with `is_group = false` that has exactly `{v_uid, SYSTEM_PROFILE_ID}` as its
   `conversation_participants`. If found, reuse it (`v_conversation_id`). If not,
   insert a new `conversations` row (`is_group = false`, `created_by = v_uid`, `name =
   null`) and two `conversation_participants` rows (`v_uid`, `SYSTEM_PROFILE_ID`, both
   `status = 'accepted'` — this is a system thread, not a request the user has to
   approve).

   **Why one persistent thread, not one per request:** with no cap on pending requests
   (founder's call), one thread keeps a user's whole request history in one place
   instead of spawning a new "The W App" conversation every time they ask about a
   venue.
4. Insert into `messages` (`conversation_id = v_conversation_id`, `sender_id =
   SYSTEM_PROFILE_ID`, `content = 'Your request for "' || p_name || '" is pending
   approval.'`).
5. Return `v_request_id`.

All of steps 2–4 happen in the same function body (implicitly one transaction) so a
request is never created without its notification, or vice versa.

**`approve_location_request(p_request_id uuid) returns uuid`** — SECURITY DEFINER.

1. Raise `not_authorized` unless the caller is a master admin (same predicate as
   `set_master_admin`).
2. Look up the request; raise `request_not_found` if missing, `already_reviewed` if
   `status <> 'pending'`.
3. Insert into `locations` (`name`, `description`, `lat`, `lng`,
   `geofence_radius_meters = 50`, `owner_id = request.submitted_by`) — 50m matches the
   map's existing local-fallback default (`MapTab.tsx`'s old `radius: 50`). Capture
   `v_location_id`.
4. Update the request: `status = 'approved'`, `reviewed_by = auth.uid()`, `reviewed_at =
   now()`.
5. Find-or-create the requester's system conversation (same lookup as step 3 of
   `request_location` — factor into a shared helper if plpgsql makes that easy, inline
   duplication is acceptable otherwise) and insert a message: `'"' || name || '" was
   approved — you're the venue owner now.'`.
6. Return `v_location_id`.

**`reject_location_request(p_request_id uuid, p_reason text default null) returns
void`** — SECURITY DEFINER. Same admin check and status guard as approve. Updates
`status = 'rejected'`, `reviewed_by`, `reviewed_at`, `rejection_reason = p_reason`.
Posts a system message: `'Your request for "' || name || '" wasn''t approved.'`,
appending `' ' || p_reason` when given.

### 5. Client changes

**`lib/data.ts`** — three thin RPC wrappers (`requestLocation`, `approveLocationRequest`,
`rejectLocationRequest`) plus a `fetchLocationRequests(status?)` read (master-admin-only
by RLS, used by the queue).

**`components/tabs/MapTab.tsx`** — the existing tap-to-place flow (arm "+", tap map,
modal opens with `clickedLocation`) is unchanged. `handleAddLocation` changes from
`setNearbyLocations([...])` to calling `requestLocation(name, description, lat, lng)`
and showing a confirmation (a simple success state in the same modal — "Request sent —
we'll message you once it's reviewed", then close). The button and modal stay open to
every signed-in user; no permission gate needed now that it's a request, not a create.
The modal gains the guideline text (below) above the form fields.

**Guideline copy** (shown in the "Add New Location" modal, above the Name field):

> Before you request a venue: it should be a real place your group can physically check
> into, and you should have some connection to it — you work there, run events there, or
> can otherwise speak for it. This isn't a general points-of-interest map. Duplicate,
> joke, or spam requests will be rejected. Review is manual and may take a few days.

**New admin page** `app/admin/location-requests/page.tsx` — a list of pending requests
(name, description, submitter's `display_name`, `created_at`, lat/lng shown as plain
text — no embedded mini-map, keeps this simple), each with **Approve** and **Reject**
buttons. Reject opens an inline optional-reason text field before confirming. Linked
from the main admin panel (`app/admin/page.tsx`) alongside the existing venue/admin
management links. Approved/rejected requests can drop off the list (no separate
history view in this pass — `reviewed_at`/`status` are in the table for whenever a
history view is wanted).

### 6. Error handling

| condition | message |
|---|---|
| not signed in | "You need to be signed in." |
| name empty | (existing client-side validation: submit button already disabled) |
| RPC failure (network, etc.) | "Couldn't send your request. Try again." |
| admin: request already reviewed (race — two admins) | "This request was already handled." |
| admin: not authorized (shouldn't be reachable via UI, but RLS/RPC both guard it) | generic RPC error surfaces; the page itself is only linked from admin nav |

### 7. Testing

No automated test suite in this repo. Verification: `npx tsc --noEmit` clean, manual QA
against `w-app-qa` with two accounts (one regular, one master admin), and direct
`supabase db query` row assertions after each RPC call — same pattern as every prior
plan in `docs/superpowers/plans/`.

## Decisions made without human input

None — every product decision here (separate table, requester-becomes-owner, no request
limit, "location requests first" sequencing) was made by the founder in-session on
2026-09-04.

## Deferred / follow-up

- Categories sub-project (separate spec).
- Showing a user's own pending request pins on the map.
- A request-history view in the admin panel.
- Editing venue geo fields (radius, coordinates) after creation — pre-existing gap.
