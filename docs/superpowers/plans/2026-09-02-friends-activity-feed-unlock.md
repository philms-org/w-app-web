# Friends Activity Feed Unlock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Refreshed 2026-09-03** against the shipped Plan A. Changes from the original: Task 3 is now the opt-in toggle only — connection removal was dropped because Plan A shipped `/main/connections` with a working unfriend button (`removeConnection` already has a surface). Task 3's toggle markup is corrected to `ProfileTab`'s **light** theme (white cards, not `theme.*` dark tokens). Spec/dependency links updated to the v2 design.

**Goal:** Turn `FriendsActivityFeed` from a hardcoded locked-state card into a real feed gated on a live 3-connection count, respecting each user's `share_checkins_with_friends` setting, and give users a toggle to opt in.

**Architecture:** Reads only — no new tables and no new RPCs beyond what Plan A shipped. The connection count comes from `fetchMyConnectionCount()` (Plan A, live in `lib/data.ts`). Friend activity is a two-step client query: read my friend ids from `friendships`, then read their recent `location_checkins` joined to `locations` and `profiles`. The privacy gate is applied **explicitly in the query** by filtering to friends whose `profiles.share_checkins_with_friends` is true — `location_checkins`'s SELECT policy is `true`, so RLS grants no protection here and the filter is the only thing standing between a friend's check-ins and the feed.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `@supabase/supabase-js` ^2.110.7. Inline `style={{}}` per this repo's convention.

**Spec:** `docs/superpowers/specs/2026-09-03-connections-graph-qr-connect-v2-design.md` (see "Sub-project 2 (friends feed)").
**Depends on:** Plan A (`docs/superpowers/plans/2026-09-03-connections-write-path-v2.md`) — **merged to `main` at `c215588`, migration 0019 live on QA and PROD as of 2026-09-03.** `fetchMyConnectionCount()` and `removeConnection()` are already in `lib/data.ts`; `friendships` two-row writes are in place. This plan can start now.

## Global Constraints

- **No automated test suite exists in this repo.** Every task ends with `npx tsc --noEmit` (must stay clean) plus a manual browser check. This matches every prior plan in `docs/superpowers/plans/`.
- Follow the existing inline-style convention — no Tailwind classes, no CSS modules. Colors come from `@/lib/theme`.
- `'use client'` at the top of every component file using React state.
- **`share_checkins_with_friends` defaults to `false`.** Every query that surfaces a friend's check-in must filter on it. Never widen this default.
- The connection-count gate threshold is **3**, matching the existing copy.
- Commit after every task.
- Build gates are ON (`next.config.ts`): lint and type errors fail the build.
- No database migration in this plan. If you find yourself writing SQL, stop — the requirement has drifted.

---

### Task 1: `fetchFriendsActivity()` data function

**Files:**
- Modify: `lib/types.ts` (append one interface)
- Modify: `lib/data.ts` (append after the Plan A connections functions)

**Interfaces:**
- Consumes: `getCurrentUserId()` and `supabase`, already in `lib/data.ts`.
- Produces:
  ```ts
  interface FriendActivityEntry {
    user_id: string;
    name: string | null;
    avatar_url: string | null;
    location_id: string;
    venue_name: string;
    checked_in_at: string;
    is_active: boolean;
  }
  function fetchFriendsActivity(limit?: number): Promise<FriendActivityEntry[]>
  ```
  Task 2 consumes both.

- [ ] **Step 1: Append the interface to `lib/types.ts`**

```ts
// One friend's most recent venue check-in, for the home friends feed.
// Only ever populated for friends who set share_checkins_with_friends = true.
export interface FriendActivityEntry {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  location_id: string;
  venue_name: string;
  checked_in_at: string;
  is_active: boolean;
}
```

- [ ] **Step 2: Append the function to `lib/data.ts`**

