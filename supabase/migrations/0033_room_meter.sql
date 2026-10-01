-- 0033_room_meter.sql
-- "Room activity" meter: a rolling one-hour energy level for a venue/event
-- that goes up whenever people engage.
--
-- Sources (points):
--   check-in 5 · post 3 · team join/create 3 · comment 2 · like 1      (DB triggers)
--   carousel tap 1 · hotspot visit 4                                   (record_meter_event RPC)
--
-- Two tables on purpose:
--   meter_events  private, has user_id, used only to rate-limit per person.
--                 No client can read it.
--   meter_pulses  anonymous (no user_id), readable by anyone who has visited
--                 the venue. Clients subscribe to it in realtime so everyone
--                 sees the meter move and star effects for other people's
--                 activity without learning who did what.
--
-- Triggers never block the action that fired them: any failure is swallowed.
--
-- Depends on: locations, location_checkins, venue_posts, post_likes,
-- venue_post_comments (0024/0030), has_visited_venue() (0030),
-- is_venue_manager(), is_checked_in_at(). team_members (0032) is optional.

create table if not exists public.meter_events (
  id bigint generated always as identity primary key,
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now()
);
create index if not exists meter_events_rate
  on public.meter_events (user_id, location_id, kind, created_at desc);

create table if not exists public.meter_pulses (
  id bigint generated always as identity primary key,
  location_id uuid not null references public.locations(id) on delete cascade,
  kind text not null
    check (kind in ('checkin','post','team','comment','like','carousel','hotspot')),
  points integer not null check (points between 1 and 10),
  created_at timestamptz not null default now()
);
create index if not exists meter_pulses_recent
  on public.meter_pulses (location_id, created_at desc);

alter table public.meter_events enable row level security;
alter table public.meter_pulses enable row level security;

revoke all on public.meter_events from anon, authenticated;
revoke all on public.meter_pulses from anon, authenticated;
grant select on public.meter_pulses to authenticated;

drop policy if exists meter_pulses_select on public.meter_pulses;
create policy meter_pulses_select on public.meter_pulses for select to authenticated
  using (
    public.has_visited_venue(location_id)
    or public.is_venue_manager(location_id, auth.uid())
  );

-- ---------------------------------------------------------------- core

-- Points per kind and the most events one person can add per window, so
-- tapping a heart 50 times can't pin the meter.
create or replace function public._meter_rule(p_kind text, out points integer, out max_events integer, out window_seconds integer)
language sql
immutable
as $$
  select case p_kind
    when 'checkin'  then 5 when 'post' then 3 when 'team' then 3
    when 'comment'  then 2 when 'like' then 1
    when 'carousel' then 1 when 'hotspot' then 4 end,
  case p_kind
    when 'checkin'  then 1 when 'post' then 6 when 'team' then 2
    when 'comment'  then 10 when 'like' then 10
    when 'carousel' then 1 when 'hotspot' then 1 end,
  case p_kind
    when 'checkin'  then 600 when 'post' then 600 when 'team' then 600
    when 'comment'  then 300 when 'like' then 60
    when 'carousel' then 60 when 'hotspot' then 300 end;
$$;

