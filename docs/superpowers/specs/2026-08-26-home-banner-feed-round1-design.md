# Home Banner + Feed Teaser Restyle (Round 1)

**Date:** 2026-08-26
**Status:** Approved
**Repo:** `/Users/sr/w-app-web`

## Background

The user reviewed a live demo of the app and found it doesn't match their design intent:
profile editing is a dead link, the "not detected" location banner has no way to retry,
there's no way to see venues you're actually in range of, and the friends'-activity
locked-state card reads as a generic upsell rather than the app's actual voice.

This is the first of three rounds carved out of that feedback during brainstorming:
- **Round 1 (this spec):** the concrete, well-scoped fixes below.
- **Round 2 (separate spec, next):** mutual peek-back matching — when someone checked in
  at a venue you're peeking notices you and peeks back, it opens an auto-DM and invites you
  in. Needs new schema (who's peeking what, who's visible to whom, match triggers) and a
  privacy/venue-visibility model. Out of scope here.
- **Round 3 (separate spec, later):** the engagement-points/leveling system and the
  attendee-facing "Add a location" flow (Places search → pin → auto-geofence → become
  owner) it gates. This is a real, previously-designed feature — see
  `w-app-ios/docs/superpowers/specs/2026-07-02-wap-design.md` (Main Feed Top Card, Section 8
  "Engagement Bar System") and the live-but-unconsumed `engagement_events` /
  `feature_unlocks` / `user_feature_access` tables (`w-app-ios/database/migrations`
  001/002/003/005/007/008) — but no UI on either platform wires any of it up today. Out of
  scope here; Round 1's "location not detected" CTA is deliberately named **Enable
  Location**, not **Add Location**, so it doesn't collide with this later feature.

## Scope

**In scope (Round 1):**
1. Fix the dead `/profile/edit` link with a real edit screen.
2. Rebuild `NearbyBanner`'s two states (location detected / not detected) per the behavior
   below.
3. Replace the auto-fetch-once location flow with pull-to-refresh + a manual header button.
4. Restyle `FriendsActivityFeed`'s locked-state copy and add a blurred illustrative backdrop.
5. "Peek" in this round is preview-only: venue info, photo carousel, blurred feed. No
   reciprocal matching, no notifications, no new peek-specific database table.

**Out of scope:** everything in Round 2 and Round 3 above. Also out of scope: touching
`CheckedInHero.tsx`'s zone-tracking (`useZoneTracking`) or any organizer-analytics surface —
those are unrelated, already shipped, and this spec doesn't need to touch them.

## Current state (what exists today)

- `components/tabs/HomeTab.tsx` renders `selectedLocation ? <CheckedInHero /> : <NearbyBanner />`,
  then a quick-access row, then `FriendsActivityFeed` when no panel is open.
- `NearbyBanner.tsx`: no-location state is static "Can't detect your location" text with no
  retry affordance. Location-detected state is a single horizontal scroller of all venues
  sorted by distance (no in-range/out-of-range distinction), each card with a stubbed `Peek`
  button (`console.log` only).
- `FriendsActivityFeed.tsx`: a static gradient card, "Unlock friends' activity / Connect with
  3 people to see where they've been / 0 / 3 connections" — no real gating logic wired up
  yet (Phase 3 of the paused 2026-08-04 plan), no backdrop image.
- `app/main/page.tsx`: on first login (and only then — `localStorage` flag
  `w_app_location_permission_asked` prevents it from firing again), shows a modal that calls
  `navigator.geolocation.getCurrentPosition()` **once**. If denied or never asked again,
  there is no retry mechanism anywhere in the app.
- `ProfileTab.tsx` links "Edit Profile" to `/profile/edit`, which doesn't exist — 404.
  `app/profile/setup/page.tsx` exists but only covers "I'm Looking For" + a few preference
  fields (nationality/city/drink/activity/profession) via `upsertProfile()` — no name/photo
  editing anywhere.
- `CheckedInHero.tsx` and `NearbyBanner.tsx` each independently define an identical
  `haversineMeters()` helper — real duplication, touched by this spec's banner work.

## Design

### 1. Profile edit screen

New `app/profile/edit/page.tsx`, modeled on `app/profile/setup/page.tsx`'s structure but for
identity fields: avatar photo (reuse the existing upload affordance from Create Account),
full name, phone, gender, date of birth. Pre-filled from `useStore().user`, saved via the
existing `upsertProfile()` — no new backend. `ProfileTab.tsx`'s link needs no change, it
already points at the right path.

### 2. Shared geo helper

Extract the duplicated `haversineMeters()` into `lib/geo.ts`, imported by both
`NearbyBanner.tsx` and `CheckedInHero.tsx`. Mechanical dedup, no behavior change.

### 3. Banner — location detected

Header row: **"Location detected"** + a small refresh icon button (see §4).

Venues split into two groups using each venue's `radius` field (already on `Venue`) compared
against `haversineMeters(currentLocation, venue)` — the same math `CheckedInHero` already
uses for its geofence gate:

- **In range** — rendered first, each card gets a primary **Check In** button. Tapping it
  calls `setSelectedLocation(venue)` (the same store action the Map tab's "Check In Here"
  button already uses) — this hands off to `CheckedInHero`'s existing check-in effect, no new
  check-in code path.
