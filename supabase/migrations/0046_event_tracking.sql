-- 0046: organizer event tracking (Startup Weekend W-S readout, P1 batch A).
--
-- What organizers couldn't see at TSWWS26, and the data that fixes it:
--   1. Staff vs attendee: event_staff. Organizers mark mentors, judges,
--      volunteers, sponsors and test accounts so counts exclude them.
--   2. Daily presence: event_presence_days. One row per person per local day
--      they were seen inside the geofence. Check-ins stay open for the whole
--      event, so check-in rows alone can't say who came back on day 2.
--   3. Role at the event: event_roles (developer / designer / business /
--      other), asked once per event at check-in when the organizer turns on
--      locations.ask_event_role.
--   4. Sponsor slide reach: carousel_slide_events. Unique viewers and link
--      taps per carousel slide per day (the room meter only kept a total).
--   5. event_tracking_summary(): one manager-only read for the report page.
--
-- Writes from attendees go through SECURITY DEFINER RPCs that check the
-- rules server-side; tables are readable by venue managers (and each person
-- can read their own rows). No backfill: TSWWS26 data stays as it was.

-- --------------------------------------------------------------- settings

alter table public.locations
  add column if not exists ask_event_role boolean not null default false;

-- ------------------------------------------------------------------ staff

create table if not exists public.event_staff (
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('organizer', 'mentor', 'judge', 'volunteer', 'sponsor', 'test')),
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (location_id, user_id)
);

alter table public.event_staff enable row level security;

drop policy if exists event_staff_select on public.event_staff;
create policy event_staff_select on public.event_staff
  for select to authenticated
  using (public.is_venue_manager(location_id, auth.uid()));

drop policy if exists event_staff_insert on public.event_staff;
create policy event_staff_insert on public.event_staff
  for insert to authenticated
  with check (public.is_venue_manager(location_id, auth.uid()) and added_by = auth.uid());

drop policy if exists event_staff_update on public.event_staff;
create policy event_staff_update on public.event_staff
  for update to authenticated
  using (public.is_venue_manager(location_id, auth.uid()))
  with check (public.is_venue_manager(location_id, auth.uid()));

drop policy if exists event_staff_delete on public.event_staff;
create policy event_staff_delete on public.event_staff
  for delete to authenticated
  using (public.is_venue_manager(location_id, auth.uid()));

grant select, insert, update, delete on public.event_staff to authenticated;

-- ------------------------------------------------------------------ roles

create table if not exists public.event_roles (
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('developer', 'designer', 'business', 'other')),
  picked_at timestamptz not null default now(),
  primary key (location_id, user_id)
);

alter table public.event_roles enable row level security;

drop policy if exists event_roles_select on public.event_roles;
create policy event_roles_select on public.event_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_venue_manager(location_id, auth.uid()));

grant select on public.event_roles to authenticated;

