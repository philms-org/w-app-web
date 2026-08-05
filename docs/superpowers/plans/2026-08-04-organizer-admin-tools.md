# Organizer Tools + Master Admin — Event-Readiness Build

## STATUS (2026-08-04): ALL PHASES (0-6) DONE, COMMITTED, PUSHED.

Remaining before this is live: user must run
`supabase/migrations/0001_organizer_admin_rbac.sql` in the Supabase SQL editor
(paste-and-run, not automated typing), create a `banners` Storage bucket
(public read, mirroring `avatars`), and manually flip `is_master_admin = true`
on a W-staff test account to verify the admin panel. Known gaps: group
messages/conversations have no `location_id`, so they can't be attributed to
a venue in the report (shown as an explicit note, not a fake zero); a
`connections`→`friendships` relationship was never confirmed, so the report
shows two honest separate counts instead of one combined "connections
formed" figure.


## Context

The app needs to be ready to hand to real event organizers. This covers: verification/designation tags organizers can assign to attendees (e.g. "DJ"), an editable clickable photo carousel for organizers ("banners"), attendee groups + organizer-to-group messaging, a master-admin (W staff) tier above organizer, and an organizer-facing report. Auto geofence check-in is explicitly deferred — not part of this build.

Two Explore agents (iOS legacy repo + current w-app-web repo) already confirmed the real schema and what's reusable vs. greenfield, so this plan is schema-accurate, not guesswork (lesson learned from the earlier connections/peeks pause this session, where assuming schema from repo-code-only led to a wrong design).

**Confirmed decisions:**
- Master-admin gating: new `profiles.is_master_admin boolean default false` column (simplest, mirrors how organizer status already works via `Venue.owner_id`).
- Report v1 covers all 4 proposed metrics: attendance & peak times, tag/role breakdown, connections formed, engagement (posts + group messages).
- Carousel uses the existing `banners` table (has a `link` column, matching the "clickable" requirement) — not `venue_photos` (no link field).
- Banner cap: 5 per venue (matches iOS), enforced client-side only (cheap to change later).

## Reusable primitives (already built — do not rebuild)

- `Venue.owner_id` (`lib/types.ts:47`) — organizer-owns-a-location, already used in `lib/data.ts:50,84,98` (`fetchMyVenue`, etc.).
- `startConversation(recipientIds, name, isGroup, firstMessage)` (`lib/data.ts:392-397`) — already fully supports creating named groups. Groups need new UI only, no backend work.
- `components/shared/AttendeeStrip.tsx` + `components/home/CheckedInHero.tsx` — already list attendees at a venue via `fetchPresence`/`fetchAttendeeHistory`; this is where organizer affordances (tag, group-create) attach.

## Live tables that exist but are currently unused by this repo (confirmed via grep — zero references)

- `verification_tags` (`id, user_id, location_id, tag text, assigned_by, assigned_at`) — **no RLS exists on it at all yet**.
- `banners` (`image_url, location_id, link, display_order, is_active`) — RLS currently select-only, no write path for anyone.
- `venue_photos`, `profile_field_definitions`, `profile_field_values`, `feature_flags`/`feature_flag_overrides`/`feature_unlocks` — exist, out of scope for this build (no clear fit).

`Profile.role` (`lib/types.ts:13`) is a free-text job-title field, NOT an auth role — do not repurpose it.

## Phase 0 — RBAC foundation (blocking prerequisite)

New file `supabase/migrations/0001_organizer_admin_rbac.sql` (repo has no `supabase/` dir yet — create it; user applies manually in the Supabase SQL editor, same pattern as before — **this time, hand the SQL to the user to paste themselves, do not attempt to type it into the Monaco editor via browser automation again**):

```sql
alter table profiles add column if not exists is_master_admin boolean not null default false;

create policy if not exists verification_tags_select on verification_tags for select using (true);
create policy if not exists verification_tags_write on verification_tags
  for insert, update, delete
  using (
    exists (select 1 from locations l where l.id = location_id and l.owner_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_master_admin)
  );

create policy if not exists banners_write on banners
  for insert, update, delete
  using (
    exists (select 1 from locations l where l.id = location_id and l.owner_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_master_admin)
  );
```

Client: extend `lib/store.ts`'s `User` with `isMasterAdmin?: boolean` (populated at login from `profiles.is_master_admin`). Add `lib/hooks/useIsOrganizer.ts(locationId)` comparing `fetchMyVenue()`/`venue.owner_id === user.id`, exposing `{ isOrganizer, isMasterAdmin, canManage }` for UI gating. RLS is the real enforcement; the hook only controls what renders.

**Checkpoint:** app builds/runs unchanged; new column defaults false; `npx tsc --noEmit` clean.

## Phase 1 — Verification tags

- `lib/types.ts`: `VerificationTag { id, user_id, location_id, tag, assigned_by, assigned_at, profiles?: Profile }`.
- `lib/data.ts`: `fetchVerificationTags(locationId)`, `assignVerificationTag(userId, locationId, tag)`, `removeVerificationTag(tagId)`.
- `components/shared/AttendeeStrip.tsx`: optional `tagsByUserId: Map<string, VerificationTag[]>` prop, renders a small text chip under each avatar (visible to everyone). Add an organizer-only "+ tag" affordance (free-text input popover), gated by `useIsOrganizer`, wired from `components/home/CheckedInHero.tsx`.

