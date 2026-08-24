# Owner Benefits — Venue Members, Group Chat, Admin + Rewards (Implementation Plan)

## STATUS (2026-08-24): PROPOSED — nothing built yet. This is a review doc for
the founder to approve/redirect before any code lands. Research-only pass;
no migrations, no app code, no commits.

## Context

The founder described the next track loosely as organizer "owner benefits" —
"venue → members → group chat + admin/rewards" — with no further spec. This
doc is not a guess: it was written after reading the actual current code (the
2026-08-04 organizer/admin build, the governance + multi-venue commits that
followed it, and the shared Supabase schema, including the iOS repo's
migrations 001-019, since both apps sit on one backend). The goal is to name
what already exists, what's genuinely missing, and give the founder 2-3
concrete "rewards" options to pick from rather than building the wrong thing
against a vague brief.

## What already exists — do not rebuild any of this

- **RBAC foundation** (`supabase/migrations/0001_organizer_admin_rbac.sql`):
  `profiles.is_master_admin` (global), `locations.owner_id` (primary organizer),
  `location_managers` table (co-owners — same organizer-level access as
  owner_id via the `is_venue_manager(location_id, user_id)` SQL helper).
  Client-side gating via `lib/hooks/useIsOrganizer.ts` → `{ isOrganizer,
  isMasterAdmin, canManage }`. RLS is the real enforcement everywhere.
- **Verification tags** — organizer-assignable per-attendee labels with an
  icon (`verification_tags`, `components/shared/AttendeeStrip.tsx`).
- **Banners/carousel** — organizer-editable clickable photo carousel
  (`app/main/venue/carousel/page.tsx`, `Banner` type, `banners` storage bucket).
- **Organizer group creation** (`components/organizer/CreateGroupModal.tsx`)
  — ad-hoc, snapshot-based: organizer multi-selects currently-checked-in
  attendees and calls `startConversation(...)`. Plus "Message Everyone Live"
  in `CheckedInHero.tsx` — same mechanism, auto-selects everyone presently
  checked in. **Both are one-off snapshots, not a persistent venue roster or
  chat** — there is no ongoing "venue members" list anywhere today.
- **Master-admin panel** (`app/admin/page.tsx`) — venues list, cross-venue
  carousel/tag management, governance UI: grant/revoke master admin, assign/
  remove venue organizer, create venue (all via `set_master_admin`/
  `assign_venue_owner` SECURITY DEFINER RPCs).
- **Multi-venue + co-owners + badges + broadcast** (`df4b7ba`) —
  `fetchMyVenues()` + `VenueSwitcher.tsx` for organizers managing several
  venues; `location_managers` co-owner add/remove; `verification_tags.icon`.
- **Organizer report** (`app/main/venue/report/page.tsx`) — attendance/peak
  times, tag breakdown, connections formed, engagement. **Known, documented
  gap**: `groupsCreated`/`groupMessagesSent` are hardcoded to 0 in
  `lib/data.ts` (`fetchEngagementStats`) because `conversations` /
  `conversation_participants` carry no `location_id` — a group can't be
  attributed to the venue it was created from. This plan's schema change
  (below) closes that gap as a side effect.
- **`rewards` table** (already live, unused for writes) — `location_id,
  name, icon_type, deal_text, instructions, qr_path, is_active,
  display_order, feature_name, created_by`. Web has `RewardsPanel.tsx` /
  `fetchRewards(locationId)` (read-only, member-facing). iOS has an
  equivalent read-only `RewardsVC`/`WAPRewardsVC`. **No create/edit/redeem
  UI exists anywhere, on either platform** — `created_by` is populated by
  nothing today, and `feature_name` links to `feature_unlocks`, an unrelated
  app-feature-unlock-by-points system, not a reward-redemption mechanism.
