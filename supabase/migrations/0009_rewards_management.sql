-- Owner Benefits Phase 3: organizer reward CRUD.
-- The `rewards` table has been live since before this track (name, icon_type,
-- deal_text, instructions, qr_path, is_active, display_order, feature_name,
-- created_by) but only ever had a read policy (rewards_select using(true)) --
-- confirmed on QA: no write policy exists at all today. This adds the write
-- policy, scoped exactly like the banners/verification_tags write policies
-- in 0001 (is_venue_manager — owner, co-owner, or master admin).
-- Run manually against the w-app-qa project:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0009_rewards_management.sql

drop policy if exists rewards_write on rewards;
create policy rewards_write on rewards
  for all to authenticated
  using (is_venue_manager(rewards.location_id, auth.uid()))
  with check (is_venue_manager(rewards.location_id, auth.uid()));
