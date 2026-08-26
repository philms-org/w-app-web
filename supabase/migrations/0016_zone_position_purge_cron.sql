-- 0016_zone_position_purge_cron.sql
-- Schedules an hourly job to purge zone_position_fixes rows older than 48h,
-- independent of the organizer report being loaded. Previously this only
-- happened as a side effect of fetch_zone_analytics() (0013/0015) — an
-- organizer who never opens the report meant stale raw location data never
-- got deleted, breaking the 48h retention promise in docs/RESUME-launch-prep.md.
-- Run manually against w-app-qa first, then prod:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0016_zone_position_purge_cron.sql

create extension if not exists pg_cron with schema extensions;

-- Same delete fetch_zone_analytics() already does inline (0013/0015),
-- extracted so the cron job and the report path share one definition.
create or replace function public.purge_stale_zone_positions()
returns void
language sql
security definer
set search_path = public
as $$
  delete from zone_position_fixes where recorded_at < now() - interval '48 hours';
$$;

grant execute on function public.purge_stale_zone_positions() to postgres;

-- Idempotent: drop any existing job with this name before scheduling, so
-- re-running this migration doesn't create duplicate cron jobs.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-stale-zone-positions') then
    perform cron.unschedule('purge-stale-zone-positions');
  end if;
end $$;

select cron.schedule(
  'purge-stale-zone-positions',
  '0 * * * *', -- hourly, on the hour
  $$select public.purge_stale_zone_positions();$$
);
