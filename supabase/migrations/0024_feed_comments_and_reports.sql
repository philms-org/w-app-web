-- 0024_feed_comments_and_reports.sql
-- Phase 1 of the venue activity feed + commenting feature: schema, RLS, and
-- the server-verified posting RPC. No UI changes land in this phase — the
-- new tables/RPC are inert until Phase 2 wires a composer to them.
-- Run manually against w-app-qa:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0024_feed_comments_and_reports.sql
--
-- Note: `feed_posts` (location_id, user_id, content, zone_tag, created_at)
-- already exists live but was never created by a tracked migration in this
-- repo — this file only adds to it, it never recreates it.

-- ---------------------------------------------------------------------
-- Comments on a feed post.
-- ---------------------------------------------------------------------
create table if not exists public.feed_comments (
  id uuid primary key default gen_random_uuid(),
  feed_post_id uuid not null references public.feed_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  content text not null check (char_length(trim(content)) > 0 and char_length(content) <= 1000),
  created_at timestamptz not null default now()
);

alter table public.feed_comments enable row level security;

-- Read access mirrors feed_posts itself (world-readable to any authenticated
-- user today — fetchFeed applies no extra scoping beyond location_id).
drop policy if exists feed_comments_select on public.feed_comments;
create policy feed_comments_select on public.feed_comments for select to authenticated
  using (true);

drop policy if exists feed_comments_insert_own on public.feed_comments;
create policy feed_comments_insert_own on public.feed_comments for insert to authenticated
  with check (user_id = auth.uid());

-- Delete: the comment's own author, or the venue's organizer/co-owner/master
-- admin (is_venue_manager already ORs in is_master_admin — see 0001).
drop policy if exists feed_comments_delete on public.feed_comments;
create policy feed_comments_delete on public.feed_comments for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.feed_posts fp
      where fp.id = feed_comments.feed_post_id
        and public.is_venue_manager(fp.location_id, auth.uid())
    )
  );

create index if not exists idx_feed_comments_post on public.feed_comments (feed_post_id, created_at);

-- ---------------------------------------------------------------------
-- Reports on a post or a comment. Polymorphic target (no single FK is
-- possible across two tables) — target_type + target_id is resolved to a
-- venue via the two EXISTS branches in each policy below.
-- ---------------------------------------------------------------------
create table if not exists public.feed_reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reporter_id uuid not null references public.profiles(id),
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'other')),
  details text,
  status text not null check (status in ('open', 'resolved')) default 'open',
  resolved_by uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.feed_reports enable row level security;

-- A reporter can see their own reports; a venue's organizer/co-owner/master
-- admin can see reports whose target belongs to their venue. Because
-- is_venue_manager already includes is_master_admin, this same predicate is
-- what gives master admin the cross-venue reports view (Phase 4 UI) for
-- free — no separate "is admin" branch needed.
drop policy if exists feed_reports_select on public.feed_reports;
create policy feed_reports_select on public.feed_reports for select to authenticated
  using (
    reporter_id = auth.uid()
    or (
      target_type = 'post'
      and exists (
        select 1 from public.feed_posts fp
        where fp.id = feed_reports.target_id
          and public.is_venue_manager(fp.location_id, auth.uid())
      )
    )
    or (
      target_type = 'comment'
      and exists (
        select 1 from public.feed_comments fc
        join public.feed_posts fp on fp.id = fc.feed_post_id
        where fc.id = feed_reports.target_id
          and public.is_venue_manager(fp.location_id, auth.uid())
      )
    )
  );

drop policy if exists feed_reports_insert_own on public.feed_reports;
create policy feed_reports_insert_own on public.feed_reports for insert to authenticated
  with check (reporter_id = auth.uid());

