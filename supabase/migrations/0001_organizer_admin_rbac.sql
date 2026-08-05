-- RBAC foundation for organizer tools + master admin.
-- Run this manually in the Supabase SQL editor for the w-app-qa project.

alter table profiles add column if not exists is_master_admin boolean not null default false;

drop policy if exists verification_tags_select on verification_tags;
create policy verification_tags_select on verification_tags for select to authenticated
  using (true);

drop policy if exists verification_tags_write on verification_tags;
create policy verification_tags_write on verification_tags
  for all to authenticated
  using (
    exists (select 1 from locations l where l.id = verification_tags.location_id and l.owner_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_master_admin)
  )
  with check (
    exists (select 1 from locations l where l.id = verification_tags.location_id and l.owner_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_master_admin)
  );

drop policy if exists banners_write on banners;
create policy banners_write on banners
  for all to authenticated
  using (
    exists (select 1 from locations l where l.id = banners.location_id and l.owner_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_master_admin)
  )
  with check (
    exists (select 1 from locations l where l.id = banners.location_id and l.owner_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_master_admin)
  );

-- Read access for the organizer report's "Connections Formed" counts.
-- Scoped to the venue's organizer/master admin, same as the tags/banners
-- write policies above — these two tables had no RLS at all before this.
drop policy if exists connections_select_organizer on connections;
create policy connections_select_organizer on connections for select to authenticated
  using (
    exists (select 1 from locations l where l.id = connections.location_id and l.owner_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_master_admin)
  );

drop policy if exists peek_invites_select_organizer on peek_invites;
create policy peek_invites_select_organizer on peek_invites for select to authenticated
  using (
    exists (select 1 from locations l where l.id = peek_invites.location_id and l.owner_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_master_admin)
  );
