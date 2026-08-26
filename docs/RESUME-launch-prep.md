# W App — Launch Prep: RESUME HERE (updated 2026-08-25)

## ONE-LINE STATUS
Prod migrations 0001-0010 are ALL APPLIED + VERIFIED on prod (owner-benefits
feature fully live). The new organizer-analytics feature (zones, cross-venue
movement, dwell time, message counts, QR/contact-method tracking — 5
migrations, 0011-0015) is built, reviewed (task-level + whole-branch + one
fix wave, all clean), merged to local `main` — but its migrations are
**QA-only so far**, and there are 2 non-code launch gates (below) before it
should reach real users.

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

NOT yet on prod — QA-verified only, from today's organizer-analytics build:
  - 0011_venue_zones.sql
  - 0012_zone_position_fixes.sql
  - 0013_analytics_functions.sql
  - 0014_contact_method_type.sql
  - 0015_final_review_fixes.sql (post-review fixes: FK cascade, auth-gated
    RPC, k=3 anonymity thresholds, indexes, RPC-based contact-method update)
All five are additive-only and safe to apply using the same walkthrough
pattern as before (link to prod, apply each file in order 0011→0015,
verify each with a targeted query — ask Claude for the exact commands when
ready, same as last time).

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

### 2 non-code launch gates before this reaches real users
1. **The 48h raw-location-data purge only runs when an organizer happens to
   load the report** — it's a side effect of the report's own query, not a
   scheduled job. Needs a `pg_cron` job (or equivalent) running the same
   purge hourly, independent of report loads, to make the 48h retention
   promise actually firm. Infra setup, not a code change.
2. **No user-facing disclosure that check-in triggers continuous location
   tracking, and no privacy policy page exists in the web app at all.** This
   is a real gap for GDPR/CCPA and App Store review once this ships broadly
   — needs the founder's decision on copy/policy, not something to
   auto-generate.

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

## OPEN ASKS FOR FOUNDER
  - QA project should be on paid/always-on plan (keeps auto-pausing = unreliable staging).
  - Confirm Supabase Pro backups/PITR active on PROD before further prod
    applies (rollback safety) — still not confirmed.
  - The two launch gates above (pg_cron purge job, tracking disclosure/privacy policy).
  - Decide what to do with the 2 pending commits on iOS `feat/wap-foundation`
    (contact-method capture) relative to that branch's other in-progress work.
