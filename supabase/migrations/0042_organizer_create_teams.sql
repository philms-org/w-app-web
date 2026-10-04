-- 0042_organizer_create_teams.sql
-- Organizers and master admins can set up teams for their event.
--
-- Rules (founder-approved 2026-10-04):
--   * Venue managers (is_venue_manager: primary owner, co-owners, master
--     admins) can create teams without checking in.
--   * They create teams for other people, so they don't join the team and
--     the one-team-per-person rule doesn't limit how many they set up.
--     Until someone joins, the organizer is the team's owner and can edit it,
--     add people from the room and accept join requests.
--   * The first person to join becomes the owner. An organizer who wants to
--     be on a team joins it with the code like anyone else.
--   * Organizers can manage any team at their venue: add people from the
--     room, remove people, accept or decline requests, edit and delete it.
--   * Everyone else is unchanged: check in to create, and you join the team
--     you create.
--
-- Depends on: 0032 (teams), is_venue_manager() (0001), is_checked_in_at().

create or replace function public.create_team(
  p_location_id uuid,
  p_name text,
  p_kind text,
  p_idea text,
  p_needs text[],
  p_max_size integer
)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_team public.teams%rowtype;
  v_organizer boolean;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'team name must be 2 to 60 characters' using errcode = '22023';
  end if;

  v_organizer := coalesce(public.is_venue_manager(p_location_id, auth.uid()), false);

  if not v_organizer then
    if not public.is_checked_in_at(p_location_id) then
      raise exception 'check in to create a team' using errcode = '42501';
    end if;
    if exists (
      select 1 from public.team_members m
      where m.location_id = p_location_id and m.user_id = auth.uid() and m.status = 'active'
    ) then
      raise exception 'you are already on a team' using errcode = '23505';
    end if;
  end if;

  begin
    insert into public.teams (location_id, name, kind, idea, needs, max_size, join_code, owner_id)
    values (
      p_location_id,
      v_name,
      coalesce(nullif(p_kind, ''), 'team'),
      nullif(btrim(coalesce(p_idea, '')), ''),
      coalesce(p_needs, '{}'),
      coalesce(p_max_size, 6),
      public.gen_team_code(),
      auth.uid()
    )
    returning * into v_team;
  exception when unique_violation then
    raise exception 'that team name is already taken here' using errcode = '23505';
  end;

  -- Organizers set the team up for others and stay off it.
  if v_organizer then
    return v_team;
  end if;

  insert into public.team_members (team_id, user_id, location_id, role, status)
  values (v_team.id, auth.uid(), p_location_id, 'owner', 'active');

  delete from public.team_members
  where user_id = auth.uid() and location_id = p_location_id and status = 'requested';

  return v_team;
end;
$$;

-- When someone becomes an active member of a team whose owner isn't on it
-- (an organizer-created team), they take it over. Covers every way in:
-- join by code, accepted request, added by the organizer.
create or replace function public._team_claim_unowned()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'active' or new.role = 'owner' then
    return null;
  end if;
  if exists (
    select 1 from public.teams t
    join public.team_members m
      on m.team_id = t.id and m.user_id = t.owner_id and m.status = 'active'
    where t.id = new.team_id
  ) then
    return null;
  end if;

  update public.teams set owner_id = new.user_id where id = new.team_id;
  update public.team_members set role = 'owner'
  where team_id = new.team_id and user_id = new.user_id;
  return null;
end;
$$;

revoke all on function public._team_claim_unowned() from public, anon, authenticated;

drop trigger if exists trg_team_claim_unowned on public.team_members;
create trigger trg_team_claim_unowned after insert or update of status on public.team_members
  for each row execute function public._team_claim_unowned();

-- ------------------------------------------------- organizers manage teams

-- Team owner, or an organizer of the team's venue.
create or replace function public.can_manage_team(p_team public.teams)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    p_team.owner_id = auth.uid()
    or coalesce(public.is_venue_manager(p_team.location_id, auth.uid()), false)
  );
$$;

revoke all on function public.can_manage_team(public.teams) from public, anon, authenticated;

create or replace function public.respond_to_join_request(
  p_team_id uuid,
  p_user_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.teams%rowtype;
  v_count integer;
begin
  select * into v_team from public.teams t where t.id = p_team_id for update;
  if not found or not public.can_manage_team(v_team) then
    raise exception 'only the team owner can do that' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.team_members m
    where m.team_id = p_team_id and m.user_id = p_user_id and m.status = 'requested'
  ) then
    raise exception 'no such request' using errcode = 'P0002';
  end if;

  if not p_accept then
    delete from public.team_members
    where team_id = p_team_id and user_id = p_user_id and status = 'requested';
    return;
  end if;

  select count(*) into v_count from public.team_members m
  where m.team_id = p_team_id and m.status = 'active';
  if v_count >= v_team.max_size then
    raise exception 'that team is full' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.team_members m
    where m.location_id = v_team.location_id and m.user_id = p_user_id and m.status = 'active'
  ) then
    delete from public.team_members
    where team_id = p_team_id and user_id = p_user_id and status = 'requested';
    raise exception 'that person already joined another team' using errcode = '23505';
  end if;

  update public.team_members set status = 'active'
  where team_id = p_team_id and user_id = p_user_id;
  delete from public.team_members
  where user_id = p_user_id and location_id = v_team.location_id
    and status = 'requested' and team_id <> p_team_id;
