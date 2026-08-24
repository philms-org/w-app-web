-- Owner Benefits Phase 4: attendance-tier badges (rewards interpretation #1
-- from docs/owner-benefits-plan.md). No new table -- a reward with
-- min_checkins set is "unlocked" once the member's location_checkins count
-- at that venue reaches it. Nullable: existing rewards (min_checkins = null)
-- keep showing to everyone, unaffected.
-- Run manually against the w-app-qa project:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0010_reward_tiers.sql

alter table rewards
  add column if not exists min_checkins int;

-- Already covered by 0009's rewards_write policy (is_venue_manager) --
-- no new RLS needed, this is just a new nullable column on the same table.
