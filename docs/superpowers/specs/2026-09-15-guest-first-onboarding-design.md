# Guest-First Onboarding / Passwordless Check-In — Design

**Date:** 2026-09-15
**Status:** Approved (founder walked through the interactive prototype, 2026-09-15)
**Repo:** `/Users/sr/w-app-web`

## Background

`w-app-web` is **live in production beta** at `w-app-web.vercel.app` (confirmed
2026-09-15 — real content served, `main` in sync with `origin/main` at `41ee554`,
Vercel auto-deploys every push). Real users can sign up today. This spec is a
migration of that live signup path, not a pre-launch feature.

Today's flow is a hard wall before any content:

`/` (marketing page) → `/auth/register` — one form asking for **name, email,
phone, password, confirm password, gender, birthdate, and a profile photo**
(`app/auth/register/page.tsx`), calling `signUp()` (`lib/auth.ts`,
`supabase.auth.signUp({ email, password })`) → `upsertProfile()` → a forced
5-step preferences wizard (`app/profile/setup/page.tsx`, `components/onboarding/`)
→ `/main`. `/main` (`app/main/page.tsx`) redirects to `/auth/login` if
`!isAuthenticated`, and only *then* shows the location-permission modal that
already exists there.

The app already has real check-in (`location_checkins` table, `checkIn()` in
`lib/data.ts`), venue chat, and a feed — all fully built, just unreachable
without running that whole gauntlet first.

**Goal:** let a visitor reach the feed, browse, and check in with only a name
and email — no password, no upfront wizard — and collect everything else
(photo, city, preferences) later, while they're already using the app.

## Scope

1. Anonymous session on landing — `/` creates a Supabase anonymous session and
   routes straight into `/main`'s feed. No signup wall.
2. The existing location-priming modal (today in `app/main/page.tsx`) moves
   earlier — it's the first thing an anonymous visitor sees in `/main`,
   unchanged in content/behavior otherwise.
3. A single **vitals gate** (name + email, bottom sheet) triggered the moment
   an unidentified session tries to check in, open venue messaging, or open
   the Profile tab.
4. Submitting vitals **upgrades the existing anonymous session in place**
   (`supabase.auth.updateUser`) — same `auth.uid()`, so nothing done while
   anonymous is lost — and immediately completes whatever action triggered
   the gate. No blocking on email confirmation.
5. Passwordless return path: "Already checked in before? Sign in" sends a
   magic link (`signInWithOtp`) instead of asking for a password.
6. Profile completion becomes incremental: the same fields the 5-step wizard
   already collects (`components/onboarding/`), surfaced as independently
   saveable rows from the Profile tab instead of a forced linear flow, plus a
   new profile-photo entry point (today only reachable via the register form).
7. Infra: enable anonymous sign-ins on the Supabase project (currently
   `enable_anonymous_sign_ins = false` in `supabase/config.toml`; the
   dashboard toggle for QA/prod is a separate, explicit founder action — see
   Deferred).

**Explicitly out of scope:**
- Actually flipping the anonymous-sign-ins toggle on QA/prod Supabase, or
  deploying this — separate go/no-go from the founder once the code is built.
- Removing password login entirely. `/auth/login` (password) stays reachable
  for the real, already-registered users this live app has today — see
  §6 below. It's just no longer the default path the new flow surfaces.
- Redesigning the *content* of the 5 preference-wizard steps (looking-for,
  city, work, fun, visibility) — reused as-is, just no longer forced/linear.
- Building real venue-chat UI — messaging already exists elsewhere in the
  app; this spec only changes *when* it's reachable, not what it looks like.
- The `/welcome` carousel — already unlinked from the main flow per
  `docs/RESUME-launch-prep.md`; left alone here.
- The native iOS app (`WAPAuth.swift` and friends) — web-only.
- Rate-limiting beyond what Supabase already enforces (`anonymous_users = 30`
  per IP per hour, `supabase/config.toml`).

## Design

