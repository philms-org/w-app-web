-- 0019_connections_write_path.sql
-- The connections graph (connections + friendships) has existed since the iOS
-- era but has never been writable: connections had only
-- connections_select_organizer, friendships only friendships_select, and
-- neither had an INSERT policy. That, not a missing table, is why the
-- organizer report's "QR Scans" tile has always read 0 and ConnectSheet was a
-- stub.
--
-- Design: docs/superpowers/specs/2026-09-03-connections-graph-qr-connect-v2-design.md
--
-- Writes go through SECURITY DEFINER RPCs, not INSERT policies, because a
-- friendship needs TWO rows -- (A,B) and (B,A) -- and the reverse row has
-- user_id <> auth.uid(), which no safe with-check expression permits. Matches
-- the convention of set_master_admin / assign_venue_owner (0001) and
-- record_contact_method_choice (0015).
--
-- Apply order (run from inside /Users/sr/w-app-web):
--   supabase link --project-ref ducadjakxmkfcvrteoqz     # QA first
--   supabase db query --linked < supabase/migrations/0019_connections_write_path.sql
-- PROD (yatixschvikugckkpfum) only after the founder gate in this plan's final task.

create extension if not exists pgcrypto with schema extensions;  -- gen_random_bytes
create extension if not exists pg_cron with schema extensions;

-- ---- Schema additions -----------------------------------------------------

-- Best-effort geotag captured client-side at scan time. Retained PERMANENTLY
-- (founder decision 2026-09-03), including through remove_connection.
alter table connections
  add column if not exists scan_lat    double precision,
  add column if not exists scan_lng    double precision,
  add column if not exists place_label text;

-- Idempotency for record_qr_scan is per (scanner, scannee); enforce it and
-- index the lookup. connections was empty on QA/PROD (feature never wrote a row).
create unique index if not exists connections_scanner_scannee_uniq
  on connections (scanner_id, scannee_id);

-- connections.location_id had no ON DELETE action, so deleting a venue with
-- connection rows errored. This migration makes far more rows carry a
-- location_id, so switch to SET NULL: keep the connection event and its
-- coordinates, drop only the venue link.
do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'connections'::regclass
    and contype = 'f'
    and confrelid = 'locations'::regclass;

  if v_constraint is not null then
    execute format('alter table connections drop constraint %I', v_constraint);
  end if;

  alter table connections
    add constraint connections_location_id_fkey
    foreign key (location_id) references locations(id) on delete set null;
end $$;

