# Connections Graph + QR Connect Flow — Design v2

**Date:** 2026-09-03
**Status:** Approved (founder decisions resolved in-session 2026-09-03)
**Repo:** `/Users/sr/w-app-web`
**Supersedes:** `docs/superpowers/specs/2026-09-02-connections-graph-qr-connect-design.md`
and its two plans (`2026-09-02-connections-write-path-qr-connect.md`,
`2026-09-02-friends-activity-feed-unlock.md`). Those were written unattended with
two product decisions flagged for review; both were reviewed and **one was
reversed**, which changes the RPC contract enough to warrant a fresh spec.

## What changed from the 2026-09-02 design

| Area | 2026-09-02 (superseded) | 2026-09-03 (this doc) |
|---|---|---|
| **Co-presence requirement** | Both parties must hold an open check-in at the same venue; venue derived server-side from the caller's check-in | **Removed.** Connect anywhere — at the door, outside, at a venue not in the app |
| **Forgery resistance** | Provided by the co-presence check (a bare user-id payload is safe only if both parties are physically at the same venue) | **Rotating single-use token.** QR payload is a 90s single-use token, not a user id |
| **QR payload** | `w://connect/<user_id>` | `w://connect/<token>` |
| **`record_qr_scan` signature** | `record_qr_scan(p_scannee_id uuid)` | `record_qr_scan(p_token text, p_lat float8 default null, p_lng float8 default null)` |
| **Location recorded** | `location_id` only, from the caller's check-in | `scan_lat` / `scan_lng` captured at scan time (best-effort, **retained permanently**), plus a server-resolved `location_id` and `place_label` |
| **Idempotency key** | `(scanner, scannee, venue)` | `(scanner_id, scannee_id)` — venue is now variable, so the pair is the key |
| **Connections-list / unfriend UI** | Explicitly out of scope in both plans | **In scope** — a `/main/connections` screen is the "connected near X" surface and gives `remove_connection` a UI |
| **Auth expansion** | Out of scope | Still out of scope (confirmed) |

Everything else from the 2026-09-02 design carries forward unchanged and its
reasoning is not repeated in full here — read that doc for the two-layer model
rationale, the "why RPCs not RLS INSERT policies" argument, and the live-database
findings. The essential facts, restated:

- `connections`, `friendships`, `peek_invites` **already exist** (iOS era). No new
  relationship tables. Live QA row counts at design time: `connections` 0,
  `friendships` 2, `peek_invites` 0.
- The blocker was never missing schema — it is a **missing write path**.
  `connections` and `friendships` each have exactly one policy, both SELECT, no
  INSERT. Nothing can write them.
- `friendships` has `UNIQUE (user_id, friend_id)` and a `source` CHECK
  (`qr_scan | peek_invite | message`).
- `fetchConnectionsFormed()` (`lib/data.ts`) already issues real `count` queries
  against `connections` / `peek_invites`. The organizer report's "always 0" is an
  empty table, not hardcoding — **the report needs no code change**, only
  verification.
- `record_contact_method_choice(p_connection_id, p_type)` (SECURITY DEFINER,
  migration 0015) is already live and already takes a connection id.
- `profiles.share_checkins_with_friends` (default **false**) and
  `is_friend_sharing(target_user_id)` (bidirectional, SECURITY DEFINER, live in
  DB, in no migration file) already exist and are the gate the friends feed uses.
- `startConversation()` reads friendships **one-directionally**
  (`.eq('user_id', uid)`); `is_friend_sharing()` reads **bidirectionally**.
  Writing two friendship rows per connection keeps both correct with no change to
  either.
- `next.config.ts` sets `Permissions-Policy: camera=()` — hard-disables the camera
  on every route. The scanner is dead until this becomes `camera=(self)`.
  `geolocation=(self)` is already set, so the scan-time geotag needs no header
  change. CSP already allows `data:`/`blob:` for `img-src`, and a `<video>` fed by
  `srcObject` is not subject to `media-src` — no CSP change for QR or camera.
- `locations` table columns: `lat`, `lng`, `geofence_radius_meters` (the `Venue`
  type maps to this table). `haversineMeters()` in `lib/geo.ts` is the reference
  distance formula.

## Founder decisions (resolved 2026-09-03)

