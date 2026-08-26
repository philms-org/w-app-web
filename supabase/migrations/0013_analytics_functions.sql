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

-- What % of this venue's attendees also checked into which other venues
-- within +/- 12h of their check-in here. A rolling window, not "same
-- calendar day," to avoid timezone handling this app doesn't otherwise do.
create or replace function fetch_cross_venue_movement(p_location_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  total_attendees int;
begin
  if not is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  select count(distinct user_id) into total_attendees
  from location_checkins
  where location_id = p_location_id;

  if total_attendees = 0 then
    return '[]'::jsonb;
  end if;

  with reference_checkins as (
    select user_id, checked_in_at
    from location_checkins
    where location_id = p_location_id
  ),
  other_visits as (
    select distinct lc.location_id, rc.user_id
    from reference_checkins rc
    join location_checkins lc
      on lc.user_id = rc.user_id
     and lc.location_id <> p_location_id
     and lc.checked_in_at between rc.checked_in_at - interval '12 hours' and rc.checked_in_at + interval '12 hours'
  ),
  counted as (
    select location_id, count(*) as attendee_count
    from other_visits
    group by location_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'location_id', c.location_id,
    'venue_name', l.name,
    'attendee_count', c.attendee_count,
    'percentage', round((c.attendee_count::numeric / total_attendees) * 100, 1)
  ) order by c.attendee_count desc), '[]'::jsonb)
  into result
  from counted c
  join locations l on l.id = c.location_id;

  return result;
end;
$$;

grant execute on function fetch_cross_venue_movement(uuid) to authenticated;

-- DM message count is an approximation: DMs between two users who have
-- both checked in to this venue at some point (DMs carry no location_id —
-- they aren't venue-scoped by nature). Group message count is exact
-- (conversations.location_id is only ever set on the venue's own chat).
create or replace function fetch_message_stats(p_location_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  group_count int;
  group_messages int;
  dm_messages int;
begin
  if not is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'not authorized';
  end if;

  select count(*) into group_count
  from conversations
  where location_id = p_location_id and is_group = true;

  select count(*) into group_messages
  from messages m
  join conversations c on c.id = m.conversation_id
  where c.location_id = p_location_id and c.is_group = true;

  with venue_attendees as (
    select distinct user_id from location_checkins where location_id = p_location_id
  ),
  dm_convos as (
    select c.id
    from conversations c
    where c.is_group = false
      and exists (
        select 1 from conversation_participants cp
        join venue_attendees va on va.user_id = cp.user_id
        where cp.conversation_id = c.id
      )
      and not exists (
        select 1 from conversation_participants cp
        where cp.conversation_id = c.id
          and cp.user_id not in (select user_id from venue_attendees)
      )
  )
  select count(*) into dm_messages
  from messages m
  where m.conversation_id in (select id from dm_convos);

  return jsonb_build_object(
    'groupsCreated', group_count,
    'groupMessagesSent', group_messages,
    'dmMessagesApprox', dm_messages
  );
end;
$$;

grant execute on function fetch_message_stats(uuid) to authenticated;
