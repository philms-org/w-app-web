-- 0021_activity_menu.sql
-- Per-venue "activity words" an organizer publishes, and the picks a
-- checked-in attendee makes. See
-- docs/superpowers/specs/2026-09-08-web-parity-must-haves-design.md §3.
-- Run manually against w-app-qa:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0021_activity_menu.sql

create table if not exists activity_menu_items (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  label text not null,
  sort_order integer not null default 0,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists activity_menu_items_location_idx
  on activity_menu_items (location_id, sort_order);

alter table activity_menu_items enable row level security;

drop policy if exists activity_menu_items_select on activity_menu_items;
create policy activity_menu_items_select on activity_menu_items
  for select to authenticated using (true);

drop policy if exists activity_menu_items_write on activity_menu_items;
create policy activity_menu_items_write on activity_menu_items
  for all to authenticated
  using (is_venue_manager(activity_menu_items.location_id, auth.uid()))
  with check (is_venue_manager(activity_menu_items.location_id, auth.uid()));

create table if not exists attendee_activity_picks (
  user_id uuid not null references profiles(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  item_id uuid not null references activity_menu_items(id) on delete cascade,
  picked_at timestamptz not null default now(),
  primary key (user_id, location_id, item_id)
);

create index if not exists attendee_activity_picks_loc_idx
  on attendee_activity_picks (location_id);

alter table attendee_activity_picks enable row level security;

-- Reads: your own picks, plus organizers of the venue (for a future report).
drop policy if exists attendee_activity_picks_select on attendee_activity_picks;
create policy attendee_activity_picks_select on attendee_activity_picks
  for select to authenticated
  using (
    user_id = auth.uid()
    or is_venue_manager(attendee_activity_picks.location_id, auth.uid())
  );

-- Direct writes are blocked; go through set_activity_picks().
drop policy if exists attendee_activity_picks_write on attendee_activity_picks;
create policy attendee_activity_picks_write on attendee_activity_picks
  for all to authenticated using (false) with check (false);

create or replace function set_activity_picks(p_location_id uuid, p_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from attendee_activity_picks
    where user_id = auth.uid() and location_id = p_location_id;

  insert into attendee_activity_picks (user_id, location_id, item_id)
  select auth.uid(), p_location_id, i.id
    from activity_menu_items i
   where i.location_id = p_location_id
     and i.id = any(p_item_ids);
end;
$$;

grant execute on function set_activity_picks(uuid, uuid[]) to authenticated;
