-- 0022_badges.sql
-- Automatic badges: a seeded catalog + per-user earned rows recomputed by
-- recompute_user_badges(). See
-- docs/superpowers/specs/2026-09-08-web-parity-must-haves-design.md §4.
-- Run manually against w-app-qa:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0022_badges.sql

create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text not null,
  icon text not null default 'award',
  criteria_kind text not null,        -- 'checkins' | 'connections' | 'events'
  criteria_threshold integer not null,
  sort_order integer not null default 0
);

alter table badges enable row level security;

drop policy if exists badges_select on badges;
create policy badges_select on badges for select to authenticated using (true);

drop policy if exists badges_write on badges;
create policy badges_write on badges for all to authenticated using (false) with check (false);

create table if not exists user_badges (
  user_id uuid not null references profiles(id) on delete cascade,
  badge_id uuid not null references badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

alter table user_badges enable row level security;

drop policy if exists user_badges_select on user_badges;
create policy user_badges_select on user_badges for select to authenticated
  using (user_id = auth.uid());

drop policy if exists user_badges_write on user_badges;
create policy user_badges_write on user_badges for all to authenticated using (false) with check (false);

create or replace function recompute_user_badges(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_checkins    integer;
  v_connections integer;
  v_events      integer;
begin
  select count(*) into v_checkins
    from location_checkins where user_id = p_user_id;

  -- Match the app's "my connections" count (friendships, one row per direction).
  select count(*) into v_connections
    from friendships where user_id = p_user_id;

  select count(distinct lc.location_id) into v_events
    from location_checkins lc
    join locations l on l.id = lc.location_id
   where lc.user_id = p_user_id and l.is_event is true;

  insert into user_badges (user_id, badge_id)
  select p_user_id, b.id
    from badges b
   where (b.criteria_kind = 'checkins'    and v_checkins    >= b.criteria_threshold)
      or (b.criteria_kind = 'connections' and v_connections >= b.criteria_threshold)
      or (b.criteria_kind = 'events'      and v_events      >= b.criteria_threshold)
  on conflict (user_id, badge_id) do nothing;
end;
$$;

grant execute on function recompute_user_badges(uuid) to authenticated;

-- Seed (idempotent on key)
insert into badges (key, name, description, icon, criteria_kind, criteria_threshold, sort_order) values
  ('first_checkin', 'First check-in',  'Checked in somewhere for the first time.', 'map-pin', 'checkins',    1,  10),
  ('checkins_10',   'Regular',         'Checked in 10 times.',                     'map-pin', 'checkins',    10, 20),
  ('checkins_50',   'Local legend',    'Checked in 50 times.',                     'map-pin', 'checkins',    50, 30),
  ('connections_5', 'Connector',       'Made 5 connections.',                      'users',   'connections', 5,  40),
  ('connections_25','Networker',       'Made 25 connections.',                     'users',   'connections', 25, 50),
  ('events_5',      'Scene-goer',      'Attended 5 events.',                       'ticket',  'events',      5,  60)
on conflict (key) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  criteria_kind = excluded.criteria_kind, criteria_threshold = excluded.criteria_threshold,
  sort_order = excluded.sort_order;
