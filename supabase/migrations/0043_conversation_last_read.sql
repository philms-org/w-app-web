-- 0043_conversation_last_read.sql
-- Messages unread state (founder-approved 2026-10-10).
--
-- Nothing recorded when someone last read a conversation, so the Messages
-- tab badge and the "Unread" filter could never work. This adds a per-
-- participant read marker and one RPC to move it.
--
--   * conversation_participants.last_read_at: when this participant last
--     had the conversation open. Existing rows get now() so past threads
--     don't all light up as unread on deploy; new rows start at join time.
--   * mark_conversation_read(conversation_id): sets the caller's own
--     marker to now(). Security definer and scoped to auth.uid(), so it
--     can't touch anyone else's row and needs no new RLS policy.
--
-- A conversation is unread (app side) when its latest message is newer
-- than last_read_at and wasn't sent by you.

alter table public.conversation_participants
  add column if not exists last_read_at timestamptz not null default now();

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;

  update public.conversation_participants
     set last_read_at = now()
   where conversation_id = p_conversation_id
     and user_id = auth.uid();
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
