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
real legal exposure if untrue.</new_string>


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

## PROD STATE (verified 2026-08-25, direct query — trust this over any doc)
ALL applied + verified on prod: 0001 through 0010 (RBAC/master-admin,
locations insert policy, checkout policy, DM RLS fix, profiles RLS
lockdown + self-promotion fix, checkin cleanup/indexes, venue group chat +
chat_join_mode, rewards write policy, reward tiers).

0011-0015 (venue zones, zone position fixes + RPC, analytics functions,
contact method type column, final-review fixes) applied to prod and
verified 2026-08-25: FK cascade confirmed (`ON DELETE CASCADE`), 3 indexes
on `zone_position_fixes`, `record_contact_method_choice` RPC present, old
overly-broad `connections` update policy confirmed removed.

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

### 2 non-code launch gates — both addressed on QA, prod pending (2026-08-26)
1. **48h purge job.** `supabase/migrations/0016_zone_position_purge_cron.sql`
   adds an hourly `pg_cron` job (`purge-stale-zone-positions`) calling a new
   `purge_stale_zone_positions()` function — same delete `fetch_zone_analytics()`
   already did inline, now independent of report loads. Applied + verified
   on QA (job active, `0 * * * *`). **Not yet applied to prod** — needs
   explicit go-ahead before running against `yatixschvikugckkpfum`.
2. **Location-tracking disclosure.** Added: a line in the location-permission
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
  - All code + all migration files (0001-0015) committed on `main`.
  - `.env.local` points at the QA cloud project directly.

## STILL QUEUED (code, no DB needed — unrelated, can parallelize):
  - Sentry + @vercel/analytics (launch-day error visibility)
  - Hide paused stub features (Connect QR / Peek / Friends Activity)
  - SEO/meta pack: OG image, app/sitemap.ts, app/robots.ts, crawlable landing page

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
  migrations 0001-0015, exists on GitHub yet.

## OPEN ASKS FOR FOUNDER
  - QA project should be on paid/always-on plan (keeps auto-pausing = unreliable staging).
  - Confirm Supabase Pro backups/PITR active on PROD before further prod
    applies (rollback safety) — still not confirmed.
  - The two launch gates above (pg_cron purge job, tracking disclosure/privacy policy).
  - Decide what to do with the 2 pending commits on iOS `feat/wap-foundation`
    (contact-method capture) relative to that branch's other in-progress work.

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
