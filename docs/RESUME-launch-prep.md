# W App — Launch Prep: RESUME HERE (updated 2026-08-26)

## ONE-LINE STATUS
Prod migrations 0001-0016 are ALL APPLIED + VERIFIED on prod (2026-08-26) —
owner-benefits, the organizer-analytics feature, and the pg_cron purge job
(`purge-stale-zone-positions`, hourly, confirmed live) are all fully on
prod now. The other non-code launch gate (privacy disclosure copy) has a
real, substantive problem — see below — before it should be finalized.

**RISK: `main` is STILL unpushed to `origin` as of 2026-08-26** (confirmed
again: no cached GitHub credentials in this environment — `osxkeychain`
helper configured but empty, no `gh` CLI installed; clean fast-forward, no
divergence, just needs the founder to push from an authenticated terminal).
All work below exists only in this local checkout until then.

**FOUNDER DECISION NEEDED: privacy disclosure copy has 2 factual
inaccuracies vs. the real implementation** (found via independent review,
2026-08-26):
1. "Individual attendees are never identified... figures below 3 hidden" —
   only true for `occupancy` and cross-venue counts. `avgDwellMinutes` and
   `transitions` in `fetch_zone_analytics` have NO k=3 floor — a zone with
   1 person still shows its dwell time / transition count.
2. "Aggregated, anonymized statistics are kept longer [than 48h]" — false.
   Nothing persists past the raw-fix purge; the report recomputes live from
   the trailing 48h window every time, so data disappears from the report
   once it ages out — there's no persisted aggregate table anywhere.
   The copy's own example ("Main Bar was busiest at 9pm") implies a lasting
   record that doesn't exist.
Also: the tracking banner/copy imply tracking happens on every check-in;
it only fires for venues that have zones defined.
**Decide one of:** (a) tighten the SQL — add k=3 to dwell/transitions, add
a real persisted aggregate table if "kept longer" should be true, or
(b) rewrite the copy to match what the code actually does today. Do not
publish the copy as-is — these are exactly the kind of claims that create
real legal exposure if untrue.

## PIPELINE (no password, no local psql needed)
- Auth: Supabase CLI **token auth** (already logged in). NO db password needed.
- Apply SQL:  `supabase db query --linked < path/to/file.sql`
- Read state: `echo "select ..." | supabase db query --linked`
- Switch target: `supabase link --project-ref <ref>`  (token auth, no pw prompt)
  - PROD ref: yatixschvikugckkpfum   ("The W app")
  - QA   ref: ducadjakxmkfcvrteoqz   ("w-app-qa")
- **IMPORTANT lesson learned:** always run `supabase link`/`db query` from
  inside `/Users/sr/w-app-web` (or wherever `supabase/` lives) — running
  from `~` silently fails to do anything useful. Also: multi-line heredoc
  SQL blocks are fragile to paste into a terminal; prefer the single-line
  `echo "...;" | supabase db query --linked` form for verification queries.

## PROD STATE (verified 2026-08-26, direct query — trust this over any doc)
ALL applied + verified on prod: 0001 through 0010 (RBAC/master-admin,
locations insert policy, checkout policy, DM RLS fix, profiles RLS
lockdown + self-promotion fix, checkin cleanup/indexes, venue group chat +
chat_join_mode, rewards write policy, reward tiers).

0011-0015 (venue zones, zone position fixes + RPC, analytics functions,
contact method type column, final-review fixes) applied to prod and
verified 2026-08-25: FK cascade confirmed (`ON DELETE CASCADE`), 3 indexes
on `zone_position_fixes`, `record_contact_method_choice` RPC present, old
overly-broad `connections` update policy confirmed removed.

0016 (hourly pg_cron purge job) applied to prod and verified 2026-08-26:
`purge-stale-zone-positions` job confirmed present, schedule `0 * * * *`.

## Organizer analytics feature (built + merged 2026-08-25)
See `docs/superpowers/specs/2026-08-25-organizer-analytics-design.md` (spec)
and `docs/superpowers/plans/2026-08-25-organizer-analytics.md` (7-task plan).
Built via subagent-driven-development in an isolated worktree, merged to
`main` after a clean whole-branch review + one fix wave. Adds to the
organizer report: zone occupancy/dwell/flow (GPS-based, anonymized, k=3
threshold), cross-venue movement %, average visit dwell time, group +
approximate-DM message counts, and a QR-scan/contact-method-choice
breakdown. One iOS commit was also required (in the sibling `/Users/sr/w-app-ios`
repo, on branch `feat/wap-foundation`) to capture which contact method a
scanner chose — NOT yet merged/integrated with that branch's other pending
work, still sitting as 2 extra commits there.

