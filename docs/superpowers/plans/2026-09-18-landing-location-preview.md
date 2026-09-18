# Landing-Page Location-Activity Preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ask for location on the landing page (before signup); if the visitor is inside an active venue's geofence, show a 2-second preview of that venue with a "Join `<venue>`" button before routing into the unchanged, mandatory `/auth/register` flow; otherwise show the normal marketing page exactly as today.

**Architecture:** New `components/LandingLocationGate.tsx` mounted on `app/page.tsx` alongside the existing `AuthedRedirect`. On Allow, it bootstraps a background Supabase anonymous session (RLS bootstrap only — never touches Zustand `isAuthenticated`), fetches venues, and checks geofence via a shared helper extracted from `NearbyBanner`. Match → preview screen → `setSelectedLocation` + route to `/auth/register`, so the existing unmodified `CheckedInHero` auto-checkin effect finishes the job once the visitor reaches `/main`. No match / any failure → falls back to today's plain marketing page.

**Tech Stack:** Next.js 15 App Router, TypeScript, Zustand (`lib/store.ts`), Supabase JS (`signInAnonymously`). No new deps. Verification: `npx tsc --noEmit` + `npm run build` + manual preview-browser QA (full end-to-end match path needs Anonymous Sign-Ins enabled on QA Supabase — manual dashboard step, not scriptable from this repo).

**Spec:** `docs/superpowers/specs/2026-09-18-landing-location-preview-design.md`

## Global Constraints

- No change to `/auth/register`, `/profile/setup`, or `/main`'s own permission-modal code.
- The anonymous session must never set Zustand's `user`/`isAuthenticated`/`token` — those stay exactly as `signUp()` sets them today.
- `supabase/config.toml` local flip only (`enable_anonymous_sign_ins = true`) — safe, local-only. QA/prod dashboard toggles are manual steps for the founder, not done by this plan.
- Theme tokens only (`lib/theme.ts`), matching the existing inline-style convention throughout `components/home/*.tsx`.

---

### Task 1: Shared geofence helper + local config

**Files:**
- Modify: `lib/geo.ts` — add `DEFAULT_RADIUS_METERS = 50` and `findClosestVenueInRange(venues, loc)` returning the nearest venue whose distance ≤ its `geofence_radius_meters` (or the default), else `null`.
- Modify: `components/home/NearbyBanner.tsx` — import the new constant/helper instead of its local inline copy (behavior-preserving refactor only).
- Modify: `supabase/config.toml` — `enable_anonymous_sign_ins = true`.

- [ ] Implement `findClosestVenueInRange` in `lib/geo.ts`, reusing `haversineMeters`.
- [ ] Update `NearbyBanner.tsx`'s `useMemo` to use it for the `inRange`/`nearby` split (same output shape as today).
- [ ] Flip `enable_anonymous_sign_ins` in `supabase/config.toml`.
- [ ] `npx tsc --noEmit` clean.
- [ ] Commit: "Extract shared geofence-match helper; enable local anonymous sign-ins"

### Task 2: `signInAnonymously()` helper

**Files:**
- Modify: `lib/auth.ts` — add `signInAnonymously()` per the spec (thin wrapper, throws on error).

- [ ] Add the function, same style as the file's other wrappers.
- [ ] `npx tsc --noEmit` clean.
- [ ] Commit: "Add signInAnonymously auth helper"

### Task 3: `LandingLocationGate` component

**Files:**
- Create: `components/LandingLocationGate.tsx`.
- Modify: `app/page.tsx` — mount it alongside `<AuthedRedirect />`.

Behavior (per spec §3):
- Skip entirely if authenticated or already asked (`localStorage['w_app_location_permission_asked']`).
- "Asking" state: the existing `/main` permission-modal markup, moved here verbatim (copy/style unchanged).
- On Allow: `requestLocation()` → check `supabase.auth.getSession()`; if none, `signInAnonymously()` (catch+fall back to idle on any failure) → `fetchVenues()` (catch+fall back) → `findClosestVenueInRange`.
  - Match: "Previewing" state — venue banner/name, `FeedBlurBackdrop`, "Join `<name>`" button. `setTimeout` 2000ms and the button's `onClick` both call the same `proceed()`: convert venue → `Location` shape exactly like `NearbyBanner.handleCheckIn`, `setSelectedLocation(...)`, `router.push('/auth/register')`.
  - No match: render `null`, marketing page shows normally.
- On "Maybe Later": same as today's deny handler (fallback coordinate, mark asked, close).
- Set `localStorage['w_app_location_permission_asked']` on both Allow and Deny, matching current `/main` behavior exactly.

- [ ] Write the component.
- [ ] Wire it into `app/page.tsx`.
- [ ] `npx tsc --noEmit && npm run build` clean.
- [ ] Manual preview: as a fresh visitor with no QA venue in range, confirm plain marketing page, no console errors, `w_app_location_permission_asked` gets set after Allow/Deny.
- [ ] Commit: "Add landing-page location-activity preview before signup"

## Self-review

- Spec §1–6 all map to Task 3's single component; §"No code change to `/main`" is honored (no `app/main/page.tsx` edit anywhere in this plan).
- No RLS/migration task — matches the spec's decision to use anonymous sessions instead.
- The full match→preview→Join→register→checked-in-on-`/main` path can only be manually verified once Anonymous Sign-Ins is enabled on QA (founder action, outside this repo) — flagged in Task 3's manual-verification step and the spec's Testing section, not silently assumed to work.