-- Single-use, short-lived QR tokens. The QR payload IS one of these tokens,
-- never a bare user id (user ids are not secret -- profiles_select_auth is
-- `true`). RLS on, NO policies: reachable only via the SECURITY DEFINER RPCs.
create table if not exists connect_tokens (
  token      text primary key,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table connect_tokens enable row level security;

-- ---- Read policy --------------------------------------------------------

-- Participants can read their own connection rows (post-scan screen +
-- /main/connections). connections_select_organizer is untouched; permissive
-- policies OR together.
drop policy if exists connections_select_participant on connections;
create policy connections_select_participant on connections for select to authenticated
  using (scanner_id = auth.uid() or scannee_id = auth.uid());

-- ---- RPCs ---------------------------------------------------------------

create or replace function mint_connect_token()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid   uuid := auth.uid();
  v_token text;
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  -- base64 of 18 random bytes -> 24 chars; map to a URL/QR-safe alphabet
  -- ('+' -> '-', '/' -> '_', '=' padding deleted).
  v_token := translate(encode(gen_random_bytes(18), 'base64'), '+/=', '-_');

  -- One live token per user: clear this caller's previous token on every mint.
  delete from connect_tokens where user_id = v_uid;

  insert into connect_tokens (token, user_id, expires_at)
  values (v_token, v_uid, now() + interval '90 seconds');

  return v_token;
end;
$$;

grant execute on function mint_connect_token() to authenticated;

create or replace function record_qr_scan(
  p_token text,
  p_lat   double precision default null,
  p_lng   double precision default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scanner     uuid := auth.uid();
  v_scannee     uuid;
  v_location    uuid;
  v_place_label text;
  v_connection  uuid;
begin
  if v_scanner is null then
    raise exception 'not_signed_in';
  end if;

  select user_id into v_scannee
  from connect_tokens
  where token = p_token and expires_at > now()
  for update;

  if v_scannee is null then
    raise exception 'invalid_or_expired_token';
  end if;

  if v_scannee = v_scanner then
    raise exception 'self_scan';
  end if;

  -- Single-use: consume now. A later write failure rolls the whole
  -- transaction back (delete included) so the user retries the same code; a
  -- self_scan above does NOT consume it (owner just re-shows).
  delete from connect_tokens where token = p_token;

  -- Server-side venue resolution from the best-effort geotag. Inline haversine
  -- (earthdistance/cube not assumed installed); same formula as
  -- lib/geo.ts:haversineMeters. Nearest venue whose geofence the scan point
  -- falls inside; null if none (off-venue) or no coords.
  if p_lat is not null and p_lng is not null then
    select l.id, l.name
      into v_location, v_place_label
    from locations l
    where l.lat is not null and l.lng is not null
      and l.geofence_radius_meters is not null
      and 6371000 * 2 * asin(sqrt(
            power(sin(radians(l.lat - p_lat) / 2), 2) +
            cos(radians(p_lat)) * cos(radians(l.lat)) *
            power(sin(radians(l.lng - p_lng) / 2), 2)
          )) <= l.geofence_radius_meters
    order by 6371000 * 2 * asin(sqrt(
            power(sin(radians(l.lat - p_lat) / 2), 2) +
            cos(radians(p_lat)) * cos(radians(l.lat)) *
            power(sin(radians(l.lng - p_lng) / 2), 2)
          )) asc
    limit 1;
  end if;

  -- Idempotent per (scanner, scannee): the first scan is the canonical
  -- "where/when you connected" record; a rescan reuses it and does NOT
  -- overwrite the geotag or timestamp.
  insert into connections (scanner_id, scannee_id, location_id, scan_lat, scan_lng, place_label)
  values (v_scanner, v_scannee, v_location, p_lat, p_lng, v_place_label)
  on conflict (scanner_id, scannee_id) do nothing
  returning id into v_connection;

  if v_connection is null then
    -- rescan of an existing pair: reuse the canonical row, never overwrite
    -- its geotag or timestamp.
    select id into v_connection
    from connections
    where scanner_id = v_scanner and scannee_id = v_scannee;
  end if;

  -- Two rows so startConversation (one-directional) and is_friend_sharing
  -- (bidirectional) are BOTH correct untouched. Runs on the reuse path too,
  -- repairing a half-missing pair.
  insert into friendships (user_id, friend_id, source)
  values (v_scanner, v_scannee, 'qr_scan')
  on conflict (user_id, friend_id) do nothing;

  insert into friendships (user_id, friend_id, source)
  values (v_scannee, v_scanner, 'qr_scan')
  on conflict (user_id, friend_id) do nothing;

  return v_connection;
end;
$$;

grant execute on function record_qr_scan(text, double precision, double precision) to authenticated;

create or replace function remove_connection(p_other_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_signed_in';
  end if;

  -- Both friendship directions. The connections event row(s) are left FULLY
  -- intact -- including scan_lat/scan_lng/place_label -- per the 2026-09-03
  -- founder decision (permanent geotag retention; past organizer reports
  -- already aggregated these).
  delete from friendships
  where (user_id = v_uid and friend_id = p_other_user_id)
     or (user_id = p_other_user_id and friend_id = v_uid);
end;
$$;

grant execute on function remove_connection(uuid) to authenticated;

-- ---- Token cleanup cron -------------------------------------------------

create or replace function public.purge_expired_connect_tokens()
returns void
language sql
security definer
set search_path = public
as $$
  delete from connect_tokens where expires_at < now();
$$;

grant execute on function public.purge_expired_connect_tokens() to postgres;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-expired-connect-tokens') then
    perform cron.unschedule('purge-expired-connect-tokens');
  end if;
end $$;

select cron.schedule(
  'purge-expired-connect-tokens',
  '0 * * * *',
  $$select public.purge_expired_connect_tokens();$$
);