### 2 non-code launch gates
1. **48h purge job — DONE, live on prod.** `supabase/migrations/0016_zone_position_purge_cron.sql`
   adds an hourly `pg_cron` job (`purge-stale-zone-positions`) calling a new
   `purge_stale_zone_positions()` function — same delete `fetch_zone_analytics()`
   already did inline, now independent of report loads. Applied + verified
   on QA and PROD (job active, `0 * * * *`, confirmed 2026-08-26).
2. **Location-tracking disclosure — draft has real accuracy problems, see
   "FOUNDER DECISION NEEDED" at the top of this doc.** Added: a line in the location-permission
   modal (`app/main/page.tsx`) explaining check-in triggers venue-scoped
   tracking; a persistent "Sharing location with this venue" indicator while
   checked in (`components/home/CheckedInHero.tsx`); a new `/privacy` page
   (`app/privacy/page.tsx`) covering what's collected/why/retention/controls.
   **This is draft copy pending founder review** — not final legal language,
   and not yet deployed to prod (code committed to `main`, but `main` itself
   is still unpushed to `origin` as of this session — see below).

### Also worth knowing
- The QR-scan-to-connection flow (scanning someone's code to create a
  `connections` row) **does not exist yet on either platform** — this
  predates today's work, was simply never built. The new contact-method
  tracking added today is correct and will start working the moment that
  flow exists, but produces no data until then. The existing "QR Scans"
  report tile has always read 0 for the same reason.
- `record_zone_position` now requires the caller to have an open check-in
  at the venue (added in 0015) — zone tracking only fires for real
  checked-in attendees, not arbitrary authenticated users.
- Occupancy/cross-venue counts below 3 are suppressed (k=3 anonymity floor,
  added in 0015) so a lone attendee can't be re-identified via a "1" in the
  report combined with the organizer's live attendee list.

## HYGIENE
  - All code + all migration files (0001-0016) committed on `main`.
  - `.env.local` points at the QA cloud project directly.

## STILL QUEUED (code, no DB needed — unrelated, can parallelize):
  - ~~Sentry + @vercel/analytics (launch-day error visibility)~~ — DONE 2026-08-31,
    see "OBSERVABILITY / ANALYTICS" section below. Sentry needs a DSN before it
    reports anything.
  - Hide paused stub features (Connect QR / Peek / Friends Activity)
  - SEO/meta pack: OG image, app/sitemap.ts, app/robots.ts, crawlable landing page

## OBSERVABILITY / ANALYTICS (wired 2026-08-31, NOT yet reporting)
- `@vercel/analytics@2` — `<Analytics />` mounted in `app/layout.tsx`. Verified
  in dev (pageview + route-change events firing in debug mode). Data only flows
  once **Web Analytics is enabled in the Vercel project dashboard** (Analytics
  tab, one click). No env vars needed.
- `@sentry/nextjs@10` — full SDK scaffold, currently a **no-op** because no DSN:
  `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation-client.ts`,
  `instrumentation.ts` (register + onRequestError), `app/global-error.tsx`
  boundary, and `withSentryConfig` wrapping `next.config.ts`. CSP updated:
  `script-src` += `va.vercel-scripts.com`, `connect-src` += `*.sentry.io`.
  **To activate:** provision a Sentry project (Vercel Marketplace → Sentry, or a
  direct Sentry account) and set env vars in the Vercel project:
    - `NEXT_PUBLIC_SENTRY_DSN` — turns on capture in all runtimes (required).
    - `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` — build-only, enable
      source-map upload for readable stack traces (optional but recommended).
  `npm run build` is clean with none of these set. Sampling is currently 100%
  (`tracesSampleRate: 1`) — dial down in the Sentry project once traffic is known.

## CHECKPOINT (paused 2026-08-26, restarting computer)
- The full organizer-analytics feature was demo-walked-through live in the
  browser and confirmed working end-to-end: disclosure modal + `/privacy`
  page, master-admin panel's "Manage Zones" link, the report page's 5 new
  sections rendering real historical data (188.3 min avg dwell confirmed
  again live), and the zones page's graceful "couldn't get your location"
  handling. Demo QA account created + fully cleaned up afterward.
- Two other Claude Code sessions (peer sessions on this same repo) are
  independently active and have added 2 more commits on `main` unrelated to
  anything in this doc: `e335a49` (a "Round 1 home banner + feed teaser"
  design spec) and `146e4f8` (its 8-task implementation plan). Not reviewed
  or built by this thread — flagging so a future session doesn't confuse
  "Round 1" with anything described above.
- `main` is STILL unpushed to `origin` as of this checkpoint (see RISK note
  near the top) — nothing from today, including the fully-verified prod
  migrations 0001-0016, exists on GitHub yet.

