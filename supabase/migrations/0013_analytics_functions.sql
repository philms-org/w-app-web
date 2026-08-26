-- 0013_analytics_functions.sql
-- Aggregation functions for the organizer report. Each function checks
-- is_venue_manager itself and raises if the caller isn't authorized —
-- these are called directly via .rpc(), not gated only by a calling page.

-- Occupancy/dwell/transitions, computed from zone_position_fixes over the
-- last 48h, then purges fixes older than 48h as a side effect (there is no
-- product need to retain raw fixes once rolled up — see design doc).
create or replace function fetch_zone_analytics(p_location_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  with recent_fixes as (
    select zpf.*, vz.name as zone_name
    from zone_position_fixes zpf
    join venue_zones vz on vz.id = zpf.zone_id
    where vz.location_id = p_location_id
      and zpf.recorded_at > now() - interval '48 hours'
  ),
  occupancy as (
    select zone_name, count(distinct user_id) as count
    from recent_fixes
    group by zone_name
  ),
  per_user_zone_span as (
    select user_id, zone_name,
           extract(epoch from (max(recorded_at) - min(recorded_at))) / 60 as minutes
    from recent_fixes
    group by user_id, zone_name
  ),
  dwell as (
    select zone_name, avg(minutes) as minutes
    from per_user_zone_span
    where minutes > 0
    group by zone_name
  ),
  ordered_fixes as (
    select user_id, zone_name, recorded_at,
           lag(zone_name) over (partition by user_id order by recorded_at) as prev_zone_name
    from recent_fixes
  ),
  transitions as (
    select prev_zone_name as from_zone, zone_name as to_zone, count(*) as count
    from ordered_fixes
    where prev_zone_name is not null and prev_zone_name <> zone_name
    group by prev_zone_name, zone_name
  )
  select jsonb_build_object(
    'occupancy', coalesce((select jsonb_agg(jsonb_build_object('zone_name', zone_name, 'count', count)) from occupancy), '[]'::jsonb),
    'avgDwellMinutes', coalesce((select jsonb_agg(jsonb_build_object('zone_name', zone_name, 'minutes', round(minutes::numeric, 1))) from dwell), '[]'::jsonb),
    'transitions', coalesce((select jsonb_agg(jsonb_build_object('from_zone', from_zone, 'to_zone', to_zone, 'count', count)) from transitions), '[]'::jsonb)
  ) into result;

  delete from zone_position_fixes where recorded_at < now() - interval '48 hours';

  return result;
end;
$$;

grant execute on function fetch_zone_analytics(uuid) to authenticated;
