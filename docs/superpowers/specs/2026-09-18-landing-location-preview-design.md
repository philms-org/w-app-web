# Landing-Page Location-Activity Preview — Design

**Date:** 2026-09-18
**Status:** Approved (founder direction in-session, 2026-09-18)
**Repo:** `/Users/sr/w-app-web`

## Background

`w-app-web` is live in production. Today's signup funnel is a hard wall:
`/` (marketing) → `/auth/register` (name/email/phone/password/gender/
birthdate/photo) → `/profile/setup` (5-step wizard) → `/main`. Location
permission is only asked *after* all of that, inside `/main`
([app/main/page.tsx:95-223](/Users/sr/w-app-web/app/main/page.tsx)) — a "Share
Your Location" modal that, on Allow, just closes and calls
`requestLocation()`. There is no moment in the funnel where granting
location visibly pays off.

**Founder ask (2026-09-18):** move location permission earlier, to the
landing page, before signup. If the visitor is standing inside an active
venue's geofence right now, show them a **brief preview of that venue** — a
teaser, not real content — with a "Join `<venue name>`" button, then require
the existing signup form to actually continue. If they're not at a venue,
nothing changes: normal marketing page.

This is deliberately smaller than the (separate, already-spec'd, uncommitted)
`docs/superpowers/specs/2026-09-15-guest-first-onboarding-design.md`, which
makes the *entire app* passwordless/anonymous-first. This spec keeps
`/auth/register`'s full form mandatory — signup is still required to reach
`/main` — it only adds a location-gated teaser *before* that wall, on the
landing page.

## Scope

1. **Move the permission ask to `/`.** Unauthenticated first-time visitors
   (same "asked once" gate as today, `localStorage['w_app_location_permission_asked']`)
   see the location modal on landing instead of after signup. Already-asked
   or already-authenticated visitors: unchanged behavior (`AuthedRedirect`
   still bounces authenticated visitors to `/main`).
2. **On Allow:** bootstrap a background Supabase **anonymous session**
   (`signInAnonymously()`) purely so the landing page can read the
   `locations` table under its existing RLS (`to authenticated` — confirmed
   directly against QA: an anon-key request with no session returns an empty
   result, i.e. the current SELECT policy does not grant the `anon` role;
   only `authenticated` — which an anonymous Supabase session satisfies).
   This session is invisible to the rest of the app: Zustand's
   `isAuthenticated`/`user` are **not** touched by it, so the mandatory
   `/auth/register` wall is completely unaffected. It exists solely to make
   one `fetchVenues()` call succeed before anyone has signed up.
3. **Geofence match:** reuse the exact in-range logic `NearbyBanner`
   already uses (haversine distance ≤ `venue.geofence_radius_meters`,
   default 50m) — extracted to a shared helper so it isn't duplicated.
4. **Match found → preview:** a full-screen teaser — venue banner/name and a
   blurred feed backdrop (reusing the existing `FeedBlurBackdrop` /
   `VenuePeekModal` "preview, not real content" pattern) with a
   **"Join `<venue name>`"** button. Auto-advances to `/auth/register` after
   2 seconds, or immediately on tap. Before navigating, the matched venue is
   written to the (in-memory, not persisted) Zustand `selectedLocation`
   field — the same shape `NearbyBanner.handleCheckIn` already produces —
   so that once the visitor finishes the *unchanged* mandatory signup +
   profile wizard and lands on `/main`, the existing, unmodified
   `CheckedInHero` auto-checkin effect completes the real check-in with zero
   new plumbing.
5. **No match (denied, no fix, or nothing in range) → unchanged:** close the
   modal, stay on the normal marketing page exactly as it renders today.
6. **Fail open:** any failure — anonymous sign-ins not enabled on this
   environment yet, network error, empty venue list — is caught and falls
   back to the normal marketing page. Never a dead end.

**Explicitly out of scope:**
- Guest-first/passwordless browsing of the whole app — that's the separate,
  larger `2026-09-15-guest-first-onboarding` initiative (still uncommitted
  in `.worktrees/guest-first-onboarding`); this spec does not build on it
  and does not require it.
- Any change to what `/auth/register` collects, or to `/profile/setup`.
- Any change to `/main`'s own permission-modal code — it stays exactly as
  it is; it just no longer fires for visitors who already granted/denied on
  `/`, because the same `localStorage` flag is shared.
- Enabling anonymous sign-ins on **prod** Supabase — QA only for now, prod
  is a later, separate go/no-go once this is verified end-to-end on QA
  (same precedent as every other prod-affecting toggle in this repo).
- Real venue-feed content in the preview — it's a blurred teaser, matching
  `VenuePeekModal`'s existing "no real data before you're actually in"
  privacy posture. Feed/chat RLS is not touched.

## Design

### 1. `lib/geo.ts` — shared geofence-match helper

Today `NearbyBanner.tsx` computes in-range venues inline in a `useMemo`,
with `DEFAULT_RADIUS_METERS = 50` defined locally. Both `NearbyBanner` and
the new landing gate need the identical "closest venue within its geofence"
check — extracted here so it's defined once.

### 2. `lib/auth.ts` — `signInAnonymously()`

One new thin wrapper, same style as every other function in this file:

```ts
export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data;
}
```

Callers must check `supabase.auth.getSession()` first and only call this if
there's no session yet — an authenticated visitor (real account) must never
have their real session replaced by an anonymous one.

### 3. `components/LandingLocationGate.tsx` — new component, replaces the modal-hosting role `app/main/page.tsx` used to have for first-time visitors

Mounted in `app/page.tsx` alongside (not replacing) `AuthedRedirect`. Only
renders/acts for unauthenticated, not-yet-asked visitors. Three states:

- **Asking** — same modal UI/copy as today's `/main` prompt (moved, not
  rewritten).