### 1. Verified against the live schema (2026-09-15, read-only introspection)

Before designing the "minimal profile row," this was checked directly against
prod (`yatixschvikugckkpfum`) rather than assumed:

- `profiles` has exactly three `NOT NULL` columns: `id`, `display_name`,
  `is_master_admin` (defaulted). Everything else — `email`, `phone`, `gender`,
  `date_of_birth`, `avatar_url`, `city`, … — is nullable. `{id, display_name}`
  is a fully valid row.
- `profiles_insert_own` / `profiles_update_own` RLS policies are `to
  authenticated`, `with check (auth.uid() = id)` — no anonymous-specific
  carve-out needed. **Anonymous Supabase sessions hold role `authenticated`**
  (with an `is_anonymous: true` JWT claim), the same role every other
  `to authenticated` policy in this repo already targets
  (`location_checkins`, `conversations`, `conversation_participants`, …).
- No trigger creates a `profiles` row on `auth.users` insert — row creation is
  and stays entirely client-driven via `upsertProfile()`, same as today.

**Conclusion: no migration, and no RLS change, is needed anywhere for this
feature.** Every table this flow touches already grants exactly the access an
anonymous-then-upgraded session needs, because it was already written against
`auth.uid()` + `authenticated`, not against "has a password" or "has an
email."

### 2. Session bootstrap — replacing `AuthedRedirect`

`components/AuthedRedirect.tsx` (mounted on `/`) currently only redirects
*already-authenticated* visitors to `/main`. It becomes `EnsureSession`:

```tsx
useEffect(() => {
  if (hasSession) { router.replace('/main'); return; }
  supabase.auth.signInAnonymously().then(() => router.replace('/main'));
}, [hasSession, router]);
```

Crawlers (no JS) still render the server-side marketing content in
`app/page.tsx` untouched — this component returns `null`, same as today.

`lib/store.ts` needs a session-shaped replacement for the current
`isAuthenticated`/`user` pair: `isAuthenticated` (any session, anonymous or
not — gates route access) stays, plus a new `isIdentified` derived from
whether the session's `user.email` is set (gates the vitals-triggered
actions). `setUser`/`setToken` keep their shape; `isIdentified` is computed
from the same Supabase user object already being read on auth state changes,
not a new field to persist.

### 3. Route guard (`app/main/page.tsx`)

