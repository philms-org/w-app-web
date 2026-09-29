-- Venue event feed follow-ups (after 0024, which is already on QA and must
-- not be edited). See docs/superpowers/specs/2026-09-23-venue-event-feed-design.md.
--
-- 1. Authors can delete their own posts. Nobody else can (no organizer
--    moderation yet). post_likes rows go with the post via 0024's
--    `on delete cascade`; referential actions are not subject to RLS.
-- 2. Live updates: add venue_posts and post_likes to the supabase_realtime
--    publication so postgres_changes fire for them (same pattern as 0017).
--
-- Realtime note: INSERT/UPDATE events are checked against each subscriber's
-- SELECT policy (0024's checked-in-at-this-venue rule), so post bodies only
-- reach people checked in there. DELETE events cannot be RLS-checked; they
-- carry only the old row's primary key: venue_posts.id, and for post_likes
-- (post_id, user_id). No post text or profile data is sent on delete.
--
-- Safe to re-run.

drop policy if exists venue_posts_delete_own on venue_posts;
create policy venue_posts_delete_own on venue_posts for delete to authenticated
  using (auth.uid() = author_id);

do $$
begin
  alter publication supabase_realtime add table venue_posts;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table post_likes;
exception when duplicate_object then null;
end $$;
