-- 0039_delete_account.sql
-- Self-serve account deletion (founder decision 2026-10-02): a user can
-- permanently delete their account and everything they posted — feed posts,
-- comments, likes, reports, messages, connections, check-ins, badges.
-- Owners hand off first: anyone who owns a venue, is a venue's only manager,
-- owns a team that still has other members, or is W staff is refused with a
-- list of what's in the way.
--
-- Most user tables already cascade from profiles (which cascades from
-- auth.users). The ones below don't, and would make the delete fail:
--   * nullable "who did this" columns  -> set to null (row stays)
--   * the user's own rows (NOT NULL)   -> deleted
-- Everything happens in one transaction, ending with the auth.users delete,
-- so a failure part-way leaves the account untouched.
--
-- Only the service role can call these; /api/account/delete checks the
-- caller's token and passes their own id. Never grant to authenticated.
-- FOUNDER-GATED: apply to QA, then prod, only on founder go-ahead.
--   supabase db query --linked < supabase/migrations/0039_delete_account.sql

create or replace function public.account_deletion_blockers(p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'staff', coalesce((select is_master_admin from profiles where id = p_user), false),
    'venues', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'name', l.name) order by l.name)
      from locations l
      where l.owner_id = p_user
         or (
           exists (select 1 from location_managers m where m.location_id = l.id and m.user_id = p_user)
           and not exists (select 1 from location_managers m where m.location_id = l.id and m.user_id <> p_user)
         )
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name) order by t.name)
      from teams t
      where t.owner_id = p_user
        and exists (select 1 from team_members tm where tm.team_id = t.id and tm.user_id <> p_user)
    ), '[]'::jsonb)
  );
$$;

create or replace function public.delete_account(p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blockers jsonb;
begin
  if p_user is null then
    raise exception 'delete_account: no user';
  end if;

  -- Hold the profile row so nothing new can hang off it mid-delete.
  perform 1 from profiles where id = p_user for update;
  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;

  v_blockers := account_deletion_blockers(p_user);
  if (v_blockers->>'staff')::boolean
     or jsonb_array_length(v_blockers->'venues') > 0
     or jsonb_array_length(v_blockers->'teams') > 0 then
    return jsonb_build_object('status', 'blocked', 'blockers', v_blockers);
  end if;

  -- "Who did this" columns: keep the row, drop the link.
  update locations              set owner_id    = null where owner_id    = p_user;
  update rewards                set created_by  = null where created_by  = p_user;
  update reward_claims          set verified_by = null where verified_by = p_user;
  update user_feature_access    set granted_by  = null where granted_by  = p_user;
  update verification_tags      set assigned_by = null where assigned_by = p_user;
  update verification_tag_types set created_by  = null where created_by  = p_user;
  update feature_flag_overrides set set_by      = null where set_by      = p_user;
  update location_managers      set added_by    = null where added_by    = p_user;
  update venue_zones            set created_by  = null where created_by  = p_user;
  update location_requests      set reviewed_by = null where reviewed_by = p_user;
  update activity_menu_items    set created_by  = null where created_by  = p_user;
  update venue_announcers       set granted_by  = null where granted_by  = p_user;
  update venue_post_reports     set resolved_by = null where resolved_by = p_user;
  update hotspot_trail_pauses   set created_by  = null where created_by  = p_user;
  update venue_invites          set updated_by  = null where updated_by  = p_user;
  update event_hotspots         set created_by  = null where created_by  = p_user;

  -- Reports point at posts/comments by id with no FK, so clear the ones
  -- about this user's content before that content goes.
  delete from venue_post_reports r
  where r.reporter_id = p_user
     or (r.target_type = 'post'    and r.target_id in (select id from venue_posts         where author_id = p_user))
     or (r.target_type = 'comment' and r.target_id in (select id from venue_post_comments where author_id = p_user));

  -- The user's own rows. Deleting their posts also removes other people's
  -- likes and comments on them (cascade).
  delete from post_likes          where user_id    = p_user;
  delete from venue_post_comments where author_id  = p_user;
  delete from venue_posts         where author_id  = p_user;
  delete from venue_announcements where created_by = p_user;
  delete from zone_position_fixes where user_id    = p_user;
  delete from location_managers   where user_id    = p_user;
  -- Teams with nobody else in them (blockers already refused the rest).
  delete from teams               where owner_id   = p_user;

  -- Cascades to profiles and every table that cascades from it, plus the
  -- user's auth identities and sessions.
  delete from auth.users where id = p_user;

  return jsonb_build_object('status', 'deleted');
end;
$$;

revoke all on function public.account_deletion_blockers(uuid) from public, anon, authenticated;
revoke all on function public.delete_account(uuid) from public, anon, authenticated;
grant execute on function public.account_deletion_blockers(uuid) to service_role;
grant execute on function public.delete_account(uuid) to service_role;
