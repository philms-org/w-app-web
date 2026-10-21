-- 0034_event_hotspots.sql
-- Event hotspots: organizer-recommended places attached to an event; visits
-- are derived from location_checkins. See
-- docs/superpowers/specs/2026-09-30-event-hotspots-design.md.
-- FOUNDER-GATED: do not apply until the founder approves. Then, on QA only:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0034_event_hotspots.sql

create table if not exists event_hotspots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references locations(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  note text check (note is null or char_length(note) <= 140),
  sort_order int not null default 0,
  created_by uuid default auth.uid() references profiles(id),
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

-- Split per command so any manager (co-organizer, master admin) can edit or
-- delete a hotspot someone else added; only inserts pin created_by.
drop policy if exists event_hotspots_write on event_hotspots;
drop policy if exists event_hotspots_insert on event_hotspots;
drop policy if exists event_hotspots_update on event_hotspots;
drop policy if exists event_hotspots_delete on event_hotspots;
create policy event_hotspots_insert on event_hotspots for insert to authenticated
  with check (is_venue_manager(event_hotspots.event_id, auth.uid()) and (created_by is null or created_by = auth.uid()));
create policy event_hotspots_update on event_hotspots for update to authenticated
  using (is_venue_manager(event_hotspots.event_id, auth.uid()))
  with check (is_venue_manager(event_hotspots.event_id, auth.uid()));
create policy event_hotspots_delete on event_hotspots for delete to authenticated
  using (is_venue_manager(event_hotspots.event_id, auth.uid()));

-- Server-owned columns: created_at drives the visit-count clamp, so clients
-- must not backdate it, and created_by/event_id/location_id are immutable.
-- Updates may only change note and sort_order. (create_hotspot_place is
-- security definer, but auth.uid() is still the caller there.)
create or replace function public.event_hotspots_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    new.created_at := old.created_at;
    new.created_by := old.created_by;
    new.event_id := old.event_id;
    new.location_id := old.location_id;
  end if;
  return new;
end;
$$;
drop trigger if exists event_hotspots_guard on event_hotspots;
create trigger event_hotspots_guard before insert or update on event_hotspots
  for each row execute function public.event_hotspots_guard();

-- Reward unlock by distinct hotspots visited. Covered by rewards_write (0009).
alter table rewards add column if not exists min_hotspots int
  check (min_hotspots is null or min_hotspots > 0);

-- Organizer stats: distinct visitors per hotspot within the event window.
-- Aggregates only. Dates compared in UTC here (display-only counts); the
-- attendee-facing progress uses the browser's local day. Only check-ins at
-- or after the hotspot's created_at are counted.
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
     and lc.checked_in_at >= h.created_at
     and ((v_start is not null and lc.checked_in_at::date between v_start and v_end) or v_start is null)
    where h.event_id = p_event_id
    group by h.location_id;
end;
$$;
revoke all on function public.hotspot_visit_counts(uuid) from public, anon;
grant execute on function public.hotspot_visit_counts(uuid) to authenticated;

-- Organizers can't insert into locations (0002: master admins only). This is
-- the one narrow path: create a place AND link it as a hotspot of an event
-- the caller manages. The place is created ownerless (owner_id = null) so the
-- caller does not become its manager; only master admins can edit it.
-- locations RLS is not loosened.
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
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'valid lat/lng required' using errcode = '22023';
  end if;
  insert into locations (name, lat, lng, geofence_radius_meters, owner_id, is_event)
    values (trim(p_name), p_lat, p_lng, p_radius, null, false)
    returning id into v_place_id;
  select coalesce(max(sort_order) + 1, 0) into v_next
    from event_hotspots where event_id = p_event_id;
  insert into event_hotspots (event_id, location_id, note, sort_order, created_by)
    values (p_event_id, v_place_id, nullif(trim(p_note), ''), v_next, auth.uid());
  return v_place_id;
end;
$$;
revoke all on function public.create_hotspot_place(uuid, text, double precision, double precision, int, text) from public, anon;
grant execute on function public.create_hotspot_place(uuid, text, double precision, double precision, int, text) to authenticated;
