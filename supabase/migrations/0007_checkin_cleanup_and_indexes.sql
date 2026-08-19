-- Data fix: before 0003 existed, checkout was a silent no-op (no UPDATE
-- policy on location_checkins), so prod accumulated permanently-"active"
-- check-in rows — ghost attendees in every venue's presence list.
-- Close out any active check-in older than 12 hours. New check-ins are
-- unaffected; 0003 makes real checkout work from here on.
update location_checkins
   set checked_out_at = checked_in_at + interval '12 hours'
 where checked_out_at is null
   and checked_in_at < now() - interval '12 hours';

-- Prevent duplicate active check-ins at the DB level (the client also
-- guards, but two tabs racing could still double-insert).
create unique index if not exists uniq_active_checkin_per_user_location
  on location_checkins (user_id, location_id)
  where checked_out_at is null;

-- Hot-path indexes (presence lookups + message threads are the two
-- queries that grow with usage; both were unindexed).
create index if not exists idx_checkins_location_active
  on location_checkins (location_id) where checked_out_at is null;
create index if not exists idx_messages_conversation_created
  on messages (conversation_id, created_at);
