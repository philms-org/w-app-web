-- SECURITY FIX (critical, pre-existing): 0006's guard trigger never blocked
-- anything. protect_master_admin_flag() was SECURITY DEFINER, and inside a
-- security-definer function `current_user` is the function OWNER (postgres),
-- so its "backend roles bypass" branch matched for every caller. Any signed-in
-- user could run
--   update profiles set is_master_admin = true where id = auth.uid();
-- and become a master admin. Reproduced against 0006 on Postgres 16.
--
-- Fix: run the trigger as the caller (SECURITY INVOKER) so current_user is
-- the real role: `authenticated` for app users, `postgres` / `service_role`
-- for the SQL editor, migrations and the set_master_admin RPC (itself
-- security definer, so its UPDATE still passes).
--
-- Also guards is_verified the same way. It is a trust badge shown next to
-- names in the feed and history, and no app code writes it, but the
-- own-row update policy let any user set it on themselves.
--
-- Self-contained (does not depend on 0026). Apply as soon as possible, then
-- audit existing flags (see the PR for the query).

create or replace function public.protect_master_admin_flag()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_caller_is_admin boolean;
begin
  -- Backend roles (SQL editor, service_role, migrations, security-definer
  -- RPCs owned by postgres such as set_master_admin) are trusted.
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;

  -- Own row is always readable to its owner, so this works under RLS.
  v_caller_is_admin := exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_master_admin
  );

  if tg_op = 'UPDATE' then
    if new.is_master_admin is distinct from old.is_master_admin and not v_caller_is_admin then
      raise exception 'changing is_master_admin requires master admin';
    end if;
    if new.is_verified is distinct from old.is_verified and not v_caller_is_admin then
      raise exception 'changing is_verified requires master admin';
    end if;
  elsif tg_op = 'INSERT' then
    if coalesce(new.is_master_admin, false) and not v_caller_is_admin then
      raise exception 'setting is_master_admin requires master admin';
    end if;
    if coalesce(new.is_verified, false) and not v_caller_is_admin then
      raise exception 'setting is_verified requires master admin';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_master_admin on public.profiles;
create trigger trg_protect_master_admin
  before insert or update on public.profiles
  for each row execute function public.protect_master_admin_flag();
