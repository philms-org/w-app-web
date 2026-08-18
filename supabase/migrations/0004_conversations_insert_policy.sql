-- conversations has a working SELECT policy but no INSERT policy at all, so
-- startConversation() in lib/data.ts (used by direct messages, the History
-- "reconnect" composer, and organizer group creation) has always failed
-- with a bare RLS violation (42501) for every user. Confirmed live during
-- QA: sending a DM or creating a group both fail at the first insert step.
-- Run this manually in the Supabase SQL editor for the w-app-qa project.

drop policy if exists conversations_insert_own on conversations;
create policy conversations_insert_own on conversations for insert to authenticated
  with check (auth.uid() = created_by);
