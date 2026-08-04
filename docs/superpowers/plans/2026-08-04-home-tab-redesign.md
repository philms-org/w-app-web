# Home Tab Redesign — Claude Design Import

## Context

The user pulled a Claude Design mockup (`claude.ai/design/p/643102d9-9c49-429e-893f-e3dbdb81f31f`, file `W App.dc.html`) representing an optimized redesign of the app's home screen and navigation, and asked to implement it fully in `w-app-web` (Android/iOS are separate repos, handled in a later session). The mockup is a self-contained prototype with mock local state — it establishes the visual system and rough screen layout, but several pieces of the user's verbal spec (peek, connections-gated friends feed) aren't in the mockup at all and need fresh design.

Decisions confirmed with the user:
- **Full IA replace**: the new dark/teal theme and 3-tab nav (Home/Map/Messages, Profile behind a header icon, History+Rewards collapsed into Home panels) replaces the current 5-surface structure, not additive.
- **Web first**: build and verify fully in `w-app-web`; Android/iOS get a spec handoff afterward, not simultaneous implementation.
- **Real schema**: build actual Supabase tables/RLS for connections and peeks, not mock state.
- **Adopt mockup's exact colors** (`#22c3c9` teal / `#0d0d0f` bg), replacing `theme.accent`/`theme.bg`.
- **Real geofence check** gates check-in (compare `currentLocation` to venue lat/lng/`geofence_radius_meters`).
- **QR Connect = display-only** (show own QR; no in-app camera scanner).
- **Peek = one active peek at a time, silent** (no realtime notify push; checked-in users see it next time they view the CONNECTIONS card).

## Existing code to reuse (do not rebuild)

- **Attendee strip + reconnect composer** — `components/tabs/HistoryTab.tsx` lines ~116–218 (`fetchAttendeeHistory` → avatar scroller → tap → inline composer → `startConversation`). Extract into `components/shared/AttendeeStrip.tsx` and `components/shared/InlineMessageComposer.tsx`; both `HistoryTab` and the new checked-in hero use them.
- **Quick-access icon row** — `components/tabs/MainFeedTab.tsx` lines ~55–71 (`quickAccessItems`/`handleQuickAccess`). Generalize into `components/home/QuickAccessRow.tsx` taking an `items` prop, so Home can swap Profile → Connect.
- **HeroCarousel** (`components/HeroCarousel.tsx`) — keep as-is for the checked-in-venue photo banner. It is NOT reused for the new "scroll nearby locations" banner (different data shape: N distinct venues, not N photos of one venue) — that's a new `NearbyBanner` component.
- **Check-in plumbing** — `checkIn`/`checkOut`/`fetchPresence` in `lib/data.ts` already exist; only the gating UI (geofence check before calling `checkIn`) is new.

## Phase 1 — Visual shell + navigation (checkpoint: app fully navigable, no regressions)

