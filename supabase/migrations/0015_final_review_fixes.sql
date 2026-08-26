-- 0015_final_review_fixes.sql
-- Fixes from the final whole-branch review of the organizer-analytics
-- feature (7 tasks). Run manually against w-app-qa:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0015_final_review_fixes.sql

-- ---------------------------------------------------------------------
-- Finding 1 — zone_position_fixes.zone_id has no ON DELETE CASCADE, so
-- deleting a venue_zones row that has any recorded fixes fails forever
-- (until the 48h purge happens to clear them). Constraint name confirmed
-- via pg_constraint on the QA project: zone_position_fixes_zone_id_fkey.
-- ---------------------------------------------------------------------
alter table zone_position_fixes
  drop constraint zone_position_fixes_zone_id_fkey,
  add constraint zone_position_fixes_zone_id_fkey
    foreign key (zone_id) references venue_zones(id) on delete cascade;

-- ---------------------------------------------------------------------
-- Finding 2 — record_zone_position must verify the caller is actually
-- checked in at the venue before recording a fix (otherwise any
-- authenticated user can poison another venue's analytics from anywhere).
-- Also drop the direct-insert policy: the RPC is security definer and
-- bypasses RLS entirely, so the insert policy only exists as an unused
-- bypass that lets a client insert an arbitrary zone_id/recorded_at
-- directly, skipping the RPC's matching logic.
-- ---------------------------------------------------------------------
create or replace function record_zone_position(
  p_location_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  nearest_zone_id uuid;
begin
  if not exists (
    select 1 from location_checkins
    where user_id = auth.uid()
      and location_id = p_location_id
      and checked_out_at is null
  ) then
    return;
  end if;

  select id into nearest_zone_id
  from venue_zones
  where location_id = p_location_id
  order by ((center_lat - p_lat) ^ 2 + (center_lng - p_lng) ^ 2) asc
  limit 1;

  if nearest_zone_id is not null then
    insert into zone_position_fixes (user_id, zone_id)
    values (auth.uid(), nearest_zone_id);
  end if;
end;
$$;

grant execute on function record_zone_position(uuid, double precision, double precision) to authenticated;

drop policy if exists zone_position_fixes_insert on zone_position_fixes;

-- ---------------------------------------------------------------------
-- Finding 5 — missing indexes on zone_position_fixes.
-- ---------------------------------------------------------------------
create index if not exists idx_zone_position_fixes_zone_recorded on zone_position_fixes (zone_id, recorded_at);
create index if not exists idx_zone_position_fixes_recorded on zone_position_fixes (recorded_at);

-- ---------------------------------------------------------------------
-- Finding 3 — transitions were mislabeled as distinct people when they
-- actually count every consecutive zone-change event, which GPS jitter
-- can trigger many times per minute for one person. Add unique_people
-- alongside the existing event count so the UI can present both.
--
-- Finding 7 — occupancy and cross-venue counts can re-identify
-- individuals at small counts. Suppress zones/venues with fewer than 3
-- people rather than showing "1" or "2".
-- ---------------------------------------------------------------------
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
    having count(distinct user_id) >= 3
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
    select prev_zone_name as from_zone, zone_name as to_zone,
           count(*) as count,
           count(distinct user_id) as unique_people
    from ordered_fixes
    where prev_zone_name is not null and prev_zone_name <> zone_name
    group by prev_zone_name, zone_name
  )
  select jsonb_build_object(
    'occupancy', coalesce((select jsonb_agg(jsonb_build_object('zone_name', zone_name, 'count', count)) from occupancy), '[]'::jsonb),
    'avgDwellMinutes', coalesce((select jsonb_agg(jsonb_build_object('zone_name', zone_name, 'minutes', round(minutes::numeric, 1))) from dwell), '[]'::jsonb),
    'transitions', coalesce((select jsonb_agg(jsonb_build_object('from_zone', from_zone, 'to_zone', to_zone, 'count', count, 'unique_people', unique_people)) from transitions), '[]'::jsonb)
  ) into result;

  delete from zone_position_fixes where recorded_at < now() - interval '48 hours';

  return result;
end;
$$;

grant execute on function fetch_zone_analytics(uuid) to authenticated;

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
    having count(*) >= 3
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

-- ---------------------------------------------------------------------
-- Finding 6 — connections_update_own_contact_choice let a scanner rewrite
-- ANY column on their own connection row (location_id, scanned_at, etc.),
-- not just contact_method_type — RLS can't scope to a single column.
-- Replace with a security-definer RPC that only ever touches
-- contact_method_type, matching the convention already established by
-- set_master_admin/assign_venue_owner in 0001_organizer_admin_rbac.sql.
-- ---------------------------------------------------------------------
drop policy if exists connections_update_own_contact_choice on connections;

create or replace function record_contact_method_choice(p_connection_id uuid, p_type text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update connections
  set contact_method_type = p_type
  where id = p_connection_id and scanner_id = auth.uid();
end;
$$;

grant execute on function record_contact_method_choice(uuid, text) to authenticated;
