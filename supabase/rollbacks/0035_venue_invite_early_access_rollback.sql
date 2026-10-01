-- ROLLBACK for 0035_venue_invite_early_access.sql. Not a migration: run by
-- hand only if 0035 has to come off a database.
--
--   supabase db query --linked -f supabase/rollbacks/0035_venue_invite_early_access_rollback.sql
--
-- Puts back exactly what prod ran before 0035. The five functions below are
-- prod's live definitions (pg_get_functiondef, captured 2026-10-01), which
-- matched the repo's 0030/0031/0033 versions; the five policies are 0024/0030's.
-- Existing grants survive CREATE OR REPLACE, so none are re-issued.
--
-- DESTRUCTIVE: drops venue_invites and venue_early_access, so every invite
-- link and every "joined by link" grant is lost. Posts, likes and comments
-- invitees already made stay (they're ordinary rows).
--
-- All or nothing; safe to re-run.

begin;

-- 1. Functions back to their pre-0035 bodies (no early-access paths, meter
--    counts every post/like/comment again).

CREATE OR REPLACE FUNCTION public.create_venue_post(p_location_id uuid, p_body text, p_lat double precision, p_lng double precision)
 RETURNS venue_posts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.report_venue_content(p_target_type text, p_target_id uuid, p_reason text, p_details text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public._meter_from_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not coalesce(new.is_announcement, false) then
    perform public._record_meter(new.location_id, new.author_id, 'post');
  end if;
  return new;
exception when others then
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public._meter_from_like()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_loc uuid;
begin
  select location_id into v_loc from public.venue_posts where id = new.post_id;
  perform public._record_meter(v_loc, new.user_id, 'like');
  return new;
exception when others then
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public._meter_from_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_loc uuid;
begin
  select location_id into v_loc from public.venue_posts where id = new.post_id;
  perform public._record_meter(v_loc, new.author_id, 'comment');
  return new;
exception when others then
  return new;
end;
$function$;

-- 2. Feed policies back to check-in only (0024 / 0030).

drop policy if exists venue_posts_select_visitors on public.venue_posts;
create policy venue_posts_select_visitors on public.venue_posts for select to authenticated
  using (public.has_visited_venue(venue_posts.location_id));

drop policy if exists post_likes_select_visitors on public.post_likes;
create policy post_likes_select_visitors on public.post_likes for select to authenticated
  using (exists (
    select 1 from public.venue_posts vp
    where vp.id = post_likes.post_id
      and (public.has_visited_venue(vp.location_id) or public.is_sharing_connection(vp.author_id))
  ));

drop policy if exists venue_post_comments_select on public.venue_post_comments;
create policy venue_post_comments_select on public.venue_post_comments for select to authenticated
  using (exists (
    select 1 from public.venue_posts vp
    where vp.id = venue_post_comments.post_id and public.has_visited_venue(vp.location_id)
  ));

drop policy if exists post_likes_insert_engage on public.post_likes;
drop policy if exists post_likes_insert_checked_in on public.post_likes;
create policy post_likes_insert_checked_in on public.post_likes for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.venue_posts vp
      join public.location_checkins lc on lc.location_id = vp.location_id
      where vp.id = post_likes.post_id
        and lc.user_id = auth.uid()
        and lc.checked_out_at is null
    )
  );

drop policy if exists venue_post_comments_insert on public.venue_post_comments;
create policy venue_post_comments_insert on public.venue_post_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.venue_posts vp
      where vp.id = venue_post_comments.post_id and public.is_checked_in_at(vp.location_id)
    )
  );

-- 3. 0035's own functions and tables (nothing references them any more).

drop function if exists public.set_venue_invite(uuid, boolean, timestamptz, boolean);
drop function if exists public.set_venue_invite(uuid, boolean, boolean);
drop function if exists public.redeem_venue_invite(text);
drop function if exists public.can_engage_venue(uuid);
drop function if exists public.can_read_venue_feed(uuid);
drop function if exists public.has_early_access(uuid);

drop table if exists public.venue_early_access;
drop table if exists public.venue_invites;

commit;