1. `lib/theme.ts`: update `bg` → `#0d0d0f`, `accent` → `#22c3c9`; add `surface: #1a1a1d`, `surface2: #232327`, `text: #f5f5f7`, `muted: rgba(245,245,247,.55)`, `divider: rgba(255,255,255,.09)`, `warm1: #f3b56d`, `warm2: #e8836a`, `premium1: #7c5cff`, `premium2: #d24bd6`, `green: #3ecf6b`. Leave `accent2`/`gradientStart`/`gradientEnd` untouched.
2. `components/TabBar.tsx`: rename `'feed'` tab → `'home'` (keep W-wordmark glyph/position). Map and Messages entries unchanged.
3. `lib/store.ts`: default `activeTab` → `'home'`.
4. New `components/AppHeader.tsx`: W logo/wordmark + profile-icon button (routes to existing `profile` tab). Rendered from `app/main/page.tsx` only when `activeTab === 'home'` (routing is a client-state switch, not per-route layout, so the header can't live inside a shared layout file).
5. New `components/home/QuickAccessRow.tsx` (generalized from MainFeedTab, see above).
6. New `components/home/NearbyBanner.tsx`: horizontal-scroll cards from `fetchVenues()` sorted by distance from `currentLocation` (haversine, client-side). Each card: venue image, name, short blurb, "Peek" button (stubbed — see Phase 3). Shows "Can't detect your location" fallback text when `currentLocation` is null (reuse the existing geolocation-permission flow in `app/main/page.tsx`, don't rebuild it).
7. New `components/home/HistoryPanel.tsx` / `components/home/RewardsPanel.tsx`: panel versions (toggled inline below `QuickAccessRow`, not full-tab nav) of `HistoryTab`'s list+detail and the rewards grid/BOGO flow already sketched in `MainFeedTab`. `HistoryPanel` uses the extracted `AttendeeStrip`/`InlineMessageComposer`.
8. New `components/home/CheckedInHero.tsx`: reuses `HeroCarousel` unchanged for the checked-in venue banner, plus a CONNECTIONS card (extracted `AttendeeStrip`) — peeks list stubbed empty until Phase 3.
9. New `components/home/ConnectSheet.tsx`: renders the user's own profile QR (encode `user.id`) — stub, no `requestConnection` call yet (Phase 3).
10. New `components/home/FriendsActivityFeed.tsx`: renders the locked-state CTA only for now (real unlock logic in Phase 3).
11. New `components/tabs/HomeTab.tsx` assembling all of the above per the mockup's layout order: NearbyBanner (or CheckedInHero if checked in) → QuickAccessRow (History/Rewards/Connect) → History/Rewards panel (if toggled) → FriendsActivityFeed (default state). Wire real geofence check here before calling `checkIn` (Phase 1 can implement this now since it only needs existing `currentLocation`/venue columns, no new schema).
12. `app/main/page.tsx`: `case 'home': return <HomeTab />`, delete the `'feed'` case.
13. Delete `components/tabs/MainFeedTab.tsx` once `HomeTab` fully covers its real functionality (check-in, presence, venue banner).

**Checkpoint**: dev server + Camoufox/manual click-through — Home loads, nearby banner scrolls, check-in works with geofence, History/Rewards panels work end-to-end via existing data functions, Map/Messages/Profile still reachable and unchanged, no console errors, `npx tsc --noEmit` clean.

## Phase 2 — Schema

New file `supabase/migrations/0001_connections_and_peeks.sql` (repo has no existing migrations dir or CLI link — user applies manually via the Supabase SQL editor, same pattern as the sibling `wapp` repo's `supabase/migrations/0001_create_leads_table.sql`):

```sql
create table if not exists public.connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id),
  addressee_id uuid not null references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint connections_no_self check (requester_id <> addressee_id),
  constraint connections_unique_pair unique (requester_id, addressee_id)
);
create index on public.connections (addressee_id, status);
create index on public.connections (requester_id, status);
alter table public.connections enable row level security;
create policy "select own connections" on public.connections for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
create policy "insert own request" on public.connections for insert to authenticated
  with check (auth.uid() = requester_id);
create policy "respond or withdraw" on public.connections for update to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id)
  with check (auth.uid() = requester_id or auth.uid() = addressee_id);

create table if not exists public.location_peeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) unique,
  location_id uuid not null references public.locations(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 hours')
);
alter table public.location_peeks enable row level security;
create policy "insert own peek" on public.location_peeks for insert to authenticated
  with check (auth.uid() = user_id);
create policy "peeker sees own peek" on public.location_peeks for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.location_checkins lc
      where lc.location_id = location_peeks.location_id
        and lc.user_id = auth.uid()
        and lc.checked_out_at is null
    )
  );
create policy "peeker can update own peek" on public.location_peeks for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "peeker can delete own peek" on public.location_peeks for delete to authenticated
  using (auth.uid() = user_id);
```

Note: `user_id unique` on `location_peeks` enforces "one active peek at a time" at the DB level (new peek = upsert on `user_id`, replacing any prior row/location). The existing bare `friendships` table (`lib/data.ts` ~line 411) is left untouched, not dropped or backfilled — flagged as a follow-up decision, not made silently.

No new comments/threading table: "friends' activity feed" reads `feed_posts` (already top-level-only, matches scope — the user's "commenting in those locations" maps to existing feed posts, not a new reply structure).

## Phase 3 — Live wiring

1. `lib/types.ts`: add `Connection` and `LocationPeek` interfaces (see fields in the SQL above, plus an optional joined `profiles?: Profile`).
2. `lib/data.ts`: add `fetchConnections(status?)`, `requestConnection(targetUserId)`, `respondToConnection(id, accept)`, `getConnectionCount(userId?)` (head-count query), `peekLocation(locationId)` (upsert on `user_id`), `fetchActivePeeks(locationId)`, `fetchMyActivePeek()`, `fetchFriendsActivity(sinceDate, limit=100)` (accepted-connection ids → `feed_posts` join, ordered desc, capped). Update `startConversation`'s friendship lookup (~line 411) to query `connections` with `status='accepted'` instead of `friendships`.
3. Wire `NearbyBanner`'s Peek button → `peekLocation`; `CheckedInHero`'s CONNECTIONS card → `fetchActivePeeks` merged into the `AttendeeStrip` view; `ConnectSheet` → `requestConnection` (from a scanned/entered id — display-only per the QR decision, so this is likely triggered by the *other* person's QR-decode elsewhere, or a manual "enter code" fallback — confirm exact entry point during implementation since QR is display-only, not scan); `FriendsActivityFeed` → `getConnectionCount()` (≥3 unlocks) → `fetchFriendsActivity(oneMonthAgoISO)`, rendered as a scrollable list grouped by day (reuse `HistoryTab`'s day-grouping pattern).
4. Geofence check (Phase 1's `HomeTab` check-in gate) already works off existing columns — confirm end-to-end here.

## Verification

- `npx tsc --noEmit` clean after each phase.
- Dev server (`npm run dev`) + Browser pane click-through after Phase 1: Home banner scroll, check-in (in-range and out-of-range cases), History panel list→detail→reconnect-message send, Rewards panel, header→Profile, TabBar Map/Home/Messages.
- After Phase 2: user runs the SQL migration manually in Supabase SQL editor (QA project), confirm tables + RLS via Table Editor.
- After Phase 3: click-through Peek (from a second test account or by directly checking DB rows since a single manual tester can't easily be "checked in" and "peeking" simultaneously), Connect QR display, Friends Activity locked-state below 3 connections and unlocked above (may need to manually insert accepted `connections` rows for a QA account to test the unlock, since organically reaching 3 connections isn't practical in testing).

### Critical files
- `lib/theme.ts`, `lib/store.ts`, `lib/types.ts`, `lib/data.ts`
- `app/main/page.tsx`, `components/TabBar.tsx`, `components/AppHeader.tsx` (new)
- `components/tabs/HomeTab.tsx` (new, replaces `MainFeedTab.tsx`)
- `components/home/*.tsx` (new: QuickAccessRow, NearbyBanner, HistoryPanel, RewardsPanel, CheckedInHero, ConnectSheet, FriendsActivityFeed)
- `components/shared/AttendeeStrip.tsx`, `components/shared/InlineMessageComposer.tsx` (new, extracted from `HistoryTab.tsx`)
- `supabase/migrations/0001_connections_and_peeks.sql` (new)
