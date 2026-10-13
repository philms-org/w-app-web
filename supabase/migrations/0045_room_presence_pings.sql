-- 0045_room_presence_pings.sql
-- "In the room" means seen at the venue recently (founder-approved 2026-10-13).
--
-- "N in the room" counted every open location_checkins row. Walking out only
-- checks you out while the app is open and watching your position, so anyone
-- who closed the app or locked their phone stayed "in the room" until the
-- 12h cleanup (Startup Weekend Winston-Salem showed 21 in the room at 6pm
-- with almost nobody left).
--
--   * room_pings: one row per (user, venue), last time the app saw that
--     person inside the venue. Kept out of location_checkins on purpose: a
--     ping every couple of minutes there would fire the realtime presence
--     reload for every viewer of the venue.
--   * touch_room(location_id): the caller's own ping. Only counts if the
--     caller has an open check-in there. Server sets the time, so a client
--     can't write a future timestamp to look present forever.
--   * New open check-ins ping once on insert (trigger), so you show up the
--     moment you check in.
--   * room_presence(location_id): user ids with an open check-in AND a ping
--     in the last 20 minutes. This is what "in the room" means now.
--
-- No backfill: existing open check-ins without a ping drop out of "in the
-- room" on deploy. Anyone really there with the app open pings again within
-- a couple of minutes. Check-ins themselves (attending, feed access,
-- hotspots) are unchanged.

create table if not exists public.room_pings (
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, location_id)
);

create index if not exists idx_room_pings_location_seen
  on public.room_pings (location_id, last_seen_at);

-- No direct access; only through the functions below.
alter table public.room_pings enable row level security;
revoke all on public.room_pings from anon, authenticated;

create or replace function public.touch_room(p_location_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.location_checkins
     where user_id = auth.uid()
       and location_id = p_location_id
       and checked_out_at is null
  ) then
    return;  -- not checked in here: quietly ignore
  end if;

  insert into public.room_pings (user_id, location_id, last_seen_at)
  values (auth.uid(), p_location_id, now())
  on conflict (user_id, location_id) do update set last_seen_at = excluded.last_seen_at;
end;
$$;

revoke all on function public.touch_room(uuid) from public, anon;
grant execute on function public.touch_room(uuid) to authenticated;

create or replace function public.room_ping_on_checkin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.checked_out_at is null then
    insert into public.room_pings (user_id, location_id, last_seen_at)
    values (new.user_id, new.location_id, now())
    on conflict (user_id, location_id) do update set last_seen_at = excluded.last_seen_at;
  end if;
  return new;
end;
$$;

revoke all on function public.room_ping_on_checkin() from public, anon, authenticated;

drop trigger if exists trg_room_ping_on_checkin on public.location_checkins;
create trigger trg_room_ping_on_checkin
  after insert on public.location_checkins
  for each row execute function public.room_ping_on_checkin();

create or replace function public.room_presence(p_location_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct c.user_id
    from public.location_checkins c
    join public.room_pings p
      on p.user_id = c.user_id and p.location_id = c.location_id
   where c.location_id = p_location_id
     and c.checked_out_at is null
     and p.last_seen_at > now() - interval '20 minutes';
$$;

revoke all on function public.room_presence(uuid) from public, anon;
grant execute on function public.room_presence(uuid) to authenticated;
