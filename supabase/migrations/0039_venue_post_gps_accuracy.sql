-- Venue posts: allow for GPS error, the same way check-in does.
--
-- #41 made the client count someone as "at the venue" when their distance
-- minus the fix's reported accuracy (capped at 150 m) is within the radius
-- (lib/geo.ts isWithinGeofence). create_venue_post still compared the raw
-- distance, so a person indoors with a fuzzy fix was shown as checked in and
-- then told "You need to be at the venue to post."
--
-- Adds p_accuracy (meters, optional). Same rule and cap as the client:
--   distance - least(greatest(accuracy, 0), 150) <= radius
-- Otherwise identical to 0035's version.
--
-- Deploy order: apply this BEFORE shipping the client that sends p_accuracy.
-- (Old clients keep working against this version: p_accuracy defaults to null.)

drop function if exists public.create_venue_post(uuid, text, double precision, double precision);

create or replace function public.create_venue_post(
  p_location_id uuid,
  p_body text,
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null
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
  -- Same cap as lib/geo.ts MAX_ACCURACY_ALLOWANCE_METERS.
  v_allowance double precision := least(greatest(coalesce(p_accuracy, 0), 0), 150);
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
         or public.haversine_meters(p_lat, p_lng, v_venue.lat, v_venue.lng) - v_allowance
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

revoke all on function public.create_venue_post(uuid, text, double precision, double precision, double precision) from public, anon;
grant execute on function public.create_venue_post(uuid, text, double precision, double precision, double precision) to authenticated;