Today: `if (!isAuthenticated) router.push('/auth/login')`. Changes to: if
there's no session at all (shouldn't normally happen — `EnsureSession` always
creates one before landing here — but covers a direct deep link to `/main`),
send to `/` to bootstrap one, not to `/auth/login`. The location-priming
modal logic already in this file (`showLocationPrompt`,
`handleAllowLocation`, `handleDenyLocation`, backed by
`lib/geolocation.ts`'s `requestLocation()`) is **unchanged** — it already
runs as soon as `/main` mounts, which is now also "as soon as an anonymous
visitor lands," so no relocation is actually needed, only the auth check
above it.

### 4. The vitals gate

New component, e.g. `components/onboarding/VitalsGate.tsx` — a bottom sheet
(reuse `radius.sheet`, `theme.glassFill`/`glassBorder` tokens per
`docs/design-system.md`) with **name** and **email** fields only
(`autoComplete="name"` / `autoComplete="email"` `inputMode="email"` for iOS
QuickType), opened from three call sites:

- `requestCheckIn()` in the venue-card check-in handler (currently
  `checkIn()` in `lib/data.ts`) — if `!isIdentified`, open the gate with
  intent `checkin:<locationId>`; on success, call `checkIn(locationId)`.
- Opening venue messaging (wherever that entry point lives today) — intent
  `messages`.
- Opening the Profile tab — intent `profile`.

On submit:

```ts
const { error } = await supabase.auth.updateUser({
  email,
  data: { display_name: name },
});
if (error) { /* see §6 */ return; }
await upsertProfile({ id: session.user.id, display_name: name, email });
```

This **does not wait** for the confirmation email to be clicked — `auth.uid()`
is unchanged, so the triggering action (check-in / open chat / open profile)
runs immediately after. Supabase sends the confirmation async in the
background; clicking it is what flips `is_anonymous` to `false` permanently
server-side, which is invisible to the user in this flow.

### 5. Returning-user sign-in

A secondary mode of the same sheet: one email field, "Send magic link" →
`supabase.auth.signInWithOtp({ email })`. This is the **only** returning-user
path surfaced in the new flow. `/auth/login` (password) is not linked from
here but stays live and working — see §6.

### 6. Existing users (this app has real ones today)

Because this is a live app, some visitors already have a password account
from the current register form. Two cases the vitals gate must handle
explicitly, not just the happy path:

| condition | handling |
|---|---|
| New anonymous session submits an email that already belongs to a real (non-anonymous) account | `updateUser({ email })` returns an error (Supabase rejects the email as already in use — exact error shape to confirm against the live SDK version during implementation). Catch it, keep the sheet open, swap to the "sign in instead" mode (§5) pre-filled with that email, with copy: "That email's already got an account — we'll send you a sign-in link instead." |
| Existing user prefers their password | `/auth/login` is untouched and still reachable directly (not deleted, not gated) — just no longer linked from the marketing page's primary CTA or the vitals gate. Anyone who bookmarked it or knows it keeps working. |

`/auth/register`'s heavy form is retired from the primary flow (nothing links
to it after this ships) but the route/component can stay in the codebase
unreferenced rather than being deleted in this pass — low risk, easy to
actually delete once this flow has run in prod for a while.

### 7. Progressive profile

`components/onboarding/` (`StepLookingFor`, `StepLocation`, `StepWork`,
`StepFun`, `StepVisibility`, `types.ts`) already model each field
independently (`OnboardingData`, `dataToProfilePatch`) — the forced wizard in
`app/profile/setup/page.tsx` is the only thing that's linear. The Profile
tab gains a fields list (photo, "where you are" = `city`, "looking for",
"what you do", "fun stuff", visibility toggle), each row opening its
existing step component inline and saving independently via `upsertProfile`
on change, instead of requiring all 5 steps before any of it persists.
`app/profile/setup/page.tsx` can stay as-is for now (still reachable, e.g.
from a "review all details" link) — this is additive, not a replacement of
that page.

Photo upload reuses the existing `uploadAvatar()` (`lib/data.ts`, already
used by the register form) — no new storage/RLS work.

### 8. Infra — anonymous sign-ins

`supabase/config.toml` line 178 (`enable_anonymous_sign_ins = false`)
controls **local dev only**. QA (`ducadjakxmkfcvrteoqz`) and prod
(`yatixschvikugckkpfum`) each need the equivalent dashboard toggle (Auth →
Sign In / Providers → Anonymous Sign-Ins) turned on separately — this is a
real, visible account setting, not something to flip silently. Flagged again
in Deferred below as a founder go/no-go, same treatment as every other
prod-affecting toggle in this repo's history (Sentry DSN, redirect
allow-list, etc.).

## Error handling

| condition | message |
|---|---|
| Vitals submit: name or email empty | (client-side: submit button disabled until both are filled, matches current register-form pattern) |
| Vitals submit: malformed email | "That doesn't look like a valid email." |
| Vitals submit: email already belongs to a real account | See §6 — silently redirect into the "sign in instead" mode with that email pre-filled, plus the copy above. |
| Vitals submit: network/RPC failure | "Couldn't save that — try again." Sheet stays open, nothing else changes (session is still anonymous, still usable for browsing). |
| Magic-link request: malformed email | "That doesn't look like a valid email." |
| Magic-link request: network/RPC failure | "Couldn't send the link — try again." |
| Anonymous session bootstrap itself fails (network, or anonymous sign-ins not yet enabled on that environment) | Fall back to today's behavior: show the marketing page instead of silently spinning, so the site never dead-ends. |
| Location permission denied | Unchanged from today — falls back to the NYC default in `lib/geolocation.ts`. |

