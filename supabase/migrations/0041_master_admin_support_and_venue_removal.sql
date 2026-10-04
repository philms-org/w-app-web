-- 0041: master admin "support mode" + removing someone from a venue.
--
-- Founder decisions (2026-10-03):
--   * A master admin can step into any venue to give technical support without
--     being there and without being seen. The app doesn't write a check-in for
--     them (so they never show in the roster, "here now", the room meter,
--     attendee history or analytics); instead the feed helpers below treat a
--     master admin as able to read and engage everywhere. Reading posts,
--     posting (as an announcement) and deleting posts already worked through
--     is_venue_manager / can_announce (0001, 0030, 0031).
--   * A venue manager (owner, co-owner, master admin) can remove a person from
--     a venue: they're checked out, lose invite-link / guest access and the
--     announcer role, and can't check back in or read that venue's feed until
--     a manager lets them back in. Their posts stay up (managers can already
--     delete those). Owners, co-owners and master admins can't be removed.
--
-- Builds on 0030 (has_visited_venue, is_checked_in_at), 0035/0037 (early
-- access, can_read_venue_feed, can_engage_venue). Does not touch
-- create_venue_post, so it is independent of 0040.
--
-- Safe to re-run.

begin;

-- ------------------------------------------------------------- schema

create table if not exists public.venue_removals (
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  removed_by uuid references public.profiles(id) on delete set null,
  removed_at timestamptz not null default now(),
  primary key (location_id, user_id)
);

alter table public.venue_removals enable row level security;

-- Managers see their venue's list; a removed person can see their own row
-- (so the app can explain why they can't get in).
drop policy if exists venue_removals_select on public.venue_removals;
create policy venue_removals_select on public.venue_removals for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_venue_manager(venue_removals.location_id, auth.uid())
  );

-- Writes only through remove_from_venue / restore_to_venue below.
revoke insert, update, delete on public.venue_removals from anon, authenticated;

-- ------------------------------------------------------------ helpers

create or replace function public.is_master_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.is_master_admin);
$$;

create or replace function public.is_removed_from_venue(p_location_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from venue_removals r
    where r.location_id = p_location_id and r.user_id = p_user_id
  );
$$;

revoke all on function public.is_master_admin() from public, anon;
revoke all on function public.is_removed_from_venue(uuid, uuid) from public, anon;
grant execute on function public.is_master_admin() to authenticated;
grant execute on function public.is_removed_from_venue(uuid, uuid) to authenticated;

-- Same as 0030, minus anyone removed from the venue. Past check-ins would
-- otherwise keep a removed person reading the feed forever.
create or replace function public.has_visited_venue(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from location_checkins lc
    where lc.user_id = auth.uid() and lc.location_id = p_location_id
  ) and not public.is_removed_from_venue(p_location_id, auth.uid());
$$;

-- Same as 0035, plus master admin (support mode) and minus removed people.
create or replace function public.can_read_venue_feed(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_master_admin()
      or ((public.has_visited_venue(p_location_id) or public.has_early_access(p_location_id))
          and not public.is_removed_from_venue(p_location_id, auth.uid()));
$$;

create or replace function public.can_engage_venue(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_master_admin()
      or ((public.is_checked_in_at(p_location_id) or public.has_early_access(p_location_id))
          and not public.is_removed_from_venue(p_location_id, auth.uid()));
$$;

-- ---------------------------------------- block check-in / invite redeem

-- Triggers rather than policies so they also hold inside security-definer
-- paths (redeem_venue_invite, _attendee_from_checkin). Covers reopening an
-- old check-in too: location_checkins_update_own (0003) lets a user edit
-- their own rows, including clearing checked_out_at.
create or replace function public._block_removed_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.checked_out_at is null
     and (tg_op = 'INSERT' or old.checked_out_at is not null)
     and public.is_removed_from_venue(new.location_id, new.user_id) then
    raise exception 'removed from this venue' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_removed_checkin on public.location_checkins;
create trigger trg_block_removed_checkin before insert or update on public.location_checkins
  for each row execute function public._block_removed_checkin();

create or replace function public._block_removed_early_access() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_removed_from_venue(new.location_id, new.user_id) then
    raise exception 'removed from this venue' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_removed_early_access on public.venue_early_access;
create trigger trg_block_removed_early_access before insert on public.venue_early_access
  for each row execute function public._block_removed_early_access();

-- --------------------------------------------------- remove / let back in

create or replace function public.remove_from_venue(p_location_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  -- is_venue_manager is true for the owner, co-owners and master admins.
  if public.is_venue_manager(p_location_id, p_user_id) then
    raise exception 'owners, co-owners and staff can''t be removed' using errcode = '42501';
  end if;

  insert into venue_removals (location_id, user_id, removed_by)
  values (p_location_id, p_user_id, auth.uid())
  on conflict (location_id, user_id) do update
    set removed_by = excluded.removed_by, removed_at = now();

  update location_checkins set checked_out_at = now()
  where location_id = p_location_id and user_id = p_user_id and checked_out_at is null;

  delete from venue_early_access where location_id = p_location_id and user_id = p_user_id;
  delete from venue_announcers where location_id = p_location_id and user_id = p_user_id;
end;
$$;

create or replace function public.restore_to_venue(p_location_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  delete from venue_removals where location_id = p_location_id and user_id = p_user_id;
end;
$$;

revoke all on function public.remove_from_venue(uuid, uuid) from public, anon;
revoke all on function public.restore_to_venue(uuid, uuid) from public, anon;
grant execute on function public.remove_from_venue(uuid, uuid) to authenticated;
grant execute on function public.restore_to_venue(uuid, uuid) to authenticated;

commit;
