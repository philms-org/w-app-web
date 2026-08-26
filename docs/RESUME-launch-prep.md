# W App — Launch Prep: RESUME HERE (updated 2026-08-26)

## ONE-LINE STATUS
Prod migrations 0001-0015 are ALL APPLIED + VERIFIED on prod (2026-08-25) —
owner-benefits AND the new organizer-analytics feature (zones, cross-venue
movement, dwell time, message counts, QR/contact-method tracking) are both
fully live on prod now. Both non-code launch gates now have code/migrations
committed and verified on QA (2026-08-26) — prod application still pending.

**RISK: `main` is unpushed to `origin` as of 2026-08-26** (git push failed —
this environment has no interactive TTY for the GitHub credential prompt).
All commits below, including the entire organizer-analytics feature and the
launch-gate work, exist only in this local checkout until someone runs
`git push origin main` from a terminal with cached GitHub credentials.

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
