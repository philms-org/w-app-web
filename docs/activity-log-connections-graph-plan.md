# Connections graph / QR / friends-feed — planning activity log

**Status:** DONE — spec + 2 plans written, awaiting founder review

## Exploration findings

### Environment note
The agent worktree started at `a951bf0`, ~25 commits behind `main` (`5d7229b`). Since the
worktree was clean and `HEAD` was a strict ancestor of `main`, it was fast-forwarded
(`git merge --ff-only main`) so all exploration reflects the **real current state**. The docs
the task referenced (`docs/RESUME-launch-prep.md`, the Round 1 spec/plan, the realtime plan)
only exist post-fast-forward.

### The audit's framing needs one correction
The report figures are **not hardcoded zeros**. `fetchConnectionsFormed()`
(`lib/data.ts:1178`) issues real `count` queries against `connections` and `peek_invites`.
They read 0 because **nothing has ever written a row to either table** — confirmed by live
row counts below. This means the report needs *no code change at all*; it starts working the
moment the write path exists. That materially shrinks the plan.

### Live QA schema (project `ducadjakxmkfcvrteoqz`, queried directly via Supabase CLI)
All three tables already exist. **No new tables are needed.** This confirms the 2026-08-04
paused plan's finding (commit `d71d848`, which deleted an invented
`0001_connections_and_peeks.sql`).

| table | columns |
|---|---|
| `connections` | `id`, `scanner_id`, `scannee_id`, `location_id`, `scanned_at`, `contact_method_type` |
| `friendships` | `id`, `user_id`, `friend_id`, `connected_at`, `source` |
| `peek_invites` | `id`, `sender_id`, `peeker_id`, `location_id`, `sent_at`, `accepted_at` |

Constraints:
- `friendships` **UNIQUE (user_id, friend_id)** — one row per ordered pair.
- `friendships.source` CHECK — **`qr_scan` | `peek_invite` | `message`** (provenance is
  already designed for exactly this feature).
- `connections` has **no unique constraint** → duplicate scans are possible; idempotency must
  be handled explicitly.
- `connections.location_id` FK lacks `ON DELETE CASCADE` (the other FKs have it).

**Row counts (QA): `connections` = 0, `peek_invites` = 0, `friendships` = 2.**
Effectively greenfield — no backfill or migration-of-existing-data concerns.

### THE ACTUAL BLOCKER: the tables are write-locked
RLS is enabled on all three, but:
- `connections` has exactly **one** policy: `connections_select_organizer`
  (`is_venue_manager(location_id, auth.uid())`). **No INSERT policy → no client can create a
  connection.** Participants cannot even read their own scan rows.
- `friendships` has exactly **one** policy: `friendships_select`
  (`user_id = auth.uid() OR friend_id = auth.uid()`). **No INSERT policy → no client can
  create a friendship.**
- `peek_invites` is the only one that is actually writable (4 policies incl. `peeks_insert`
  and `peeks_update`).

So the "unresolved connections graph" is **not a missing-schema problem — it is a missing
write-path (RLS + RPC) problem.** That reframing is the single most important finding here.

### Directionality inconsistency (latent bug to design around)
- `startConversation()` (`lib/data.ts:826`) reads friendships **one-directionally**:
  `.eq('user_id', uid).in('friend_id', recipientIds)`.
- `is_friend_sharing(target_user_id)` (SECURITY DEFINER, live in DB, not in any migration
  file — an iOS-era function) reads them **bidirectionally** (checks both orderings).

Two consumers disagree about whether a friendship is one row or two. Any write path must
resolve this deliberately or `startConversation` will mis-mark DMs as `pending`.

### Privacy plumbing already exists
`profiles` has `share_checkins_with_friends` (**default false**) and `share_checkin_history`
(default false), plus per-field `*_visible` flags. `is_friend_sharing()` already combines the
flag with a bidirectional friendship check — this is precisely the gate a friends-activity
feed needs, and it already exists. `location_checkins` SELECT policy is `true`
(readable by any authenticated user), so the feed needs no new read policy — the privacy
gate has to be applied deliberately in the query, not inherited from RLS.

### Client-side current state
- `components/home/ConnectSheet.tsx` — static `QrCode` lucide icon, no QR library;
  "Share my code" is `console.log`. No scan surface exists anywhere.
- `components/home/FriendsActivityFeed.tsx` — pure presentational locked state, hardcoded
  `0 / 3 connections`. No props, no fetch, no gate.
- `package.json` — **no QR generation or scanning dependency** of any kind.
- `contact_methods` table + `fetchContactMethods`/`upsertContactMethod` exist in
  `lib/data.ts:350-362` with sane RLS (backend exists, no UI) — confirms the audit.
- `record_contact_method_choice(p_connection_id, p_type)` SECURITY DEFINER RPC is live
  (migration 0015) and takes a **connection id** — it is already the correct post-scan hook
  and needs no change.
- No `app/main/` route exists for scanning; routes follow `app/main/venue/<feature>/page.tsx`.

### Round 2 peek scope boundary (confirmed, not assumed)
`docs/superpowers/specs/2026-08-26-home-banner-feed-round1-design.md` explicitly defines
**Round 2 = mutual peek-back matching**, with its own spec, needing "new schema (who's
peeking what, who's visible to whom, match triggers) and a privacy/venue-visibility model."
The 2026-08-04 paused plan left the same question open (passive "who's peeking" state has no
home in `peek_invites`, which only models sender→peeker invites). **Round 2 is therefore
correctly out of scope for this plan** and is left to its own spec.

