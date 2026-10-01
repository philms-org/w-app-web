-- 0032_teams.sql
-- Teams (and, for later events, companies) inside a venue/event.
--
-- Rules (founder-approved 2026-09-30):
--   * One active team per person per event (venue).
--   * Anyone currently checked in can create a team.
--   * Join by code/QR/link (instant), by requesting (owner approves), or by
--     being added by the owner (target must be checked in).
--   * Teams and their active members are visible to everyone who has visited
--     the venue; requests are visible only to the requester, the team owner
--     and venue managers.
--   * Venue managers (organizers) can read every team and member so they can
--     message by team.
--
-- All writes go through SECURITY DEFINER functions below. The tables have no
-- INSERT/UPDATE/DELETE policies and direct write privileges are revoked, so
-- the rules cannot be bypassed from the browser.
--
-- Depends on: locations, profiles, location_checkins, has_visited_venue()
-- (0030), is_venue_manager() (0008), is_checked_in_at() (exists on QA and
-- prod, called positionally).

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  kind text not null default 'team' check (kind in ('team', 'company')),
  idea text check (idea is null or char_length(idea) <= 140),
  needs text[] not null default '{}'
    check (needs <@ array['developer','designer','business','data','marketing','other']::text[]),
  max_size integer not null default 6 check (max_size between 2 and 50),
  join_code text not null unique,
  owner_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create unique index if not exists teams_name_per_venue
  on public.teams (location_id, lower(btrim(name)));
create index if not exists teams_location on public.teams (location_id);

create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  status text not null default 'active' check (status in ('active', 'requested')),
  created_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

-- One active team per person per event.
create unique index if not exists team_members_one_active_per_event
  on public.team_members (location_id, user_id) where status = 'active';
create index if not exists team_members_user on public.team_members (user_id);
create index if not exists team_members_location on public.team_members (location_id);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

revoke all on public.teams from anon, authenticated;
revoke all on public.team_members from anon, authenticated;
grant select on public.teams to authenticated;
grant select on public.team_members to authenticated;

-- ---------------------------------------------------------------- helpers

create or replace function public.gen_team_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i integer;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * 32)::integer, 1);
    end loop;
    exit when not exists (select 1 from public.teams t where t.join_code = code);
  end loop;
  return code;
end;
$$;

create or replace function public.is_team_owner(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.teams t where t.id = p_team_id and t.owner_id = auth.uid()
  );
$$;

revoke all on function public.gen_team_code() from public, anon, authenticated;
revoke all on function public.is_team_owner(uuid) from public, anon;
grant execute on function public.is_team_owner(uuid) to authenticated;

-- --------------------------------------------------------------- policies

drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams for select to authenticated
  using (
    public.has_visited_venue(location_id)
    or public.is_venue_manager(location_id, auth.uid())
    or owner_id = auth.uid()
  );

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members for select to authenticated
  using (
    (status = 'active' and public.has_visited_venue(location_id))
    or user_id = auth.uid()
    or public.is_team_owner(team_id)
    or public.is_venue_manager(location_id, auth.uid())
  );

-- -------------------------------------------------------------- functions

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
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'team name must be 2 to 60 characters' using errcode = '22023';
  end if;
  if not public.is_checked_in_at(p_location_id) then
    raise exception 'check in to create a team' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.team_members m
    where m.location_id = p_location_id and m.user_id = auth.uid() and m.status = 'active'
  ) then
    raise exception 'you are already on a team' using errcode = '23505';
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

  insert into public.team_members (team_id, user_id, location_id, role, status)
  values (v_team.id, auth.uid(), p_location_id, 'owner', 'active');

  delete from public.team_members
  where user_id = auth.uid() and location_id = p_location_id and status = 'requested';

  return v_team;
end;
$$;

