-- SECURITY FIX (critical): prod had `profiles_all_auth ... USING (true)
-- WITH CHECK (true)`, letting ANY authenticated user UPDATE/DELETE any
-- profile row — including setting is_master_admin = true on themselves
-- (full admin takeover: venue creation, governance RPCs, organizer tools).
-- Confirmed in prod schema dump 2026-08-18.
--
-- Replacement: world-readable directory (app relies on it), but writes
-- are own-row only, deletes blocked, and is_master_admin is guarded by
-- a trigger so even an own-row update cannot self-promote.

-- Drop every known variant so this normalizes cleanly whether it lands on
-- prod (profiles_all_auth), QA (profiles_select/insert/update — drifted),
-- or a fresh DB. Idempotent by design.
drop policy if exists profiles_all_auth on profiles;
drop policy if exists profiles_select on profiles;
drop policy if exists profiles_insert on profiles;
drop policy if exists profiles_update on profiles;
drop policy if exists profiles_select_auth on profiles;
drop policy if exists profiles_insert_own on profiles;
drop policy if exists profiles_update_own on profiles;

create policy profiles_select_auth on profiles
  for select to authenticated using (true);

create policy profiles_insert_own on profiles
  for insert to authenticated with check (id = auth.uid());

create policy profiles_update_own on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No DELETE policy: profile deletion is service-role / cascade only.

-- Guard: only an existing master admin (via the set_master_admin RPC or
-- direct update) — or the postgres/service_role backend — may change
-- is_master_admin. Blocks self-promotion even through own-row updates.
create or replace function public.protect_master_admin_flag()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Backend roles (SQL editor, service_role, migrations) bypass the guard.
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.is_master_admin is distinct from old.is_master_admin then
    if auth.uid() is null or not exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.is_master_admin
    ) then
      raise exception 'changing is_master_admin requires master admin';
    end if;
  elsif tg_op = 'INSERT' and coalesce(new.is_master_admin, false) then
    if auth.uid() is null or not exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.is_master_admin
    ) then
      raise exception 'setting is_master_admin requires master admin';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_master_admin on profiles;
create trigger trg_protect_master_admin
  before insert or update on profiles
  for each row execute function public.protect_master_admin_flag();
