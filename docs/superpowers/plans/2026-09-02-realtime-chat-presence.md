# Realtime Chat + Presence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make chat threads, the conversation list, and venue presence update live via Supabase Realtime instead of polling / load-once.

**Architecture:** One shared hook (`useTableSubscription`) opens a `postgres_changes` channel on a table (optionally filtered) and calls a caller-supplied `onEvent` — debounced — whenever a matching row changes, plus once on subscribe, on tab-visible, and every 30s while visible. Callers keep their existing fetch-on-mount and just pass that same fetch as `onEvent`; the realtime path never parses the payload, so it can't drift from the load path. A migration adds `messages` and `location_checkins` to the `supabase_realtime` publication.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `@supabase/supabase-js` ^2.110.7 (`supabase.channel(...).on('postgres_changes', ...)`), Supabase Postgres. Inline `style={{}}` per this repo's convention.

## Global Constraints

- **No automated test suite exists in this repo.** Every task ends with `npx tsc --noEmit` (must stay clean) plus a manual browser check in the dev-server preview — not a unit test. This matches every prior plan in `docs/superpowers/plans/`.
- Follow the existing inline-style convention — no Tailwind classes, no CSS modules.
- `'use client'` at the top of every hook/component file that uses React or browser APIs (all files here).
- New hooks live in `lib/hooks/` (matches `usePullToRefresh.ts`, `useZoneTracking.ts`).
- Migration files: `supabase/migrations/00NN_name.sql`, applied with `supabase db query --linked` after `supabase link --project-ref <ref>` (QA ref `ducadjakxmkfcvrteoqz`, PROD ref `yatixschvikugckkpfum`). Run from inside `/Users/sr/w-app-web`.
- Commit after every task (small working increments).
- Do **not** apply the migration to PROD until Task 7's founder demo is signed off (Task 7 is explicitly gated).
- Deviation from spec, intentional: the hook returns `void`, not `{ status }`. No surface displays connection status; the 30s backstop poll is the resilience story. YAGNI.

---

### Task 1: Realtime-enablement migration file

**Files:**
- Create: `supabase/migrations/0017_enable_realtime.sql`

**Interfaces:**
- Produces: nothing consumed by code. Task 3 applies this file to QA; Task 7 applies it to PROD.

- [ ] **Step 1: Create the migration file**

```sql
-- 0017_enable_realtime.sql
-- postgres_changes events only fire for tables in the `supabase_realtime`
-- publication. The web app subscribes to these two for live updates:
--   messages          -> live chat threads + conversation list
--   location_checkins -> live venue presence ("who's here")
-- Each ALTER is guarded so re-running the file is a no-op (adding a table
-- that's already a member raises duplicate_object / SQLSTATE 42710).

do $$
begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table location_checkins;
exception when duplicate_object then null;
end $$;
```

- [ ] **Step 2: Verify it parses (syntax only, no apply yet)**

Run: `grep -c 'add table' supabase/migrations/0017_enable_realtime.sql`
Expected: `2`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0017_enable_realtime.sql
git commit -m "Add migration 0017: enable realtime on messages + location_checkins"
```

---

### Task 2: `useTableSubscription` hook

**Files:**
- Create: `lib/hooks/useTableSubscription.ts`

**Interfaces:**
- Consumes: `supabase` from `@/lib/supabase` (already exported).
- Produces:
  ```ts
  function useTableSubscription(opts: {
    table: string;
    filter?: string;                       // e.g. `conversation_id=eq.<uuid>`
    event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';   // default '*'
    onEvent: () => void;
    enabled?: boolean;                     // default true
  }): void
  ```
  Tasks 4, 5, 6 call this.

- [ ] **Step 1: Write the hook**

```ts
'use client';

import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type PgEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseTableSubscriptionOptions {
  table: string;
  /** PostgREST-style filter, e.g. `conversation_id=eq.<uuid>`. Omit for all rows. */
  filter?: string;
  /** Which change type to listen for. Default '*'. */
  event?: PgEvent;
  /** Re-run this on any matching change (debounced). Also called once on
   *  subscribe, on tab-visible, and every 30s while visible. */
  onEvent: () => void;
  /** When false, no channel is opened. Default true. */
  enabled?: boolean;
}

const DEBOUNCE_MS = 250;
const BACKSTOP_MS = 30_000;