- **Previewing** — shown only when a venue match is found. Venue banner,
  name, blurred feed backdrop, "Join `<name>`" button, auto-advance timer.
- **Idle/done** — renders `null`; the marketing page underneath is
  untouched.

### 4. `app/main/page.tsx` — no code change

Its own permission-modal block is unchanged. It simply won't fire for a
visitor who already went through the landing-page prompt, because both read
the same `localStorage['w_app_location_permission_asked']` flag.

## Error handling

| condition | handling |
|---|---|
| Anonymous sign-ins not enabled on this Supabase environment yet | `signInAnonymously()` throws; caught, no preview shown, marketing page renders normally — same as "no match." |
| `fetchVenues()` fails (network, RLS) | Caught, same fallback. |
| Geolocation denied / unsupported | Unchanged from today: fallback NYC coordinate, no preview attempted (nothing to match against a fake location). |
| Visitor already authenticated | `AuthedRedirect` already sends them to `/main`; the gate never mounts its UI. |

## Testing

No automated test suite in this repo (consistent with every prior spec
here). Verification: `npx tsc --noEmit` clean; manual QA once Anonymous
Sign-Ins is enabled on the QA Supabase project (dashboard: Authentication →
Sign In / Providers → Anonymous Sign-Ins) — walk the flow as a fresh visitor
both standing inside a QA test venue's geofence (confirm preview → Join →
register → wizard → lands checked-in on `/main`) and outside any venue
(confirm plain marketing page, no behavior change).

## Deferred / follow-up

- Enabling Anonymous Sign-Ins on **prod** Supabase — separate founder
  go/no-go after QA verification.
- Orphaned anonymous `auth.users` rows: this flow's anonymous session is
  never linked to the real account created by `/auth/register`'s `signUp()`
  (deliberately — this spec doesn't touch the register form), so each
  preview-then-signup leaves one abandoned anonymous row behind. Acceptable
  for now, same class of deferred cleanup already noted in the guest-first
  spec's own Deferred section.
