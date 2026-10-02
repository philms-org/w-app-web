-- 0038_hotspot_trail_pauses.sql
-- Off switch for a hotspot trail (founder decision 2026-10-02): an organizer
-- can pause an event's hotspots. While paused, attendees don't see them and
-- visits inside the paused window never count — for stamps or for organizer
-- visitor counts — even after the trail is turned back on. Earned stamps and
-- past counts are kept. Each pause is a row: open while ended_at is null.
-- FOUNDER-GATED: apply to QA, then prod, only on founder go-ahead.
--   supabase db query --linked < supabase/migrations/0038_hotspot_trail_pauses.sql

create table if not exists hotspot_trail_pauses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references locations(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_by uuid default auth.uid() references profiles(id),
  constraint hotspot_trail_pauses_order check (ended_at is null or ended_at >= started_at)
);
create index if not exists hotspot_trail_pauses_event_idx on hotspot_trail_pauses(event_id);
-- At most one open pause per event.
create unique index if not exists hotspot_trail_pauses_one_open
  on hotspot_trail_pauses(event_id) where ended_at is null;

alter table hotspot_trail_pauses enable row level security;

-- Attendees' clients need pauses to hide a paused trail and to leave paused
-- windows out of their stamp count.
drop policy if exists hotspot_trail_pauses_select on hotspot_trail_pauses;
create policy hotspot_trail_pauses_select on hotspot_trail_pauses for select to authenticated
  using (true);

drop policy if exists hotspot_trail_pauses_insert on hotspot_trail_pauses;
create policy hotspot_trail_pauses_insert on hotspot_trail_pauses for insert to authenticated
  with check (is_venue_manager(hotspot_trail_pauses.event_id, auth.uid()));

drop policy if exists hotspot_trail_pauses_update on hotspot_trail_pauses;
create policy hotspot_trail_pauses_update on hotspot_trail_pauses for update to authenticated
  using (is_venue_manager(hotspot_trail_pauses.event_id, auth.uid()))
  with check (is_venue_manager(hotspot_trail_pauses.event_id, auth.uid()));
-- No delete policy: pause history is kept so paused windows stay excluded.

-- Server-owned times: a pause starts now and can only be ended (once), now.
-- Nobody can backdate a pause to hide real visits or reopen a closed one.
create or replace function public.hotspot_trail_pauses_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.started_at := now();
    new.ended_at := null;
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    new.event_id := old.event_id;
    new.started_at := old.started_at;
    new.created_by := old.created_by;
    if old.ended_at is not null then
      new.ended_at := old.ended_at;
    elsif new.ended_at is not null then
      new.ended_at := now();
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists hotspot_trail_pauses_guard on hotspot_trail_pauses;
create trigger hotspot_trail_pauses_guard before insert or update on hotspot_trail_pauses
  for each row execute function public.hotspot_trail_pauses_guard();

-- Same as 0034, plus: check-ins inside any pause window of the event don't count.
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
     and not exists (
       select 1 from hotspot_trail_pauses p
       where p.event_id = h.event_id
         and lc.checked_in_at >= p.started_at
         and lc.checked_in_at < coalesce(p.ended_at, 'infinity'::timestamptz)
     )
    where h.event_id = p_event_id
    group by h.location_id;
end;
$$;
revoke all on function public.hotspot_visit_counts(uuid) from public, anon;
grant execute on function public.hotspot_visit_counts(uuid) to authenticated;
