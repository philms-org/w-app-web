# W App — Web ⇄ iOS Design Alignment

**Date:** 2026-09-03
**Status:** Direction approved in brainstorm. Pending spec self-review + implementation plan.
**Scope:** Web (`w-app-web`) and iOS (`w-app-ios`) only. Android (`w-app-android`) is the legacy "Wing Me" build and is out of scope — it inherits this document whenever it is rebuilt.
**Deliverable:** Gap analysis + unified visual direction. Per-feature UI specs and build plans come after this.

---

## Purpose

Web and iOS share tokens and a backend but have drifted apart on theme, navigation, component language, and feature surface. This document records the audit and locks a single design direction so all subsequent feature work targets one system.

---

## 1. Shared baseline (already aligned — do not disturb)

- Montserrat, four weights (Light / Regular / SemiBold / Bold).
- Core color tokens on web were seeded directly from the iOS asset catalog (commit `e8663ee`).
- Same Supabase project and schema.
- Geofence check-in model: entry → live presence → auto-checkout after a grace period.
- Both nominally describe a 3-tab bar with a center **W**.

---

## 2. Divergences found (the audit)

### Theme
- **iOS:** light only. `#F0F6FA` ground, white cards, `#231E20` ink. Colorsets have no dark appearance.
- **Web:** turned dark in commit `67d98ea` ("Redesign home tab: dark/teal theme, 3-tab nav"). `lib/theme.ts` → `bg #0d0d0f`, surfaces `#1a1a1d`/`#232327`, text `#f5f5f7`; teal drifted to `#22c3c9`; new gradient families (premium purple `#7c5cff→#d24bd6`, warm `#f3b56d→#e8836a`).
- **Web is half-migrated:** `tailwind.config.ts` + `globals.css` still carry the *light* iOS tokens; `app/main/page.tsx`'s shell and the Map loader still render light while `HomeTab`/`TabBar`/`AppHeader` render dark.

### Accent
- iOS `#17BFD9` (cyan) vs web `#22C3C9` (green-teal).

### Information architecture
| | iOS today | Web today |
|---|---|---|
| Tabs | 5: Home feed · Locations · Venue/check-in (center W) · Messages · Profile | 3: Map · Home (center W) · Messages |
| Home vs. venue | Separate tabs | Merged — Home swaps `NearbyBanner` ⇄ `CheckedInHero` |
| Profile | Dedicated tab | Header icon |
| History / Rewards | Pill buttons docked in the venue screen | Quick-access row in Home (+ a "Connect" entry iOS lacks) |
| Naming | "Locations" | "Map" |

