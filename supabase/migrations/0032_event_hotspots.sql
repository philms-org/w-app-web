-- 0032_event_hotspots.sql
-- Event hotspots: organizer-recommended places attached to an event; visits
-- are derived from location_checkins. See
-- docs/superpowers/specs/2026-09-30-event-hotspots-design.md.
-- FOUNDER-GATED: do not apply until the founder approves. Then, on QA only:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0032_event_hotspots.sql

create table if not exists event_hotspots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references locations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  note text check (note is null or char_length(note) <= 140),
  sort_order int not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint event_hotspots_unique unique (event_id, location_id),
  constraint event_hotspots_not_self check (event_id <> location_id)
);
create index if not exists event_hotspots_event_idx on event_hotspots(event_id);
create index if not exists event_hotspots_location_idx on event_hotspots(location_id);

alter table event_hotspots enable row level security;

drop policy if exists event_hotspots_select on event_hotspots;
create policy event_hotspots_select on event_hotspots for select to authenticated
  using (true);

drop policy if exists event_hotspots_write on event_hotspots;
create policy event_hotspots_write on event_hotspots for all to authenticated
  using (is_venue_manager(event_hotspots.event_id, auth.uid()))
  with check (is_venue_manager(event_hotspots.event_id, auth.uid()));

-- Reward unlock by distinct hotspots visited. Covered by rewards_write (0009).
alter table rewards add column if not exists min_hotspots int
  check (min_hotspots is null or min_hotspots > 0);

-- Organizer stats: distinct visitors per hotspot within the event window.
-- Aggregates only. Dates compared in UTC here (display-only counts); the
-- attendee-facing progress uses the browser's local day.
create or replace function public.hotspot_visit_counts(p_event_id uuid)
returns table (location_id uuid, visitors bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date;
  v_end date;
begin
  if not is_venue_manager(p_event_id, auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  select l.event_date::date, coalesce(l.event_end_date, l.event_date)::date
    into v_start, v_end
    from locations l where l.id = p_event_id;
  return query
    select h.location_id, count(distinct lc.user_id)::bigint
    from event_hotspots h
    left join location_checkins lc
      on lc.location_id = h.location_id
     and (
       (v_start is not null and lc.checked_in_at::date between v_start and v_end)
       or (v_start is null and lc.checked_in_at >= h.created_at)
     )
    where h.event_id = p_event_id
    group by h.location_id;
end;
$$;
revoke all on function public.hotspot_visit_counts(uuid) from public;
grant execute on function public.hotspot_visit_counts(uuid) to authenticated;

-- Organizers can't insert into locations (0002: master admins only). This is
-- the one narrow path: create a place AND link it as a hotspot of an event
-- the caller manages. locations RLS is not loosened.
create or replace function public.create_hotspot_place(
  p_event_id uuid,
  p_name text,
  p_lat double precision,
  p_lng double precision,
  p_radius int default 75,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_place_id uuid;
  v_next int;
begin
  if not is_venue_manager(p_event_id, auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'name required' using errcode = '22023';
  end if;
  if p_radius is null or p_radius < 10 or p_radius > 1000 then
    raise exception 'radius must be 10-1000m' using errcode = '22023';
  end if;
  insert into locations (name, lat, lng, geofence_radius_meters, owner_id, is_event)
    values (trim(p_name), p_lat, p_lng, p_radius, auth.uid(), false)
    returning id into v_place_id;
  select coalesce(max(sort_order) + 1, 0) into v_next
    from event_hotspots where event_id = p_event_id;
  insert into event_hotspots (event_id, location_id, note, sort_order, created_by)
    values (p_event_id, v_place_id, nullif(trim(p_note), ''), v_next, auth.uid());
  return v_place_id;
end;
$$;
revoke all on function public.create_hotspot_place(uuid, text, double precision, double precision, int, text) from public;
grant execute on function public.create_hotspot_place(uuid, text, double precision, double precision, int, text) to authenticated;