### Late exploration corrections (caught while writing the plans)

- **`next.config.ts:29` sets `Permissions-Policy: camera=()`** — the camera is hard-disabled on
  every route. Any QR scanner is dead on arrival until this becomes `camera=(self)`. Now an
  explicit step in Plan A Task 5.
- **`Profile` uses `display_name`, not `name`.** The store's `User` (`lib/store.ts:4`) is a
  *separate* camelCase session shape that does have `name` — which is why `ConnectSheet`'s
  existing `user?.name` compiles. Both plans were corrected after this was verified.
- **`Profile` does not declare `share_checkins_with_friends`** even though the column exists in
  Postgres. Plan B Task 3 adds it to the interface and seeds the toggle from `fetchProfile()`,
  not from the store.
- CSP needs no change: `img-src` already allows `data:`/`blob:`, and a `<video>` fed via
  `srcObject` is not subject to `media-src`.

## Key design decisions (brainstorming outputs)

Run unattended, so every ambiguous call was self-resolved and flagged in the spec's
"Decisions made without human input" section. The two that most need a founder yes/no:

1. **Single-opt-in — scanning creates the connection immediately, no accept step.** `friendships`
   has no status column, and adding one would re-invent the schema the paused 2026-08-04 plan
   warned against. Unwanted contact is already gated one layer down by
   `conversation_participants.status`, and `share_checkins_with_friends` defaults to false, so a
   new connection leaks nothing by default. *Alternative:* double opt-in request/accept, which
   needs a whole notification/inbox surface.
2. **Both parties must be checked in at the same venue to connect.** This is the most
   product-consequential decision in the spec — it means you cannot connect at the door, outside,
   or at a venue not in the app. Chosen because `profiles` is world-readable, so a bare user id in
   a QR payload is not a secret; without a co-presence check any authenticated user could
   enumerate ids and forge connections. Co-presence buys real forgery resistance for **zero new
   schema**. *Alternative:* signed rotating QR tokens (new table + secret rotation).
3. **Two `friendships` rows per connection.** Makes the one-directional reader
   (`startConversation`) and the bidirectional one (`is_friend_sharing`) both correct with zero
   changes to existing code. *Alternative:* one canonical row plus fixing every directional reader.
4. **Scan is idempotent per `(scanner, scannee, venue)`** so "QR Scans" means distinct people
   connected with at that venue, and the UI is safely retryable.
5. **`remove_connection` retains the `connections` event rows** — they are venue analytics already
   aggregated into past organizer reports.
6. **Writes go through SECURITY DEFINER RPCs, not INSERT policies.** RLS cannot write the reverse
   friendship row (`user_id <> auth.uid()`) without being permissive enough to allow forgery. This
   also matches the convention the repo already converged on in 0001 and 0015.
7. **Split into two plans**, because one plan spanning migration + camera + feed + privacy toggle
   would be too large to review.

## Deliverables produced

- `docs/superpowers/specs/2026-09-02-connections-graph-qr-connect-design.md` — design spec
- `docs/superpowers/plans/2026-09-02-connections-write-path-qr-connect.md` — Plan A, 7 tasks
- `docs/superpowers/plans/2026-09-02-friends-activity-feed-unlock.md` — Plan B, 3 tasks
- `docs/activity-log-connections-graph-plan.md` — this log

No application code was written or modified. Nothing under `app/`, `components/`, `lib/`, or
`supabase/migrations/` was touched.

## Scope notes

**Plan A (foundational, ships working software on its own):** migration 0018 (two SECURITY
DEFINER RPCs + participant SELECT policy), the `camera=(self)` fix, types + QR payload helpers +
data functions, real QR in `ConnectSheet`, camera scan route, post-scan contact-method chooser,
and organizer-report verification with an explicit founder gate before PROD.

**Plan B (depends on A):** `fetchFriendsActivity()` with the privacy filter, the real
3-connection gate, and the check-in-sharing opt-in toggle.

**Explicitly deferred:**
- **Round 2 Peek** — confirmed out of scope by reading the Round 1 spec, which defines Round 2 as
  mutual peek-back matching with its own spec, needing a peek-visibility model. The 2026-08-04
  plan left the same question open: `peek_invites` models only sender→peeker invites, with no home
  for passive "who is currently peeking" state. "Peek invites accepted" will therefore correctly
  stay at 0 after these plans.
- **Own-contact-methods settings UI** (`upsertContactMethod` exists, no UI). Only the *post-scan
  chooser* is in scope.
- **An unfriend button.** `remove_connection` ships in Plan A without a surface; a connections-list
  screen belongs to a follow-up.
- iOS/Android parity (`w-app-ios` is a separate repo).

**Notable finding that shrank the scope:** the two organizer-report figures need **no code
change**. `fetchConnectionsFormed()` already issues real count queries; they read 0 only because
the tables are empty. They become a verification step, not work.

## Next step for whoever picks this up

Spec + both plans are complete and internally consistent. **Blocked on a founder decision**, not on
more analysis: decisions 1 and 2 above (single-opt-in, and same-venue co-presence) both change
migration 0018 if reversed, so Plan A Task 7 gates PROD on them explicitly.

Once those are confirmed, Plan A is ready for execution via
`superpowers:subagent-driven-development` in an isolated worktree. Plan A Task 2 proves the whole
server-side contract in SQL before any UI exists — if it passes, everything after it is
presentation.

