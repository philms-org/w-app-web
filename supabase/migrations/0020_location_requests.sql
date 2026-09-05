-- 0020_location_requests.sql
-- The map's "Add a location" button (components/tabs/MapTab.tsx) has always
-- been visible to every signed-in user with no permission check, but
-- locations' INSERT policy (0002_locations_insert_policy.sql,
-- locations_insert_master_admin) restricts venue creation to master admins
-- only. Submitting the button wrote to local React state only
-- (setNearbyLocations([...])) and never persisted, which is why it looked
-- broken -- it could never have worked as "any user creates a venue".
--
-- This migration adds the missing step: any signed-in user can REQUEST a
-- venue; a master admin approves or rejects it from a queue; the requester
-- is notified via an automated chat message from a fixed "The W App"
-- system sender.
--
-- Design: docs/superpowers/specs/2026-09-04-location-request-workflow-design.md
--
-- Apply order (run from inside /Users/sr/w-app-web):
--   supabase link --project-ref ducadjakxmkfcvrteoqz     # QA only -- see plan
--   supabase db query --linked < supabase/migrations/0020_location_requests.sql

-- ---- Schema ---------------------------------------------------------------

create table if not exists location_requests (
  id uuid primary key default gen_random_uuid(),
  submitted_by uuid not null references profiles(id) on delete cascade,
  name text not null,
  description text,
  lat double precision not null,
  lng double precision not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);
alter table location_requests enable row level security;

-- Submitter reads their own requests; master admins read all (for the
-- approval queue). No client INSERT/UPDATE policy at all -- every write
-- goes through the three RPCs below, matching the convention set by
-- set_master_admin / record_qr_scan: the interesting writes here (creating
-- a locations row as a side effect, writing a message as a different
-- sender) can't be expressed safely as a plain RLS `with check`.
drop policy if exists location_requests_select_own on location_requests;
create policy location_requests_select_own on location_requests for select to authenticated
  using (submitted_by = auth.uid());

drop policy if exists location_requests_select_admin on location_requests;
create policy location_requests_select_admin on location_requests for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and is_master_admin));

-- ---- System sender ----------------------------------------------------
-- Fixed, well-known id -- never regenerated. Mirrored as SYSTEM_PROFILE_ID
-- in lib/constants.ts. No email/phone, not a master admin.
insert into profiles (id, display_name, is_master_admin)
values ('00000000-0000-4000-8000-00000000a99d', 'The W App', false)
on conflict (id) do nothing;

-- ---- RPCs ---------------------------------------------------------------

create or replace function request_location(
  p_name text,
  p_description text,
  p_lat double precision,
  p_lng double precision
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_system_id constant uuid := '00000000-0000-4000-8000-00000000a99d';
  v_uid uuid := auth.uid();
  v_request_id uuid;
  v_conversation_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  insert into location_requests (submitted_by, name, description, lat, lng)
  values (v_uid, p_name, p_description, p_lat, p_lng)
  returning id into v_request_id;

  -- Find-or-create the requester's persistent system-notification thread --
  -- one thread per user across all their requests (there's no cap on
  -- pending requests), not one per request.
  select c.id into v_conversation_id
  from conversations c
  join conversation_participants cp1 on cp1.conversation_id = c.id and cp1.user_id = v_uid
  join conversation_participants cp2 on cp2.conversation_id = c.id and cp2.user_id = v_system_id
  where c.is_group = false
  limit 1;

  if v_conversation_id is null then
    insert into conversations (is_group, name, created_by)
    values (false, null, v_uid)
    returning id into v_conversation_id;

    insert into conversation_participants (conversation_id, user_id, status)
    values
      (v_conversation_id, v_uid, 'accepted'),
      (v_conversation_id, v_system_id, 'accepted');
  end if;

  insert into messages (conversation_id, sender_id, content)
  values (v_conversation_id, v_system_id, 'Your request for "' || p_name || '" is pending approval.');

  return v_request_id;
end;
$$;

grant execute on function request_location(text, text, double precision, double precision) to authenticated;

create or replace function approve_location_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_system_id constant uuid := '00000000-0000-4000-8000-00000000a99d';
  v_req record;
  v_location_id uuid;
  v_conversation_id uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_master_admin) then
    raise exception 'not_authorized';
  end if;

  select * into v_req from location_requests where id = p_request_id;
  if v_req is null then
    raise exception 'request_not_found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'already_reviewed';
  end if;

  insert into locations (name, description, lat, lng, geofence_radius_meters, owner_id, is_event)
  values (v_req.name, v_req.description, v_req.lat, v_req.lng, 50, v_req.submitted_by, false)
  returning id into v_location_id;

  update location_requests
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;

  select c.id into v_conversation_id
  from conversations c
  join conversation_participants cp1 on cp1.conversation_id = c.id and cp1.user_id = v_req.submitted_by
  join conversation_participants cp2 on cp2.conversation_id = c.id and cp2.user_id = v_system_id
  where c.is_group = false
  limit 1;

  if v_conversation_id is null then
    insert into conversations (is_group, name, created_by)
    values (false, null, v_req.submitted_by)
    returning id into v_conversation_id;

    insert into conversation_participants (conversation_id, user_id, status)
    values
      (v_conversation_id, v_req.submitted_by, 'accepted'),
      (v_conversation_id, v_system_id, 'accepted');
  end if;

  insert into messages (conversation_id, sender_id, content)
  values (v_conversation_id, v_system_id, '"' || v_req.name || '" was approved — you''re the venue owner now.');

  return v_location_id;
end;
$$;

grant execute on function approve_location_request(uuid) to authenticated;

create or replace function reject_location_request(p_request_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_system_id constant uuid := '00000000-0000-4000-8000-00000000a99d';
  v_req record;
  v_conversation_id uuid;
  v_content text;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_master_admin) then
    raise exception 'not_authorized';
  end if;

  select * into v_req from location_requests where id = p_request_id;
  if v_req is null then
    raise exception 'request_not_found';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'already_reviewed';
  end if;

  update location_requests
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = p_reason
  where id = p_request_id;

  select c.id into v_conversation_id
  from conversations c
  join conversation_participants cp1 on cp1.conversation_id = c.id and cp1.user_id = v_req.submitted_by
  join conversation_participants cp2 on cp2.conversation_id = c.id and cp2.user_id = v_system_id
  where c.is_group = false
  limit 1;

  if v_conversation_id is null then
    insert into conversations (is_group, name, created_by)
    values (false, null, v_req.submitted_by)
    returning id into v_conversation_id;

    insert into conversation_participants (conversation_id, user_id, status)
    values
      (v_conversation_id, v_req.submitted_by, 'accepted'),
      (v_conversation_id, v_system_id, 'accepted');
  end if;

  v_content := 'Your request for "' || v_req.name || '" wasn''t approved.';
  if p_reason is not null and length(trim(p_reason)) > 0 then
    v_content := v_content || ' ' || p_reason;
  end if;

  insert into messages (conversation_id, sender_id, content)
  values (v_conversation_id, v_system_id, v_content);
end;
$$;

grant execute on function reject_location_request(uuid, text) to authenticated;