## OPEN ASKS FOR FOUNDER
  - QA project should be on paid/always-on plan (keeps auto-pausing = unreliable staging).
  - Confirm Supabase Pro backups/PITR active on PROD before further prod
    applies (rollback safety) — still not confirmed.
  - The privacy disclosure copy accuracy problem (see "FOUNDER DECISION NEEDED" at top) — the purge job is done.
  - Decide what to do with the 2 pending commits on iOS `feat/wap-foundation`
    (contact-method capture) relative to that branch's other in-progress work.

## ROUND 1 HOME BANNER + FEED TEASER — MERGED; MANUAL QA DONE 2026-09-01
- **MERGED to `main`** as `f70b77a` (merge of `home-banner-feed-round1`) — the
  "NOT YET MERGED" header below is stale. All 8 task commits (`2d32f33` ..
  `78c3c13`) are on `main`. `npx tsc --noEmit` clean on `main`.

### MANUAL QA — authenticated browser click-through (2026-09-01)
Run against local dev (`next dev`, `.env.local` → `w-app-qa`), logged in as
`testy@gmail.com` (master admin). Geolocation simulated via a
`navigator.geolocation.getCurrentPosition` override. QA project has **only 1
venue** (`QA Test Venue` @ 40.7128,-74.006, r=150m, no banner, no description)
— so the multi-venue split and the `HeroCarousel` path inside `VenuePeekModal`
could NOT be exercised (see gaps).

**PASS:**
- NearbyBanner in-range state: geo on venue → header "Location detected",
  working refresh icon, "You're here — check in" row with the venue card +
  "Check In".
- Check In → `checkOut` via the hero's Back arrow: real `location_checkins`
  row created and then closed (`checked_out_at` set) in the QA DB. `CheckedInHero`
  renders with the "Sharing location with this venue…" disclosure indicator.
- Manual refresh (banner refresh button) → `requestLocation()` re-reads geo;
  moving the sim fix ~1.9 km away reclassifies the venue from "You're here"
  to "Nearby — peek in" with a "Peek" button. In-range/nearby split works.
- Peek → `VenuePeekModal`: venue name + blurred `FeedBlurBackdrop` + "Check in
  to see what's happening here" caption; no carousel section (venue has no
  banners — correct fallback). Closes via the X **and** via backdrop click.
- No-location state: "Location not detected" + "Enable Location" + "or enter
  it manually" → reveals venue picker → picking the venue flips straight to
  the detected / "You're here" state.
