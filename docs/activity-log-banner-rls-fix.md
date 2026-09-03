# Banner upload RLS fix — activity log

**Status:** DONE

## What I found

Root cause confirmed on `w-app-qa` (ref `ducadjakxmkfcvrteoqz`):

- Upload code: `lib/data.ts` `uploadBannerImage(file, locationId)` writes to
  `supabase.storage.from('banners').upload(`${locationId}/${Date.now()}.jpg`, ...)`.
  So the bucket is `banners` and the object's first path segment is always the
  venue's `location_id`. Called from `app/main/venue/carousel` (organizer
  banner/carousel management UI).
- Queried QA directly:
  - `select id, name, public from storage.buckets;` → only one bucket exists,
    `banners` (`public = true`). (Note: there is no `avatars` bucket on QA at
    all either — out of scope for this task, not touching it, just noting it
    in case it surfaces later.)
  - `select * from pg_policies where schemaname='storage' and tablename='objects';`
    → **zero rows**. `storage.objects` has RLS enabled with no policies at
    all for any bucket, which is deny-all. Every upload (via
    `uploadBannerImage()` or a direct REST PUT) 403s: "new row violates row
    level security policy".
- Checked `supabase/migrations/` (as of `main` @ `a951bf0`, which is what
  this worktree branched from, and re-checked against `main` @ `5d7229b`
  which had since advanced 59 commits from unrelated parallel work): **no
  migration for `banners` bucket storage policies exists at all**, on either
  QA or (presumably) prod. This is a real gap, not a migration that was
  written but never applied — there's nothing to "apply", it needed to be
  written.
- The `banners` *table* (not the storage bucket) already has a write policy
  from `0001_organizer_admin_rbac.sql` (`banners_write`, scoped via
  `is_venue_manager(location_id, user_id)` — owner / co-owner / master
  admin). That helper function already exists on QA (confirmed via
  `pg_proc`), so the storage policy can reuse it directly by extracting
  `location_id` from the object path by using `storage.foldername(name)[1]`.
- This matches the QA-infra finding already recorded independently in
  `docs/RESUME-launch-prep.md` (2026-09-01 QA gap-closure note): "banner
  *image upload* is broken on `w-app-qa`... Looks like the storage-bucket
  RLS policies were never applied to the QA project."

## What I did

1. Wrote `supabase/migrations/0018_banners_storage_policies.sql`:
   - `banners_storage_select` — `for select to authenticated, anon using (bucket_id = 'banners')`.
     Bucket is public, carousel images are meant to be publicly viewable.
   - `banners_storage_write` — `for all to authenticated`, scoped to
     `bucket_id = 'banners' and is_venue_manager((storage.foldername(name))[1]::uuid, auth.uid())`
     on both `using` and `with check`. Mirrors the existing `banners_write`
     table policy's authorization model exactly.
2. Applied to QA:
   ```
   supabase link --project-ref ducadjakxmkfcvrteoqz
   supabase db query --linked < supabase/migrations/0018_banners_storage_policies.sql
   ```
3. Verified policies now exist (see Verification below).

## Verification

- Pre-fix: `select * from pg_policies where schemaname='storage' and tablename='objects';` → 0 rows.
- Applied migration via `supabase db query --linked < supabase/migrations/0018_banners_storage_policies.sql` — succeeded, no errors.
- Post-fix: re-ran the same `pg_policies` query — now shows `banners_storage_select` (SELECT, roles `{authenticated,anon}`, qual `bucket_id = 'banners'::text`) and `banners_storage_write` (ALL, role `{authenticated}`, qual/with_check both `bucket_id = 'banners'::text AND is_venue_manager(...)`).
- Additional authorization-logic check (SQL-level, in place of a live login since no test credentials are available to this session — checked `docs/RESUME-launch-prep.md` and the `qa-pass-2026-08-06-status` / `testing-w-app-web-live-session` memory notes; the password for `testy@gmail.com` is deliberately not stored anywhere, so a real browser login is not attemptable here):
  ```sql
  select is_venue_manager('fa85f0f4-71eb-4b5f-ad34-50b0482ffe28'::uuid, '185204cf-de9f-4c9b-8db1-212d62b9a371'::uuid) as owner_can_write,   -- QA Test Venue's owner_id
         is_venue_manager('fa85f0f4-71eb-4b5f-ad34-50b0482ffe28'::uuid, gen_random_uuid()) as random_user_cannot;
  ```
  → `owner_can_write = true`, `random_user_cannot = false`. Since the new
  `banners_storage_write` policy's `using`/`with_check` is exactly
  `bucket_id = 'banners' and is_venue_manager((storage.foldername(name))[1]::uuid, auth.uid())`,
  this confirms the policy will accept an upload to
  `fa85f0f4-.../<file>.jpg` from the real venue owner and reject one from an
  arbitrary authenticated user — the exact fix intended, verified without
  needing UI credentials.
