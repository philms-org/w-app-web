# W App — Launch Prep: RESUME HERE (paused ~11:xx pm, resume 12:10am)

## ONE-LINE STATUS
QA migrations applied + schema-verified. Prod NOT yet touched. Next: finish 1 QA
verification (self-promotion test) → apply same 4 migrations to prod → verify.

## THE PIPELINE THAT WORKS (no password, no local psql needed)
- Auth: Supabase CLI **token auth** (already logged in). NO db password needed.
- Apply SQL:  `supabase db query --linked < path/to/file.sql`
- Read state: `echo "select ..." | supabase db query --linked`
- Switch target: `supabase link --project-ref <ref>`  (token auth, no pw prompt)
  - PROD ref: yatixschvikugckkpfum   ("The W app")
  - QA   ref: ducadjakxmkfcvrteoqz   ("w-app-qa")  ← currently linked
- Docker only needed for `supabase db dump`; disk was full (fixed: 11GB free now).
  QA cloud project AUTO-PAUSES (free tier) — un-pause in dashboard if NXDOMAIN.

## MIGRATIONS TO APPLY TO PROD (in this order) — all in supabase/migrations/
  0003_location_checkins_update_policy.sql   (checkout works)
  0005_conversations_select_creator.sql      (DMs work — RETURNING/RLS fix)
  0006_profiles_rls_lockdown.sql             (CRITICAL: kills priv-esc hole + guard trigger)
  0007_checkin_cleanup_and_indexes.sql       (ghost-checkin cleanup + indexes)
  NOTE: 0004 already on prod. 0001/0002 already on prod. Prod migration-history
  table is EMPTY so DO NOT `supabase db push` — apply the 4 files explicitly.

## PROD STATE (from /tmp/prod_schema.sql dump, 2026-08-18) — why each is needed
  - profiles: has `profiles_all_auth USING(true) WITH CHECK(true)` ← ANY user can
    self-set is_master_admin. 0006 replaces it.
  - location_checkins: no UPDATE policy → checkout no-ops. 0003 fixes.
  - conversations_select: lacks `created_by` clause → new DMs 42501. 0005 fixes.

## QA IS DONE + VERIFIED (all 4 applied). Verified via schema:
  profiles → select_auth/insert_own/update_own; trg_protect_master_admin present;
  checkout update policy present; uniq_active_checkin index present;
  conversations_select has created_by = YES.

## THE ONE UNFINISHED CHECK (do first on resume, on QA)
  Prove own-row self-promotion is blocked by the trigger. QA had only 1 profile
  (already admin), so couldn't test. BEST WAY (Option A): use app signup flow —
  point .env.local at QA (QA anon key via `supabase projects api-keys --project-ref
  ducadjakxmkfcvrteoqz`), signUp a throwaway user, then attempt
  `supabase.from('profiles').update({is_master_admin:true}).eq('id', myUid)` and
  assert it stays false. Then run same assertion on PROD after applying 0006.

## AFTER PROD APPLY — re-verify on prod:
  - same schema checks (see /tmp/verify.sql pattern)
  - functional: seed script style — signUp 2 users, create conversation (DM works),
    checkout works, self-promotion blocked.
  - one-time: 0007 already closes stale check-ins; confirm count dropped.

## STILL QUEUED (code, no DB needed — can parallelize):
  - Sentry + @vercel/analytics (launch-day error visibility)
  - Hide paused stub features (Connect QR / Peek / Friends Activity)
  - SEO/meta pack: OG image, app/sitemap.ts, app/robots.ts, crawlable landing page

## HYGIENE DONE
  - All code + migrations committed (HEAD = 52573cb).
  - ~/.wapp-db-pass deleted (didn't need it; token auth). Recreate only if going psql route.
  - Local Supabase Docker stack was wiped when we cleared disk — fine, we use cloud QA now.
  - .env.local currently points where? CHECK on resume (may be local/QA). Prod app uses
    its own Vercel env; don't need to change prod.

## OPEN ASKS FOR FOUNDER
  - QA project should be on paid/always-on plan (keeps auto-pausing = unreliable staging).
  - Confirm Supabase Pro backups/PITR active on PROD before prod apply (rollback safety).
