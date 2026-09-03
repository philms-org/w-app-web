-- Storage RLS for the `banners` bucket — venue banner/carousel image uploads.
-- uploadBannerImage() in lib/data.ts writes to `${locationId}/${timestamp}.jpg`,
-- i.e. the object's first path segment is always the venue's location_id.
--
-- Root cause (found 2026-09-02, w-app-qa): the `banners` storage bucket
-- exists on QA (public = true) but has ZERO RLS policies on
-- storage.objects:
--   select * from pg_policies where schemaname='storage' and tablename='objects';
-- returns no rows at all. storage.objects has RLS enabled with no policies,
-- which is deny-all — every upload (both via uploadBannerImage() and a
-- direct REST PUT) 403s with "new row violates row-level security policy".
-- No prior migration ever created these policies for this bucket — this is
-- a real gap (not a migration that was skipped on QA), so there is nothing
-- to compare against on another environment.
--
-- Scoped identically to the `banners` table's own write policy
-- (0001_organizer_admin_rbac.sql, banners_write): owner / co-owner / master
-- admin via the existing is_venue_manager(location_id, user_id) helper.
-- Read is open (bucket is public = true, matches the banners table's
-- select-using-true policy) since carousel images are meant to be publicly
-- viewable without auth.
--
-- Run manually against the w-app-qa project:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0018_banners_storage_policies.sql

drop policy if exists banners_storage_select on storage.objects;
create policy banners_storage_select on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'banners');

drop policy if exists banners_storage_write on storage.objects;
create policy banners_storage_write on storage.objects
  for all to authenticated
  using (
    bucket_id = 'banners'
    and is_venue_manager((storage.foldername(name))[1]::uuid, auth.uid())
  )
  with check (
    bucket_id = 'banners'
    and is_venue_manager((storage.foldername(name))[1]::uuid, auth.uid())
  );