// Live-updates primitive for this app: open a Postgres change stream on
// `table` and call `onEvent` whenever a matching row changes. `onEvent` is
// always the caller's existing fetch function — realtime never reads the
// row payload, it just says "something changed, refetch". Subscribe, tab
// re-focus, and a 30s visible-only poll all also fire `onEvent`, so a
// dropped socket or missed event still reconciles.
export function useTableSubscription({
  table,
  filter,
  event = '*',
  onEvent,
  enabled = true,
}: UseTableSubscriptionOptions): void {
  // Latest onEvent without making it a resubscribe trigger.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    let debounce: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        debounce = null;
        try {
          onEventRef.current();
        } catch (err) {
          console.error('useTableSubscription onEvent failed:', err);
        }
      }, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel(`${table}:${filter ?? 'all'}:${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event, schema: 'public', table, ...(filter ? { filter } : {}) },
        () => fire(),
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') fire();
      });

    const onVisible = () => {
      if (document.visibilityState === 'visible') fire();
    };
    document.addEventListener('visibilitychange', onVisible);

    const backstop = setInterval(() => {
      if (document.visibilityState === 'visible') fire();
    }, BACKSTOP_MS);

    return () => {
      if (debounce) clearTimeout(debounce);
      clearInterval(backstop);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [table, filter, event, enabled]);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. (Nothing consumes the hook yet — this only proves it compiles against the installed `@supabase/supabase-js` types.)

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/useTableSubscription.ts
git commit -m "Add useTableSubscription hook (postgres_changes + debounced refetch + backstop)"
```

---

### Task 3: Apply migration 0017 to QA and verify

**Files:** none (operational task).

**Interfaces:**
- Consumes: `supabase/migrations/0017_enable_realtime.sql` from Task 1.
- Produces: `messages` and `location_checkins` are members of `supabase_realtime` on the QA project — Tasks 4–6's browser checks depend on this.

- [ ] **Step 1: Point the Supabase CLI at QA**

Run: `supabase link --project-ref ducadjakxmkfcvrteoqz`
Expected: "Finished supabase link." (token auth, no password prompt). Must be run from `/Users/sr/w-app-web`.

- [ ] **Step 2: Apply the migration**

Run: `supabase db query --linked < supabase/migrations/0017_enable_realtime.sql`
Expected: completes with no error (empty result set is fine).

- [ ] **Step 3: Verify publication membership**

Run:
```bash
echo "select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename in ('messages','location_checkins') order by tablename;" | supabase db query --linked
```
Expected: two rows — `location_checkins`, `messages`.

- [ ] **Step 4: Commit a note (no code change)**

```bash
git commit --allow-empty -m "Apply migration 0017 to QA (realtime publication verified: messages, location_checkins)"
```

---

### Task 4: Live chat thread — wire `ChatView`

**Files:**
- Modify: `components/ChatView.tsx`

**Interfaces:**
- Consumes: `useTableSubscription` (Task 2); existing `loadMessages(isInitial: boolean)` callback and `loading` / `loadError` state already in this file.
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Remove the poll**

Delete the constant near the top:
```ts
const POLL_MS = 4000;
```
Delete this entire effect (the "Poll for new messages while the chat is open" block):
```ts
  // Poll for new messages while the chat is open (no realtime backend yet).
  useEffect(() => {
    if (loading || loadError) return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') loadMessages(false);
    }, POLL_MS);
    return () => clearInterval(t);
  }, [loading, loadError, loadMessages]);
```

- [ ] **Step 2: Add the import**

Add with the other imports at the top:
```ts
import { useTableSubscription } from '@/lib/hooks/useTableSubscription';
```

- [ ] **Step 3: Subscribe instead**

Where the deleted poll effect was, add:
```ts
  // Live updates for this thread. `messages` rows are insert-only in this
  // app, so listen for INSERT and refetch (fetchMessages does the profile
  // join + ordering the raw payload lacks). Disabled until the first load
  // succeeds so we don't refetch over a still-loading / errored view.
  useTableSubscription({
    table: 'messages',
    filter: `conversation_id=eq.${conversation.id}`,
    event: 'INSERT',
    onEvent: () => loadMessages(false),
    enabled: !loading && !loadError,
  });
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Then `grep -n POLL_MS components/ChatView.tsx` — expected: no output (constant fully removed).

- [ ] **Step 5: Manual browser check (single session — proves the refetch path)**

1. `preview_start` the dev server (`w-app-web-dev`), log in, open a conversation in `MessagesTab`.
2. In the browser console, REST-insert a message as the current user against the QA project, using the session token (same pattern used for QA seed data this session):
   `POST {NEXT_PUBLIC_SUPABASE_URL}/rest/v1/messages`, headers `apikey: <anon>` + `Authorization: Bearer <access_token>` (from `localStorage['sb-ducadjakxmkfcvrteoqz-auth-token']`), body `{ "conversation_id": "<open convo id>", "content": "realtime probe" }`.
3. Expected: the new bubble appears in the open thread within ~1s, with no navigation and no 4s cadence. `read_console_messages` shows no channel errors.
4. Cross-user delivery (a message from a *different* account arriving live) is verified in Task 7's two-device demo — a second browser tab shares the same auth session and can't stand in for a second user.

- [ ] **Step 6: Commit**

```bash
git add components/ChatView.tsx
git commit -m "ChatView: live message updates via useTableSubscription, drop 4s poll"
```

---

### Task 5: Live conversation list — wire `MessagesTab`

**Files:**
- Modify: `components/tabs/MessagesTab.tsx`

**Interfaces:**
- Consumes: `useTableSubscription` (Task 2); existing `loadConversations` callback (already a `useCallback(..., [])`).
- Produces: nothing new.

- [ ] **Step 1: Add the import**

Add with the other imports:
```ts
import { useTableSubscription } from '@/lib/hooks/useTableSubscription';
```

- [ ] **Step 2: Subscribe**

Immediately after the existing `useEffect(() => { loadConversations(); }, [loadConversations]);`, add:
```ts
  // No server-side filter: postgres_changes can't express
  // `conversation_id IN (my conversations)`. Listen for every message
  // INSERT and refetch — RLS still scopes fetchConversations() to the
  // current user, so an unrelated message just costs one cheap refetch.
  // Scaling note: at high volume every client wakes per message; revisit
  // with a per-user broadcast channel if that becomes a problem.
  useTableSubscription({
    table: 'messages',
    event: 'INSERT',
    onEvent: loadConversations,
  });
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual browser check**

1. Dev server running, logged in, sitting on `MessagesTab` with **no** chat open.
2. REST-insert a message (as in Task 4 Step 5) into one of the listed conversations.
3. Expected: that conversation's preview text updates and it reorders per the list's normal ordering, within ~1s, no reopen. Console clean.

- [ ] **Step 5: Commit**

```bash
git add components/tabs/MessagesTab.tsx
git commit -m "MessagesTab: live conversation-list updates via useTableSubscription"
```

---

### Task 6: Live venue presence — wire `CheckedInHero`

**Files:**
- Modify: `components/home/CheckedInHero.tsx`

**Interfaces:**
- Consumes: `useTableSubscription` (Task 2); existing `fetchPresence`, `fetchAttendeeHistory` (already imported), `selectedLocation` from the store, `setPresenceProfiles` state setter, `Profile` type (already imported).
- Produces: a new `loadPresence` `useCallback` used by both the mount effect and the subscription.

- [ ] **Step 1: Add the import**

Add with the other imports:
```ts
import { useTableSubscription } from '@/lib/hooks/useTableSubscription';
```

- [ ] **Step 2: Extract the presence load into a stable callback**

Add near the other callbacks (e.g. just above `loadTags`). This is the presence + attendee-history block currently inline in the big effect, verbatim, wrapped in `useCallback`:
```ts
  // Current presence + historical attendees for the Connections strip.
  // Same logic that used to live inline in the effect below — extracted so
  // the realtime subscription can re-run exactly the same load.
  const loadPresence = useCallback(() => {
    if (!selectedLocation) return;
    const locationId = selectedLocation.id;

    fetchPresence(locationId)
      .then((rows) => {
        const profiles = rows.map((row) => row.profiles).filter((p): p is Profile => !!p);
        setPresenceProfiles(profiles);
      })
      .catch((err) => console.error('Failed to load presence:', err));

    fetchAttendeeHistory(locationId)
      .then((history) => {
        setPresenceProfiles((current) => {
          const seen = new Set(current.map((p) => p.id));
          const merged = [...current];
          for (const profile of history) {
            if (!seen.has(profile.id)) {
              seen.add(profile.id);
              merged.push(profile);
            }
          }
          return merged;
        });
      })
      .catch((err) => console.error('Failed to load attendee history:', err));
  }, [selectedLocation]);
```

- [ ] **Step 3: Call it from the existing effect instead of the inline fetches**

In the big `useEffect` (the one starting `if (!selectedLocation) return;`, with the `checkInAttemptedFor` guard), replace the inline `fetchPresence(...)` `.then(...)` chain **and** the inline `fetchAttendeeHistory(...)` `.then(...)` chain (the two blocks that call `setPresenceProfiles`) with a single line:
```ts
    loadPresence();
```
Leave everything else in that effect untouched (the check-in guard, the `setSelectedAttendeeId`/`setTagText`/`setTagError` resets, `loadTags`, `fetchBanners`). Add `loadPresence` to that effect's dependency array.

- [ ] **Step 4: Subscribe**

Right after the `loadPresence` definition, add:
```ts
  // Live presence: any check-in / check-out row for this venue re-runs the
  // same load. Listen for '*' because a check-out is an UPDATE
  // (checked_out_at set), not an INSERT.
  useTableSubscription({
    table: 'location_checkins',
    filter: selectedLocation ? `location_id=eq.${selectedLocation.id}` : undefined,
    onEvent: loadPresence,
    enabled: !!selectedLocation,
  });
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. Confirm `useCallback` is in this file's `react` import — if not, add it to the existing `import { ... } from 'react'` line.

- [ ] **Step 6: Manual browser check**

1. Dev server, logged in, check in to `QA Test Venue` (geo-sim to `40.7128,-74.006`, as done for QA this session) so `CheckedInHero` is showing.
2. REST-insert a `location_checkins` row for `QA Test Venue` with a **different** `user_id` (any other profile id in QA — get one from the master-admin panel's people list), body `{ "location_id": "<qa test venue id>", "user_id": "<other id>", "mode": "live" }`.
3. Expected: within ~1s the Connections strip gains that person, no refresh.
4. PATCH that row `{ "checked_out_at": "<now-iso>" }`. Expected: the strip drops them within ~1s.
5. If check-**out** (the UPDATE) does not propagate but check-in (INSERT) does: add `alter table location_checkins replica identity full;` to `0017_enable_realtime.sql`, re-apply to QA (Task 3 Step 2 is idempotent), retest. Note it in this task's commit message.

- [ ] **Step 7: Commit**

```bash
git add components/home/CheckedInHero.tsx supabase/migrations/0017_enable_realtime.sql
git commit -m "CheckedInHero: live venue presence via useTableSubscription"
```

---

### Task 7: Full manual pass + founder demo (PROD gate)

**Files:** none (verification + rollout task).

**Interfaces:**
- Consumes: Tasks 1–6 landed on `main`, migration 0017 applied to QA.
- Produces: founder sign-off → migration 0017 applied to PROD.

- [ ] **Step 1: Channel-leak check**

With the dev server running and logged in, navigate Home ↔ Messages ↔ Map and open/close a chat ~10 times, then in the console run `performance.getEntriesByType('resource').filter(r => r.name.includes('realtime')).length` — it should not grow unbounded across repeats, and `read_console_messages` shows no "channel already subscribed" / timeout spam.

- [ ] **Step 2: Backstop check**

DevTools → Network → Offline (or block WebSocket), REST-insert a message, confirm it still appears within ~30s (the visible-only backstop poll). Restore network, confirm sub-second updates resume.

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit` clean from a clean tree.

- [ ] **Step 4: Two-device founder demo (on the QA deployment)**

Founder signs in as two different accounts on two devices / browsers:
- Both in the same conversation: message sent on A appears on B in ~1s; B's scroll auto-sticks only if already at the bottom.
- B on `MessagesTab` (no chat open): A sends; B's row updates + reorders without reopening.
- A checked in at a venue on the Home tab; B checks in at the same venue: A's Connections strip gains B in ~1s; B checks out: A's strip drops B.

- [ ] **Step 5: On sign-off, apply to PROD**

```bash
supabase link --project-ref yatixschvikugckkpfum
supabase db query --linked < supabase/migrations/0017_enable_realtime.sql
echo "select tablename from pg_publication_tables where pubname='supabase_realtime' and tablename in ('messages','location_checkins') order by tablename;" | supabase db query --linked
```
Expected: two rows.

- [ ] **Step 6: Commit the rollout note**

```bash
git commit --allow-empty -m "Apply migration 0017 to PROD (realtime live for chat + presence)"
```

- [ ] **Step 7: Update the launch docs** — in `docs/RESUME-launch-prep.md` and `docs/build-state-inventory-2026-09-02.md`, record realtime as shipped (chat + presence), migration 0017 applied QA + PROD, and remove "No realtime" from the build-state gaps. Commit.

---

## Final verification (after all tasks)

- [ ] `npx tsc --noEmit` clean from a clean tree.
- [ ] `grep -rn "POLL_MS" components/` returns nothing (old poll fully gone).
- [ ] `grep -rn "useTableSubscription" components/` shows exactly the three wirings (ChatView, MessagesTab, CheckedInHero).
- [ ] Migration 0017 present in `supabase/migrations/`, applied to QA and PROD, publication membership verified on both.
- [ ] `docs/RESUME-launch-prep.md` and `docs/build-state-inventory-2026-09-02.md` updated to reflect realtime shipped.