1. **Single opt-in** — scanning creates the connection instantly, no accept step.
   (Unchanged from 2026-09-02.)
2. **Connect anywhere** — no venue co-presence requirement. *(Reversed.)*
3. **Forgery resistance via a rotating single-use token** — 90s TTL, re-minted on
   screen every 60s.
4. **Geotag is best-effort** — if location permission is denied or unavailable at
   scan time, the connection is still created, just without coordinates.
5. **Raw scan coordinates are retained permanently** on the `connections` row —
   including through an unfriend. `remove_connection` deletes only the
   `friendships` rows and leaves the `connections` event row completely intact.
6. **"Connected near X" is shown to both participants** — via a new
   `/main/connections` screen.
7. **No off-venue reverse-geocoding this pass.** `place_label` is the venue name
   when the scan resolves inside a venue geofence; otherwise null (the UI shows
   the date only). Real place names for off-venue scans are a follow-up.
8. **Privacy-copy `/privacy` must disclose the permanent connection geotag** —
   tracked as sub-project 3, not this spec, but noted here because this feature
   creates the disclosure obligation.
9. **Auth expansion (phone OTP, social sign-in) is out of scope.**

## Scope

Two linked plans, same split as before.

**Plan A — Connections write path + QR connect + connections list (foundational):**
1. Migration `0019`: `connect_tokens` table; `mint_connect_token()`,
   `record_qr_scan(...)`, `remove_connection(...)` RPCs; `scan_lat` / `scan_lng` /
   `place_label` columns on `connections`; `connections_select_participant`
   policy; `connections.location_id` FK → `ON DELETE SET NULL`; expired-token
   cleanup on the existing hourly cron.
2. `next.config.ts` camera Permissions-Policy fix.
3. Types + `lib/connect.ts` helpers + `lib/data.ts` functions.
4. Real QR (auto-refreshing) in `ConnectSheet`, replacing the stub.
5. Camera scan route that captures a best-effort geotag and creates a connection.
6. Post-scan contact-method chooser + "connected near X" line.
7. `/main/connections` list screen with unfriend.
8. Verify the two organizer-report tiles now read non-zero.

