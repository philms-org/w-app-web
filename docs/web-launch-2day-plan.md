# W App — 2-Day Web Launch Plan

**Set:** 2026-09-08. Supersedes the open-ended Phase B sequencing for the
next two working days. Scope decisions (2026-09-08):

- **Web launch first, iOS after.** Both days on `w-app-web`. iOS token +
  IA alignment (spec stages 4–5) and iOS parity build-out are a separate
  effort next week.
- **Light-only for launch.** Dark stays defined-but-off in `lib/theme.ts`.
  `useTheme()` + `prefers-color-scheme` + toggle is a fast-follow.
- **All four web parity must-haves are launch blockers:** QR/Links contact
  grid · 5-step onboarding · word meter + organizer activity menu · Badges.

Starting state: `main` is 105 commits ahead of `origin`, builds green.
Phase A (ship-readiness) done. Phase B stages 1–2 done, stage 3 partial
(`components/ui/primitives.tsx` exists; `TabBar` upgraded; screens still
inline-styled).

---

## Progress (2026-09-08)

**Day 1 stage 3 — DONE** (commits `c461e5c`..`111`):
- `FeedRow` + `Button`/`Card`/`Chip`/`Input` primitives (`components/ui/primitives.tsx`).
- Auth group — full rewrites onto primitives + tokens.
- Home group — buttons to control radius + on-accent text; `FriendsActivityFeed`
  uses `FeedRow`. Plus a cross-cutting fix: `color: theme.bg` used as a text
  colour in 11 files became invisible after the light flip → `theme.text`.
- Venue group — accent buttons to control radius + `#0D0D0F` text; invisible
  status-chip text fixed; `members` search input radius.
- Profile/misc — `profile/setup` rewritten from hardcoded dark to light tokens
  (−395 lines of dead step 4/5 code); `ProfileTab` old cyan → `theme.accent`;
  `profile/edit` / `admin` / `welcome` button polish.
- **Deferred:** `CheckedInHero` deep pass (token-correct already; its nav chips
  are legitimately pill-radius per design-system §6 — not a blocker).

Next: parity specs (Day 1 item 2), then Day 2.

**Parity specs — DONE** (`docs/superpowers/specs/2026-09-08-web-parity-must-haves-design.md`).
Open questions resolved per the doc's recommendations.

**Parity feature 1/4 — 5-step onboarding — DONE** (commits `0431a77`..`9aac1e9`,
plan `docs/superpowers/plans/2026-09-08-onboarding-5-step-wizard.md`).
`/profile/setup` is now a 5-step wizard (`components/onboarding/`): looking-for
· location · work · fun · visibility+review. One `upsertProfile` on Finish;
non-destructive re-entry via `profileToData`. No migration — all `profiles`
columns already existed. NOT yet verified: the live Finish→`/main` round-trip
(dev env has a stale JWT — needs a real auth session; logic is tsc/build clean).

**Parity 2/4 QR/Links, 3/4 word meter, 4/4 Badges** — plans not yet written.

---

## Day 1 — design-alignment finish + parity specs

### 1. Stage 3 completion — component layer across all screens
- Add `FeedRow` to `components/ui/primitives.tsx` (design-system.md §6).
- Wire `Button` / `Card` / `Chip` / `Input` / `FeedRow` into every screen,
  replacing hand-rolled inline styles. Screen groups (one subagent each,
  `next build` gate between):
  1. Auth — `login`, `register`, `forgot-password`, `reset` (also move the
     remaining hardcoded `#17BFD9` / `#231E20` / `#D5D5D5` to tokens).
  2. Home tab — `HomeTab`, `NearbyBanner`, `CheckedInHero`, `ConnectSheet`,
     `FriendsActivityFeed`, quick-access row.
  3. Venue — `venue/chat`, `members`, `report`, `rewards`, `zones`,
     `carousel`.
  4. Profile + misc — `ProfileTab`, `profile/setup`, `profile/edit`,
     `connections`, `connect/scan`, `admin`, `privacy`, `welcome`.
- Acceptance: no `theme.*` regressions, `tsc` + `next build` green,
  visual sweep of every route (light) shows one consistent system.

### 2. Parity specs + implementation plans
Brainstorm → spec → plan for each. Resolve open schema questions here
(new tables? `profile_field_definitions` coverage? Badges storage?).
- **QR / Links contact grid** — 2×3 contact-method grid + My/User/Edit
  Links. Connections write path (migration 0019) already exists; this is
  mostly UI + a `contact_methods`-shaped read/write. *Smallest — start
  execution today if stage 3 finishes early.*
- **5-step onboarding** — extend existing `/profile/setup` (partial) to
  the full 5 steps. Lightest spec (extension, not net-new).
- **Word meter + organizer activity menu** — progress indicator for
  words/terms chosen + organizer-customisable activity list backed by
  `profile_field_definitions`. Confirm that table exists / its shape.
- **Badges** — earn/display surface, Lexicon folded in. Largest. Needs a
  badges catalog + per-user earned state (likely a new migration).

## Day 2 — parity execution + ship

### 3. Execute parity (priority order — see triage)
1. 5-step onboarding
2. QR / Links contact grid
3. Word meter + activity menu
4. Badges

### 4. location-requests
- Execute the 5-task plan in `.worktrees/location-requests`
  (migration 0020 already written). Apply 0020 to QA then prod via the
  Supabase CLI (token auth, no password — see RESUME-launch-prep
  "PIPELINE"). Merge to `main`.

### 5. Ship
- Final full QA sweep (every route), `next build` green, `npm run lint`.
- **Founder:** `git push origin main`; Vercel prod deploy + env
  (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, optional
  `NEXT_PUBLIC_SITE_URL` / Sentry); Supabase Auth → add prod origin +
  `<origin>/auth/reset` to redirect allow-list, confirm recovery email.
- Agent: smoke-test prod (landing, register, login, reset, check-in,
  connect, report).

## Triage — if time slips

Firm priority if Day 2 runs long: **onboarding > QR/Links grid > word
meter > Badges.** Badges is the first to drop to fast-follow — it is the
only must-have with no existing web surface and a likely new migration.

## Explicitly out (fast-follow, post-launch)

- Dark-theme wiring (`useTheme()` + toggle).
- iOS: token pass, `#17BFD9`→`#22C3C9`, 5-tab→3-tab IA, and porting
  Zones / organizer analytics / Privacy page to iOS.
- Web: Events, Group Chat, Block List, dedicated Attendee History screen,
  Rewards organizer template editor.
- Engagement / leveling system (shared spec, both platforms).

## Risk notes

- Four parity features + stage-3 wiring + location-requests in two days is
  aggressive. The stage-3 wiring is the safest to time-box (it is
  mechanical); parity features are where scope should flex.
- Migrations: agent can apply to QA/prod directly via `supabase db query
  --linked` (token auth). Prod migration application should still be
  called out to the founder before it runs.
- `w-app-ios` has uncommitted organizer-analytics work on
  `feat/wap-foundation` — untouched by this plan, but note it before any
  iOS work starts next week.
