# W App (`w-app-web`) — build-state inventory (2026-09-02)

A walk of the codebase to answer "is the app done being built?". Scoped to
the **web** app in this repo. iOS/Android are separate repos, not covered.

**Legend**
`✅` built and working · `🟡` partial / rough edges · `🔴` visible stub (UI
exists, does nothing real) · `⚪` backend/data-layer only, no UI · `❌` not
started

---

## 1. Core attendee flow

| Area | State | Notes |
|---|---|---|
| Email + password sign-up / login | ✅ | `app/auth/register`, `app/auth/login`. Password min 6 chars. |
| Profile setup (looking-for, city, profession, drink…) | ✅ | `app/profile/setup` |
| Profile view / edit | ✅ | `ProfileTab`, `app/profile/edit` (blank-form bug fixed this session) |
| Onboarding carousel | ✅ | `app/welcome` |
| Phone / SMS-OTP login | ⚪ | `signInWithPhone`/`verifyOTP` exist in `lib/auth.ts`, **no UI calls them** |
| Apple / Google / Facebook sign-in | ❌ | `lib/auth.ts` comment: "omitted… OAuth app config for web hasn't been set up" |
| Map of venues | 🟡 | `MapTab` + `WMap` — real Leaflet/OSM map with venue pins. But: category filter has 7 categories while every venue is hardcoded `category:'venue'`, so filtering by cafe/bar/etc. always shows nothing. Stale "Placeholder for Google Maps" comment. |
| "Add a location" from the map | 🔴 | Adds to local React state only (`setNearbyLocations([...])`) — never persists to the DB. The real create path is the admin panel's `createVenue`. |
| Nearby venues / in-range vs. nearby split | ✅ | `NearbyBanner` (Round 1). Verified in QA this session. |
| Geofenced check-in / check-out | ✅ | `checkIn`/`checkOut`, geofence gate in `CheckedInHero`. Made idempotent this session. |
| "People here" count | 🟡 | Real presence via `fetchPresence`; but `count` is hardcoded `0` when venues are built in `MapTab`/`NearbyBanner`, so the number is often just 0. |
| Check-in history + "who was there" | ✅ | `HistoryTab` — last-visited venues, per-venue day-grouped feed, attendee strip, inline compose |
| Attendee-history opt-out | ✅ | `isOptedOutOfAttendeeHistory` / `setAttendeeHistoryOptOut` |

## 2. Peek (Round 1)

| Area | State | Notes |
|---|---|---|
| Peek a nearby venue (preview) | ✅ | `VenuePeekModal` — venue name, description, photo carousel, blurred feed teaser |
| Peek **tracking** — "someone peeked your venue" record | ❌ | Explicitly Round 2. Code comment: "No peek-tracking row, no notification to anyone at the venue, no reciprocal matching." |
| Peek → notification / reciprocal match | ❌ | Round 2 |
| Report field for it (`peeksAccepted`) | ⚪ | `ConnectionsFormedStats.peeksAccepted` exists; always 0 until the above ships |

## 3. Connections / contact exchange

| Area | State | Notes |
|---|---|---|
| "Connect" QR panel | 🔴 | `ConnectSheet` — no QR library; "Share my code" is a `console.log` no-op; scanning "is Phase 3, `requestConnection` doesn't exist" |
| QR-scan → creates a `connections` row | ❌ | Doesn't exist on **any** platform (per launch-prep doc). |
| Choose which contact methods to share | ⚪ | `fetchContactMethods`/`upsertContactMethod` + `ContactMethod` type exist; **no UI** |
| Contact-method-choice tracking | 🟡 | `record_contact_method_choice` RPC built (0014/0015); produces no data until QR-scan flow exists |

## 4. Friends / social feed

| Area | State | Notes |
|---|---|---|
| Friends-activity feed | 🔴 | `FriendsActivityFeed` renders the **locked state only**. No `fetchFriendsActivity()`, no 3-connection gate. Comment: "needs the real connections schema this repo's paused 2026-08-04 plan flagged as unresolved." |
| Friend/connection graph | ❌ | No `connections` schema resolved; nothing to build the feed or the gate on |

## 5. Messaging

| Area | State | Notes |
|---|---|---|
| 1:1 DMs (request / accept / send) | ✅ | `startConversation`, `sendMessage`, `respondToConversationRequest`, `ChatView`, `MessagesTab` |
| Persistent per-venue group chat | ✅ | Phase 2 — `chat_join_mode` (`auto`/`request`), join requests, admin mgmt, `app/main/venue/chat`. Migration 0008, verified on prod. |
| Organizer ad-hoc group creation | ✅ | `CreateGroupModal` |
| "Message Everyone Live" broadcast | ✅ | From `CheckedInHero` |
| **Realtime delivery** | ✅ | Chat threads (`ChatView`), the conversation list (`MessagesTab`), and venue presence (`CheckedInHero`) now update live via `lib/hooks/useTableSubscription.ts` (`postgres_changes` on `messages` + `location_checkins`, migration 0017, applied + verified on QA and prod 2026-09-02). Join requests still update on load/refresh only — out of scope for this round (design spec explicitly deferred venue-chat join-request badges). |

## 6. Rewards