**Plan B — Friends activity feed unlock (depends on Plan A):**
1. `fetchFriendsActivity()` respecting `share_checkins_with_friends`.
2. Real 3-connection gate in `FriendsActivityFeed` (replaces hardcoded `0 / 3`).
3. A `share_checkins_with_friends` opt-in toggle in `ProfileTab`.
   *(Connection removal is Plan A's `/main/connections` screen, not here.)*

**Explicitly out of scope:**
- Round 2 Peek (peek-tracking, notifications, reciprocal matching) — its own spec.
- A settings UI for editing your own contact methods — only the post-scan chooser
  is in scope.
- Off-venue reverse-geocoding (place names for coordinates not inside a venue).
- Signed-token *key rotation infrastructure* beyond per-token TTL — a random
  single-use token in a table is sufficient; no HMAC secret management.
- iOS/Android parity — `w-app-ios` is a separate repo.
- Auth expansion.

## Design

### 1. Two-layer model (unchanged)

`connections` is an **event log** ("A scanned B at time T, near here"). `friendships`
is the **relationship state**. The organizer report wants events; the friends feed
wants state. Keep both; never collapse them.

### 2. A connection is single-opt-in, created at scan time (unchanged)

Scanning creates the friendship immediately, no pending/accept step. `friendships`
has no status column and adding one re-invents schema the paused 2026-08-04 plan
warned against. Unwanted contact is gated one layer down:
`conversation_participants.status` gives DMs their own accept flow, and
`share_checkins_with_friends` defaults **false**, so a new connection leaks no
location data by default. Because it is single-opt-in, `remove_connection` is a
requirement, not a nice-to-have.

### 3. Two friendship rows per connection (unchanged)

`record_qr_scan` inserts both `(A,B)` and `(B,A)` in one transaction,
`on conflict (user_id, friend_id) do nothing`. Every existing consumer is correct
with zero changes. Counting connections is a clean
`count(*) where user_id = me`.

### 4. Forgery resistance: rotating single-use token

**The problem.** Profiles are world-readable (`profiles_select_auth` is `true`),
so a user id is not a secret. With no co-presence check, a bare-id payload would
let anyone call `record_qr_scan(<scraped_id>)` and forge a mutual friendship —
which, combined with the friends feed and an opted-in target, leaks that person's
venue history.

**The mechanism.**

- **`connect_tokens`** table: `token text primary key`, `user_id uuid not null
  references profiles(id) on delete cascade`, `created_at timestamptz not null
  default now()`, `expires_at timestamptz not null`. RLS **enabled, no policies** —
  no client reads or writes it directly; both RPCs are SECURITY DEFINER.
- **`mint_connect_token() returns text`** — SECURITY DEFINER. `v_uid := auth.uid()`,
  raise `not_signed_in` if null. Generate a URL-safe random token
  (`encode(gen_random_bytes(18), 'base64')` → 24 chars, then map `+/` → `-_` and
  strip `=`). Insert `(token, v_uid, now() + interval '90 seconds')`. Delete this
  user's own already-expired tokens in the same call (cheap, bounds the table).
  Return the token.
- QR payload: **`w://connect/<token>`**. The `w://connect/` prefix lets the
  scanner reject unrelated QR codes with a clear message.
- `ConnectSheet` calls `mint_connect_token()` on mount and **re-mints every 60
  seconds** (`setInterval`, cleared on unmount), so the code on screen always has
  ≥30s of validity.
- **`record_qr_scan`** looks the token up with `expires_at > now()`, raising
  `invalid_or_expired_token` if not found, then **deletes it** — single-use. A
  scraped id is worthless; a screenshotted QR is dead after one use or 90s,
  whichever comes first.

**Residual risk (accepted).** A user could forward their *own* currently-valid QR
to a remote person within the 90s window, letting that person connect without
being present. That requires the code's owner to actively collude — at which point
they are choosing to make the connection. No further mitigation.

**Why a table and not an HMAC.** A random token in a table is revocable, needs no
secret-management story in Postgres, and the TTL cleanup reuses the existing
hourly `pg_cron` purge pattern (0016). An HMAC buys statelessness we do not need.

### 5. Geotag: best-effort, captured client-side, resolved server-side

**Capture.** On a successful QR decode the scanner calls
`navigator.geolocation.getCurrentPosition()` with a short timeout (~5s) and
`enableHighAccuracy: false`, **in parallel** with — not before — the
`record_qr_scan` call path. If it resolves in time, its `latitude`/`longitude` go
into the RPC as `p_lat`/`p_lng`. If it rejects, times out, or the user has denied
permission, the RPC is still called with `p_lat`/`p_lng` null. **A connection is
never lost to a location prompt.**

**Storage.** `connections` gains:
- `scan_lat double precision` — nullable, **retained permanently**.
- `scan_lng double precision` — nullable, **retained permanently**.
- `place_label text` — nullable. Set to the resolved venue's name when the scan
  falls inside a venue geofence; null otherwise.

**Server-side venue resolution.** Inside `record_qr_scan`, when `p_lat`/`p_lng` are
non-null: select the `locations` row minimising haversine distance to the scan
point **where that distance ≤ `geofence_radius_meters`**. If one matches, set
`location_id` to it and `place_label` to its `name`. If none matches (off-venue),
`location_id` and `place_label` stay null. Haversine is inlined in the plpgsql
(the `earthdistance`/`cube` extensions are not assumed to be installed); it is the
same formula as `lib/geo.ts:haversineMeters`, and a venue set of any realistic
size is a trivial scan.

**Consequence for the organizer report.** The "QR Scans" tile counts connection
rows whose resolved `location_id` is that venue — i.e. scans that physically
happened within the venue's geofence, regardless of check-in state. "Someone was
checked in but had walked two blocks away when they scanned" correctly attributes
to *nothing* (or to whatever venue they were actually standing in), which is the
honest number.

### 6. The RPCs

**`mint_connect_token() returns text`** — see §4.

**`record_qr_scan(p_token text, p_lat float8 default null, p_lng float8 default
null) returns uuid`** — SECURITY DEFINER, `set search_path = public`.

1. `v_scanner := auth.uid()`; raise `not_signed_in` if null.
2. `select user_id into v_scannee from connect_tokens where token = p_token and
   expires_at > now()`. Raise `invalid_or_expired_token` if not found.
3. Raise `self_scan` if `v_scannee = v_scanner`.
4. `delete from connect_tokens where token = p_token` — single-use. Sequenced
   here: a `self_scan` reject above does not consume the token (harmless — the
   owner just re-shows it); a write failure below rolls the whole transaction
   back, delete included, so the user retries with the same still-valid code.
5. If `p_lat` and `p_lng` are non-null, resolve `v_location` (and, if matched,
   `v_place_label`) by the geofence scan in §5.
6. **Idempotent per `(scanner_id, scannee_id)`**: `select id into v_connection
   from connections where scanner_id = v_scanner and scannee_id = v_scannee limit
   1`. If found, reuse it — do **not** overwrite its geotag or timestamp (the
   first scan is the canonical "where/when you connected" record). If not found,
   `insert into connections (scanner_id, scannee_id, location_id, scan_lat,
   scan_lng, place_label) values (...)` and use the new id.
7. Insert both `friendships` rows, `source = 'qr_scan'`, `on conflict (user_id,
   friend_id) do nothing`. Runs on the reuse path too, so a repeat scan repairs a
   half-missing pair.
8. Return `v_connection`.

**`remove_connection(p_other_user_id uuid) returns void`** — SECURITY DEFINER.
`v_uid := auth.uid()`, raise `not_signed_in` if null. `delete from friendships
where (user_id = v_uid and friend_id = p_other_user_id) or (user_id =
p_other_user_id and friend_id = v_uid)`. **The `connections` event row(s) are left
entirely untouched** — including `scan_lat`/`scan_lng`/`place_label` — per founder
decision 5. They are venue analytics already aggregated into past organizer
reports, and the founder chose permanent retention of the geotag.

**One new RLS policy**, `connections_select_participant`:
`for select to authenticated using (scanner_id = auth.uid() or scannee_id =
auth.uid())`. Needed for the post-scan screen and the `/main/connections` list.
The existing `connections_select_organizer` is unchanged and additive (permissive
policies OR).

**FK fix.** `connections.location_id` currently has no `ON DELETE` action, so
deleting a venue with connection rows errors. This design makes more rows carry a
`location_id`, so the migration alters the constraint to `ON DELETE SET NULL` —
losing the venue attribution on venue deletion but keeping the connection event
and its coordinates.

**Token cleanup.** Add `delete from connect_tokens where expires_at < now()` to a
`purge_expired_connect_tokens()` function and schedule it on the existing hourly
`pg_cron` (alongside `purge-stale-zone-positions`). Per-user expired tokens are
also swept opportunistically in `mint_connect_token()`.

### 7. QR display and scanning

Dependencies: **`qrcode`** (generate, renders to a canvas we style) and **`jsqr`**
(pure-JS decode; we drive `getUserMedia` + the `<video>`/canvas frame loop
directly for full theme control). `html5-qrcode` rejected — it ships its own UI
chrome.

**`ConnectSheet`** (`components/home/ConnectSheet.tsx`) — replace the static
lucide icon and the `console.log` handler with: a `mint_connect_token()` call on
mount, a 60s re-mint interval, `QRCode.toDataURL(encodeConnectPayload(token))`
rendered dark-on-white on a white plate (many scanners fail on an inverted code),
the user's name, and a `Link` to `/main/connect/scan`. Drop the "you both need to
be checked in here to connect" line — no longer true.

**`app/main/connect/scan/page.tsx`** (new) — follows the `app/main/**/page.tsx`
convention. `getUserMedia({ video: { facingMode: 'environment' } })`, a
`requestAnimationFrame` loop drawing frames to a hidden canvas and running `jsQR`.
On decode:
- `decodeConnectPayload(code.data)` → token string, or null → show "That's not a W
  code."
- A `busyRef` guard prevents the loop re-firing `recordQrScan` while the first
  call is in flight (the camera sees the same code every frame).
- Fire `getCurrentPosition()` (best-effort, ~5s timeout, low accuracy); whether it
  resolves or rejects, call `recordQrScan(token, lat?, lng?)`.
- On success: stop the stream, render `<ConnectResult>`.
- **The stream must be stopped on unmount and on `visibilitychange`→hidden**, or
  the camera indicator stays lit — a real, visible bug.

`next.config.ts`: `camera=()` → `camera=(self)` in the same task. `microphone` and
`payment` stay disabled.

### 8. Post-scan screen — `ConnectResult`

`components/connect/ConnectResult.tsx`, props `{ connectionId: string; scanneeId:
string }` — the scanner has both from `recordQrScan`'s return + the decoded token.

- Loads, in parallel: `fetchProfile(scanneeId)` (uses `display_name`, not
  `name`), `fetchContactMethods(scanneeId)` (its RLS already limits to
  owner-enabled rows), and the connection row itself
  (`fetchConnection(connectionId)` — a new one-row select, readable now via
  `connections_select_participant`) for `place_label` / `scanned_at`. The RPC
  returns only the id; the label is read back from the row, not threaded through
  props.
- Heading: "Connected with «display_name»".
- If `place_label` is non-null: a muted line "Connected near «place_label»".
  Otherwise: "Connected · «date»" from `scanned_at`.
- Contact-method chooser: one button per enabled `ContactMethod`; tapping calls
  `recordContactMethodChoice(connectionId, type)` **best-effort** (the connection
  already exists — a failure here must not read as "connection failed") and shows
  "Saved."

### 9. Connections list — `app/main/connections/page.tsx` (new)

The "connected near X" surface and the home for `remove_connection`.

- `fetchMyConnections()` returns, for the current user, each connection they are a
  participant in: the other person's `display_name` + `avatar_url`, `place_label`,
  `scanned_at`, and the other user's id. Two-step client query: read
  `friendships` rows `where user_id = me` for the id set, then read `connections`
  rows where `scanner_id = me or scannee_id = me` for the geotag/label/date, then
  join to `profiles` for names. (A friend with no `connections` row — e.g.
  `source = 'message'` — still lists, with no place/date.)
- Each row: avatar, name, "Connected near «place» · «relative date»" (or just the
  date, or nothing, per §8's fallback ladder), and an overflow/"Remove" action
  calling `removeConnection(otherUserId)` then refetching. A confirm step
  ("Remove connection with «name»?") because it is destructive and silent
  otherwise.
- Empty state: "You haven't connected with anyone yet. Show your code from the
  home screen, or scan someone else's."
- Linked from `ProfileTab` (a row in the existing list area).

### 10. Error handling

| condition | message |
|---|---|
| camera permission denied | "Camera access is off. Allow camera in your browser settings, then reload." + retry |
| scanned own code | "That's your own code." |
| non-`w://connect/` QR | "That's not a W code." |
| token expired / unknown (`invalid_or_expired_token`) | "That code has expired — ask them to show a fresh one." |
| not signed in (`not_signed_in`) | "You need to be signed in." |
| already connected | **success**, "Already connected with «name»." — idempotent, not an error |
| geolocation denied/unavailable | **silent** — connection proceeds with no geotag |

### 11. Testing

No automated test suite in this repo (`package.json` scripts: `dev` / `build` /
`build:vercel` / `start` / `lint`). Verification is `npx tsc --noEmit` clean, plus
manual QA against `w-app-qa`, plus direct `supabase db query` row assertions after
each scan. The RPCs are provable in SQL before any UI exists — Plan A is sequenced
that way. Migration is **not** applied to PROD until a working end-to-end demo is
signed off (Plan A's final task).

## Decisions made without human input

None. Every product/schema ambiguity in this revision was resolved by the founder
in-session on 2026-09-03 (see "Founder decisions" above). The remaining
implementation-level choices — token encoding, exact statement ordering in
`record_qr_scan`, which file the `/main/connections` link sits in — are pinned in
the implementation plan and carry no product consequence.

## Deferred / follow-up

- **`/privacy` copy must disclose the permanent connection geotag** — sub-project
  3 (`privacy-copy-rewrite-2026-09-02.md` scope), gated on this feature shipping.
  This spec creates the obligation; it does not discharge it.
- Round 2 Peek — its own spec, needs the peek-visibility model.
- Own-contact-methods settings UI.
- Off-venue reverse-geocoding for `place_label`. Would need an external geocoder
  (Nominatim etc.), a CSP `connect-src` entry, and attribution.
- The `startConversation` / `is_friend_sharing` directionality mismatch is
  *worked around* by two-row writes, not fixed. Latent trap if anything ever
  writes a single-direction row. Worth a cleanup pass.
- HMAC / rotating-secret tokens if the `connect_tokens` table ever proves a
  bottleneck (it will not at this scale).