```ts
// Recent check-ins by people I'm connected to.
//
// PRIVACY: location_checkins' SELECT policy is `true` (any authenticated user
// can read any check-in), so RLS provides NO protection here. The
// share_checkins_with_friends filter below is the only thing gating this data,
// and that column defaults to false. Do not remove it, and do not widen it to
// a join that could return rows for opted-out users.
export async function fetchFriendsActivity(limit = 20): Promise<FriendActivityEntry[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];

  // record_qr_scan writes both directions, so every friend of mine has a row
  // with user_id = me. A single-direction read is correct and index-friendly.
  const { data: friendRows, error: friendError } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', uid);
  if (friendError) throw friendError;

  const friendIds = (friendRows ?? []).map((r: { friend_id: string }) => r.friend_id);
  if (friendIds.length === 0) return [];

  // Restrict to friends who opted in BEFORE reading any check-in.
  // `Profile` uses display_name — there is no `name` column on profiles.
  const { data: sharers, error: sharerError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', friendIds)
    .eq('share_checkins_with_friends', true);
  if (sharerError) throw sharerError;

  const sharerIds = (sharers ?? []).map((p: { id: string }) => p.id);
  if (sharerIds.length === 0) return [];

  const profileById = new Map(
    (sharers ?? []).map((p: { id: string; display_name: string | null; avatar_url: string | null }) => [p.id, p])
  );

  const { data: checkins, error: checkinError } = await supabase
    .from('location_checkins')
    .select('user_id, location_id, checked_in_at, checked_out_at, locations(name)')
    .in('user_id', sharerIds)
    .order('checked_in_at', { ascending: false })
    .limit(limit);
  if (checkinError) throw checkinError;

  type CheckinRow = {
    user_id: string;
    location_id: string;
    checked_in_at: string;
    checked_out_at: string | null;
    locations: { name: string } | null;
  };

  return ((checkins ?? []) as unknown as CheckinRow[]).map((row) => {
    const profile = profileById.get(row.user_id);
    return {
      user_id: row.user_id,
      name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      location_id: row.location_id,
      venue_name: row.locations?.name ?? 'A venue',
      checked_in_at: row.checked_in_at,
      is_active: row.checked_out_at === null,
    };
  });
}
```

Add `FriendActivityEntry` to the existing `import type { ... } from '@/lib/types'` block at the top of `lib/data.ts`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Verify the privacy filter holds**

With two QA accounts connected via Plan A, confirm the default keeps data hidden:

```bash
echo "select id, share_checkins_with_friends from profiles where share_checkins_with_friends = true;" | supabase db query --linked
```
Expected: zero rows initially (the column defaults to false), so `fetchFriendsActivity()` must return `[]` even though a friendship exists. Task 3 adds the opt-in that changes this.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/data.ts
git commit -m "Add fetchFriendsActivity with share_checkins_with_friends gate"
```

---

### Task 2: Wire the gate and the real feed into `FriendsActivityFeed`

**Files:**
- Modify: `components/home/FriendsActivityFeed.tsx` (replace the whole file)

**Interfaces:**
- Consumes: `fetchMyConnectionCount()` (Plan A, Task 3), `fetchFriendsActivity()` and `FriendActivityEntry` (Task 1).
- Produces: nothing consumed by later tasks. The component still takes no props, so its call site in `components/tabs/HomeTab.tsx` needs no change.

- [ ] **Step 1: Replace `components/home/FriendsActivityFeed.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { theme } from '@/lib/theme';
import { Users, Lock } from 'lucide-react';
import FeedBlurBackdrop from '@/components/shared/FeedBlurBackdrop';
import { fetchMyConnectionCount, fetchFriendsActivity } from '@/lib/data';
import type { FriendActivityEntry } from '@/lib/types';

const REQUIRED_CONNECTIONS = 3;

