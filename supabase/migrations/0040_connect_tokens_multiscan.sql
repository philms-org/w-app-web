-- 0040_connect_tokens_multiscan.sql
-- FOUNDER-GATED (CLAUDE.md #1/#3): review before applying to QA, then prod.
--
-- Connect codes were single-use with a 90s TTL, and every mint deleted the
-- caller's previous token. At an event that meant: the first person to scan a
-- code connected, everyone after them got "That code has expired"; and a
-- refresh landing mid-scan killed the code being scanned.
--
-- Now:
--   * A token can be scanned by many people until it expires (record_qr_scan
--     no longer deletes it). Rescans of the same pair stay idempotent.
--   * TTL is 5 minutes, long enough for someone who scanned with the phone
--     camera (/c/<token>) to sign in or sign up and still finish connecting.
--   * Minting no longer deletes the previous token; it only clears this
--     user's expired ones. The purge cron from 0019 still sweeps the rest.
--
-- Trade-off: a screenshot of a code works for anyone for up to 5 minutes, and
-- connecting reveals enabled contact links. The client re-mints every 60s, so
-- the code on screen is never more than ~1 minute old.
--
-- Signatures, grants and security definer settings are unchanged from 0019.

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

  -- Keep this caller's still-valid tokens alive (a code being scanned while
  -- the screen refreshes must still work); just clear their expired ones.
  delete from connect_tokens where user_id = v_uid and expires_at <= now();

  insert into connect_tokens (token, user_id, expires_at)
  values (v_token, v_uid, now() + interval '5 minutes');

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
  for share;

  if v_scannee is null then
    raise exception 'invalid_or_expired_token';
  end if;

  if v_scannee = v_scanner then
    raise exception 'self_scan';
  end if;

  -- Multi-use within the TTL (0040): the token is NOT consumed, so everyone
  -- scanning the same code connects. The share lock above lets concurrent
  -- scans of one code proceed in parallel while blocking the purge cron from
  -- deleting the token mid-scan. Pairs stay idempotent via the unique
  -- (scanner_id, scannee_id) / (user_id, friend_id) conflicts below.

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