- **`location_checkins`** — full historical per-user, per-venue check-in/
  check-out timestamps already exist and already power
  `fetchAttendeeHistory(locationId)` (used by `HistoryTab`'s "Who was
  there"). This is real, already-queryable attendance data — no new
  tracking needed for attendance-based logic.
- **Group chat roles, already live in the shared Supabase schema but wired
  into ZERO ui on either app** (`w-app-ios/database/migrations/018_group_chat_conversion.sql`,
  applies to the one shared backend, so web sees it too):
  - `conversation_participants.role` (`admin` | `member`, default `member`).
  - `is_conversation_admin(conversation_id)` SQL helper.
  - `join_requests` table: pending/approved/denied, 3-attempt cap per
    (conversation, user), admin-only approve/deny via RLS.
  - A trigger blocking demotion of the last remaining admin.
  - RLS lets admins insert/update/delete participant rows (approve joins,
    change roles, remove members) — none of this is called anywhere; web's
    `CreateGroupModal`/`startConversation` inserts everyone directly with no
    role at all, and there is no admin/kick/approve UI on either platform.

This is the single biggest reusable asset for this track: the exact
primitive a "venue owner manages their members in a group chat" feature
needs — admin/member roles, join approval, last-admin protection — is
already schema-complete and battle-tested by migration, just never
consumed by any screen.

## The actual gap (what "owner benefits" needs that doesn't exist yet)

1. No persistent venue "members" concept — only ephemeral present-attendee
   snapshots.
2. No way to attribute a conversation/group to a venue (`location_id`
   missing on `conversations`).
3. The role/join-request infrastructure above is unused by any UI.
4. No reward create/edit/redeem UI, on either platform.
5. No attendance-tiering or redemption-tracking logic of any kind.

## Rewards: term is vague — 3 concrete, buildable interpretations

**1. Attendance-tier badges (recommended first build).** Compute a tier per
user per venue purely from existing `location_checkins` rows (e.g. Regular
at 3 visits, Regular+ at 10, VIP at 25 — thresholds organizer-configurable
per venue). Organizer effort is limited to writing tier copy/rewards; no new
redemption workflow, no scanning, no new write-heavy surface. Cheapest to
ship because it needs zero new operational process — just a read model over
data that already exists.

**2. Organizer-managed reward catalog + redemption log.** Give organizers
full CRUD over the existing `rewards` table (name, deal text, instructions,
active flag, display order — the columns are already there, just no write
path), plus a new `reward_redemptions` table (`reward_id, user_id,
redeemed_at, redeemed_by` — staff taps "mark redeemed" or member self-taps
"I'm redeeming this now") so the organizer report can show real redemption
counts. This is the most literal reading of "member rewards" and completes
the loop the schema's unused `created_by` column already implies was
planned — but it's the most net-new schema + UI of the three.

**3. Discount/comp codes.** Organizer generates a code (single-use or
reusable) tied to a reward; member sees the code + redemption instructions
in the app; organizer report shows how many codes were issued/used. Sits
between #1 and #2 in effort — no scanning hardware needed — but still
introduces a redemption flow that doesn't exist today.

**Recommendation:** build #1 first (attendance tiers — reuses 100% existing
data, zero new redemption process), then treat #2's CRUD as the natural
phase-2 rewards build (it's the one that actually finishes what the schema
was clearly set up for via `rewards.created_by`). Treat #3 as a later/
stretch option — it needs an operational redemption flow with no existing
analog on either platform, so it should wait until #1/#2 prove out demand.

## Proposed data model additions

- `conversations`: add `location_id uuid references locations(id)`
  (nullable — existing DMs/ad-hoc groups keep it null). A conversation with
  `location_id` set and `is_group = true` is "the venue's group chat."
  Additive-only migration; no backfill needed since nothing currently
  attributes groups to venues.