create or replace function public.join_team_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.teams%rowtype;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select * into v_team from public.teams t
  where t.join_code = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then
    raise exception 'no team with that code' using errcode = 'P0002';
  end if;
  if not public.is_checked_in_at(v_team.location_id) then
    raise exception 'check in to join a team' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.team_members m
    where m.team_id = v_team.id and m.user_id = auth.uid() and m.status = 'active'
  ) then
    return v_team.id;
  end if;
  if exists (
    select 1 from public.team_members m
    where m.location_id = v_team.location_id and m.user_id = auth.uid() and m.status = 'active'
  ) then
    raise exception 'you are already on a team' using errcode = '23505';
  end if;
  select count(*) into v_count from public.team_members m
  where m.team_id = v_team.id and m.status = 'active';
  if v_count >= v_team.max_size then
    raise exception 'that team is full' using errcode = '23514';
  end if;

  insert into public.team_members (team_id, user_id, location_id, role, status)
  values (v_team.id, auth.uid(), v_team.location_id, 'member', 'active')
  on conflict (team_id, user_id) do update set status = 'active', role = 'member';

  delete from public.team_members
  where user_id = auth.uid() and location_id = v_team.location_id and status = 'requested';

  return v_team.id;
end;
$$;

create or replace function public.request_to_join_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team public.teams%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select * into v_team from public.teams t where t.id = p_team_id;
  if not found then
    raise exception 'team not found' using errcode = 'P0002';
  end if;
  if not public.is_checked_in_at(v_team.location_id) then
    raise exception 'check in to join a team' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.team_members m
    where m.location_id = v_team.location_id and m.user_id = auth.uid() and m.status = 'active'
  ) then
    raise exception 'you are already on a team' using errcode = '23505';
  end if;

  insert into public.team_members (team_id, user_id, location_id, role, status)
  values (v_team.id, auth.uid(), v_team.location_id, 'member', 'requested')
  on conflict (team_id, user_id) do nothing;
end;
$$;

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
  if not found or v_team.owner_id is distinct from auth.uid() then
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
    raise exception 'your team is full' using errcode = '23514';
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
  if not found or v_team.owner_id is distinct from auth.uid() then
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
    raise exception 'your team is full' using errcode = '23514';
  end if;

  insert into public.team_members (team_id, user_id, location_id, role, status)
  values (p_team_id, p_user_id, v_team.location_id, 'member', 'active')
  on conflict (team_id, user_id) do update set status = 'active', role = 'member';
  delete from public.team_members
  where user_id = p_user_id and location_id = v_team.location_id
    and status = 'requested' and team_id <> p_team_id;
end;
$$;

-- Owner removes someone, or a person leaves (p_user_id = caller). If the
-- owner leaves, the longest-standing member takes over; if nobody is left,
-- the team is deleted.
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
     or (p_user_id is distinct from auth.uid() and v_team.owner_id is distinct from auth.uid()) then
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
  if not found or v_team.owner_id is distinct from auth.uid() then
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

revoke all on function public.create_team(uuid, text, text, text, text[], integer) from public, anon;
revoke all on function public.join_team_by_code(text) from public, anon;
revoke all on function public.request_to_join_team(uuid) from public, anon;
revoke all on function public.respond_to_join_request(uuid, uuid, boolean) from public, anon;
revoke all on function public.add_team_member(uuid, uuid) from public, anon;
revoke all on function public.remove_team_member(uuid, uuid) from public, anon;
revoke all on function public.update_team(uuid, text, text, text[], integer) from public, anon;
grant execute on function public.create_team(uuid, text, text, text, text[], integer) to authenticated;
grant execute on function public.join_team_by_code(text) to authenticated;
grant execute on function public.request_to_join_team(uuid) to authenticated;
grant execute on function public.respond_to_join_request(uuid, uuid, boolean) to authenticated;
grant execute on function public.add_team_member(uuid, uuid) to authenticated;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;
grant execute on function public.update_team(uuid, text, text, text[], integer) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.teams;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.team_members;
exception when duplicate_object then null;
end $$;
