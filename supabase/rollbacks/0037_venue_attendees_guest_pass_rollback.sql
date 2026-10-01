-- ROLLBACK for 0037_venue_attendees_guest_pass.sql. Not a migration: run by
-- hand only if 0037 has to come off a database.
--
--   supabase db query --linked -f supabase/rollbacks/0037_venue_attendees_guest_pass_rollback.sql
--
-- Puts back 0035's behaviour: one attendee link whose access ends at
-- event_starts_at, no guest pass, no "check-in makes you an attendee".
-- has_early_access and redeem_venue_invite are restored verbatim from 0035.
--
-- DESTRUCTIVE: guest grants are deleted (otherwise dropping `kind` would turn
-- every guest into an attendee) and guest links stop working. People who
-- became attendees by checking in keep their row, which then behaves like a
-- 0035 link grant. Posts and comments stay.
--
-- All or nothing; safe to re-run.

begin;

drop trigger if exists trg_attendee_from_checkin on public.location_checkins;
drop function if exists public._attendee_from_checkin();
drop function if exists public.set_venue_guest_pass(uuid, boolean, boolean);
drop function if exists public.venue_attendees(uuid);

create or replace function public.has_early_access(p_location_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from venue_early_access ea
    join venue_invites vi on vi.location_id = ea.location_id
    where ea.location_id = p_location_id
      and ea.user_id = auth.uid()
      and vi.enabled
      and (vi.event_starts_at is null or now() < vi.event_starts_at)
  );
$$;

create or replace function public.redeem_venue_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location uuid;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'sign up to use this link' using errcode = '42501';
  end if;

  select vi.location_id into v_location
  from venue_invites vi
  where vi.token = p_token
    and vi.enabled
    and (vi.event_starts_at is null or now() < vi.event_starts_at);

  if v_location is null then
    raise exception 'invite link is invalid or no longer active' using errcode = 'P0002';
  end if;

  insert into venue_early_access (location_id, user_id)
  values (v_location, auth.uid())
  on conflict do nothing;

  return v_location;
end;
$$;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'venue_early_access' and column_name = 'kind') then
    delete from public.venue_early_access where kind = 'guest';
  end if;
end;
$$;

alter table public.venue_early_access drop constraint if exists venue_early_access_kind_check;
alter table public.venue_early_access drop column if exists kind;
alter table public.venue_invites drop column if exists guest_enabled;
alter table public.venue_invites drop column if exists guest_token;

commit;
