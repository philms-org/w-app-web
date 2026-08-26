-- 0011_venue_zones.sql
-- Organizer-defined zones within a venue (e.g. "Bar", "Dance Floor"), used
-- to attribute GPS position fixes to a zone for anonymized occupancy/flow
-- reporting. See docs/superpowers/specs/2026-08-25-organizer-analytics-design.md.
-- Run manually against w-app-qa:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0011_venue_zones.sql

create table if not exists venue_zones (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table venue_zones enable row level security;

drop policy if exists venue_zones_select on venue_zones;
create policy venue_zones_select on venue_zones for select to authenticated
  using (true);

drop policy if exists venue_zones_write on venue_zones;
create policy venue_zones_write on venue_zones for all to authenticated
  using (is_venue_manager(venue_zones.location_id, auth.uid()))
  with check (is_venue_manager(venue_zones.location_id, auth.uid()));