-- Attendees set their own role while checked in or attending by link.
create or replace function public.set_event_role(p_location_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_role not in ('developer', 'designer', 'business', 'other') then
    raise exception 'unknown role' using errcode = '22023';
  end if;
  if not (public.is_checked_in_at(p_location_id) or public.has_early_access(p_location_id)) then
    raise exception 'not at this event' using errcode = '42501';
  end if;
  insert into event_roles (location_id, user_id, role)
  values (p_location_id, auth.uid(), p_role)
  on conflict (location_id, user_id) do update
    set role = excluded.role, picked_at = now();
end;
$$;

revoke all on function public.set_event_role(uuid, text) from public;
grant execute on function public.set_event_role(uuid, text) to authenticated;

-- --------------------------------------------------------- daily presence

create table if not exists public.event_presence_days (
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  pings integer not null default 1,
  primary key (location_id, user_id, day)
);

alter table public.event_presence_days enable row level security;

drop policy if exists event_presence_days_select on public.event_presence_days;
create policy event_presence_days_select on public.event_presence_days
  for select to authenticated
  using (user_id = auth.uid() or public.is_venue_manager(location_id, auth.uid()));

grant select on public.event_presence_days to authenticated;

-- Called by the app while someone with an open check-in has a GPS fix inside
-- the venue. The server re-checks the fix against the geofence with the same
-- accuracy allowance as posting (0040), so a phone at home can't log a day.
-- p_tz is the phone's IANA zone; it decides which calendar day this is.
create or replace function public.record_event_presence(
  p_location_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null,
  p_tz text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue locations%rowtype;
  v_allowance double precision := least(greatest(coalesce(p_accuracy, 0), 0), 150);
  v_tz text := 'America/New_York';
  v_day date;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not public.is_checked_in_at(p_location_id) then
    return;  -- not checked in here: nothing to record
  end if;

  select * into v_venue from locations where id = p_location_id;
  if v_venue.id is null or v_venue.lat is null or v_venue.lng is null
     or p_lat is null or p_lng is null then
    return;
  end if;
  if public.haversine_meters(p_lat, p_lng, v_venue.lat, v_venue.lng) - v_allowance
     > coalesce(v_venue.geofence_radius_meters, 50) then
    return;  -- outside the room
  end if;

  if p_tz is not null and exists (select 1 from pg_timezone_names where name = p_tz) then
    v_tz := p_tz;
  end if;
  v_day := (now() at time zone v_tz)::date;

  insert into event_presence_days (location_id, user_id, day)
  values (p_location_id, auth.uid(), v_day)
  on conflict (location_id, user_id, day) do update
    set last_seen_at = now(), pings = event_presence_days.pings + 1
    where event_presence_days.last_seen_at < now() - interval '1 minute';
end;
$$;

revoke all on function public.record_event_presence(uuid, double precision, double precision, double precision, text) from public;
grant execute on function public.record_event_presence(uuid, double precision, double precision, double precision, text) to authenticated;

-- ------------------------------------------------------ carousel slide reach

create table if not exists public.carousel_slide_events (
  id bigint generated always as identity primary key,
  location_id uuid not null references public.locations(id) on delete cascade,
  banner_id uuid not null references public.banners(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('view', 'tap')),
  day date not null default (now() at time zone 'America/New_York')::date,
  created_at timestamptz not null default now()
);

-- One view and one tap per person per slide per day: the numbers are reach
-- (unique people), which is what sponsors ask for.
create unique index if not exists carousel_slide_events_once_per_day
  on public.carousel_slide_events (banner_id, user_id, kind, day);
create index if not exists carousel_slide_events_location
  on public.carousel_slide_events (location_id);

alter table public.carousel_slide_events enable row level security;

drop policy if exists carousel_slide_events_select on public.carousel_slide_events;
create policy carousel_slide_events_select on public.carousel_slide_events
  for select to authenticated
  using (public.is_venue_manager(location_id, auth.uid()));

grant select on public.carousel_slide_events to authenticated;

create or replace function public.record_slide_event(p_banner_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_kind not in ('view', 'tap') then
    raise exception 'unsupported slide event' using errcode = '22023';
  end if;
  select location_id into v_location from banners where id = p_banner_id and is_active;
  if v_location is null then
    return;
  end if;
  insert into carousel_slide_events (location_id, banner_id, user_id, kind)
  values (v_location, p_banner_id, auth.uid(), p_kind)
  on conflict (banner_id, user_id, kind, day) do nothing;
end;
$$;

revoke all on function public.record_slide_event(uuid, text) from public;
grant execute on function public.record_slide_event(uuid, text) to authenticated;

-- --------------------------------------------------------------- summary

-- Everything the report page's "Event tracking" card shows, staff excluded.
create or replace function public.event_tracking_summary(p_location_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null or not public.is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'not a manager of this venue' using errcode = '42501';
  end if;

  with staff as (
    select user_id from event_staff where location_id = p_location_id
  ),
  people as (
    select user_id from location_checkins where location_id = p_location_id
    union
    select user_id from venue_early_access where location_id = p_location_id
  )
  select jsonb_build_object(
    'dates_set', (select event_date is not null and event_end_date is not null from locations where id = p_location_id),
    'ask_event_role', (select ask_event_role from locations where id = p_location_id),
    'staff', (select count(*) from staff),
    'attendees', (select count(*) from people where user_id not in (select user_id from staff)),
    'presence_days', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'people', n) order by day)
      from (
        select day, count(*) as n from event_presence_days
        where location_id = p_location_id and user_id not in (select user_id from staff)
        group by day
      ) d
    ), '[]'::jsonb),
    'roles', coalesce((
      select jsonb_object_agg(role, n)
      from (
        select role, count(*) as n from event_roles
        where location_id = p_location_id and user_id not in (select user_id from staff)
        group by role
      ) r
    ), '{}'::jsonb),
    'slides', coalesce((
      select jsonb_agg(jsonb_build_object(
        'banner_id', b.id,
        'image_url', b.image_url,
        'is_active', b.is_active,
        'viewers', (select count(distinct e.user_id) from carousel_slide_events e
                    where e.banner_id = b.id and e.kind = 'view' and e.user_id not in (select user_id from staff)),
        'tappers', (select count(distinct e.user_id) from carousel_slide_events e
                    where e.banner_id = b.id and e.kind = 'tap' and e.user_id not in (select user_id from staff))
      ) order by b.display_order)
      from banners b where b.location_id = p_location_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.event_tracking_summary(uuid) from public;
grant execute on function public.event_tracking_summary(uuid) to authenticated;
