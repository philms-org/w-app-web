# Connections Graph + QR Connect Flow — Design

**Date:** 2026-09-02
**Status:** Draft — **awaiting founder review** (see "Decisions made without human input")
**Repo:** `/Users/sr/w-app-web`
**Supersedes:** the Phase 2/3 schema in `docs/superpowers/plans/2026-08-04-home-tab-redesign.md` (paused, commit `d71d848`)

## Background

The 2026-09-02 codebase audit named the connections graph the single biggest unresolved gap,
blocking five things: the Connect/QR flow, the friends-activity feed, contact-method sharing
UI, Round 2 Peek, and two organizer-report figures stuck at 0.

Direct inspection of the live QA database (`ducadjakxmkfcvrteoqz`) reframes the problem
substantially. **This is not a missing-schema problem. It is a missing write-path problem.**

## Current state (verified against the live database, not inferred from code)

All three tables already exist. The 2026-08-04 paused plan was right to delete its invented
`0001_connections_and_peeks.sql`.

| table | columns | rows (QA) |
|---|---|---|
| `connections` | `id`, `scanner_id`, `scannee_id`, `location_id`, `scanned_at`, `contact_method_type` | **0** |
| `friendships` | `id`, `user_id`, `friend_id`, `connected_at`, `source` | **2** |
| `peek_invites` | `id`, `sender_id`, `peeker_id`, `location_id`, `sent_at`, `accepted_at` | **0** |

The design intent is already encoded in the constraints:

- `friendships` **UNIQUE (user_id, friend_id)** — one row per *ordered* pair.
- `friendships.source` CHECK — **`qr_scan` | `peek_invite` | `message`**. Provenance was
  designed for exactly this feature.
- `connections` has **no** unique constraint, so duplicate scans are possible unless handled.

### The actual blocker

RLS is enabled on all three tables, but:

- `connections` has **one** policy — `connections_select_organizer`
  (`is_venue_manager(location_id, auth.uid())`). **No INSERT policy.** No client can create a
  connection; participants can't even read their own scan rows.
- `friendships` has **one** policy — `friendships_select`
  (`user_id = auth.uid() OR friend_id = auth.uid()`). **No INSERT policy.**
- `peek_invites` is the only writable one (`peeks_insert`, `peeks_update`).

The tables are effectively read-only to every client. That is why nothing has ever written a row.

### The report figures need no code change

`fetchConnectionsFormed()` (`lib/data.ts:1178`) already issues real `count` queries against
`connections` and `peek_invites`. The audit's "always read 0" is accurate but the cause is an
empty table, not hardcoding. **Both tiles start working the moment the write path exists** —
they appear in this spec only as a verification step, not as work.

Likewise `record_contact_method_choice(p_connection_id, p_type)` (SECURITY DEFINER, migration
0015) is already live and already takes a **connection id** — it was built anticipating this
flow and needs no change.

### Privacy plumbing already exists

`profiles.share_checkins_with_friends` (**default false**) and `share_checkin_history`
(default false) exist, and `is_friend_sharing(target_user_id)` — a live SECURITY DEFINER
function, present in the DB but in no migration file (iOS-era) — already combines that flag
with a **bidirectional** friendship check. This is exactly the gate the friends feed needs.

Note `location_checkins` SELECT policy is `true` (any authenticated user can read any
check-in), so the friends feed's privacy gate must be applied **deliberately in the query** —
it is not inherited from RLS.

### Two consumers disagree about friendship directionality

- `startConversation()` (`lib/data.ts:826`) reads **one-directionally**:
  `.eq('user_id', uid).in('friend_id', recipientIds)`.
- `is_friend_sharing()` reads **bidirectionally** (checks both orderings).

Any write path must resolve this or DMs between real friends get mis-marked `pending`.

### Client state

- `components/home/ConnectSheet.tsx` — static lucide `QrCode` icon; "Share my code" is a
  `console.log`. No scan surface exists.
- `components/home/FriendsActivityFeed.tsx` — presentational locked state, hardcoded
  `0 / 3 connections`, no props, no fetch.
- `package.json` — **no QR dependency** of any kind.
- **`next.config.ts:29` sets `Permissions-Policy: camera=()`, which hard-disables the camera
  on every route.** Any scanner is dead on arrival until this becomes `camera=(self)`. This is
  the kind of thing that costs an afternoon if it isn't in the plan.
- CSP `img-src` already allows `data:` and `blob:`, so QR rendering needs no CSP change. A
  `<video>` fed by `srcObject` (a `MediaStream`) is not subject to `media-src`, so CSP needs
  no change for the scanner either.

## Scope

This design covers the **foundational connections write path and the QR connect flow**, split
into two linked plans. It deliberately does not try to be one mega-plan.

**Plan A — Connections write path + QR connect (foundational, ships working software):**
1. Migration `0019`: two SECURITY DEFINER RPCs + the participant-read policy on `connections`.
2. `next.config.ts` camera Permissions-Policy fix.
3. Types + `lib/data.ts` functions.
4. QR display (real, replacing the stub) in `ConnectSheet`.
5. Camera scan surface that creates a connection.
6. Post-scan contact-method chooser (wires the already-live `record_contact_method_choice`).
7. Verify the two organizer-report tiles now read non-zero.