**Checkpoint:** organizer can tag/untag attendees at their own venue; tags render publicly read-only for everyone else.

## Phase 2 — Editable clickable carousel (banners)

- `lib/types.ts`: `Banner { id, image_url, location_id, link, display_order, is_active }`.
- `lib/data.ts`: `fetchBanners(locationId)`, `createBanner(locationId, imageUrl, link)`, `updateBanner(id, fields)`, `deleteBanner(id)`, `uploadBannerImage(file, locationId)` (mirror `uploadAvatar`'s storage pattern).
- `components/HeroCarousel.tsx`: add optional `links?: (string | null)[]` prop — wrap each slide in a click target calling `window.open(link, '_blank', 'noopener,noreferrer')` when present. Optional prop keeps existing call sites (`HistoryTab.tsx`, `CheckedInHero.tsx`) unchanged.
- New organizer screen `app/main/venue/carousel/page.tsx`: upload, up/down reorder buttons (skip drag-and-drop, not worth the library for the deadline), per-slide link field, active toggle, add/remove capped at 5.

**Checkpoint:** organizer manages their venue's banners; carousel reflects live/active banners and opens links in a new tab; zero-banner venues keep the existing gradient fallback.

## Phase 3 — Groups + organizer messaging

No backend work — `startConversation` already handles this fully. New UI only:
- `components/organizer/CreateGroupModal.tsx`: multi-select attendees (extend `AttendeeStrip`'s selection to multi-select mode), name input, first-message input, calls `startConversation(ids, name, true, firstMessage)`.
- Entry point in `CheckedInHero.tsx`, gated the same way as Phase 1's tag button.

**Checkpoint:** organizer creates a named group from their attendee list; existing Messages tab sends/receives into it with zero code changes (verify by smoke test, don't touch messaging code).

## Phase 4 — Master admin panel (v1, intentionally minimal)

- `app/admin/layout.tsx`: redirect-gate on `user.isMasterAdmin`.
- `app/admin/page.tsx`: list all venues (`fetchVenues()`) + their organizer (`owner_id` → profile).
- Reuse Phase 1/2's tag and banner UI, parameterized by a venue picker instead of `fetchMyVenue()`, so master admin can manage any venue's tags/banners.
- Explicitly NOT in v1: audit logs, a role-granting UI (stays a manual DB update), bulk actions — the report lives in Phase 6, not here.

**Checkpoint:** flagged master-admin reaches `/admin`, manages any venue's banners/tags; everyone else redirected.

## Phase 5 — Welcome/instructions content (low-risk, slot in anytime)

Static content, no schema — a first-run screen/modal (likely under the existing `app/welcome/`) explaining organizer features to organizers on first post-launch login. Independent of every other phase.

## Phase 6 — Organizer report (all 4 confirmed metrics)

New `lib/data.ts` aggregate queries + a new organizer-facing report screen (`app/main/venue/report/page.tsx`), each metric as its own stat-tile/section:
1. **Attendance & peak times** — `location_checkins` check-in/out timestamps → turnout trend + busiest moment.
2. **Tag/role breakdown** — `verification_tags` grouped by `tag` → roster composition at a glance.
3. **Connections formed** — `friendships` (and/or `connections`/`peek_invites` events) created during the event window.
4. **Engagement** — `feed_posts` volume + group messages sent (via `conversations`/`conversation_participants`/`messages` scoped to groups created at this venue).

Depends only on Phase 0 (RBAC, to gate the report to the organizer/master-admin) — can be built any time after that.

## Sequencing

Phase 0 → {Phase 1, Phase 2} in parallel → Phase 3 (independent of 1/2) → Phase 4 (reuses 1/2's UI) → Phase 5 (anytime) → Phase 6 (needs only Phase 0).

## Verification

- `npx tsc --noEmit` clean after each phase.
- Dev server + Browser pane click-through after each checkpoint above.
- Schema changes: user runs the migration SQL manually in the Supabase SQL editor (paste-and-run only — no automated typing into the editor, per this session's earlier incident where Monaco's autocomplete corrupted an in-progress paste).
- Cross-role smoke test: verify an organizer sees their own venue's manage affordances, a non-organizer attendee does not, and (once `is_master_admin` is manually flipped on a test account) the master admin can reach any venue.

### Critical files
- `lib/data.ts`, `lib/types.ts`, `lib/store.ts`
- `components/HeroCarousel.tsx`, `components/shared/AttendeeStrip.tsx`, `components/home/CheckedInHero.tsx`
- New: `lib/hooks/useIsOrganizer.ts`, `components/organizer/CreateGroupModal.tsx`, `app/main/venue/carousel/page.tsx`, `app/main/venue/report/page.tsx`, `app/admin/layout.tsx`, `app/admin/page.tsx`
- `supabase/migrations/0001_organizer_admin_rbac.sql` (new)
