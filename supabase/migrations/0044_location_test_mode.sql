-- 0044_location_test_mode.sql
-- Test mode for venues: a venue can be created "not live" so W staff can
-- stand in it and check location accuracy / geofence / check-in before
-- anyone else can see it. Going live is a single update (is_live = true).
--
-- Existing venues default to live, so nothing changes for current users.
--
-- Enforced in the database, not just hidden in the app:
--   * a test venue is only readable by its owner, its co-managers and
--     master admins (W staff) -- everyone else's queries simply don't
--     return it, so it never reaches their phones;
--   * only those same people can check in at it.
--
-- Both rules are RESTRICTIVE policies: they are ANDed on top of whatever
-- permissive SELECT / INSERT policies already exist on these tables (those
-- live only in the database, not in this repo), so they can only narrow
-- access, never widen it.
--
-- Apply manually (QA first, then prod), like the other migrations:
--   supabase db query --linked < supabase/migrations/0044_location_test_mode.sql

alter table public.locations
  add column if not exists is_live boolean not null default true;

-- Who may see / use a venue that isn't live yet. SECURITY DEFINER and it
-- deliberately does NOT read `locations` (the row's owner_id is passed in):
-- a locations policy that queried locations again would recurse.
create or replace function public.can_access_test_location(p_location_id uuid, p_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    p_owner_id = auth.uid()
    or exists (
      select 1 from location_managers lm
      where lm.location_id = p_location_id and lm.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_master_admin)
  );
$$;

revoke all on function public.can_access_test_location(uuid, uuid) from public;
grant execute on function public.can_access_test_location(uuid, uuid) to anon, authenticated;

drop policy if exists locations_hide_test_mode on public.locations;
create policy locations_hide_test_mode on public.locations
  as restrictive
  for select
  to public
  using (is_live or public.can_access_test_location(id, owner_id));

-- Check-in: the venue has to be visible to the person checking in. Because
-- the policy above hides test venues, this blocks check-ins at a test venue
-- for everyone except its owner, co-managers and W staff.
drop policy if exists location_checkins_require_visible_location on public.location_checkins;
create policy location_checkins_require_visible_location on public.location_checkins
  as restrictive
  for insert
  to public
  with check (exists (select 1 from public.locations l where l.id = location_checkins.location_id));
