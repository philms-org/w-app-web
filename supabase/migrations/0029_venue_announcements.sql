-- Venue announcements: a short organizer-authored banner shown at the top of
-- checked-in Home ("Happy hour until 9", "Band starts at 10").
--
-- Same access model as the carousel `banners` table (0001 banners_write):
-- only venue managers (owner, co-owner, master admin) can write, via
-- is_venue_manager(location_id, auth.uid()). Everyone signed in can read
-- the active, unexpired ones; managers also see their inactive / expired
-- history on the manage page.
--
-- Safe to re-run.

create table if not exists public.venue_announcements (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 200),
  is_active boolean not null default true,
  expires_at timestamptz,
  created_by uuid not null references public.profiles(id) default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists venue_announcements_location_recent
  on public.venue_announcements (location_id, created_at desc);

alter table public.venue_announcements enable row level security;

drop policy if exists venue_announcements_select on public.venue_announcements;
create policy venue_announcements_select on public.venue_announcements
  for select to authenticated
  using (
    (is_active and (expires_at is null or expires_at > now()))
    or is_venue_manager(venue_announcements.location_id, auth.uid())
  );

drop policy if exists venue_announcements_insert on public.venue_announcements;
create policy venue_announcements_insert on public.venue_announcements
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and is_venue_manager(venue_announcements.location_id, auth.uid())
  );

drop policy if exists venue_announcements_update on public.venue_announcements;
create policy venue_announcements_update on public.venue_announcements
  for update to authenticated
  using (is_venue_manager(venue_announcements.location_id, auth.uid()))
  with check (is_venue_manager(venue_announcements.location_id, auth.uid()));

drop policy if exists venue_announcements_delete on public.venue_announcements;
create policy venue_announcements_delete on public.venue_announcements
  for delete to authenticated
  using (is_venue_manager(venue_announcements.location_id, auth.uid()));

-- Live updates on Home (useTableSubscription), same pattern as 0017.
do $$
begin
  alter publication supabase_realtime add table public.venue_announcements;
exception when duplicate_object then null;
end $$;
