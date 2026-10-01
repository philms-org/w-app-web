-- Pre-arrival access via an invite link. Builds on 0030 (feed policies),
-- 0031 (create_venue_post) and 0033 (room meter triggers).
--
-- A venue manager switches "pre-arrival access" on for their venue, sets
-- when the event starts, and gets a link (/join/<token>) to email attendees.
-- Anyone who signs up (not a guest / anonymous session) and opens the link
-- can read AND take part in that venue's feed (post, like, comment, report)
-- before they get there.
--
-- Early access is temporary. It ends for everyone who joined by link when:
--   * the event starts (event_starts_at passes), or
--   * the manager switches it off (kill switch).
-- Anyone who actually checks in moves onto the normal check-in rules
-- (0024/0030) at that point, so arriving needs no special handling.
--
-- Invitees do NOT count toward the room meter (meter triggers below only
-- record people who are checked in), and teams, announcers and the meter
-- read rules keep using has_visited_venue() / is_checked_in_at().
--
-- The token lives in its own manager-only table, not on locations, because
-- locations rows are readable by every signed-in user.
--
-- Safe to re-run.

-- ------------------------------------------------------------- schema

create table if not exists public.venue_invites (
  location_id uuid primary key references public.locations(id) on delete cascade,
  token text not null unique,
  enabled boolean not null default false,
  event_starts_at timestamptz,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- For databases that ran an earlier draft of this file.
alter table public.venue_invites add column if not exists event_starts_at timestamptz;

alter table public.venue_invites enable row level security;

-- Managers read their venue's link. All writes go through
-- set_venue_invite(), so there are no insert/update/delete policies.
drop policy if exists venue_invites_select_manager on public.venue_invites;
create policy venue_invites_select_manager on public.venue_invites for select to authenticated
  using (public.is_venue_manager(venue_invites.location_id, auth.uid()));

revoke insert, update, delete on public.venue_invites from anon, authenticated;

create table if not exists public.venue_early_access (
  location_id uuid not null references public.locations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  granted_at timestamptz not null default now(),
  primary key (location_id, user_id)
);

alter table public.venue_early_access enable row level security;

-- You can see your own grants; managers can see who joined by link.
drop policy if exists venue_early_access_select on public.venue_early_access;
create policy venue_early_access_select on public.venue_early_access for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_venue_manager(venue_early_access.location_id, auth.uid())
  );

revoke insert, update, delete on public.venue_early_access from anon, authenticated;

-- ------------------------------------------------------------ helpers

-- Joined by link, the venue's switch is on, and the event hasn't started.
create or replace function public.has_early_access(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from venue_early_access ea
    join venue_invites vi on vi.location_id = ea.location_id
    where ea.location_id = p_location_id
      and ea.user_id = auth.uid()
      and vi.enabled
      and (vi.event_starts_at is null or now() < vi.event_starts_at)
  );
$$;

-- Who may read a venue's feed: anyone who has checked in there (0030), or
-- an invitee while early access lasts.
create or replace function public.can_read_venue_feed(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_visited_venue(p_location_id) or public.has_early_access(p_location_id);
$$;

-- Who may like / comment: checked in right now, or an invitee while early
-- access lasts. (Posting goes through create_venue_post below.)
create or replace function public.can_engage_venue(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_checked_in_at(p_location_id) or public.has_early_access(p_location_id);
$$;

revoke all on function public.has_early_access(uuid) from public, anon;
revoke all on function public.can_read_venue_feed(uuid) from public, anon;
revoke all on function public.can_engage_venue(uuid) from public, anon;
grant execute on function public.has_early_access(uuid) to authenticated;
grant execute on function public.can_read_venue_feed(uuid) to authenticated;
grant execute on function public.can_engage_venue(uuid) to authenticated;

-- ------------------------------------------------- manager: switch + link

-- The earlier draft took no event time; drop it so calls aren't ambiguous.
drop function if exists public.set_venue_invite(uuid, boolean, boolean);

-- Turn pre-arrival access on/off and set when the event starts (early
-- access ends then; null = only the switch ends it). Creates the link on
-- first use; pass p_rotate => true to replace it (old links stop working;
-- people who already joined keep access). Returns the current token.
create or replace function public.set_venue_invite(
  p_location_id uuid,
  p_enabled boolean,
  p_event_starts_at timestamptz,
  p_rotate boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if auth.uid() is null or not public.is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into venue_invites (location_id, token, enabled, event_starts_at, updated_by)
  values (
    p_location_id,
    replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    p_enabled,
    p_event_starts_at,
    auth.uid()
  )
  on conflict (location_id) do update
    set enabled = excluded.enabled,
        event_starts_at = excluded.event_starts_at,
        token = case when p_rotate then excluded.token else venue_invites.token end,
        updated_by = auth.uid(),
        updated_at = now()
  returning token into v_token;

  return v_token;
end;
$$;

revoke all on function public.set_venue_invite(uuid, boolean, timestamptz, boolean) from public, anon;
grant execute on function public.set_venue_invite(uuid, boolean, timestamptz, boolean) to authenticated;

-- ---------------------------------------------------- attendee: redeem

-- Called after sign-up with the token from the link. Signed-up accounts
-- only (guest / anonymous sessions are refused). A wrong token, a
-- switched-off venue and an event that already started all give the same
-- error, so tokens can't be probed. Returns the venue id so the app can
-- open it.
create or replace function public.redeem_venue_invite(p_token text)
returns uuid
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
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'sign up to use this link' using errcode = '42501';
  end if;

  select vi.location_id into v_location
  from venue_invites vi
  where vi.token = p_token
    and vi.enabled
    and (vi.event_starts_at is null or now() < vi.event_starts_at);

  if v_location is null then
    raise exception 'invite link is invalid or no longer active' using errcode = 'P0002';
  end if;

  insert into venue_early_access (location_id, user_id)
  values (v_location, auth.uid())
  on conflict do nothing;

  return v_location;
end;
$$;

revoke all on function public.redeem_venue_invite(text) from public, anon;
grant execute on function public.redeem_venue_invite(text) to authenticated;

-- ------------------------------------------- feed read policies (0030)

drop policy if exists venue_posts_select_visitors on public.venue_posts;
create policy venue_posts_select_visitors on public.venue_posts for select to authenticated
  using (public.can_read_venue_feed(venue_posts.location_id));

drop policy if exists post_likes_select_visitors on public.post_likes;
create policy post_likes_select_visitors on public.post_likes for select to authenticated
  using (exists (
    select 1 from public.venue_posts vp
    where vp.id = post_likes.post_id
      and (public.can_read_venue_feed(vp.location_id) or public.is_sharing_connection(vp.author_id))
  ));

drop policy if exists venue_post_comments_select on public.venue_post_comments;
create policy venue_post_comments_select on public.venue_post_comments for select to authenticated
  using (exists (
    select 1 from public.venue_posts vp
    where vp.id = venue_post_comments.post_id and public.can_read_venue_feed(vp.location_id)
  ));

-- --------------------------------------- feed write policies (0024/0030)

-- Replaces 0024's post_likes_insert_checked_in (same open-check-in rule,
-- plus invitees).
drop policy if exists post_likes_insert_checked_in on public.post_likes;
drop policy if exists post_likes_insert_engage on public.post_likes;
create policy post_likes_insert_engage on public.post_likes for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.venue_posts vp
      where vp.id = post_likes.post_id and public.can_engage_venue(vp.location_id)
    )
  );