**Plan B — Friends activity feed unlock (depends on Plan A):**
1. `fetchFriendsActivity()` respecting `share_checkins_with_friends`.
2. Real 3-connection gate in `FriendsActivityFeed`.
3. A privacy toggle so users can actually opt in (the flag defaults false, so the feed is
   empty-by-construction without one).

**Explicitly out of scope:**
- **Round 2 Peek** (peek-tracking, notifications, reciprocal matching). Confirmed out of scope
  by reading `docs/superpowers/specs/2026-08-26-home-banner-feed-round1-design.md`, which
  defines Round 2 as mutual peek-back matching needing "new schema (who's peeking what, who's
  visible to whom, match triggers) and a privacy/venue-visibility model," with its own spec.
  The 2026-08-04 paused plan left the same question open: `peek_invites` models only a
  sender→peeker invite, with no home for passive "who is currently peeking" state. That
  unresolved modelling question belongs to Round 2's spec, not here.
- **A settings UI for editing your own contact methods.** `fetchContactMethods` /
  `upsertContactMethod` exist (`lib/data.ts:350-362`) with sane RLS. That is a profile-settings
  surface; only the *post-scan chooser* is in scope, because it is part of the scan flow's own
  data story and makes the report's contact-method panel work.
- iOS/Android parity. `w-app-ios` is a separate repo.

## Design

### 1. The two-layer model (preserve what exists)

`connections` is an **event log** ("A scanned B at venue V at time T"). `friendships` is the
**relationship state**. This separation already exists and is correct: the organizer report
wants events (how many scans happened here), the friends feed wants state (who am I connected
to). The design keeps both and never collapses one into the other.

### 2. A connection is single-opt-in, created at scan time

Scanning creates the friendship immediately. No pending/accept step.

Rationale: `friendships` has **no status column**, and adding one would re-invent schema the
paused plan explicitly warned against. QR scanning is inherently consensual and co-present —
the scannee must physically display their code. Unwanted contact is already gated one layer
down: `conversation_participants.status` gives DMs their own pending/accepted flow, so being
connected does not let someone spam you. And `share_checkins_with_friends` defaults to
**false**, so a new connection leaks no location data by default.

Because it is single-opt-in, **removal is a requirement, not a nice-to-have** — hence
`remove_connection` below.

### 3. Write two friendship rows per connection

`record_qr_scan` inserts both `(A,B)` and `(B,A)` in one transaction.

This makes *every* existing consumer correct with **zero changes to existing code**:
`startConversation`'s one-directional read finds the row, and `is_friend_sharing`'s
bidirectional read still works (merely redundant). Counting connections becomes a clean,
index-friendly `count(*) where user_id = me`. The existing UNIQUE constraint prevents
duplicates per direction. Cost is one extra row per friendship — negligible.

### 4. Writes go through SECURITY DEFINER RPCs, not RLS INSERT policies

Plain RLS cannot express this safely. The reverse friendship row has `user_id = B ≠ auth.uid()`,
so a `with check (user_id = auth.uid())` policy can't write it — and a policy permissive enough
to write it would let anyone forge a friendship. RLS also can't validate venue co-presence or
handle idempotency.

This matches the convention the repo has already converged on: `set_master_admin`,
`assign_venue_owner`, `record_zone_position`, and `record_contact_method_choice` are all
SECURITY DEFINER RPCs, and migration 0015 explicitly *replaced* a too-broad RLS update policy
on `connections` with one.

**`record_qr_scan(p_scannee_id uuid) returns uuid`**

Note the signature takes **no** `location_id`. The venue is derived server-side from the
caller's open check-in, so a client cannot attribute scans to an arbitrary venue and inflate
that venue's organizer report.

Logic:
1. `v_scanner := auth.uid()`; raise if null.
2. Raise if `p_scannee_id = v_scanner` (no self-connect).
3. Resolve `v_location` from the caller's open check-in
   (`location_checkins where user_id = v_scanner and checked_out_at is null`, most recent).
   Raise a distinct error if there is none.
4. Require the scannee to have an open check-in at **the same** `v_location`. Raise a distinct
   error otherwise.
5. Idempotency: look for an existing `connections` row for
   `(v_scanner, p_scannee_id, v_location)`. If found, reuse its id; otherwise insert a new row
   and use that id.
6. Insert both `friendships` rows with `source = 'qr_scan'`,
   `on conflict (user_id, friend_id) do nothing`. This runs on **both** the reused and the
   newly-inserted path, so a repeat scan repairs a half-missing friendship rather than
   silently skipping it.
7. Return the connection id.

Step 4 is what makes the QR payload safe to be a bare user id. Profiles are world-readable
(`profiles_select_auth` is `true`), so a user id is not a secret — without a co-presence check,
any authenticated user could enumerate ids and forge connections. Requiring both parties to
hold an open, geofence-validated check-in at the same venue blocks remote forgery **without
adding a signed-token table**. It also grounds the graph in the venue model the whole product
and report are built around.