### Components
- **iOS:** `WPillButton` (fully rounded), 14px card radius, 1.5px accent borders on CTA cards, soft shadows, consistent `*Designable` classes.
- **Web:** inline styles on nearly every element, no component layer (`globals.css`'s `.btn-primary`/`.card` layer was deleted), radii vary 12–20px.

### Feature surface
See §5.

---

## 3. Decisions (resolved aspect-by-aspect)

### 3.1 Theme — dual-theme system, light default
One set of **named semantic color roles**, each with a light value and a dark value. Light is the default and is essentially iOS's current look. Dark is a properly designed second mode, shared across platforms, shipped when ready (not gated to launch — see §7).

### 3.2 Accent — `#22C3C9`
Canonical `accent` = `#22C3C9`. iOS shifts its teal to match (asset catalog + any hardcoded cyan). May be tuned per-theme later (a touch brighter in dark so it doesn't glow on black) but starts from one value.

### 3.3 Tab bar — 3 tabs
`Map` · `Home` (center **W**) · `Messages`.
- Profile moves to a **header icon** on iOS too (matches web).
- `History` / `Rewards` / `Connect` = a quick-access row inside Home, on both platforms.
- iOS drops its separate "Home feed" and "Venue" tabs.
- Tab name **"Map"** (web's term) is canonical.

### 3.4 Merged Home — web's model, adopted on iOS as-is
Center **W** is one screen with two states:
- **Not checked in:** nearby venue card (Check In when in range / Peek when not) + quick-access row + friends' activity (blurred until the user has connections).
- **Checked in:** venue + live connections strip + quick-access row + this venue's live feed.
- **Header:** W wordmark left, profile icon right.

### 3.5 Component kit — one shared vocabulary, built natively per platform
- **Radius:** buttons & inputs `12` · cards `16` · chips/pills `999` · sheets/modals `20`.
- **Elevation:** light → soft shadow; dark → `1px` hairline border, no shadow.
- **Buttons:** primary = filled accent, 700 weight; secondary = 1.5px accent outline; both `12px` rounded-rect. iOS `WPillButton` becomes rounded-rect.
- **Type:** Montserrat — 700 headings / 600 labels / 400 body.

### 3.6 Feature parity — two-way build-out
See §5.

---

## 4. Semantic color roles (starting map — finalize in the design-system doc)

Each role takes a light value (from iOS today) and a dark value (from web, cleaned up).

| Role | Light | Dark |
|---|---|---|
| `surface` | `#F0F6FA` | `#0D0D0F` |
| `surface-raised` (cards) | `#FFFFFF` | `#1A1A1D` |
| `surface-raised-2` | `#F3F3F3` | `#232327` |
| `content` | `#231E20` | `#F5F5F7` |
| `content-muted` | `#919191` | `rgba(245,245,247,.55)` |
| `border` | `#E7EDF2` *(approx — confirm)* | `rgba(255,255,255,.09)` |
| `accent` | `#22C3C9` | `#22C3C9` *(may brighten)* |
| `accent-2` (pink) | `#EC2C91` | `#EC2C91` |
| `tab-bar-bg` | `#231E20` | `#000000` |
| `gradient-premium` | `#7C5CFF → #D24BD6` | same |
| `gradient-warm` | `#F3B56D → #E8836A` | same |

---

## 5. Feature parity matrix + scope

| Feature / screen | Web | iOS | Direction |
|---|---|---|---|
| **Consumer — iOS has, web lacks** | | | |
| Events (create / edit / browse) | ✗ | ✓ | → web |
| Badges (earn / display) — **now includes Lexicon** | ✗ | ✓ | → web |
| Rewards — full (9 templates, Activity/Premium) | thin | ✓ | → web (organizer-first, see below) |
| QR Code + My/User/Edit Links (2×3 contact grid) | inline only | ✓ | → web |
| Group Chat (create / members / edit) | ✗ | ✓ | → web |
| Block List | ✗ | ✓ | → web |
| ~~Lexicon / Social Settings~~ (removed as standalone) | — | — | folded into Badges + word meter |
| Attendee History screen | partial | ✓ | → web |
| Full profile setup (5 steps) | partial | ✓ | → web |
| Dedicated Friends Feed | locked stub | ✓ | → web |
| **Organizer / infra — web has, iOS lacks** | | | |
| Venue Zones management (organizer CRUD) | ✓ | ✗ | → iOS |
| Venue Chat: join-request / approval + admin | ✓ | basic | → iOS |
| Admin venue tag console | ✓ | ✗ | → iOS |
| Organizer zone-tracking / analytics presence | ✓ | ✗ | → iOS |
| Privacy page (tracking disclosure) | ✓ | ✗ | → iOS |
| Peek modal (preview-only) | ✓ | ✗ | → iOS |
| Pull-to-refresh + manual location retry | ✓ | ✗ | → iOS |
| **Spec'd, built on neither** | | | |
| Engagement points / leveling | ✗ | ✗ | design once, both |

### Refinements from review

- **Lexicon / Social Settings** removed as a standalone parity screen.
- **Lexicon folds into Badges** — the word/term selection becomes part of the Badges surface (identity display), not its own screen.
- On **web**, replace a full Lexicon screen with a lightweight **word meter** (progress indicator for words/terms picked) plus an **organizer-customizable "activity menu"** — the list of selectable activities/words per event, backed by `profile_field_definitions`.
- **Rewards is organizer-first:** the organizer builds rewards from templates and controls verification; the consumer claim flow stays light (show deal text + instructions + QR, staff scans to grant). *[OPEN: user note "the claim flow can be more organizer and ripple that then have lead" — confirm exact intent next session.]*
- **Zones + organizer analytics on iOS are must-have, not optional** — iOS cannot run an event without them.

### Must-have for launch parity
- **Web:** QR/Links contact exchange · full 5-step onboarding · word meter + organizer activity menu · Badges (Lexicon folded in)
- **iOS:** Venue Zones management · organizer analytics · Privacy page
- **Both:** engagement / leveling system — design now (shared spec)

### Stage later
- **Web:** Events · Group Chat · Block List · Attendee History screen · dedicated Friends Feed · Rewards organizer template editor (full expansion)
- **iOS:** Peek modal · pull-to-refresh + manual location retry · Admin tag console · Venue Chat join-approval polish

---

## 6. Plan of attack (staged)

1. **Design-system doc** — lock the semantic color roles (light + dark values), component specs, type scale, radius/elevation rules. One doc, referenced by both repos.
2. **Web theme reconciliation** — collapse `theme.ts` + `tailwind.config.ts` + `globals.css` into one token source built on the semantic roles; light default; dark wired behind the same role names. Fix the half-migrated screens (`app/main` shell, Map loader).
3. **Web component layer** — build the approved kit (button / chip / card / input / feed-row / tab-bar) as real components; replace inline styles on the touched screens.
4. **iOS accent + token pass** — `Colors.swift` / asset catalog → semantic-role names; shift cyan to `#22C3C9`; add dark values.
5. **iOS IA change** — 5-tab → 3-tab; Profile to header; merge Home + Venue into the context-aware center **W**; History / Rewards into the quick-access row.
6. **Parity build-out** — per-feature specs, must-have bucket first, in the order above.
7. **Engagement / leveling** — its own spec, both platforms.

---

## 7. Open items for next session

- Confirm the Rewards "ripple / lead" intent (§5).
- Finalize the semantic-role hex values, especially the light `border` and whether dark `accent` brightens.
- Decide whether dark theme ships at launch or as a fast-follow.
- Android: inherits this document when rebuilt — note only, no action now.
