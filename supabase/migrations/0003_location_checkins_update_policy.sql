-- location_checkins has working SELECT and INSERT policies (presence and
-- check-in both work), but no UPDATE policy — so checkOut() in lib/data.ts
-- (which sets checked_out_at on the user's own row) silently matches zero
-- rows under RLS and never actually checks anyone out. Confirmed live during
-- QA: repeated check-ins to the same venue left N stale "active" rows for
-- one user because checkout never took effect.
-- Run this manually in the Supabase SQL editor for the w-app-qa project.

drop policy if exists location_checkins_update_own on location_checkins;
create policy location_checkins_update_own on location_checkins for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