Step 5 makes "QR Scans" mean *distinct people you connected with at this venue*, which is the
metric an organizer actually wants, and makes the UI safely retryable.

**`remove_connection(p_other_user_id uuid) returns void`**

Deletes both `friendships` rows for the pair. Retains the `connections` event rows — they are
venue analytics that has already been aggregated, and deleting history on unfriend would
silently corrupt past organizer reports.

**One new RLS policy**, `connections_select_participant`, letting a user read connection rows
where they are the scanner or scannee. Required so the post-scan screen can confirm what it
just created, and so a user can see their own scan history. The existing organizer policy is
unchanged and additive.

### 5. QR display and scanning

Two small, focused dependencies:
- **`qrcode`** — generation. Tiny, no React coupling, renders to a canvas we style ourselves.
- **`jsqr`** — pure-JS decode. We drive `getUserMedia` and the `<video>`/canvas frame loop
  directly, which keeps full control of the dark/teal theme.

Rejected `html5-qrcode`: it ships its own UI chrome that would fight the app's inline-style
theme.

Payload: `w://connect/<user_id>`. The scheme prefix lets the scanner reject unrelated QR codes
with a clear message rather than attempting a lookup on arbitrary text.

**Camera surface**: a new `app/main/connect/scan/page.tsx`, following the established
`app/main/**/page.tsx` route convention. Camera stream must be stopped on unmount and on tab
hide, or the camera indicator stays on — a real and very visible bug.

`next.config.ts` must change `camera=()` to `camera=(self)` in the same task that adds the
scanner, or nothing works.

### 6. Error handling

Every failure gets a specific, actionable message — no generic "something went wrong":

| condition | message |
|---|---|
| camera permission denied | explain and offer retry |
| scanned own code | "That's your own code" |
| non-`w://connect/` QR | "That's not a W code" |
| caller not checked in | "Check in to a venue first" |
| scannee not checked in here | "You both need to be checked in here" |
| already connected | **success**, "Already connected with <name>" — idempotent, not an error |

### 7. Testing

**This repo has no automated test suite** (`package.json` scripts are `dev`/`build`/`start`/
`lint` only), matching every prior plan here. Verification is `npx tsc --noEmit` clean, plus
manual QA against the QA project, plus direct `supabase db query` row assertions after each
scan. The RPCs are verifiable directly in SQL before any UI exists, which is how Plan A is
sequenced — the write path is proven before a single component is touched.

## Decisions made without human input — flag for founder review

Written unattended, so every ambiguous product/schema call below was self-resolved. Each is
reversible; each names the alternative.

1. **Single-opt-in (scan = instant connection), no accept step.** *Alternative:* double
   opt-in request/accept. Rejected because `friendships` has no status column, and it needs a
   whole notification/inbox surface. Mitigated by DM-level request gating, the false-by-default
   sharing flag, and `remove_connection`. **This is the most reversible decision but also the
   most product-defining — worth an explicit yes/no.**

2. **Both parties must be checked in at the same venue to connect.** *Alternative:* allow
   connecting anywhere, with signed rotating QR tokens (new table + secret rotation) to prevent
   forgery. **This is the most product-consequential decision in the spec** — it means you
   cannot connect at the door, outside, or at a venue not in the app. Chosen because it buys
   real forgery resistance for zero new schema and matches the venue-scoped report. If the
   founder wants connect-anywhere, the signed-token design is the follow-up.

3. **Two friendship rows per connection.** *Alternative:* one canonical row (`least`/`greatest`)
   plus fixing `startConversation` and every other directional reader. Chosen because it makes
   existing consumers correct without touching them.

4. **Scan is idempotent per `(scanner, scannee, venue)`.** *Alternative:* log every scan,
   making "QR Scans" a raw event count. Chosen so the tile means distinct connections and the
   UI is retryable.

5. **`remove_connection` keeps the `connections` event rows.** *Alternative:* hard-delete for
   stricter data minimization. Chosen to avoid retroactively changing past organizer reports.

6. **Contact-method chooser included; own-contact-method editor deferred.** The chooser is the
   only thing that can supply `record_contact_method_choice` with a connection id.

7. **The 3-connection gate threshold stays 3**, matching existing copy, counting all
   `source` values (not just `qr_scan`).

8. **Split into two plans rather than one.** Plan A ships a complete, testable capability on its
   own; Plan B is pure UI on top. A single plan spanning migration + camera + feed + privacy
   toggle would be too large to review.

## Deferred / follow-up

- Round 2 Peek — its own spec, needs the peek-visibility model.
- Own-contact-methods settings UI.
- Signed rotating QR tokens, if decision 2 is reversed.
- The `startConversation` / `is_friend_sharing` directionality mismatch is *worked around*, not
  fixed. Two-row writes make both correct, but the underlying inconsistency remains a latent
  trap if anything ever writes a single-direction row. Worth a cleanup pass later.
- `connections.location_id` FK lacks `ON DELETE CASCADE` (its sibling FKs have it), so deleting
  a venue with connection rows will fail. Pre-existing, not introduced here, but it will bite
  eventually.
