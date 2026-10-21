-- Attending vs in-the-room, plus a guest pass. Builds on 0035.
--
-- Founder decisions (2026-10-01):
--   * Attendee access lasts until the organizer switches the link off (no
--     longer ends at the event start; event_starts_at is kept but ignored).
--   * Anyone who checks in at a venue whose attendee link is on becomes an
--     attendee too, so stepping out of the room doesn't cut them off.
--   * Guest pass: a second link for investors / sponsors. Guests get the same
--     feed access as attendees, show with a "guest" label, and never count as
--     attending (or toward the room meter — they aren't checked in).
--   * "In the room" stays = an open live check-in (location_checkins, already
--     readable by every signed-in user). The app now checks people out when
--     they walk out, which is what turns their green light off.
--
-- Safe to re-run.

-- ------------------------------------------------------------- schema

alter table public.venue_invites add column if not exists guest_token text unique;
alter table public.venue_invites add column if not exists guest_enabled boolean not null default false;

alter table public.venue_early_access add column if not exists kind text not null default 'attendee';
alter table public.venue_early_access drop constraint if exists venue_early_access_kind_check;
alter table public.venue_early_access add constraint venue_early_access_kind_check
  check (kind in ('attendee', 'guest'));

-- ------------------------------------------------------------ helpers

-- Attendee while the attendee link is on; guest while the guest pass is on.
-- No time limit any more (0035 ended access at event_starts_at).
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
      and ((ea.kind = 'attendee' and vi.enabled) or (ea.kind = 'guest' and vi.guest_enabled))
  );
$$;

-- People attending by link (or by having checked in while the link was on),
-- and guests, for anyone who can see this venue's feed. Opted-out people
-- (attendee_history_opt_outs) are left out, same as the attendee history.
create or replace function public.venue_attendees(p_location_id uuid)
returns table (user_id uuid, kind text)
language sql
stable
security definer
set search_path = public
as $$
  select ea.user_id, ea.kind
  from venue_early_access ea
  join venue_invites vi on vi.location_id = ea.location_id
  where ea.location_id = p_location_id
    and ((ea.kind = 'attendee' and vi.enabled) or (ea.kind = 'guest' and vi.guest_enabled))
    and not exists (
      select 1 from attendee_history_opt_outs o
      where o.location_id = ea.location_id and o.user_id = ea.user_id
    )
    and (public.can_read_venue_feed(p_location_id) or public.is_venue_manager(p_location_id, auth.uid()));
$$;

revoke all on function public.venue_attendees(uuid) from public, anon;
grant execute on function public.venue_attendees(uuid) to authenticated;

-- ------------------------------------------------- manager: guest pass

-- Turn the guest pass on/off. Creates the venue's invite row (attendee link
-- off) and/or the guest link on first use; p_rotate replaces the guest link.
-- Returns the current guest token.
create or replace function public.set_venue_guest_pass(
  p_location_id uuid,
  p_enabled boolean,
  p_rotate boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if auth.uid() is null or not public.is_venue_manager(p_location_id, auth.uid()) then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  insert into venue_invites (location_id, token, enabled, guest_token, guest_enabled, updated_by)
  values (
    p_location_id,
    replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    false,
    replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
    p_enabled,
    auth.uid()
  )
  on conflict (location_id) do update
    set guest_enabled = excluded.guest_enabled,
        guest_token = case
          when p_rotate or venue_invites.guest_token is null then excluded.guest_token
          else venue_invites.guest_token
        end,
        updated_by = auth.uid(),
        updated_at = now()
  returning guest_token into v_token;

  return v_token;
end;
$$;

revoke all on function public.set_venue_guest_pass(uuid, boolean, boolean) from public, anon;
grant execute on function public.set_venue_guest_pass(uuid, boolean, boolean) to authenticated;

-- ---------------------------------------------------- attendee: redeem

-- Same contract as 0035 (returns the venue id; one error for every bad /
-- switched-off token). The token decides the kind: attendee link -> attendee,
-- guest pass -> guest. Being an attendee wins: a guest who later uses the
-- attendee link is upgraded, an attendee who opens the guest pass is not
-- downgraded.
create or replace function public.redeem_venue_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location uuid;
  v_kind text;
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'sign up to use this link' using errcode = '42501';
  end if;

  select vi.location_id, 'attendee' into v_location, v_kind
  from venue_invites vi
  where vi.token = p_token and vi.enabled;

  if v_location is null then
    select vi.location_id, 'guest' into v_location, v_kind
    from venue_invites vi
    where vi.guest_token = p_token and vi.guest_enabled;
  end if;

  if v_location is null then
    raise exception 'invite link is invalid or no longer active' using errcode = 'P0002';
  end if;

  insert into venue_early_access (location_id, user_id, kind)
  values (v_location, auth.uid(), v_kind)
  on conflict (location_id, user_id) do update
    set kind = case
      when venue_early_access.kind = 'attendee' or excluded.kind = 'attendee' then 'attendee'
      else 'guest'
    end;

  return v_location;
end;
$$;

revoke all on function public.redeem_venue_invite(text) from public, anon;
grant execute on function public.redeem_venue_invite(text) to authenticated;

-- --------------------------------------- check-in makes you an attendee

-- Checking in (live) at a venue whose attendee link is on also makes you an
-- attendee, so you keep feed access after you step out. Never blocks the
-- check-in itself.
create or replace function public._attendee_from_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.mode = 'live' and exists (
    select 1 from venue_invites vi where vi.location_id = new.location_id and vi.enabled
  ) then
    insert into venue_early_access (location_id, user_id, kind)
    values (new.location_id, new.user_id, 'attendee')
    on conflict (location_id, user_id) do update set kind = 'attendee';
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists trg_attendee_from_checkin on public.location_checkins;
create trigger trg_attendee_from_checkin after insert on public.location_checkins
  for each row execute function public._attendee_from_checkin();