create or replace function public._record_meter(p_location_id uuid, p_user_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_recent integer;
begin
  select * into r from public._meter_rule(p_kind);
  if r.points is null or p_location_id is null or p_user_id is null then
    return;
  end if;

  select count(*) into v_recent from public.meter_events e
  where e.user_id = p_user_id and e.location_id = p_location_id and e.kind = p_kind
    and e.created_at > now() - make_interval(secs => r.window_seconds);
  if v_recent >= r.max_events then
    return;
  end if;

  insert into public.meter_events (location_id, user_id, kind) values (p_location_id, p_user_id, p_kind);
  insert into public.meter_pulses (location_id, kind, points) values (p_location_id, p_kind, r.points);

  if random() < 0.02 then  -- housekeeping: keep two days of history
    delete from public.meter_pulses where created_at < now() - interval '2 days';
    delete from public.meter_events where created_at < now() - interval '2 days';
  end if;
end;
$$;

revoke all on function public._meter_rule(text) from public, anon, authenticated;
revoke all on function public._record_meter(uuid, uuid, text) from public, anon, authenticated;

-- ------------------------------------------------------------ client RPCs

-- Carousel engagement and hotspot visits come from the client. Only those
-- two kinds are accepted here; everything else is recorded by triggers.
create or replace function public.record_meter_event(p_location_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_kind not in ('carousel', 'hotspot') then
    raise exception 'unsupported activity' using errcode = '22023';
  end if;
  if not public.is_checked_in_at(p_location_id) then
    return;  -- not in the room: quietly ignore
  end if;
  perform public._record_meter(p_location_id, auth.uid(), p_kind);
end;
$$;

-- Points in the last hour plus pulse count. Callers must have visited the venue.
create or replace function public.room_meter(p_location_id uuid)
returns table (points integer, pulses integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null
     or not (public.has_visited_venue(p_location_id) or public.is_venue_manager(p_location_id, auth.uid())) then
    return query select 0, 0;
    return;
  end if;
  return query
    select coalesce(sum(p.points), 0)::integer, count(*)::integer
    from public.meter_pulses p
    where p.location_id = p_location_id and p.created_at > now() - interval '60 minutes';
end;
$$;

revoke all on function public.record_meter_event(uuid, text) from public, anon;
revoke all on function public.room_meter(uuid) from public, anon;
grant execute on function public.record_meter_event(uuid, text) to authenticated;
grant execute on function public.room_meter(uuid) to authenticated;

-- --------------------------------------------------------------- triggers

create or replace function public._meter_from_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.mode = 'live' then
    perform public._record_meter(new.location_id, new.user_id, 'checkin');
  end if;
  return new;
exception when others then
  return new;
end;
$$;

create or replace function public._meter_from_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(new.is_announcement, false) then
    perform public._record_meter(new.location_id, new.author_id, 'post');
  end if;
  return new;
exception when others then
  return new;
end;
$$;

create or replace function public._meter_from_like() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_loc uuid;
begin
  select location_id into v_loc from public.venue_posts where id = new.post_id;
  perform public._record_meter(v_loc, new.user_id, 'like');
  return new;
exception when others then
  return new;
end;
$$;

create or replace function public._meter_from_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_loc uuid;
begin
  select location_id into v_loc from public.venue_posts where id = new.post_id;
  perform public._record_meter(v_loc, new.author_id, 'comment');
  return new;
exception when others then
  return new;
end;
$$;

create or replace function public._meter_from_team() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status is distinct from 'active') then
    perform public._record_meter(new.location_id, new.user_id, 'team');
  end if;
  return new;
exception when others then
  return new;
end;
$$;

revoke all on function public._meter_from_checkin() from public, anon, authenticated;
revoke all on function public._meter_from_post() from public, anon, authenticated;
revoke all on function public._meter_from_like() from public, anon, authenticated;
revoke all on function public._meter_from_comment() from public, anon, authenticated;
revoke all on function public._meter_from_team() from public, anon, authenticated;

drop trigger if exists trg_meter_checkin on public.location_checkins;
create trigger trg_meter_checkin after insert on public.location_checkins
  for each row execute function public._meter_from_checkin();

drop trigger if exists trg_meter_post on public.venue_posts;
create trigger trg_meter_post after insert on public.venue_posts
  for each row execute function public._meter_from_post();

drop trigger if exists trg_meter_like on public.post_likes;
create trigger trg_meter_like after insert on public.post_likes
  for each row execute function public._meter_from_like();

drop trigger if exists trg_meter_comment on public.venue_post_comments;
create trigger trg_meter_comment after insert on public.venue_post_comments
  for each row execute function public._meter_from_comment();

-- Teams (0032) are optional: only wire the trigger if the table exists.
do $$
begin
  if to_regclass('public.team_members') is not null then
    drop trigger if exists trg_meter_team on public.team_members;
    create trigger trg_meter_team after insert or update on public.team_members
      for each row execute function public._meter_from_team();
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.meter_pulses;
exception when duplicate_object then null;
end $$;
