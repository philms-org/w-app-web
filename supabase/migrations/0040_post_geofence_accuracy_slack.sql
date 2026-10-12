-- 0040: give the post geofence the same GPS-error slack the client uses.
--
-- PR #41 made the app judge "at the venue" as distance - min(accuracy, 150m)
-- <= radius (lib/geo.ts isWithinGeofence), but create_venue_post still checked
-- the raw point. Indoors a phone's fix is routinely 50-300m off, so people the
-- app showed as checked in were refused with "not within venue geofence" when
-- they tried to post (seen on Android at the Winston-Salem event, 2026-10-02).
--
-- Same as 0035's version, plus an optional p_accuracy (meters, as reported by
-- the browser). The 4-arg signature is dropped rather than overloaded so a
-- 4-arg call (older cached clients) resolves to this one with p_accuracy null,
-- i.e. the old strict check, instead of erroring as ambiguous.

begin;

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
  -- Same cap as lib/geo.ts MAX_ACCURACY_ALLOWANCE_METERS, so a coarse
  -- IP/cell-tower fix can't post from across town.
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

commit;