drop policy if exists venue_post_comments_insert on public.venue_post_comments;
create policy venue_post_comments_insert on public.venue_post_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.venue_posts vp
      where vp.id = venue_post_comments.post_id and public.can_engage_venue(vp.location_id)
    )
  );

-- Same as 0031's version, except an invitee with early access may post
-- without being at the venue (no check-in or geofence check).
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
    if public.is_checked_in_at(p_location_id) then
      if v_venue.lat is null or v_venue.lng is null then
        raise exception 'venue location unknown' using errcode = '22023';
      end if;
      -- Same 50 m fallback as lib/geo.ts DEFAULT_RADIUS_METERS.
      if p_lat is null or p_lng is null
         or public.haversine_meters(p_lat, p_lng, v_venue.lat, v_venue.lng)
            > coalesce(v_venue.geofence_radius_meters, 50) then
        raise exception 'not within venue geofence' using errcode = '42501';
      end if;
    elsif not public.has_early_access(p_location_id) then
      raise exception 'not checked in at this venue' using errcode = '42501';
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

-- Same as 0030's version, but invitees can report what they can see.
create or replace function public.report_venue_content(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
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
  if p_target_type = 'post' then
    select location_id into v_location from venue_posts where id = p_target_id;
  elsif p_target_type = 'comment' then
    select vp.location_id into v_location
    from venue_post_comments c join venue_posts vp on vp.id = c.post_id
    where c.id = p_target_id;
  else
    raise exception 'invalid target type' using errcode = '22023';
  end if;
  -- Can't report what you can't see (also hides whether an id exists).
  if v_location is null or not public.can_read_venue_feed(v_location) then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  insert into venue_post_reports (location_id, target_type, target_id, reporter_id, reason, details)
  values (v_location, p_target_type, p_target_id, auth.uid(), p_reason, nullif(btrim(coalesce(p_details, '')), ''))
  on conflict (target_type, target_id, reporter_id) do nothing;
end;
$$;

-- -------------------------------------------- room meter triggers (0033)

-- The meter measures the room, so activity from invitees who aren't there
-- yet doesn't count. Before 0035 only checked-in people could post / like /
-- comment, so for them this changes nothing.

create or replace function public._meter_from_post() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(new.is_announcement, false)
     and exists (select 1 from location_checkins lc
                 where lc.user_id = new.author_id and lc.location_id = new.location_id
                   and lc.checked_out_at is null) then
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
  if exists (select 1 from location_checkins lc
             where lc.user_id = new.user_id and lc.location_id = v_loc
               and lc.checked_out_at is null) then
    perform public._record_meter(v_loc, new.user_id, 'like');
  end if;
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
  if exists (select 1 from location_checkins lc
             where lc.user_id = new.author_id and lc.location_id = v_loc
               and lc.checked_out_at is null) then
    perform public._record_meter(v_loc, new.author_id, 'comment');
  end if;
  return new;
exception when others then
  return new;
end;
$$;
