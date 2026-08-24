-- Owner Benefits Phase 0 + Phase 2 schema: persistent per-venue group chat.
-- Builds on the already-migrated, previously-unused role/join_request infra
-- from w-app-ios/database/migrations/018_group_chat_conversion.sql (applies
-- to this same shared Supabase project). See docs/owner-benefits-plan.md.
-- Run manually against the w-app-qa project:
--   supabase link --project-ref ducadjakxmkfcvrteoqz
--   supabase db query --linked < supabase/migrations/0008_venue_group_chat.sql

-- ---- conversations.location_id --------------------------------------------
-- Nullable, additive. A conversation with location_id set AND is_group=true
-- is "the venue's persistent group chat." Existing DMs/ad-hoc groups keep it
-- null and are completely unaffected.
alter table conversations
  add column if not exists location_id uuid references locations(id);

-- Only one persistent group chat per venue.
create unique index if not exists uniq_venue_group_conversation
  on conversations (location_id)
  where is_group = true and location_id is not null;

-- ---- locations.chat_join_mode ----------------------------------------------
-- Founder decision (layered on top of the plan doc): the join model is
-- organizer-configurable per venue, not fixed. Defaults to the safer
-- 'request' flow; organizers can flip to 'auto' in the UI.
alter table locations
  add column if not exists chat_join_mode text
    check (chat_join_mode in ('auto', 'request')) not null default 'request';

-- locations had NO update policy at all before this (confirmed on QA — even
-- the existing updateVenue() call in lib/data.ts was silently blocked by
-- RLS). Organizers/co-owners/master admins need to flip chat_join_mode (and
-- this incidentally fixes the pre-existing venue-details-edit gap), scoped
-- exactly like the tags/banners write policies in 0001.
drop policy if exists locations_update_organizer on locations;
create policy locations_update_organizer on locations for update to authenticated
  using (is_venue_manager(locations.id, auth.uid()))
  with check (is_venue_manager(locations.id, auth.uid()));

-- ---- conversations: restrict who can create a venue-scoped chat -----------
-- Ad-hoc DMs/groups (location_id null) keep working exactly as before via
-- created_by = auth.uid(). A conversation with location_id set is a venue's
-- persistent chat, so only that venue's organizer/co-owner/master admin may
-- create it (lazy creation from the new Venue Chat screen). Two duplicate
-- permissive policies existed already (conversations_insert from 012,
-- conversations_insert_own from 0004) — normalize to one policy so the new
-- location_id restriction can't be bypassed by the other's OR-permissive
-- semantics.
drop policy if exists conversations_insert on conversations;
drop policy if exists conversations_insert_own on conversations;
create policy conversations_insert_own on conversations for insert to authenticated
  with check (
    auth.uid() = created_by
    and (location_id is null or is_venue_manager(location_id, auth.uid()))
  );

-- Non-members must be able to see that a venue's chat exists (id/name) so
-- the Members/Venue Chat screen can offer "Request to Join" before they're
-- a participant — the existing conversations_select policy (0005) only
-- covers the creator or an existing participant. This mirrors locations'
-- own world-readable select policy; it exposes identity only, not messages
-- (messages/conversation_participants keep their own participant-only RLS).
drop policy if exists conversations_select_venue_chat on conversations;
create policy conversations_select_venue_chat on conversations for select to authenticated
  using (location_id is not null and is_group = true);

-- ---- auto-join mode ---------------------------------------------------
-- 'auto' mode: checking in to the venue immediately inserts the member into
-- that venue's chat with role='member', no join_requests row. Self-insert
-- only, only into a conversation whose venue is actually in 'auto' mode.
drop policy if exists participants_insert_self_auto_join on conversation_participants;
create policy participants_insert_self_auto_join on conversation_participants for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from conversations c
      join locations l on l.id = c.location_id
      where c.id = conversation_participants.conversation_id
        and l.chat_join_mode = 'auto'
    )
  );

-- ---- co-owners get venue-chat admin automatically --------------------
-- Plan doc recommendation: location_managers co-owners should get venue-chat
-- admin the same way they already get full organizer access to tags/
-- banners/report — dynamically via is_venue_manager, not a static role row
-- that has to be kept in sync as co-owners are added/removed. This helper
-- ORs the existing role-based admin check (018's is_conversation_admin, for
-- ordinary ad-hoc groups) with a venue-manager check (for location-tagged
-- conversations only).
create or replace function public.is_venue_chat_manager(target_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    is_conversation_admin(target_conversation_id)
    or exists (
      select 1 from conversations c
      where c.id = target_conversation_id
        and c.location_id is not null
        and is_venue_manager(c.location_id, auth.uid())
    );
$$;

-- Additive policies (OR-permissive alongside 018's existing admin-only
-- ones) so a co-owner/organizer can approve/deny join requests, seed/kick
-- participants, and manage roles on their venue's chat even before they
-- have an explicit conversation_participants admin row of their own.
drop policy if exists participants_insert_by_venue_manager on conversation_participants;
create policy participants_insert_by_venue_manager on conversation_participants for insert to authenticated
  with check (is_venue_chat_manager(conversation_participants.conversation_id));

drop policy if exists participants_update_by_venue_manager on conversation_participants;
create policy participants_update_by_venue_manager on conversation_participants for update to authenticated
  using (is_venue_chat_manager(conversation_participants.conversation_id))
  with check (is_venue_chat_manager(conversation_participants.conversation_id));

drop policy if exists participants_delete_by_venue_manager on conversation_participants;
create policy participants_delete_by_venue_manager on conversation_participants for delete to authenticated
  using (is_venue_chat_manager(conversation_participants.conversation_id));

drop policy if exists join_requests_select_by_venue_manager on join_requests;
create policy join_requests_select_by_venue_manager on join_requests for select to authenticated
  using (is_venue_chat_manager(join_requests.conversation_id));

drop policy if exists join_requests_update_by_venue_manager on join_requests;
create policy join_requests_update_by_venue_manager on join_requests for update to authenticated
  using (is_venue_chat_manager(join_requests.conversation_id))
  with check (is_venue_chat_manager(join_requests.conversation_id));