## Testing

No automated test suite in this repo (consistent with every prior spec here).
Verification: `npx tsc --noEmit` clean; manual QA against `w-app-qa` once
anonymous sign-ins are enabled there — walk the flow as a fresh
anonymous visitor (check-in triggers the gate, submitting vitals completes
the check-in immediately), then repeat with an email that already has a QA
account to confirm the "sign in instead" redirect actually fires; direct
`supabase db query` row assertions on `profiles`/`location_checkins` after
each step, same pattern as every prior plan in `docs/superpowers/plans/`.

## Decisions made without human input

None — every product decision here (anonymous-session strategy, gate scope
covering check-in **and** messaging/connecting, fully passwordless for new
users, `/auth/login` kept alive for existing accounts) was made by the
founder in-session on 2026-09-15, confirmed against a click-through
prototype before this spec was written.

## Merge conflict with concurrent work (found 2026-09-18)

While this branch sat uncommitted-to-`main` in `.worktrees/guest-first-onboarding`,
a separate, smaller spec —
`docs/superpowers/specs/2026-09-18-landing-location-preview-design.md` — shipped
directly to `main` (commit `30c79a1`, on top of an unrelated sign-up bugfix,
`2534b99`). That spec explicitly assumed no interaction with this one ("this
spec does not build on it and does not require it," per its Background
section), but a dry-run three-way merge (`git merge-tree`, no working-tree
changes) between `origin/main` and this branch shows that assumption doesn't
hold in practice:

- **`app/page.tsx` / `components/AuthedRedirect.tsx` — real design collision,
  not just adjacent edits.** `main`'s landing-location-preview spec mounts a
  new `LandingLocationGate` *alongside* the existing `AuthedRedirect`
  (§3 of that spec: "Mounted in `app/page.tsx` alongside (not replacing)
  `AuthedRedirect`"). This spec's §2 above deletes `AuthedRedirect.tsx`
  entirely and replaces it with `EnsureSession`, which unconditionally starts
  a real anonymous session for *every* visitor rather than only when a
  location-permission modal is being shown. Both branches solved "what
  happens when a visitor lands on `/`" differently; merging requires an
  actual product decision — e.g. does `EnsureSession` subsume
  `LandingLocationGate`'s anonymous-session bootstrap and geofence-preview
  behavior, does the preview become one of `EnsureSession`'s states, or do
  they run side by side — not a mechanical conflict-marker resolution.
- **`lib/auth.ts` — mostly mechanical.** Both branches independently added
  `signInAnonymously()` with a different doc-comment directly above it,
  producing a textual conflict on the same lines. This branch's two other new
  functions in this file (`upgradeAnonymousUser`, `signInWithMagicLink`) don't
  conflict with anything on `main` — they just need to survive the merge of
  the surrounding lines.
- **Clean, no action needed:** `lib/store.ts` (this branch's additive
  `isAnonymous` field merges cleanly) and `supabase/config.toml` (both
  branches flip the same local-dev flag the same way).

Not resolved as part of this note — whoever picks this branch back up should
decide the `AuthedRedirect`/`EnsureSession`/`LandingLocationGate` question
above before merging, since it's a real architecture call, not busywork.

## Deferred / follow-up

- **Founder go/no-go + manual dashboard toggle**: enabling anonymous
  sign-ins on QA and prod Supabase — required before this can be tested or
  shipped anywhere but local dev; not something this session should flip
  unilaterally on a live app.
- Actually deleting `/auth/register`'s heavy form and its route once the new
  flow has been live for a while and nothing depends on it.
- A "review all details" full-profile view, if the incremental Profile-tab
  rows turn out to feel insufficient once real usage data comes in.
- Rate-limiting/abuse handling for anonymous session creation beyond
  Supabase's built-in per-IP cap, if that ever proves insufficient.
