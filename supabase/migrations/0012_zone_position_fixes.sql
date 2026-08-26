-- 0012_zone_position_fixes.sql
-- Write-only raw GPS fixes, matched server-side to the nearest venue_zones
-- row. Never queried by client code directly — only by the aggregation
-- function in 0013, which also purges rows older than 48h. See design doc's
-- "Storage — write-only, short retention" section.
-- Run manually against w-app-qa:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0012_zone_position_fixes.sql

create table if not exists zone_position_fixes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  zone_id uuid not null references venue_zones(id),
  recorded_at timestamptz not null default now()
);

alter table zone_position_fixes enable row level security;

-- Insert-only, own rows. No select policy for regular users at all — the
-- table is readable only by security definer functions (0013), which run
-- as the function owner and bypass RLS.
drop policy if exists zone_position_fixes_insert on zone_position_fixes;
create policy zone_position_fixes_insert on zone_position_fixes for insert to authenticated
  with check (user_id = auth.uid());

-- Finds the nearest zone (straight-line distance on lat/lng, adequate at
-- building scale) for the given location and records a fix against it. A
-- location with no zones defined is a silent no-op — the client doesn't
-- need to know whether zones exist before calling this.
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
