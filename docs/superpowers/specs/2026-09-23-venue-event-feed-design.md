# Venue Event Feed — Design

**Date:** 2026-09-23
**Status:** Approved (founder reviewed against `w app design.pdf` / `Feed v2 (Wing in history).pdf`, 2026-09-23)
**Repo:** `/Users/sr/w-app-web`

## Background

`design-system.md` §7 already documents checked-in Home as "venue + live connections
+ quick-access row + **venue feed**" — the venue feed itself was never built. Today,
`CheckedInHero`'s "Connections" card only shows `AttendeeStrip`, a horizontal
avatar scroller with name + verification tags — no posts, no likes, no age/city/
nationality/role.

The founder's design PDFs (not previously in the repo; supplied 2026-09-23) show a
richer, Twitter-like mechanic: anyone checked in can post a short update; posts show
the author's photo/name/verified badge/nationality/looking-for status/age/city; posts
can be liked and replied to; people present but not posting still show at the bottom
of the same list. This spec covers that core mechanic only. Deliberately deferred:
Photo Booth, History tab, Jukebox, an Announcements banner, and full-bleed venue
chrome — all visible in the design PDFs but out of scope for this pass.

**Goal:** A checked-in user opens Home and sees, in one scrollable list under the
venue's photo carousel: posts from other checked-in people (newest first, richly
attributed), then everyone else currently present who hasn't posted. They can post,
like, reply (which opens a message thread with that person, same as today's
reconnect flow), and filter the list by looking-for category.

## Scope

1. `profiles.date_of_birth` column — collected today at signup (`register/page.tsx`'s
   `birthDate` field) but never persisted. Persist it going forward from both the
   register form and (already-built) `ProfileFieldsList`. Age is always displayed as
   a computed number; the raw date is never rendered client-side.
2. `venue_posts` table — one row per post. Insert and select both require the actor
   to be currently checked in at that venue (`location_checkins` row for that
   `location_id`, `checked_out_at is null`) — the same trust boundary the existing
   venue group chat (migration `0008`) already uses for its messages. No new
   cross-venue exposure.
3. `post_likes` table — one row per (post, user) pair, same checked-in-there RLS,
   toggled on tap.
4. A merged feed component (replacing `AttendeeStrip`'s mount inside
   `CheckedInHero`, `AttendeeStrip` itself untouched for `HistoryTab`'s unrelated use):
   - Rows with a post: avatar, name, verified badge, nationality flag, looking-for
     icon(s) (❤️ dating / 💼 networking / 🤝 socialising — existing `dating_id`/
     `networking_id`/`socialising_id` fields, nonzero = opted in), age, city, the
     post body, a reply arrow, a like heart + count.
   - Rows without a post (present, silent): a lighter row — avatar, name, tap to
     view/reconnect, same behavior `AttendeeStrip` already has today.
   - Posts sort newest-first at the top; silent-presence rows follow at the bottom.
5. A composer ("What's up?" bar, your avatar + text input) pinned below the list;
   submitting inserts a `venue_posts` row and the new post appears at the top.
6. Reply reuses the existing `InlineMessageComposer` / `startConversation()` flow
   already wired to `AttendeeStrip` — no new messaging mechanism.
7. Filter chips (All / Dating / Networking / Socialising) under `HeroCarousel`,
   filtering rows to people who opted into that category.
8. Locked gate: reuse the `LockedOverlay` primitive (already built in P1) instead of
   `FriendsActivityFeed`'s bespoke blur/lock JSX. Same gate condition
   (`REQUIRED_CONNECTIONS = 3`, already fetched via `fetchMyConnectionCount()`) wraps
   this new feed. Refactor `FriendsActivityFeed` to use the same primitive instead of
   its hand-rolled `rgba(...)` overlay, fixing that pre-existing inconsistency.

**Explicitly out of scope (deferred):**
- Photo Booth, Jukebox, History tab within the venue screen, Announcements banner,
  full-bleed venue chrome — all shown in the design PDFs, none built here.
- Any RLS change to `profiles` itself (the pre-existing world-readable-to-any-
  authenticated-session policy flagged in PR #1 review) — `date_of_birth` inherits
  that same exposure; mitigated only by never rendering the raw value, per Scope §1.
  A real fix is a separate, already-tracked decision (see memory
  `guest_first_onboarding_pr1_2026-09-21.md`).
- Reworking `startConversation`/messaging — reused as-is.
- A full-bleed dedicated venue screen (the design's "tap the venue name" destination)
  — this pass only builds the feed inline in `CheckedInHero`, matching what
  `design-system.md` already scoped as "venue feed" on checked-in Home.

## Data model

```sql
alter table profiles add column if not exists date_of_birth date;

create table if not exists venue_posts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id),
  author_id uuid not null references profiles(id),
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);
create index if not exists venue_posts_location_recent
  on venue_posts (location_id, created_at desc);

create table if not exists post_likes (
  post_id uuid not null references venue_posts(id) on delete cascade,
  user_id uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
```

RLS (both tables, `to authenticated`): insert `with check` and select `using` both
require
`exists (select 1 from location_checkins lc where lc.user_id = auth.uid() and lc.location_id = <table>.location_id and lc.checked_out_at is null)`
— for `post_likes`, join through `venue_posts` to get `location_id`. This mirrors
migration `0008`'s existing pattern exactly (`is_venue_manager`-style helper checks),
so no new class of policy is introduced.

## Components

**New:**
- `components/home/VenueFeed.tsx` — the merged posts+presence list, mounted in
  `CheckedInHero` in place of the current `AttendeeStrip` card body.
- `components/home/VenueFeedRow.tsx` — one row, two variants (post / presence-only).
- `components/home/VenueFeedComposer.tsx` — the "What's up?" input bar.
- `components/home/VenueFeedFilters.tsx` — the filter-chip row.

**Modified:**
- `components/home/CheckedInHero.tsx` — mounts the above instead of bare
  `AttendeeStrip`; keeps `AttendeeStrip`'s existing attendee-fetch logic as the
  presence-rows data source (no duplicate query).
- `components/home/FriendsActivityFeed.tsx` — swap its hand-rolled lock UI for
  `LockedOverlay`.
- `components/ui/primitives.tsx` — no changes expected (`LockedOverlay` already
  supports this); confirm at build time.
- `lib/data.ts` — add `fetchVenuePosts`, `createVenuePost`, `toggleLike` (mirroring
  existing query/mutation style in this file), and persist `date_of_birth` in the
  register flow's `upsertProfile` call and in `ProfileFieldsList`'s patch.
- `lib/types.ts` — add `date_of_birth` to `Profile`, add `VenuePost` type.
- `app/auth/register/page.tsx` — include `birthDate` in the `upsertProfile` call
  (currently dropped).
- `components/onboarding/types.ts` — extend `OnboardingData`/`dataToProfilePatch`
  for date of birth if not already collected there (check at build time; the 5-step
  wizard's field list needs confirming against current `StepLocation`/etc).

**Unchanged:** `AttendeeStrip` (still used by `HistoryTab`), `InlineMessageComposer`,
`startConversation`, `CreateGroupModal`, `HeroCarousel`.

## Testing

No test runner in this repo — verification is `npx tsc --noEmit` + `npm run build`
+ `npm run lint`, plus manual QA once migrations run locally (`supabase start`,
apply the two new tables, verify RLS with two local test accounts checked into the
same venue vs. different venues).
