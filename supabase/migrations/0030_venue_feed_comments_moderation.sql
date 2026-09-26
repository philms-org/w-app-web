-- Venue feed follow-up: history visibility, server-verified posting,
-- comments, reports and organizer moderation. Builds on 0024/0025
-- (venue_posts, post_likes), which are not edited.
--
-- Consolidates the comments/reports/geofence work from PRs #11/#12 onto the
-- venue_posts feed (one feed instead of two), with the access model below.
--
-- WHO CAN DO WHAT
--   read posts, likes, comments   anyone who has EVER checked in at that
--                                 venue: live for everyone there during the
--                                 event, and still visible in History after
--                                 you leave.
--   read a connection's posts     your connections (friendships), from
--   (+ their like counts)         anywhere, IF the author has "Share
--                                 check-ins with connections" on. A post
--                                 reveals where you are, exactly like a
--                                 check-in, so it follows the same switch.
--   post                          only via create_venue_post(): currently
--                                 checked in AND within the venue's radius,
--                                 checked on the server from a fresh fix.
--   like                          currently checked in (0024, unchanged).
--   comment                       currently checked in at the post's venue.
--   delete a post / comment       its author, or a venue manager.
--   report a post / comment       anyone who can read it; once per target.
--   see / resolve reports         the reporter sees their own; venue
--                                 managers see and resolve their venue's.
--
-- Safe to re-run.

-- ---------------------------------------------------------------- helpers

-- Has the caller ever checked in at this venue (current or past visit)?
-- security definer so policies on other tables can call it without
-- depending on location_checkins' own select policy.
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
  );
$$;

create or replace function public.is_checked_in_at(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from location_checkins lc
    where lc.user_id = auth.uid() and lc.location_id = p_location_id and lc.checked_out_at is null
  );
$$;

-- Is the author one of my connections who shares their check-ins with
-- connections? Reads profiles as definer so it works under owner-only
-- profiles RLS (PR #7).
create or replace function public.is_sharing_connection(p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from friendships f
    join profiles p on p.id = f.friend_id
    where f.user_id = auth.uid() and f.friend_id = p_author
      and coalesce(p.share_checkins_with_friends, false)
  );
$$;

revoke all on function public.is_sharing_connection(uuid) from public, anon;
grant execute on function public.is_sharing_connection(uuid) to authenticated;

revoke all on function public.has_visited_venue(uuid) from public, anon;
revoke all on function public.is_checked_in_at(uuid) from public, anon;
grant execute on function public.has_visited_venue(uuid) to authenticated;
grant execute on function public.is_checked_in_at(uuid) to authenticated;

create or replace function public.haversine_meters(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql
immutable
as $$
  select 6371000 * 2 * asin(sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2 +
    cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2
  ));
$$;

-- ------------------------------------------------- history visibility

drop policy if exists venue_posts_select_checked_in on public.venue_posts;
drop policy if exists venue_posts_select_visitors on public.venue_posts;
create policy venue_posts_select_visitors on public.venue_posts for select to authenticated
  using (public.has_visited_venue(venue_posts.location_id));

drop policy if exists post_likes_select_checked_in on public.post_likes;
drop policy if exists post_likes_select_visitors on public.post_likes;
create policy post_likes_select_visitors on public.post_likes for select to authenticated
  using (exists (
    select 1 from public.venue_posts vp
    where vp.id = post_likes.post_id
      and (public.has_visited_venue(vp.location_id) or public.is_sharing_connection(vp.author_id))
  ));

drop policy if exists venue_posts_select_connections on public.venue_posts;
create policy venue_posts_select_connections on public.venue_posts for select to authenticated
  using (public.is_sharing_connection(venue_posts.author_id));

-- ---------------------------------------------- server-verified posting

-- Replaces the direct insert (0024 venue_posts_insert_checked_in), which only
-- checked for an open check-in row. Now the server also re-derives the
-- distance from a fresh position, like record_zone_position (0015).
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
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 280 then
    raise exception 'post must be 1 to 280 characters' using errcode = '22023';
  end if;
  if not public.is_checked_in_at(p_location_id) then
    raise exception 'not checked in at this venue' using errcode = '42501';
  end if;

  select * into v_venue from locations where id = p_location_id;
  if v_venue.id is null or v_venue.lat is null or v_venue.lng is null then
    raise exception 'venue location unknown' using errcode = '22023';
  end if;
  -- Same 50 m fallback as lib/geo.ts DEFAULT_RADIUS_METERS.
  if p_lat is null or p_lng is null
     or public.haversine_meters(p_lat, p_lng, v_venue.lat, v_venue.lng)
        > coalesce(v_venue.geofence_radius_meters, 50) then
    raise exception 'not within venue geofence' using errcode = '42501';
  end if;

  insert into venue_posts (location_id, author_id, body)
  values (p_location_id, auth.uid(), v_body)
  returning * into v_post;
  return v_post;
end;
$$;

revoke all on function public.create_venue_post(uuid, text, double precision, double precision) from public, anon;
grant execute on function public.create_venue_post(uuid, text, double precision, double precision) to authenticated;

drop policy if exists venue_posts_insert_checked_in on public.venue_posts;

-- Organizers can remove any post at their venue (authors already can, 0025).
drop policy if exists venue_posts_delete_manager on public.venue_posts;
create policy venue_posts_delete_manager on public.venue_posts for delete to authenticated
  using (public.is_venue_manager(venue_posts.location_id, auth.uid()));

-- ------------------------------------------------------------ comments

create table if not exists public.venue_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.venue_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists venue_post_comments_post on public.venue_post_comments (post_id, created_at);

alter table public.venue_post_comments enable row level security;

drop policy if exists venue_post_comments_select on public.venue_post_comments;
create policy venue_post_comments_select on public.venue_post_comments for select to authenticated
  using (exists (
    select 1 from public.venue_posts vp
    where vp.id = venue_post_comments.post_id and public.has_visited_venue(vp.location_id)
  ));

drop policy if exists venue_post_comments_insert on public.venue_post_comments;
create policy venue_post_comments_insert on public.venue_post_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.venue_posts vp
      where vp.id = venue_post_comments.post_id and public.is_checked_in_at(vp.location_id)
    )
  );

