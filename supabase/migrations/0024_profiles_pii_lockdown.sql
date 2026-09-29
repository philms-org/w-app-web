-- Fix: `profiles_select_auth` (0006_profiles_rls_lockdown.sql) is
-- `to authenticated using (true)` — deliberately world-readable so name/
-- avatar lookups work app-wide, but email/phone/is_master_admin ride along
-- with every row regardless of who's asking.
--
-- Real exposure, not just theoretical: `fetchProfile()` in lib/data.ts does
-- a bare `.select()` (all columns) and is called with OTHER users' ids in
-- two places today — ConnectResult.tsx (after a QR-code connect scan) and
-- app/admin/page.tsx (fetching a venue owner's profile). Both currently
-- receive the target's email, phone, and is_master_admin flag.
--
-- This gets worse once guest-first-onboarding (PR #1, not yet merged) lands:
-- anonymous sign-in becomes the default "authenticated" state for every
-- visitor, so this stops being "any registered user can see any other's
-- PII" and becomes "any anonymous visitor can, no account required."
--
-- Fix: base table policies are unchanged (writes stay own-row only via
-- 0006's profiles_insert_own / profiles_update_own). Add a `profiles_public`
-- view that nulls email/phone/is_master_admin unless the caller is viewing
-- their own row, then revoke direct table SELECT from anon/authenticated so
-- PostgREST (and any direct API caller) can only reach profiles through the
-- view. lib/data.ts is updated in the same commit to read from the view.
--
-- Note for whoever merges guest-first-onboarding or p2-rich-feed-rows:
-- both branches add new profiles columns (this migration doesn't know about
-- them) — add any new non-sensitive columns to the view's select list, and
-- default new sensitive columns (e.g. date_of_birth, if it should stay
-- owner-only rather than power the feed's age badge) to the same
-- `case when auth.uid() = id then ... else null end` pattern.

create or replace view public.profiles_public
with (security_invoker = true)
as
select
  id, display_name, avatar_url, affiliation, industry, role, city,
  fave_drink, friday_night, profession, city_visible, fave_drink_visible,
  friday_night_visible, profession_visible, share_checkins_with_friends,
  is_verified, height, nationality, relationship, dating_id, socialising_id,
  networking_id,
  case when auth.uid() = id then email else null end as email,
  case when auth.uid() = id then phone else null end as phone,
  case when auth.uid() = id then is_master_admin else null end as is_master_admin
from public.profiles;

grant select on public.profiles_public to authenticated, anon;

revoke select on public.profiles from authenticated, anon;
