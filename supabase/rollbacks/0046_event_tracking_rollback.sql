-- Rollback for 0046_event_tracking.sql. Drops everything 0046 added,
-- including any tracking rows collected since it was applied.
drop function if exists public.event_tracking_summary(uuid);
drop function if exists public.record_slide_event(uuid, text);
drop function if exists public.record_event_presence(uuid, double precision, double precision, double precision, text);
drop function if exists public.set_event_role(uuid, text);
drop table if exists public.carousel_slide_events;
drop table if exists public.event_presence_days;
drop table if exists public.event_roles;
drop table if exists public.event_staff;
alter table public.locations drop column if exists ask_event_role;