export default function FriendsActivityFeed() {
  const [count, setCount] = useState<number | null>(null);
  const [entries, setEntries] = useState<FriendActivityEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchMyConnectionCount()
      .then((n) => {
        if (cancelled) return;
        setCount(n);
        // Only spend a query on activity once the gate is actually open.
        if (n >= REQUIRED_CONNECTIONS) return fetchFriendsActivity();
        return [];
      })
      .then((rows) => { if (!cancelled && rows) setEntries(rows); })
      .catch(() => { if (!cancelled) setCount(0); });
    return () => { cancelled = true; };
  }, []);

  const unlocked = count !== null && count >= REQUIRED_CONNECTIONS;

  if (!unlocked) {
    return (
      <div style={{
        position: 'relative', borderRadius: '16px', overflow: 'hidden',
        margin: '0 20px 20px', backgroundColor: theme.surface,
        border: `1px solid ${theme.divider}`, minHeight: '180px',
      }}>
        <FeedBlurBackdrop />
        <div style={{
          position: 'relative',
          background: `linear-gradient(180deg, transparent 0%, ${theme.bg} 85%)`,
          padding: '24px 20px', textAlign: 'center',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '9999px',
            backgroundColor: theme.premium1, display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
          }}>
            <Lock style={{ width: '22px', height: '22px', color: 'white' }} />
          </div>
          <h3 style={{
            color: theme.text, fontSize: '16px', fontWeight: 700, marginBottom: '6px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}>
            Add friends to see where they&apos;ve been
          </h3>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            marginTop: '10px', color: theme.muted, fontSize: '12px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}>
            <Users style={{ width: '14px', height: '14px' }} />
            {count ?? 0} / {REQUIRED_CONNECTIONS} connections
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: '16px', margin: '0 20px 20px', backgroundColor: theme.surface,
      border: `1px solid ${theme.divider}`, padding: '18px 20px',
      fontFamily: 'Montserrat, system-ui, sans-serif',
    }}>
      <h3 style={{ color: theme.text, fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
        Friends&apos; activity
      </h3>

      {entries.length === 0 ? (
        <p style={{ color: theme.muted, fontSize: '13px' }}>
          No recent activity from your connections yet.
        </p>
      ) : (
        entries.map((e) => (
          <div
            key={`${e.user_id}-${e.checked_in_at}`}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}
          >
            <div style={{
              width: '36px', height: '36px', borderRadius: '9999px',
              backgroundColor: theme.surface2, flexShrink: 0, overflow: 'hidden',
            }}>
              {e.avatar_url && (
                <img src={e.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: theme.text, fontSize: '14px', fontWeight: 600 }}>
                {e.name ?? 'Someone'}
              </div>
              <div style={{ color: theme.muted, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {e.is_active ? 'At' : 'Was at'} {e.venue_name}
              </div>
            </div>
            {e.is_active && (
              <span style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: theme.green, flexShrink: 0 }} />
            )}
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual browser check**

Run `npm run dev` and open the home tab with an account that has fewer than 3 connections.
Expected: the locked card renders exactly as before, but the counter now shows the **real** count (e.g. `1 / 3`) instead of a hardcoded `0 / 3`.

- [ ] **Step 4: Commit**

```bash
git add components/home/FriendsActivityFeed.tsx
git commit -m "FriendsActivityFeed: real connection-count gate and live friends feed"
```

---

### Task 3: Check-in sharing opt-in toggle

Without an opt-in surface the feed is empty by construction, since `share_checkins_with_friends` defaults to false. (Connection removal is **out of scope** — Plan A's `/main/connections` screen already has an unfriend button wired to `removeConnection()`.)

**Files:**
- Modify: `lib/types.ts` (add one field to `Profile`)
- Modify: `lib/data.ts` (append one function)
- Modify: `components/tabs/ProfileTab.tsx` (add a privacy card)

**Interfaces:**
- Consumes: `upsertProfile()` and `fetchProfile()` (both already in `lib/data.ts`); `useStore` (already imported by `ProfileTab.tsx`).
- Produces:
  ```ts
  function setShareCheckinsWithFriends(value: boolean): Promise<void>
  ```

**Important — do not seed the toggle from `useStore().user`.** The store's `User`
(`lib/store.ts`) is a separate camelCase session shape with no
`share_checkins_with_friends` field; reading it there is a type error. Seed from
`fetchProfile()` instead, as Step 2 does.

**Important — `ProfileTab.tsx` is a LIGHT-themed screen.** Its cards use
`backgroundColor: 'white'`, `borderRadius: '16px'`, `boxShadow: '0 1px 3px
rgba(0, 0, 0, 0.1)'`, `#F3F3F3` dividers, `#919191` for muted/icon text, and
`Montserrat` — NOT the `theme.*` dark tokens. The markup below matches that.
Only the outer page wrapper uses `theme.bg`.

- [ ] **Step 1: Add the field to `Profile` and the setter to `lib/data.ts`**

`Profile` in `lib/types.ts` does **not** currently declare this column (verified 2026-09-03:
absent from the interface; present in Postgres defaulting to `false`). Add it alongside the
other `*_visible` flags in the `Profile` interface:

```ts
  share_checkins_with_friends?: boolean | null;
```

Then append to `lib/data.ts` (after the connections-graph functions at the end of the file):

```ts
// Opt in/out of letting connections see your venue check-ins in their feed.
// Defaults to false in the database; this is the only place the app turns it on.
export async function setShareCheckinsWithFriends(value: boolean): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  await upsertProfile({ id: uid, share_checkins_with_friends: value });
}
```

- [ ] **Step 2: Add a "Privacy" card to `components/tabs/ProfileTab.tsx`**

Place it as its own white card **between the "Profile Details" card and the "Menu Items"
card** (i.e. right before the `{/* Menu Items */}` comment). It matches the "Profile Details"
card wrapper exactly:

```tsx
        {/* Privacy */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          marginBottom: '16px'
        }}>
          <h3 style={{
            fontWeight: '600',
            marginBottom: '12px',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>Privacy</h3>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                Share check-ins with connections
              </div>
              <div style={{ color: '#919191', fontSize: '12px', marginTop: '2px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                Lets people you&apos;ve connected with see which venues you visit.
              </div>
            </div>
            <input
              type="checkbox"
              checked={shareCheckins}
              onChange={(e) => {
                const next = e.target.checked;
                setShareCheckins(next);
                // Revert the optimistic flip if the write fails, so the switch
                // never claims a privacy setting that isn't actually saved.
                setShareCheckinsWithFriends(next).catch(() => setShareCheckins(!next));
              }}
              style={{ width: '20px', height: '20px', accentColor: '#17BFD9', flexShrink: 0, cursor: 'pointer' }}
            />
          </div>
        </div>
```

Backed by state near the component's other hooks (`ProfileTab.tsx` imports `useState`
already; add `useEffect`):

```tsx
  const [shareCheckins, setShareCheckins] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchProfile(user.id)
      .then((p) => { if (!cancelled) setShareCheckins(p?.share_checkins_with_friends ?? false); })
      .catch(() => { /* leave the switch off if the profile can't be read */ });
    return () => { cancelled = true; };
  }, [user?.id]);
```

Add to the imports: `useEffect` from `react`; `fetchProfile` and `setShareCheckinsWithFriends`
from `@/lib/data` (the file currently imports only `signOut` from `@/lib/auth` and `useStore`
from `@/lib/store` — add a `import { fetchProfile, setShareCheckinsWithFriends } from '@/lib/data';`).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit` — clean.
Run: `npm run lint` — no NEW warnings in `ProfileTab.tsx`, `lib/data.ts`, `lib/types.ts`
(the repo has a standing `no-img-element` warning in `ProfileTab.tsx` at the avatar `<img>`
and 3 `no-explicit-any` in `lib/data.ts` — those are pre-existing, not yours).

- [ ] **Step 4: Manual browser check**

1. Sign in as your test user, open Profile tab.
   Expected: a "Privacy" card with the toggle, reflecting the current DB value (off by default).
2. Flip it on. Verify the write:
   ```bash
   echo "select id, share_checkins_with_friends from profiles where id = '<test-user-id>';" | supabase db query --linked
   ```
   Expected: `share_checkins_with_friends = true`.
3. Flip it off, re-query. Expected: back to `false`.
4. End-to-end (needs ≥3 connected QA accounts to the test user via Plan A's scan flow, each
   with `share_checkins_with_friends = true` and a recent `location_checkins` row): reload the
   test user's home tab. Expected: the locked card is replaced by "Friends' activity" listing
   those friends and their venues, green dot for anyone still checked in. Turn one friend's
   toggle off, reload → that friend drops out of the feed.

- [ ] **Step 5: Commit**

```bash
git add lib/data.ts lib/types.ts components/tabs/ProfileTab.tsx
git commit -m "Add check-in sharing opt-in toggle to ProfileTab

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** Plan B's three scope items — `fetchFriendsActivity()` respecting `share_checkins_with_friends` (Task 1), the real 3-connection gate (Task 2), and the privacy opt-in toggle (Task 3) — each map to a task.
- **Type consistency:** `FriendActivityEntry` is defined in Task 1 and consumed with the same field names in Task 2. `fetchMyConnectionCount()` matches the signature Plan A shipped (`lib/data.ts`, returns `Promise<number>`, exact head count on `friendships` where `user_id = me`). `REQUIRED_CONNECTIONS` is defined once in the component. `setShareCheckinsWithFriends` is defined in Task 3 and used only there.
- **Privacy check:** the only path to a friend's check-in filters on `share_checkins_with_friends = true` before any `location_checkins` read. The existing `is_friend_sharing()` DB function is left untouched — it serves RLS elsewhere and duplicating its logic client-side is deliberate, since `location_checkins` has no policy that would invoke it.
- **Theme note:** `FriendsActivityFeed` (Task 2) is a dark-theme card (`theme.*`); `ProfileTab` (Task 3) is a light-theme screen (white cards). The two tasks deliberately use different token sets — this is correct, not an inconsistency.
- **Out of scope:** connection removal — Plan A shipped `/main/connections` with a working unfriend button.
