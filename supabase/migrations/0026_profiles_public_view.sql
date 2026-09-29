-- SECURITY: profiles_select_auth (0006) lets ANY signed-in session read every
-- column of every profile, including email and phone. Guest-first onboarding
-- signs every visitor in (anonymous session, role `authenticated`), so that
-- would make the whole user table's PII readable by anyone who opens the site.
--
-- Split:
--   * profiles (base table): full row readable only by its owner, plus master
--     admins (the staff admin console needs email to find people).
--   * profiles_public (view): the fields the app actually shows about OTHER
--     people, for every signed-in session. No email, phone, raw birth date,
--     or private preferences. City only when the owner made it visible;
--     age is computed, the date itself never leaves the database.
--
-- Client code reads other people through profiles_public (lib/data.ts); the
-- PostgREST embeds use `profiles:profiles_public!<fk column>(*)` so result
-- shapes are unchanged.
--
-- Safe to re-run. Independent of 0024/0025 (it adds date_of_birth itself
-- with the same `if not exists`, so either order works).

alter table public.profiles add column if not exists date_of_birth date;

-- "Am I a master admin?" without reading `profiles` through RLS (a policy on
-- profiles that selects from profiles would recurse). Takes no argument so it
-- can't be used to ask about anyone else.
create or replace function public.auth_is_master_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_master_admin from public.profiles p where p.id = auth.uid()), false);
$$;
revoke all on function public.auth_is_master_admin() from public, anon;
grant execute on function public.auth_is_master_admin() to authenticated;

drop policy if exists profiles_select_auth on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_master_admin on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());

create policy profiles_select_master_admin on public.profiles
  for select to authenticated using (public.auth_is_master_admin());

-- Owner-privileged view (security_invoker = false, the default): it reads the
-- base table as its owner, so it is NOT subject to the owner-only policy
-- above. That is the point: it is the one sanctioned cross-user read path,
-- and it only exposes the columns listed here. Supabase's advisor flags
-- "security definer view"; that is expected for this view.
drop view if exists public.profiles_public;
create view public.profiles_public
with (security_invoker = false) as
select
  p.id,
  p.display_name,
  p.avatar_url,
  p.is_verified,
  p.nationality,
  case when p.city_visible then p.city end as city,
  p.city_visible,
  p.role,
  p.affiliation,
  p.dating_id,
  p.socialising_id,
  p.networking_id,
  -- Needed so fetchFriendsActivity only shows friends who opted in.
  p.share_checkins_with_friends,
  case
    when p.date_of_birth is null then null
    else extract(year from age(current_date, p.date_of_birth))::int
  end as age
from public.profiles p;

revoke all on public.profiles_public from public, anon;
grant select on public.profiles_public to authenticated;

comment on view public.profiles_public is
  'Cross-user profile directory: display fields only. Never add email, phone, date_of_birth or other private columns here.';
