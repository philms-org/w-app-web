# Realtime for chat + presence — design (2026-09-02)

## Goal

Replace poll/load-once behaviour with Supabase Realtime (`postgres_changes`)
on three surfaces so messages and "who's here" update live:

1. **`ChatView`** — open conversation thread (currently polls every 4s)
2. **`MessagesTab`** — conversation list (currently loads once, refresh on close)
3. **`CheckedInHero`** — venue presence / "connections" strip (loads once)

Out of scope: venue-chat join-request badges (scope D — fold in later),
Supabase Presence API, typing indicators, read receipts, push notifications.

## Approach

**Refetch on event, never merge the payload.** `postgres_changes` delivers
the bare changed row with no `profiles` join. Each surface already has a
fetch function that joins / orders / dedupes. A realtime event just triggers
a debounced refetch of that existing function, so the realtime path can
never drift from the load path.

### Shared hook — `lib/hooks/useTableSubscription.ts`

```
useTableSubscription({
  table: string,                       // 'messages' | 'location_checkins'
  filter?: string,                     // e.g. `conversation_id=eq.<id>`; omitted = all rows
  event?: 'INSERT' | 'UPDATE' | '*',   // default '*'
  onEvent: () => void,                 // called (debounced ~250ms) on any matching change
  enabled?: boolean,                   // default true; false tears the channel down
}): { status: 'connecting' | 'subscribed' | 'error' }
```

Responsibilities:
- Create one channel per hook instance, unique name
  (`${table}:${filter ?? 'all'}:${crypto.randomUUID()}`, generated once in a
  ref), `.on('postgres_changes', …)`, `.subscribe()`.
- Debounce `onEvent` (250ms trailing) so a burst of rows = one refetch.
- Also fire `onEvent` once on `SUBSCRIBED` (covers the gap between initial
  load and subscription) and on `visibilitychange → visible`.
- 30s `setInterval` backstop that calls `onEvent` only while
  `document.visibilityState === 'visible'` — covers a silently dropped
  socket. Cleared with the channel.
- Cleanup: `supabase.removeChannel(channel)`, clear timers, on unmount or
  when `enabled`/`filter`/`table` change.
- On channel error/timeout status: expose `status: 'error'`; the backstop
  poll keeps the surface fresh. No user-facing error UI (realtime is an
  enhancement, the fetch path still works).

### Per-surface wiring

| Surface | table | filter | onEvent |
|---|---|---|---|
| `ChatView` | `messages` | `conversation_id=eq.<conversation.id>` | `loadMessages(false)` |
| `CheckedInHero` | `location_checkins` | `location_id=eq.<selectedLocation.id>` | refetch presence + attendee history (extract the existing block into a `loadPresence()` callback) |
| `MessagesTab` | `messages` | *(none — postgres_changes can't do `conversation_id IN (…)`)* | debounced `loadConversations()` |

- `ChatView`: delete the `POLL_MS = 4000` interval effect. Keep optimistic
  append + the post-send `loadMessages(false)`. The subscription's refetch
  replaces the poll. `enabled` = not loading && not loadError.
- `CheckedInHero`: pull the presence + attendee-history fetches out of the
  big `useEffect` into a stable `loadPresence` callback so both the effect
  and the subscription call the same thing. `enabled` = `!!selectedLocation`.
- `MessagesTab`: unfiltered `messages` INSERT subscription while the tab is
  mounted. RLS still scopes `fetchConversations()` to the user, so a
  platform-wide message just causes a cheap refetch. **Scaling watch-item:**
  at high message volume every client wakes on every message — revisit with
  a per-user broadcast channel if it becomes a problem. Acceptable for
  launch.

### Migration — `supabase/migrations/0017_enable_realtime.sql`

```sql
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table location_checkins;
```

Apply QA → prod via `supabase db query --linked` (per RESUME-launch-prep
pipeline). Idempotency: wrap each in a `do $$ begin … exception when
duplicate_object then null; end $$;` guard so a re-run is safe.

### RLS verification (known gotcha)

Realtime re-checks RLS per subscriber against the `authenticated` role. The
SELECT policies already exist (`fetchMessages` / `fetchPresence` work today),
but delivery can still fail if a policy isn't granted to `authenticated`
specifically. Plan includes a live check: two browser sessions, confirm an
INSERT in one arrives in the other. If it doesn't, add/adjust the SELECT
policy for `authenticated` in the same migration.

## Data flow

```
User B sends message
  → INSERT into messages (RLS: B is a participant)
  → Postgres logical replication → supabase_realtime publication
  → Realtime server re-evaluates SELECT RLS for each subscriber
  → User A's ChatView channel (conversation_id=eq.X) receives event
  → debounced onEvent → fetchMessages(X) → setMessages → autoscroll
  → User A's MessagesTab channel (unfiltered) also receives event
  → debounced onEvent → fetchConversations() → list re-renders, convo bumps
```

## Error handling

- Channel never connects / errors → `status: 'error'`, 30s backstop poll
  keeps data fresh, no error surfaced to the user.
- Refetch inside `onEvent` throws → logged, swallowed (same as today's
  poll failures); next event or backstop retries.
- Socket drop → supabase-js auto-reconnects; on re-`SUBSCRIBED` the hook
  fires `onEvent` once to catch up on anything missed.
- Optimistic message in `ChatView` + realtime echo → the post-send
  `loadMessages(false)` already replaces optimistic rows with real ones by
  id; a realtime-triggered refetch does the same. No dedup logic needed.

## Testing

No automated suite in this repo — manual, per convention:

1. **Chat thread live** — two sessions in the same conversation; message
   sent in A appears in B within ~1s without B polling. B's scroll only
   sticks if already at bottom.
2. **Conversation list live** — B on `MessagesTab` (no chat open); A sends;
   B's row updates preview + bumps without reopening.
3. **Presence live** — A checked in at a venue viewing `CheckedInHero`; B
   checks in at the same venue; A's connections strip gains B within ~1s.
   B checks out; A's strip drops B.
4. **Backstop** — disable WebSocket in devtools; confirm the 30s poll still
   refreshes; re-enable, confirm live resumes.
5. **Cleanup** — navigate between tabs repeatedly; confirm no channel leak
   (`supabase.getChannels().length` stays bounded).
6. `npx tsc --noEmit` clean.

## Files

- **New:** `lib/hooks/useTableSubscription.ts`,
  `supabase/migrations/0017_enable_realtime.sql`
- **Changed:** `components/ChatView.tsx` (drop 4s poll, add hook),
  `components/tabs/MessagesTab.tsx` (add hook),
  `components/home/CheckedInHero.tsx` (extract `loadPresence`, add hook)

## Rollout

1. Land code + migration file on `main`.
2. Apply `0017` to **QA**, run the manual test pass in the preview
   (two sessions), demo to founder.
3. On founder sign-off, apply `0017` to **prod**.
