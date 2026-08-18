-- 0004 added the missing INSERT policy for conversations, but DM/group
-- creation STILL fails: lib/data.ts startConversation() (and the iOS
-- equivalent in WAPData.swift) does insert(...).select(), and Postgres
-- applies SELECT policies to RETURNING rows. The existing
-- conversations_select policy only matches rows where the caller is
-- already in conversation_participants — which is only populated AFTER
-- the conversation insert. Net effect: 42501 on every new DM even with
-- 0004 applied. Reproduced locally on 2026-08-18 against a stack running
-- migrations 001-016 + 0001-0004.
--
-- Fix: let the creator see their own conversation row.
-- Run after 0004 (order matters only in that both must exist).

drop policy if exists conversations_select on conversations;
create policy conversations_select on conversations for select to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from conversation_participants cp
      where cp.conversation_id = conversations.id
        and cp.user_id = auth.uid()
    )
  );
