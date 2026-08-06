-- RBAC foundation for organizer tools + master admin.
-- Run this manually in the Supabase SQL editor for the w-app-qa project.

alter table profiles add column if not exists is_master_admin boolean not null default false;
alter table verification_tags add column if not exists icon text;

-- Co-owners: a venue's owner_id is still the single "primary" owner (and the
-- only one who can add/remove co-owners, plus the only one master admin can
-- reassign via assign_venue_owner), but any location_managers row grants the
-- same organizer-level access as owner_id everywhere else (tags, banners,
-- report, etc.) via the is_venue_manager(uuid, uuid) helper below.
create table if not exists public.location_managers (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  user_id uuid not null references public.profiles(id),
  added_by uuid references public.profiles(id),
  added_at timestamptz not null default now(),
  constraint location_managers_unique unique (location_id, user_id)
);
alter table public.location_managers enable row level security;

create or replace function public.is_venue_manager(check_location_id uuid, check_user_id uuid)
returns boolean
language sql
stable
as $$
  select
    exists (select 1 from locations l where l.id = check_location_id and l.owner_id = check_user_id)
    or exists (
      select 1 from location_managers lm
      where lm.location_id = check_location_id and lm.user_id = check_user_id
    )
    or exists (select 1 from profiles p where p.id = check_user_id and p.is_master_admin);
$$;

drop policy if exists location_managers_select on location_managers;
create policy location_managers_select on location_managers for select to authenticated
  using (auth.uid() = user_id or is_venue_manager(location_managers.location_id, auth.uid()));

drop policy if exists location_managers_write on location_managers;
create policy location_managers_write on location_managers for all to authenticated
  using (
    exists (select 1 from locations l where l.id = location_managers.location_id and l.owner_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_master_admin)
  )
  with check (
    exists (select 1 from locations l where l.id = location_managers.location_id and l.owner_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_master_admin)
  );

drop policy if exists verification_tags_select on verification_tags;
create policy verification_tags_select on verification_tags for select to authenticated
  using (true);

drop policy if exists verification_tags_write on verification_tags;
create policy verification_tags_write on verification_tags
  for all to authenticated
  using (is_venue_manager(verification_tags.location_id, auth.uid()))
  with check (is_venue_manager(verification_tags.location_id, auth.uid()));

drop policy if exists banners_write on banners;
create policy banners_write on banners
  for all to authenticated
  using (is_venue_manager(banners.location_id, auth.uid()))
  with check (is_venue_manager(banners.location_id, auth.uid()));

-- Read access for the organizer report's "Connections Formed" counts.
-- Scoped to the venue's organizer/master admin, same as the tags/banners
-- write policies above — these two tables had no RLS at all before this.
drop policy if exists connections_select_organizer on connections;
create policy connections_select_organizer on connections for select to authenticated
  using (is_venue_manager(connections.location_id, auth.uid()));

drop policy if exists peek_invites_select_organizer on peek_invites;
create policy peek_invites_select_organizer on peek_invites for select to authenticated
  using (is_venue_manager(peek_invites.location_id, auth.uid()));

-- Governance: granting master-admin and reassigning venue ownership are
-- privilege-escalation-sensitive, so these run as SECURITY DEFINER
-- functions that check the caller's admin status server-side, rather
-- than relying on a blanket RLS UPDATE policy (which can't easily be
-- scoped to a single column and would let any grantee edit unrelated
-- profile/venue fields too).

create or replace function public.set_master_admin(target_user_id uuid, value boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_master_admin) then
    raise exception 'not authorized';
  end if;
  update profiles set is_master_admin = value where id = target_user_id;
end;
$$;

create or replace function public.assign_venue_owner(target_location_id uuid, new_owner_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_master_admin) then
    raise exception 'not authorized';
  end if;
  update locations set owner_id = new_owner_id where id = target_location_id;
end;
$$;

grant execute on function public.set_master_admin(uuid, boolean) to authenticated;
grant execute on function public.assign_venue_owner(uuid, uuid) to authenticated;