- **Nearby** — everything else, sorted by distance as today. Each card gets a **Peek**
  button (see §5) instead of Check In.

Both groups reuse the existing card visual (image, name, description) from today's
`NearbyBanner`; only the button and the in-range/nearby split are new. Zero results in both
groups keeps today's "No locations nearby yet" message.

### 4. Location refresh — pull-to-refresh + manual button

Replace the one-shot, no-retry `getCurrentPosition()` call with:
- **First login:** the existing permission modal stays as the initial ask (already updated
  with tracking-disclosure copy in the prior session's work) — no change to that first-run
  behavior.
- **After that:** a small refresh icon in the banner header (works via click, all devices)
  plus a pull-to-refresh gesture at the top of the Home tab (touch devices) — both call the
  same `refreshLocation()` action, a thin wrapper around the existing
  `getCurrentPosition()` logic in `app/main/page.tsx`'s `handleAllowLocation`, extracted so
  it's callable outside the modal.
- Background zone-tracking polling for the organizer-analytics feature
  (`useZoneTracking`/`CheckedInHero`) is untouched — this is a separate, already-shipped
  mechanism and this spec doesn't change it.

### 5. Banner — location not detected

Header row: **"Location not detected"** + primary button **Enable Location** (re-triggers
the browser permission prompt via the same `refreshLocation()` action from §4) + a smaller
secondary link **"or enter it manually"** opening a simple text-search fallback (city/address
→ geocode via existing venue search patterns; if no geocoding utility exists yet, this
degrades to picking from the venue list directly, since venues already carry lat/lng).

Pull-to-refresh also works from this state (retries permission, same as Enable Location).

### 6. Peek — preview only (Round 1)

Tapping **Peek** opens a new `VenuePeekModal` (a full-screen overlay, same pattern as
`ConnectSheet` — not a route) showing:
- Venue name + description
- Photo carousel — reuses `HeroCarousel` unchanged, fed by `fetchBanners(locationId)` (same
  data `CheckedInHero` already uses for its own carousel)
- A blurred, static illustrative feed backdrop (matches §7's asset) with copy like "Check in
  to see what's happening here" — no real feed data, no peek-tracking row, no notification to
  anyone. This is explicitly a preview, not the Round 2 mechanic.

No venue-privacy gating in this round (no `locations.is_private` column exists yet) — every
venue is peek-able. Privacy is a Round 2 concern once the real peek mechanic (and the reason
to hide from it) exists.

### 7. Friends-activity feed teaser

`FriendsActivityFeed.tsx` keeps its existing gradient-card shell and lock icon, but:
- Copy changes to **"Add friends to see where they've been"** (replacing "Unlock friends'
  activity / Connect with 3 people...").
- A static illustrative blurred image (one designed asset — a mocked-up feed, blurred) sits
  behind the card as a backdrop, giving "a slight view of what it could look like" per the
  user's own description. No real data dependency, no privacy question, same asset reused by
  §6's Peek preview.
- The `0 / 3 connections` counter stays as-is (still accurate to the real gating threshold
  once Round 2 wires it up).

## Data flow

No new tables, no new RLS. Round 1 reuses entirely existing functions: `fetchVenues()`,
`fetchBanners()`, `checkIn()`/`checkOut()`, `upsertProfile()`, `setSelectedLocation()`. The
only genuinely new client logic is the in-range/nearby split (pure client-side filter over
data already fetched) and `refreshLocation()` (a thin re-export of existing geolocation
logic).

## Error handling

Keep the existing try/catch + `console.error` convention used throughout. Geolocation
failures (denied, timeout, unsupported) already have a fallback path (`setLocationDenied`);
Round 1 doesn't change that fallback, only adds a way to retry it on demand.

## Testing

No automated test suite in this repo (established convention). Manual verification via dev
server + Browser pane:
1. `/profile/edit` loads pre-filled, saves via `upsertProfile`, reflects in `/profile`.
2. Home tab, location denied → "Location not detected" + Enable Location button + manual
   entry link, both retry paths work.
3. Home tab, location granted, at least one QA venue seeded within radius and one outside →
   confirm the in-range card's Check In actually checks in (via `CheckedInHero`), the
   out-of-range card's Peek opens the preview modal, no console errors.
4. Pull-to-refresh gesture and header refresh button both re-fetch location.
5. Friends-activity card shows new copy + blurred backdrop, `0/3` counter still renders.
6. `npx tsc --noEmit` clean.

## Open questions / risks

None blocking — the one deferred decision (venue-privacy gating for Peek) is explicitly
scoped to Round 2, not a Round 1 ambiguity.

### Critical files
- `app/profile/edit/page.tsx` (new)
- `lib/geo.ts` (new, extracted)
- `components/home/NearbyBanner.tsx`, `components/home/FriendsActivityFeed.tsx`
- `components/home/VenuePeekModal.tsx` (new)
- `app/main/page.tsx` (extract `refreshLocation()`, add pull-to-refresh)
- `components/tabs/ProfileTab.tsx` (no change needed, already correct)
