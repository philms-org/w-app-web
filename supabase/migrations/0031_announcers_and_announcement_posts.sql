-- Announcements come from the feed: whenever a venue manager (owner,
-- co-owner, master admin) or an ANNOUNCER posts to a venue's feed, the post
-- is flagged as an announcement and shows in the announcements pill on
-- checked-in Home, as well as in the feed. Builds on 0030; nothing earlier
-- is edited.
--
-- Announcer = a per-venue role granted by the venue's primary owner or a
-- master admin ("governance"). Announcers can post announcements; they get
-- no other organizer powers.
--
-- Managers and announcers may post from anywhere (e.g. "Doors open at 9"
-- before the event); everyone else still has to be checked in and inside
-- the geofence (0030).
--
-- Safe to re-run.

create table if not exists public.venue_announcers (
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_by uuid references public.profiles(id) default auth.uid(),
  granted_at timestamptz not null default now(),
  primary key (location_id, user_id)
);

alter table public.venue_announcers enable row level security;

-- Only the venue's primary owner or a master admin may grant / revoke.
create or replace function public.can_govern_venue(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from locations l where l.id = p_location_id and l.owner_id = auth.uid())
      or exists (select 1 from profiles p where p.id = auth.uid() and p.is_master_admin);
$$;

-- Venue manager or announcer at this venue.
create or replace function public.can_announce(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_venue_manager(p_location_id, auth.uid())
      or exists (select 1 from venue_announcers a where a.location_id = p_location_id and a.user_id = auth.uid());
$$;

revoke all on function public.can_govern_venue(uuid) from public, anon;
revoke all on function public.can_announce(uuid) from public, anon;
grant execute on function public.can_govern_venue(uuid) to authenticated;
grant execute on function public.can_announce(uuid) to authenticated;

drop policy if exists venue_announcers_select on public.venue_announcers;
create policy venue_announcers_select on public.venue_announcers for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_visited_venue(venue_announcers.location_id)
    or public.is_venue_manager(venue_announcers.location_id, auth.uid())
  );

drop policy if exists venue_announcers_insert on public.venue_announcers;
create policy venue_announcers_insert on public.venue_announcers for insert to authenticated
  with check (public.can_govern_venue(venue_announcers.location_id));

drop policy if exists venue_announcers_delete on public.venue_announcers;
create policy venue_announcers_delete on public.venue_announcers for delete to authenticated
  using (public.can_govern_venue(venue_announcers.location_id));

-- ------------------------------------------------ announcement posts

alter table public.venue_posts add column if not exists is_announcement boolean not null default false;
create index if not exists venue_posts_announcements
  on public.venue_posts (location_id, created_at desc) where is_announcement;

-- Same contract as 0030's version, plus: the server decides whether the post
-- is an announcement (never the client), and managers/announcers skip the
-- check-in + geofence requirement.
create or replace function public.create_venue_post(
  p_location_id uuid,
  p_body text,
  p_lat double precision,
  p_lng double precision
)
returns public.venue_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venue locations%rowtype;
  v_post venue_posts%rowtype;
  v_body text := btrim(coalesce(p_body, ''));
  v_announcer boolean;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 280 then
    raise exception 'post must be 1 to 280 characters' using errcode = '22023';
  end if;

  select * into v_venue from locations where id = p_location_id;
  if v_venue.id is null then
    raise exception 'venue not found' using errcode = 'P0002';
  end if;

  v_announcer := public.can_announce(p_location_id);

  if not v_announcer then
    if not public.is_checked_in_at(p_location_id) then
      raise exception 'not checked in at this venue' using errcode = '42501';
    end if;
    if v_venue.lat is null or v_venue.lng is null then
      raise exception 'venue location unknown' using errcode = '22023';
    end if;
    -- Same 50 m fallback as lib/geo.ts DEFAULT_RADIUS_METERS.
    if p_lat is null or p_lng is null
       or public.haversine_meters(p_lat, p_lng, v_venue.lat, v_venue.lng)
          > coalesce(v_venue.geofence_radius_meters, 50) then
      raise exception 'not within venue geofence' using errcode = '42501';
    end if;
  end if;

  insert into venue_posts (location_id, author_id, body, is_announcement)
  values (p_location_id, auth.uid(), v_body, v_announcer)
  returning * into v_post;
  return v_post;
end;
$$;

revoke all on function public.create_venue_post(uuid, text, double precision, double precision) from public, anon;
grant execute on function public.create_venue_post(uuid, text, double precision, double precision) to authenticated;

-- Announcers/managers may post without ever having checked in; they must
-- still be able to read their own venue's feed and announcements.
drop policy if exists venue_posts_select_announcers on public.venue_posts;
create policy venue_posts_select_announcers on public.venue_posts for select to authenticated
  using (public.can_announce(venue_posts.location_id));

do $$
begin
  alter publication supabase_realtime add table public.venue_announcers;
exception when duplicate_object then null;
end $$;