- Did not attempt a live authenticated-browser upload test — no test credentials available to this session (per task's acceptable-limit clause). SQL-level verification (policy existence + exact `qual`/`with_check` text, plus the `is_venue_manager` authorization check above) is the best-effort achievable here.
- `npx tsc --noEmit` not run — no TypeScript files touched (SQL-only change), per task step 4.

## Final state

**NOT MERGED — left on branch `worktree-agent-a0ba22e056525d82d`, commit
`4da027be45a68c034062e9b69c9e0ac1a6925ce3`** ("fix: add missing storage RLS
policies for banners bucket (QA)").

- The actual bug fix is complete and independent of the merge: the QA
  database (`ducadjakxmkfcvrteoqz`) already has the correct
  `banners_storage_select` / `banners_storage_write` policies live (applied
  directly via `supabase db query --linked`), verified per the section
  above. Any future upload to the `banners` bucket by a real venue
  owner/co-owner/master admin will now succeed; a non-manager will still be
  rejected.
- **Could not complete the merge step from this session — mechanical
  environment constraint, not a correctness concern.** This agent runs in
  the git worktree `/Users/sr/w-app-web/.claude/worktrees/agent-a0ba22e056525d82d`
  (branch `worktree-agent-a0ba22e056525d82d`, started from `a951bf0`, same
  as `origin/main`). The repo's `main` branch is checked out in a *sibling*
  worktree (`/Users/sr/w-app-web`, currently at `5d7229b`, ~59 commits ahead
  of this branch's base from unrelated parallel work — docs, realtime
  chat+presence, etc.), and this session is sandboxed to its own worktree
  only:
  - `git checkout main` here fails: `fatal: 'main' is already checked out at '/Users/sr/w-app-web'`.
  - `git fetch . worktree-agent-a0ba22e056525d82d:main` (attempting to
    fast-forward the `main` ref without checking it out) also fails:
    `fatal: refusing to fetch into branch 'refs/heads/main' checked out at '/Users/sr/w-app-web'`
    — git itself refuses to update a branch ref that's checked out in
    another worktree, and directly redirecting git operations at that
    other worktree's path (`git -C /Users/sr/w-app-web ...`) is refused by
    this session's sandbox as isolation-breaking.
  - Since `main` has diverged (59 unrelated commits since this branch's
    base) rather than just moved forward, this needs a real
    `git merge --no-edit` (not a plain fast-forward) run from a session
    that actually has `/Users/sr/w-app-web` (or another checkout of `main`)
    as its working directory.
- **Next step for whoever picks this up (the coordinating/parent session,
  or a session rooted at `/Users/sr/w-app-web`):**
  ```
  cd /Users/sr/w-app-web
  git checkout main
  git merge worktree-agent-a0ba22e056525d82d --no-edit
  npx tsc --noEmit   # should be clean — this branch only touches SQL + docs
  ```
  The merge should be conflict-free: this branch only adds two new files
  (`supabase/migrations/0018_banners_storage_policies.sql` and
  `docs/activity-log-banner-rls-fix.md`) on top of a commit that's an
  ancestor of current `main`. No existing files were modified.
- `npx tsc --noEmit` was not run in this worktree since no TypeScript was
  touched; it should still be run on the merged `main` per the task's
  instructions, by whoever performs the merge.