-- No UPDATE policy: RLS's with-check can't be scoped to just the
-- status/resolved_by/resolved_at columns, so a broad policy would let a
-- venue manager also rewrite target_type/target_id/reporter_id on someone
-- else's report (the exact class of bug 0015's Finding 6 fixed for
-- connections_update_own_contact_choice). resolve_feed_report() below is a
-- security-definer RPC instead, touching only those three columns.
create or replace function public.resolve_feed_report(p_report_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  report feed_reports%rowtype;
  authorized boolean;
begin
  if p_status not in ('open', 'resolved') then
    raise exception 'invalid status';
  end if;

  select * into report from feed_reports where id = p_report_id;
  if report.id is null then
    raise exception 'report not found';
  end if;

  if report.target_type = 'post' then
    select public.is_venue_manager(fp.location_id, auth.uid()) into authorized
    from public.feed_posts fp where fp.id = report.target_id;
  else
    select public.is_venue_manager(fp.location_id, auth.uid()) into authorized
    from public.feed_comments fc
    join public.feed_posts fp on fp.id = fc.feed_post_id
    where fc.id = report.target_id;
  end if;

  if not coalesce(authorized, false) then
    raise exception 'not authorized';
  end if;

  update feed_reports
  set status = p_status, resolved_by = auth.uid(), resolved_at = now()
  where id = p_report_id;
end;
$$;

grant execute on function public.resolve_feed_report(uuid, text) to authenticated;

create index if not exists idx_feed_reports_target on public.feed_reports (target_type, target_id);
create index if not exists idx_feed_reports_status on public.feed_reports (status);

-- ---------------------------------------------------------------------
-- Server-verified posting. postToFeed's old plain insert trusted the
-- client's own "am I in range" check (lib/geo.ts's findClosestVenueInRange),
-- which is exactly the bit a client can spoof. This RPC re-derives the same
-- haversine distance server-side against the venue's own lat/lng before
-- allowing the insert, mirroring the checked-in gate record_zone_position
-- added in 0015 for the same reason.
-- ---------------------------------------------------------------------
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

create or replace function public.post_to_feed(
  p_location_id uuid,
  p_content text,
  p_lat double precision,
  p_lng double precision
)
returns public.feed_posts
language plpgsql
security definer
set search_path = public
as $$
declare
  venue locations%rowtype;
  new_post feed_posts%rowtype;
begin
  if trim(p_content) = '' or char_length(p_content) > 1000 then
    raise exception 'invalid content';
  end if;

  select * into venue from locations where id = p_location_id;
  if venue.id is null or venue.lat is null or venue.lng is null then
    raise exception 'venue location unknown';
  end if;

  -- Same 50m fallback as lib/geo.ts's DEFAULT_RADIUS_METERS, so a venue
  -- with no explicit geofence_radius_meters set still behaves identically
  -- to what the client already shows as "in range".
  if haversine_meters(p_lat, p_lng, venue.lat, venue.lng) > coalesce(venue.geofence_radius_meters, 50) then
    raise exception 'not within venue geofence';
  end if;

  insert into feed_posts (location_id, user_id, content)
  values (p_location_id, auth.uid(), trim(p_content))
  returning * into new_post;

  return new_post;
end;
$$;

grant execute on function public.post_to_feed(uuid, text, double precision, double precision) to authenticated;

-- feed_posts already exists with its own (untracked) RLS. Whatever INSERT
-- policy currently lets postToFeed's old plain client insert through is an
-- unused bypass once posting goes through post_to_feed exclusively (same
-- reasoning as 0015 dropping zone_position_fixes_insert) — dropped
-- dynamically by command type rather than by a guessed name, since the
-- policy was never captured in a tracked migration to begin with.
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'feed_posts' and cmd = 'INSERT'
  loop
    execute format('drop policy %I on public.feed_posts', pol.policyname);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Realtime: feed_posts/feed_comments join the two tables already live
-- (messages, location_checkins — see 0017) so Phase 2/3's live venue view
-- and comment threads can subscribe instead of polling.
-- ---------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table feed_posts;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table feed_comments;
exception when duplicate_object then null;
end $$;
