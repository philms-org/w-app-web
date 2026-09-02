-- 0017_enable_realtime.sql
-- postgres_changes events only fire for tables in the `supabase_realtime`
-- publication. The web app subscribes to these two for live updates:
--   messages          -> live chat threads + conversation list
--   location_checkins -> live venue presence ("who's here")
-- Each ALTER is guarded so re-running the file is a no-op (adding a table
-- that's already a member raises duplicate_object / SQLSTATE 42710).

do $$
begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table location_checkins;
exception when duplicate_object then null;
end $$;