- `locationDenied` branch (Critical fix #1) visibly works: after a failed
  geo read the empty state shows the distinct "Couldn't get your location.
  Try again or enter it manually." copy (vs. the pre-permission copy).
- `usePullToRefresh` (fix #2): a synthetic top-of-page pull past threshold
  fired `getCurrentPosition` **exactly once** — no StrictMode double-fire.
- `FriendsActivityFeed`: correct copy ("Add friends to see where they've
  been") + "0 / 3 connections" counter.
- `/profile/edit` via the in-app path (Profile tab → Edit Profile, client
  nav): form prefilled with name/phone; changed the name, Save →
  `router.back()` to `/main`, `profiles.display_name` updated in the QA DB,
  Zustand store updated, phone preserved. Test account restored to "rf" after.

**FINDINGS:**
1. **[FIXED 2026-09-01] `/profile/edit` loaded BLANK on a hard load / refresh
   — data-loss risk.** `app/profile/edit/page.tsx` seeded every form field
   from `useState(user?.x ?? '')` with no resync. Zustand-`persist` rehydrates
   *after* first render, so on any load where the store wasn't hydrated yet
   (refresh on the page, deep link, slow device) Full Name / Phone came up
   empty, and a subsequent Save wrote `display_name: ''` / `phone: ''` over the
   real profile. Fix: form state now starts `''` and is seeded once via a
   `useEffect` when `user` first arrives; the page renders `null` until
   `hasHydrated && user` (matches the `/main` + `/admin/layout` pattern) and
   redirects to `/auth/login` if hydrated with no user. Verified in-browser:
   prefills correctly on both hard reload and in-app nav; `tsc --noEmit` clean.
   Uncommitted as of this note.
2. **[FIXED 2026-09-01] Redundant `checkIn()` → 409 (pre-existing, not
   Round 1).** `CheckedInHero`'s mount effect called `checkIn()` more than
   once per venue entry (re-runs on `withinGeofence` change; dev StrictMode
   double-invokes it). `checkIn()`'s own select-then-insert is a TOCTOU race,
   so the concurrent second call hit `uniq_active_checkin_per_user_location`
   and logged `Check-in failed: duplicate key …` (the Next dev "1 Issue"
   pill). Fixed on both layers: (a) `lib/data.ts` `checkIn()` now treats a
   `23505` unique-violation on insert as success — idempotent for any caller;
   (b) `CheckedInHero` guards the call with a `checkInAttemptedFor` ref keyed
   by location id, cleared on check-out. Verified in-browser: one POST to
   `location_checkins` per check-in (was two), exactly one open row, no 409;
   check-out still closes the row. `tsc --noEmit` clean. Uncommitted as of
   this note.
3. **[FIXED 2026-09-01] Cosmetic:** `FeedBlurBackdrop` rendered at near-zero
   contrast against the dark surface + scrim — invisible in both
   `FriendsActivityFeed` and `VenuePeekModal`. The skeleton bars used
   `theme.surface2` (~= the surfaces it sits on) and then `opacity: 0.55` +
   `blur(6px)` washed it out entirely. Fixed in
   `components/shared/FeedBlurBackdrop.tsx`: bars/avatars now translucent
   white (`rgba(255,255,255,0.16–0.20)`), `opacity` 0.55 → 0.9, `blur` 6 → 5.
   Verified in-browser: blurred feed rows now read in both consumers, caption
   text still legible. `tsc` + `next lint` clean. Uncommitted as of this note.
4. NearbyBanner shows a live "Check In" CTA for a venue the user is *already*
   checked into (no active-check-in awareness) — minor; ties into finding #2.

**QA GAPS (need a 2nd seeded venue):**
- True multi-venue in-range/nearby split (only ever 1 venue → 1 row at a time).
- `VenuePeekModal` with real `HeroCarousel` images + the "X sits on top of the
  carousel back-arrow" deferred note.
- Seed via the master-admin panel (the `testy` account is master admin); add
  at least one venue with a `banner_image` and a `description`, ~300–1000 m
  from `QA Test Venue`.

## ROUND 1 HOME BANNER + FEED TEASER — CODE COMPLETE, NOT YET MERGED (2026-08-26)
- The plan flagged above (`e335a49`/`146e4f8`, "Round 1 home banner + feed
  teaser") is now fully implemented via superpowers:subagent-driven-development
  in the worktree `.worktrees/home-banner-feed-round1` (branch
  `home-banner-feed-round1`), 9 commits ahead of the `main` commit it
  started from: extracted `lib/geo.ts`/`lib/geolocation.ts`, added
  `usePullToRefresh` + `FeedBlurBackdrop`, rebuilt `NearbyBanner` (in-range
  check-in / nearby-peek split + manual refresh), added `VenuePeekModal`
  (preview-only Round 1 scope) and a real `/profile/edit` page.
- All 8 tasks passed individual spec+quality review. The final whole-branch
  review then caught 1 Critical + 4 Important cross-task issues — all
  traced back to code the plan itself specified verbatim, not implementer
  deviations — approved by the founder for immediate fix rather than
  deferral: (1) `NearbyBanner` wasn't reading `locationDenied`, so a denied
  geolocation prompt was silently treated as a real fix and could drive a
  real check-in write at the hardcoded NYC fallback coordinate; (2)
  `usePullToRefresh` fired its refresh callback twice under React
  StrictMode (side effect inside a `setState` updater); (3) the same hook
  had no horizontal/vertical axis check, so swiping the venue card rows
  sideways could false-trigger a refresh; (4) a failed venue fetch had no
  retry path; (5) re-uploading a profile avatar returned the same cached
  URL, so the new photo might not visibly update. Fixed in `78c3c13`,
  re-reviewed clean (all 5 addressed, no new breakage).
- `npx tsc --noEmit` is clean as of the last commit on that branch.
- **Not done:** a real authenticated browser click-through (login → check
  a venue in-range → Peek a nearby one → pull-to-refresh → edit profile,
  save, confirm it persists) — every implementer subagent hit the login
  gate with no test credentials available to it. Needs a human (or a
  session with QA credentials) to do this pass before merging. See
  [[qa-pass-2026-08-06-status]] for the existing QA test account
  (`testy@gmail.com` / "rf", master admin, `w-app-qa` project) — password
  not stored anywhere in this repo or memory by design.
- Deferred (not fixed, not blocking): a stale/wrong comment in
  `lib/geolocation.ts` claiming it's the only geolocation call site
  (`MapTab.tsx` and `app/main/venue/zones/page.tsx` also call it directly,
  and `MapTab.tsx` has its own separate local `requestLocation` with a
  different `maximumAge`); `DEFAULT_RADIUS_METERS` duplicated between
  `NearbyBanner.tsx` and `MapTab.tsx` instead of living in `lib/geo.ts`;
  `VenuePeekModal`'s close-X sits directly above `HeroCarousel`'s own back
  arrow (visually redundant, not broken); `FriendsActivityFeed`'s blurred
  backdrop may read as very low-contrast against its own scrim (worth an
  eyeball); `/profile/edit`'s `router.back()` vs. the rest of the app's
  `router.push('/main')` convention, and writing `phone: ''` instead of
  `null` when cleared. None of these are correctness bugs.
- Once the manual pass is done, this branch is ready for
  superpowers:finishing-a-development-branch (merge into `main` or open a
  PR — not yet decided).