- One persistent "venue chat" conversation per location: created lazily
  (first time an organizer opens the venue chat, or eagerly on venue
  creation — founder's call, see open questions) with the organizer seeded
  as `conversation_participants.role = 'admin'`. Members join through the
  **already-existing** `join_requests` flow (3-attempt cap, organizer
  approve/deny already enforced by 018's RLS/trigger) — no new backend
  logic required, only UI that calls it.
- Rewards interpretation #1 (attendance tiers): either a small new
  `reward_tiers` table (`location_id, tier_name, min_checkins, reward_id`)
  or a `min_checkins` column directly on `rewards` if tiers map 1:1 to
  individual reward rows — simplest is a nullable `rewards.min_checkins int`
  column: a reward with `min_checkins = 10` is "visible/unlocked" once the
  member's check-in count at that venue reaches 10.
- Rewards interpretation #2 (if chosen instead/also): new
  `reward_redemptions` table as described above, plus RLS mirroring the
  `verification_tags`/`banners` pattern (`is_venue_manager` write access,
  public/member read of their own redemptions).
- No changes needed to `location_managers`, `verification_tags`, or the
  governance RPCs — all directly reusable as-is.

## UI surfaces needed

**Web:**
- New "Members" screen/tab for a venue — roster of everyone who has ever
  checked in (built on the existing `fetchAttendeeHistory`-style query,
  de-duplicated to one row per person rather than per-visit), showing tags
  and (once built) reward tier. Organizer-only entry point, same gating
  pattern as carousel/tags/report (`useIsOrganizer`).
- A persistent "Venue Chat" surface distinct from the existing ad-hoc
  `CreateGroupModal`/"Message Everyone Live": wraps the same
  `startConversation`/messaging code paths but sets `location_id` and seeds
  the organizer as `role = 'admin'`; surfaces join requests to the organizer
  for approve/deny (first real consumer of the 018 role/join_request
  schema). The ad-hoc create-group flow stays for one-off subsets — the two
  are complementary, not a replacement.
- New organizer reward-management screen, mirroring the carousel
  management page's pattern (`app/main/venue/rewards/page.tsx`): create/
  edit/reorder/activate rewards for the organizer's venue(s), reusing
  `VenueSwitcher` for multi-venue organizers.
- Update `fetchEngagementStats` in `lib/data.ts` to compute real
  `groupsCreated`/`groupMessagesSent` once `conversations.location_id`
  exists, replacing the hardcoded 0s (report already has the UI for this,
  just needs real numbers).

**iOS:**
- Equivalent Members/roster screen.
- Venue-chat variant of `GroupChatVC` (or a new `VenueChatVC`) that
  surfaces admin/member role (e.g. an "Admin" badge) and an organizer-side
  join-request approve/deny list — again, the first UI anywhere to consume
  the already-migrated role/join_request schema.
- Reward management screen analogous to the existing read-only
  `RewardsVC`/`WAPRewardsVC`, made organizer-editable.

## Suggested build order

- **Phase 0 — Schema.** Add `conversations.location_id` (new additive
  migration, e.g. `supabase/migrations/0008_venue_group_chat.sql`). Decide
  and document the one-venue-chat-per-location model (lazy vs. eager
  creation — see open questions). No app code yet.
- **Phase 1 — Members roster (web).** Read-only per-venue member list off
  existing attendee-history data. Low risk, independent of every other
  phase, can ship first.
- **Phase 2 — Venue group chat (web).** Persistent per-venue chat using
  `location_id` + the existing role/join_request infrastructure; organizer
  auto-admin; join-request approve/deny UI. Depends on Phase 0.
- **Phase 3 — Reward management CRUD (web).** Organizer create/edit/reorder
  over the existing `rewards` table, reusing the carousel-management UI
  pattern. Independent of Phases 0-2 — can be built in parallel.
- **Phase 4 — Attendance-tier badges (rewards interpretation #1).** Compute
  tiers off `location_checkins`; surface in `RewardsPanel` and the Members
  roster. Depends only on Phase 3's rewards CRUD existing (to let organizers
  set `min_checkins` per reward) — otherwise independent.
- **Phase 5 — iOS parity.** Members roster + venue chat (this is where the
  017-019-era role/join_request migrations get their first live UI on
  either platform) + reward management screen, mirroring whatever the web
  build validates. Follows the repo's established pattern of building web
  first as the design proof, then porting to iOS.
- **Phase 6 — Organizer report update.** Wire real `groupsCreated`/
  `groupMessagesSent` numbers now that `location_id` exists; add
  redemption-count stats if interpretation #2 or #3 is later approved.

## Sequencing

Phase 0 blocks Phase 2 and Phase 6. Phase 1 and Phase 3 are independent and
can run in parallel with each other and with Phase 0. Phase 4 depends on
Phase 3. Phase 5 should wait until Phases 1-3 are validated on web (repo
convention: web first, iOS mirrors once the design is proven). Phase 6 is
last since it depends on Phase 0/2's data existing to report on.

## Open questions for the founder

1. **Auto-join vs. opt-in.** Should checking in to a venue auto-add someone
   to that venue's group chat, or should joining require an explicit
   request (using the existing `join_requests` approve/deny flow)? Affects
   spam/privacy expectations and how "instant" the chat feels.
2. **Which rewards interpretation to build first** — this plan recommends
   #1 (attendance tiers), but confirm before Phase 3/4 start.
3. **Do co-owners (`location_managers`) get venue-chat admin automatically**,
   consistent with how they already get full organizer access everywhere
   else (tags, banners, report)? Recommend yes, for consistency.
4. **Retention** — once someone joins a venue's roster/chat, is membership
   permanent, or does it expire/get pruned (e.g. no check-in in N months)?
   No existing analog in the codebase answers this either way.

## Critical files (for whoever builds this)

- `supabase/migrations/0001_organizer_admin_rbac.sql` — RBAC pattern to
  follow for any new RLS.
- `w-app-ios/database/migrations/018_group_chat_conversion.sql` — the
  role/join_request schema this plan reuses; read this in full before
  writing Phase 2's UI.
- `lib/data.ts` — `startConversation`, `fetchConversations`,
  `fetchGroupMembers`, `fetchAttendeeHistory`, `fetchRewards`,
  `fetchEngagementStats` (has the groupsCreated/groupMessagesSent TODO-by-
  comment gap this plan closes).
- `lib/types.ts` — `Conversation`, `Reward`, `EngagementStats`.
- `lib/hooks/useIsOrganizer.ts` — gating pattern for every new organizer
  screen.
- `components/organizer/CreateGroupModal.tsx`, `components/home/
  CheckedInHero.tsx` — existing ad-hoc group/broadcast flows that Phase 2's
  persistent venue chat complements rather than replaces.
- `app/main/venue/carousel/page.tsx`, `app/main/venue/report/page.tsx`,
  `app/admin/page.tsx` — UI patterns (organizer screen structure,
  `VenueSwitcher` usage, master-admin cross-venue management) to mirror for
  the new Members and Rewards screens.
- `components/home/RewardsPanel.tsx` — current read-only member-facing
  rewards UI that Phase 3/4 builds an organizer-facing counterpart for.
- `docs/superpowers/plans/2026-08-04-organizer-admin-tools.md` — prior
  plan this one builds directly on top of; same phased-doc style used here.
