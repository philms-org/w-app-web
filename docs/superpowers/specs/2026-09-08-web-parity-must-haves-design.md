# Web Parity Must-Haves — Design

**Date:** 2026-09-08
**Status:** Draft for review. One doc covering the four launch-blocking web
parity features from the design-alignment spec §5. Each feature gets its own
implementation plan after this is approved.
**Source:** `docs/superpowers/specs/2026-09-03-web-ios-design-alignment-design.md` §5.
**Design system:** `docs/design-system.md` — all screens use `lib/theme.ts`
tokens + `components/ui/primitives.tsx`.

Build order (from the 2-day plan triage): **onboarding → QR/Links → word
meter → Badges.**

---

## 1. Five-step onboarding

### Current state
- `app/auth/register` collects: name, email, phone, password, gender, birth
  date, avatar.
- `app/main/page.tsx` routes a signed-in user with no `profiles.city` to
  `/profile/setup`; otherwise to `/main`. `login` does the same.
- `app/profile/setup` (just rewritten to light tokens) is **one scrollable
  page**: looking-for (socialising / business / love), city, profession,
  nationality. It also carries `drink` / `activity` in `formData` but no
  longer renders inputs for them (the old dark step 4/5 code was dead).
- `profiles` already has every column needed: `city, profession,
  nationality, fave_drink, friday_night, dating_id, socialising_id,
  networking_id, relationship, height, affiliation, industry, role`, plus
  `*_visible` flags for city / fave_drink / friday_night / profession.
  **No migration needed.**

### Proposed design
A real **5-step wizard** at `/profile/setup`, replacing the single page.
One step per screen, a progress bar (5 dots or a bar) in the header, Back /
Next in a fixed footer, Skip allowed on optional steps.

