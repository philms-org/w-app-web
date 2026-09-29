-- Server-side rate limiting for auth endpoints that can leak account
-- existence. First user: POST /api/auth/upgrade-guest (app/api/auth/
-- upgrade-guest/route.ts), which wraps the anonymous -> real account email
-- upgrade whose "email already exists" answer is an enumeration oracle.
--
-- Fixed-window counters keyed by (bucket, hashed key, window start). The
-- route handler decides nothing about limits on the client's say-so: it
-- calls consume_rate_limit() with the service role, and only the service
-- role can execute it. The table has RLS on and no policies, so no client
-- role can read or write it.
--
-- Safe to re-run.

create table if not exists public.auth_rate_limits (
  bucket text not null,
  key_hash text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, key_hash, window_start)
);

alter table public.auth_rate_limits enable row level security;
revoke all on public.auth_rate_limits from public, anon, authenticated;

create index if not exists auth_rate_limits_window_start
  on public.auth_rate_limits (window_start);

-- Counts this attempt, then says whether it is within the limit. Every call
-- counts (allowed or not), so hammering past the limit keeps you blocked for
-- the rest of the window.
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_key_hash text,
  p_max integer,
  p_window_seconds integer
)
returns table (allowed boolean, hits integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_hits integer;
begin
  if p_max < 1 or p_window_seconds < 1 then
    raise exception 'consume_rate_limit: bad limit';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.auth_rate_limits as r (bucket, key_hash, window_start, hits)
  values (p_bucket, p_key_hash, v_window, 1)
  on conflict (bucket, key_hash, window_start)
  do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Opportunistic cleanup (~1% of calls); nothing reads windows older than a day.
  if random() < 0.01 then
    delete from public.auth_rate_limits where window_start < now() - interval '1 day';
  end if;

  return query select
    v_hits <= p_max,
    v_hits,
    greatest(1, ceil(extract(epoch from (v_window + make_interval(secs => p_window_seconds) - now())))::integer);
end;
$$;

revoke all on function public.consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
