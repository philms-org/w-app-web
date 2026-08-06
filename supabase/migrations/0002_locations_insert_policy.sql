-- The `locations` table had no INSERT policy at all — createVenue() (and
-- likely the pre-existing createEvent()) would 403 for everyone, including
-- master admins. A new venue has no owner yet at insert time, so the only
-- workable check is that the creator is a master admin.
drop policy if exists locations_insert_master_admin on locations;
create policy locations_insert_master_admin on locations for insert to authenticated
  with check (
    exists (select 1 from profiles p where p.id = auth.uid() and p.is_master_admin)
  );