| Area | State | Notes |
|---|---|---|
| Attendee rewards panel | ✅ | `RewardsPanel` |
| Attendance-tier unlock (`min_checkins`) | ✅ | `highestEarnedTier`, migration 0010 |
| Organizer reward CRUD | ✅ | `app/main/venue/rewards` |
| Reward QR redemption | 🟡 | `qr_path` stored/displayed; redemption is show-the-code, no scan-to-redeem loop |
| `hasFeatureAccess` / owner-benefits feature gating | ⚪ | Function + `Reward.feature_name` exist; **not enforced by any UI** |

## 7. Organizer / admin

| Area | State | Notes |
|---|---|---|
| Master-admin panel (venues, admins, owner assignment) | ✅ | `app/admin` |
| Create venue | ✅ | `createVenue` (used it this session to seed QA Test Venue Two) |
| Banner / carousel management | 🟡 | UI built (`app/main/venue/carousel`). **Image upload fails on `w-app-qa` with a storage RLS 403** — bucket policies look un-applied on QA (found this session). Unverified on prod. |
| Verification tags | ✅ | `app/admin/venue/[id]/tags`, assign/remove |
| Members roster | ✅ | `app/main/venue/members` |
| Venue zones (for analytics) | ✅ | `app/main/venue/zones` |
| Organizer report | ✅ | `app/main/venue/report` — 7 sections all render: Attendance & Peak Times, Tag/Role Breakdown, Connections Formed, Engagement, Zone Movement, Cross-Venue Movement |
| — "Connections Formed" section | 🟡 | `scans` + `peeksAccepted` — **always 0** until QR-scan and Round-2 Peek ship |
| — Zone analytics k=3 floor | 🟡 | Applied to occupancy + cross-venue; **not** to avg dwell time or transitions (drives the privacy-copy decision in `privacy-copy-rewrite-2026-09-02.md`) |
| Events (create / list / update) | ⚪ | `createEvent`/`fetchEvents`/`updateEvent` in `lib/data.ts` — **zero UI references**. Backend capability with no interface. |
| Feed posting (`postToFeed`) | ⚪ | Defined, **never called from any UI**. Feed content shown in History must originate elsewhere (iOS app / check-ins). |

## 8. Location analytics / privacy

| Area | State | Notes |
|---|---|---|
| Zone position tracking while checked in | ✅ | `useZoneTracking` → `record_zone_position` (checked-in-only, zone-defined venues only, 10s throttle, stores zone id not coords) |
| 48h purge of raw fixes | ✅ | hourly `pg_cron` job (0016), verified on prod |
| `/privacy` disclosure page | 🟡 | Exists but is a **narrow draft** — its own header says "covers only the location-tracking disclosure gap". Two factual errors vs. code (see `privacy-copy-rewrite-2026-09-02.md`). Doesn't mention Peek, friends feed, presence visibility, messaging, or third parties. |
| Location permission modal copy | 🟡 | Overstates ("share your approximate position with that venue") — rewrite drafted |

## 9. Cross-cutting / infra

| Area | State | Notes |
|---|---|---|
| Error tracking (Sentry) | 🟡 | Full SDK scaffold, **no-op without `NEXT_PUBLIC_SENTRY_DSN`**. Needs a Sentry project + env vars. |
| Product analytics (Vercel Analytics) | 🟡 | `<Analytics/>` mounted; **needs one click in the Vercel dashboard** to start collecting. |
| Security headers / CSP | ✅ | `next.config.ts` — CSP, HSTS, frame-deny, etc. (`'unsafe-inline'`/`'unsafe-eval'` still in `script-src`, flagged for post-launch tightening) |
| SEO / meta pack | ❌ | `app/page.tsx` is a JS redirect (not crawlable), no `robots.ts`, no `sitemap.ts`, no OG image, minimal `metadata`. Draft plan exists, not built. |
| Marketing landing page | ✅ (separate) | `/Users/sr/wapp` → `philms-org/wapp-landing-page`, deployed at `www.the-w.app`. This app serves `the-w.app/<app routes>`. |
| Automated tests | ❌ | No test suite in this repo — every plan's "testing" is manual browser verification. (The landing-page repo has Camoufox E2E; this one doesn't.) |
| Prod DB migrations | ✅ | 0001–0016 applied + verified on prod (per launch-prep doc) |
| `main` pushed to origin | ❌ | Currently ~6 commits ahead of `origin/main`, unpushed — recurring risk. |

---

## Bottom line

**Solid and shippable:** auth (email), profiles, map/venues, check-in,
history, DMs + venue group chat, rewards, the full organizer/admin suite,
zone analytics + retention. Round 1 (home banner, nearby/peek split, Peek
preview, profile-edit) is merged and QA'd.

**Not done — decide keep / hide / finish before launch:**

1. **Connections graph is unresolved** — and it blocks: the Connect/QR flow
   (`🔴` stub), the friends-activity feed (`🔴` locked-only), contact-method
   sharing (`⚪` no UI), Round 2 Peek, and 2 organizer-report figures that
   read 0.
2. **Connect QR panel** and **friends feed** are visible stubs a user will
   tap and get nothing from — hide them or finish them.
3. **Map "add location"** silently doesn't save; **map category filters**
   never match anything.
4. **Auth is email-only** — no phone OTP, no social sign-in.
5. **Banner image upload** errors on QA; unverified on prod.
6. **Infra one-clicks**: Sentry DSN, Vercel Analytics toggle.
7. **SEO pack** not built; **`main` unpushed**.

Items 1–2 are "is the product actually done" questions. 3–7 are launch
hygiene that can be knocked out quickly once 1–2 are settled.