| Step | Collects | Required |
|---|---|---|
| 1 · Looking for | `socialising_id`, `networking_id`, `dating_id` (the 3 category pickers already built as `OptionButton`s) | at least one non-"None" |
| 2 · Where you are | `city`, `nationality` | `city` (it's the routing gate) |
| 3 · What you do | `profession`, plus `affiliation` / `industry` / `role` as optional text | none |
| 4 · The fun stuff | `fave_drink` (Yes / No / Sometimes chips), `friday_night` (text), `relationship` | none |
| 5 · Who sees it | the four `*_visible` toggles (default on) + a review summary | — |

- State: one `formData` object held in the page; each step is a child
  component that reads/writes slices. A single `upsertProfile` on Finish
  (not per-step) — matches today's behaviour and keeps it offline-tolerant.
- `setupComplete` flips true and routes to `/main` on Finish.
- Re-entry: a user who already has a `city` who lands here (e.g. from
  ProfileTab "Complete profile") starts at step 1 with existing values
  pre-filled.

### Open questions
- **O1.1** Is a bio / headline field wanted? (`profiles` has no `bio`
  column — would need a migration.) Recommend: not for launch.
- **O1.2** Photo step — `register` already handles the avatar. Add an
  optional "change photo" affordance in step 5, or leave it to
  `profile/edit`? Recommend: leave to `profile/edit`.
- **O1.3** Height / `relationship` — keep or drop? They exist on iOS.
  Recommend: `relationship` in step 4, drop `height` (unused elsewhere on
  web).

---

## 2. QR / Links contact grid

### Current state
- `contact_methods` table exists (not in a tracked migration — base
  schema): `{ id, user_id, slot_order, type, value, is_enabled }`.
- `lib/data.ts` has `fetchContactMethods(userId)` and
  `upsertContactMethod(...)`. Nothing renders them yet — the web
  `ConnectSheet` only shows the rotating QR connect code.
- The post-scan chooser (`app/main/connect/scan` +
  `recordContactMethodChoice`) already records *which* method type a
  scanner picked, for the organizer report — but there's no UI for the
  scannee to *curate* their methods, and no UI for the scanner to actually
  *see* the six values.

### Proposed design
A **2×3 contact grid** (design-alignment spec §5), three surfaces:

- **My Links** — `/main/connect/links` (or a sheet from ProfileTab). The
  six slots the user owns; each slot is a `contact_methods` row keyed by
  `slot_order` 0–5. Tap a slot → edit `type` + `value` + `is_enabled`.
- **Edit Links** — the edit state of a slot (inline or a small sheet):
  a `type` picker from a fixed list + a `value` field + an enable toggle.
- **User Links** — shown to a *scanner* right after a successful connect
  (and from a connection's row in `/main/connections`): the other person's
  enabled methods as tappable rows (`tel:`, `mailto:`, `https://` deep
  links). Picking one here is what feeds `recordContactMethodChoice`.

Grid = the six `slot_order` positions; empty slots show a "+ Add" affordance
in My Links and are hidden in User Links.

### Data model
No new table. Fixed `type` vocabulary (client-side constant, `type` column
stays free text so iOS can extend):
`phone · email · instagram · whatsapp · linkedin · snapchat · x · telegram
· website · custom`. Each type carries an icon, a label, an input hint, and
a link template (`tel:{v}`, `mailto:{v}`, `https://instagram.com/{v}`, …).

### Open questions
- **O2.1** Confirm the type list above (and the default 6 shown for a brand
  new user — recommend phone / email / instagram / whatsapp / linkedin +
  one empty).
- **O2.2** Does `contact_methods` need RLS letting a *connected* user read
  another user's enabled rows? Check current policy — User Links depends on
  it. If not, add a migration: `select` where `is_enabled` and the two
  users share a `connections` row.
- **O2.3** Where does "My Links" live — its own route, or a sheet from
  ProfileTab + ConnectSheet? Recommend: a route, linked from both.

---

## 3. Word meter + organizer activity menu

### Current state
- Nothing exists. No `profile_field_definitions` table, no word/term concept
  on web. The alignment spec (§5 "Refinements") calls for:
  - replacing a full Lexicon screen with a lightweight **word meter** — a
    progress indicator for how many words/terms the user has picked;
  - an **organizer-customisable activity menu** — the list of selectable
    activities/words per event, backed by `profile_field_definitions`.

### Proposed design
- **New table `activity_menu_items`** (rename from the spec's
  `profile_field_definitions` for clarity): `{ id, location_id, label,
  sort_order, created_by, created_at }`. Rows are the words an organizer
  offers at their venue/event.
- **New table `attendee_activity_picks`**: `{ user_id, location_id,
  item_id, picked_at }` — which words an attendee chose while checked in
  there. PK `(user_id, location_id, item_id)`.
- **Organizer UI** — a new section in `/main/venue/*` (its own route
  `/main/venue/activities` or a card in the venue screen): add / reorder /
  delete menu items. Organizer-only (reuse `useIsOrganizer`).
- **Attendee UI** — on `CheckedInHero` (checked-in state), a compact
  "What are you here for?" card: the venue's menu items as `Chip`s,
  multi-select, plus a **meter** — `n / max picked` with a bar. Writes to
  `attendee_activity_picks`.
- The meter is the "word meter": `picked / TARGET` where `TARGET` is a
  small constant (recommend 3).

### Open questions
- **O3.1** Is this **per-venue/event** (my reading) or a **global profile**
  word list? The spec says "per event" — confirm.
- **O3.2** `TARGET` for the meter — 3? Is there a hard max?
- **O3.3** Do attendee picks feed the organizer analytics report (a new
  breakdown tile), or are they only for display / matching? Recommend:
  add a report tile in a follow-up, not this plan.
- **O3.4** Any relation to the existing `friday_night` / looking-for
  profile fields, or fully separate? Recommend: separate.

---

## 4. Badges (Lexicon folded in)

### Current state
- Nothing on web. iOS has an earn/display badges surface. The alignment
  spec folds "Lexicon / Social Settings" into Badges as identity display.
- The nearest existing concept is **verification tags** (`verification_tags`,
  organizer-assigned "DJ", "Host" labels shown on `AttendeeStrip`). Badges
  are broader and (mostly) automatic.

### Proposed design
- **New table `badges`** (catalog): `{ id, key, name, description, icon,
  criteria_kind, criteria_threshold, sort_order }`. Seeded with a fixed
  set, e.g. `first_checkin`, `checkins_10`, `checkins_50`,
  `connections_5`, `connections_25`, `events_5`, `early_adopter`.
- **New table `user_badges`**: `{ user_id, badge_id, earned_at }`.
- **Awarding** — a Postgres function `recompute_user_badges(uid)` that
  counts `location_checkins`, `connections`, distinct event venues, etc.
  and inserts any newly-met `user_badges` rows. Called:
  - after check-in / checkout (`CheckedInHero`),
  - after a connection is made (`recordQrScan` path),
  - on Badges-screen load (cheap catch-up).
  No cron; idempotent inserts (`on conflict do nothing`).
- **Display** — a Badges section in ProfileTab (earned badges as a grid of
  `Chip`/icon tiles) and a full `/profile/badges` route (all badges, earned
  ones lit, locked ones greyed with their criteria text).
- **"Lexicon folded in"** — the word/term identity display: show the
  user's top `attendee_activity_picks` words (from §3) as read-only chips
  alongside their badges on the Badges surface. No separate screen.

### Open questions
- **O4.1** Are any badges **organizer-granted** (like verification tags), or
  all automatic? Recommend: all automatic for launch; organizer-granted is
  a follow-up that can reuse `verification_tags`.
- **O4.2** Confirm the launch badge set + thresholds (the list above is a
  proposal).
- **O4.3** `early_adopter` / time-based badges — award to everyone who
  signs up before a date? Needs that date. Recommend: skip for launch.
- **O4.4** Does earning a badge notify the user (toast / feed entry)?
  Recommend: a lightweight toast on the Badges screen only, no push.

---

## 5. Cross-cutting

- **Migrations:** onboarding = none; QR/Links = maybe one RLS policy (O2.2);
  word meter = one migration (2 tables + RLS); Badges = one migration
  (2 tables + seed + `recompute_user_badges`). Next migration number is
  **0021** (0020 is the unbuilt `location_requests` in a worktree).
- **iOS:** every table added here should be mirrored on iOS later; keep
  `type`/`key` columns free-text-friendly so iOS can extend without a
  lockstep migration.
- **Analytics:** none of these block the organizer report; activity-pick
  and badge tiles in the report are explicit follow-ups.

## 6. Recommended build order & sizing

1. **Onboarding** — no schema; UI-only refactor of `/profile/setup` into a
   5-step wizard. Smallest. ~1 plan.
2. **QR/Links** — 3 small screens over an existing table + possibly 1 RLS
   migration. ~1 plan.
3. **Word meter + activity menu** — 1 migration + organizer CRUD screen +
   an attendee card on CheckedInHero. ~1 plan.
4. **Badges** — 1 migration (tables + function + seed) + a profile section
   + a full screen. Largest; first to drop to fast-follow if Day 2 slips.