drop policy if exists venue_post_comments_delete on public.venue_post_comments;
create policy venue_post_comments_delete on public.venue_post_comments for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.venue_posts vp
      where vp.id = venue_post_comments.post_id
        and public.is_venue_manager(vp.location_id, auth.uid())
    )
  );

-- ------------------------------------------------------------- reports

create table if not exists public.venue_post_reports (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reporter_id uuid not null references public.profiles(id) default auth.uid(),
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'resolved')),
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (target_type, target_id, reporter_id)
);
create index if not exists venue_post_reports_open on public.venue_post_reports (location_id, status, created_at desc);

alter table public.venue_post_reports enable row level security;

-- Reports go through report_venue_content() (it derives location_id from the
-- target and checks the reporter can see it), so there is no insert policy.
drop policy if exists venue_post_reports_select on public.venue_post_reports;
create policy venue_post_reports_select on public.venue_post_reports for select to authenticated
  using (
    reporter_id = auth.uid()
    or public.is_venue_manager(venue_post_reports.location_id, auth.uid())
  );

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
  if v_location is null or not public.has_visited_venue(v_location) then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  insert into venue_post_reports (location_id, target_type, target_id, reporter_id, reason, details)
  values (v_location, p_target_type, p_target_id, auth.uid(), p_reason, nullif(btrim(coalesce(p_details, '')), ''))
  on conflict (target_type, target_id, reporter_id) do nothing;
end;
$$;

-- No update policy: resolving only ever touches status / resolved_by /
-- resolved_at, and a broad update policy would let a manager rewrite the
-- rest of someone's report.
create or replace function public.resolve_venue_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location uuid;
begin
  select location_id into v_location from venue_post_reports where id = p_report_id;
  if v_location is null or not public.is_venue_manager(v_location, auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update venue_post_reports
  set status = 'resolved', resolved_by = auth.uid(), resolved_at = now()
  where id = p_report_id;
end;
$$;

revoke all on function public.report_venue_content(text, uuid, text, text) from public, anon;
revoke all on function public.resolve_venue_report(uuid) from public, anon;
grant execute on function public.report_venue_content(text, uuid, text, text) to authenticated;
grant execute on function public.resolve_venue_report(uuid) to authenticated;

-- ------------------------------------------------------------ realtime

do $$
begin
  alter publication supabase_realtime add table public.venue_post_comments;
exception when duplicate_object then null;
end $$;