end;
$$;

create or replace function public.add_team_member(p_team_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.teams%rowtype;
  v_count integer;
begin
  select * into v_team from public.teams t where t.id = p_team_id for update;
  if not found or not public.can_manage_team(v_team) then
    raise exception 'only the team owner can do that' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.location_checkins lc
    where lc.user_id = p_user_id and lc.location_id = v_team.location_id and lc.checked_out_at is null
  ) then
    raise exception 'that person is not checked in here' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.team_members m
    where m.location_id = v_team.location_id and m.user_id = p_user_id and m.status = 'active'
  ) then
    raise exception 'that person is already on a team' using errcode = '23505';
  end if;
  select count(*) into v_count from public.team_members m
  where m.team_id = p_team_id and m.status = 'active';
  if v_count >= v_team.max_size then
    raise exception 'that team is full' using errcode = '23514';
  end if;

  insert into public.team_members (team_id, user_id, location_id, role, status)
  values (p_team_id, p_user_id, v_team.location_id, 'member', 'active')
  on conflict (team_id, user_id) do update set status = 'active', role = 'member';
  delete from public.team_members
  where user_id = p_user_id and location_id = v_team.location_id
    and status = 'requested' and team_id <> p_team_id;
end;
$$;

-- Owner or organizer removes someone, or a person leaves (p_user_id =
-- caller). If the owner goes, the longest-standing member takes over; if
-- nobody is left, the team is deleted.
create or replace function public.remove_team_member(p_team_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.teams%rowtype;
  v_next uuid;
begin
  select * into v_team from public.teams t where t.id = p_team_id for update;
  if not found then
    raise exception 'team not found' using errcode = 'P0002';
  end if;
  if auth.uid() is null
     or (p_user_id is distinct from auth.uid() and not public.can_manage_team(v_team)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  delete from public.team_members where team_id = p_team_id and user_id = p_user_id;

  if p_user_id = v_team.owner_id then
    select m.user_id into v_next from public.team_members m
    where m.team_id = p_team_id and m.status = 'active'
    order by m.created_at asc limit 1;
    if v_next is null then
      delete from public.teams where id = p_team_id;
    else
      update public.teams set owner_id = v_next where id = p_team_id;
      update public.team_members set role = 'owner' where team_id = p_team_id and user_id = v_next;
    end if;
  end if;
end;
$$;

create or replace function public.update_team(
  p_team_id uuid,
  p_name text,
  p_idea text,
  p_needs text[],
  p_max_size integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.teams%rowtype;
  v_name text := btrim(coalesce(p_name, ''));
  v_count integer;
begin
  select * into v_team from public.teams t where t.id = p_team_id for update;
  if not found or not public.can_manage_team(v_team) then
    raise exception 'only the team owner can do that' using errcode = '42501';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'team name must be 2 to 60 characters' using errcode = '22023';
  end if;
  select count(*) into v_count from public.team_members m
  where m.team_id = p_team_id and m.status = 'active';
  if coalesce(p_max_size, v_team.max_size) < v_count then
    raise exception 'the limit can''t be lower than the current team size' using errcode = '23514';
  end if;
  begin
    update public.teams
    set name = v_name,
        idea = nullif(btrim(coalesce(p_idea, '')), ''),
        needs = coalesce(p_needs, '{}'),
        max_size = coalesce(p_max_size, max_size)
    where id = p_team_id;
  exception when unique_violation then
    raise exception 'that team name is already taken here' using errcode = '23505';
  end;
end;
$$;

-- Organizers delete a team outright (members and requests go with it).
create or replace function public.delete_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location uuid;
begin
  select t.location_id into v_location from public.teams t where t.id = p_team_id for update;
  if not found then
    raise exception 'team not found' using errcode = 'P0002';
  end if;
  if auth.uid() is null or not coalesce(public.is_venue_manager(v_location, auth.uid()), false) then
    raise exception 'only the organizer can delete a team' using errcode = '42501';
  end if;
  delete from public.teams where id = p_team_id;
end;
$$;

revoke all on function public.delete_team(uuid) from public, anon;
grant execute on function public.delete_team(uuid) to authenticated;
