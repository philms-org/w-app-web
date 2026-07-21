# Main Feed Restructure + Dark Restyle (Phase 1)

**Date:** 2026-07-21
**Status:** Approved
**Repo:** `/Users/sr/w-app-web` (`philms-org/w-app-web`)

## Background

The web app (Next.js 15 / React 19 / TypeScript / Tailwind v4) already has working auth,
profile setup, and Supabase-backed tabs for Home, Map, Location, Messages, and Profile.
However, the current UI does not match the actual W App design:

- **Wrong background/composition.** The real iOS app sets `view.backgroundColor = Colors.black`
  on core screens, with light `back_gray` pill fields on top for contrast. The web app currently
  uses a light `#F0F6FA` background with a cyan→pink gradient header — the inverse of the real
  design.
- **Wrong nav structure.** The design PDFs specify a 3-icon tab bar (pin/location | W | envelope),
  with Profile, History, and Rewards reached via quick-access buttons on the Main Feed screen —
  not as their own persistent tabs. The web app currently has 5 tabs (Home, Map, Location,
  Messages, Profile).
- **Invented content.** "Socializing/Business/Love" quick-action categories and a
  Settings/Notifications/Privacy/Help menu appear in the web app but not in any design PDF.
- **Leftover "wing" language.** The design PDFs (and this app's terminology generally) still
  carry wordplay from the old "Wing Me" brand — "winged into a location," a wing-flourished W
  icon in the tab bar. Now that the product is "The W App," this is retired: no wing imagery,
  no wing-themed terminology, in code, docs, or UI copy.

Brand colors are already correct: web app's `#17BFD9` and `#EC2C91` are exact matches to the
iOS asset catalog's `blue.colorset` and `pink.colorset`. This phase is a structural and
compositional fix, not a color-scheme change.

## Scope

**In scope (Phase 1):**
- Shared color tokens matching the real iOS asset catalog
- Tab bar reduced from 5 items to 3 (Map, Main Feed, Messages)
- Merge `HomeTab` + `LocationTab` into one `MainFeedTab` with two states (no-location /
  checked-in), matching the PDF's "Main Feed" screen
- Restyle `MapTab`, `MessagesTab`, `ProfileTab`, and the location-permission modal to the dark
  theme
- Quick-access row (History, Rewards, Profile) on the Main Feed's no-location state
- Redesign the tab bar's center W icon as a plain wordmark/icon with no wing-shaped flourishes
  (currently drawn as literal "Left Wing"/"Right Wing" SVG paths in `TabBar.tsx`)

**Out of scope (Phase 2 — separate future spec):**
- Building the real Profile screen per the design PDF (hero carousel, flags, links pill, etc.)
- QR / Contacts screen
- History screen (past check-ins)
- Rewards screen
- Checked-in-state tabs beyond the basic people-here list (Who's Here / Connections /
  Jukebox / Photo Booth / What's up / Announcements)

Phase 1 leaves History and Rewards quick-access buttons in place but inert ("Coming soon"),
since their destination screens don't exist yet.

## Architecture

### Color tokens

New file `lib/theme.ts`, values sourced directly from
`/Users/sr/w-app-ios/The W App/Others/Assets.xcassets/Colors/*.colorset/Contents.json`:

```ts
export const theme = {
  bg: '#23201F',      // Colors.black (view background)
  pill: '#F0F6FA',     // Colors.back_gray (field/card background)
  accent: '#17BFD9',   // Colors.blue (cyan)
  accent2: '#EC2C91',  // Colors.pink
};
```

No new dependencies. The codebase's existing inline-`style={{}}` convention is kept as-is —
Tailwind is installed but not actually used for styling today, and migrating to Tailwind
classes would be an unrelated refactor outside this phase's scope.

### Tab bar

`components/TabBar.tsx` drops from 5 tabs to 3:
- `map` (pin icon) — unchanged destination (`MapTab`)
- `feed` (plain W icon, center, no wing flourishes) — new destination (`MainFeedTab`, replaces
  `home` + `location`); the existing SVG's `{/* Left Wing */}` / `{/* Right Wing */}` paths are
  replaced with a simple W glyph
- `messages` (envelope icon) — unchanged destination (`MessagesTab`)

`profile` is removed from the tab bar's rendered icon list but remains a valid `activeTab`
value in the zustand store — reached via the Main Feed's quick-access button instead of a
persistent tab.

### Main Feed

New `components/tabs/MainFeedTab.tsx` replaces `HomeTab.tsx` and `LocationTab.tsx` as the
`feed` tab's destination. Single component, two states keyed off `selectedLocation` (same
pattern `LocationTab` already uses internally):

- **No-location state:** venue-search prompt, based on `LocationTab`'s existing empty-state
  visual (already dark, on-brand — radial cyan-glow gradient). Adds a quick-access row of 3
  circle buttons — History, Rewards, Profile — per the design spec.
  - Profile button → `setActiveTab('profile')`
  - History / Rewards buttons → "Coming soon" state (Phase 2 builds real destinations)
- **Checked-in state:** `LocationTab`'s existing `selectedLocation` branch (check-in/out,
  people-here list via `fetchPresence`), reused as-is aside from restyling any remaining
  light-mode elements.

`HomeTab.tsx` and `LocationTab.tsx` are deleted once `MainFeedTab.tsx` supersedes them.

### Other screens

- `MapTab.tsx`, `MessagesTab.tsx`, `ProfileTab.tsx`: restyle only (dark background, cyan/pink
  accents per `lib/theme.ts`) — no structural or data changes.
- `app/main/page.tsx`: swap `HomeTab`/`LocationTab` imports for `MainFeedTab` in the tab
  switch; restyle the location-permission modal (currently light/white) to match.

## Data flow

No changes. Reuses existing `lib/data.ts` functions as-is: `checkIn`, `checkOut`,
`fetchPresence`, `fetchVenues`. No new Supabase tables, columns, or RLS policy changes.

## Error handling

Keep the existing try/catch + `console.error` convention already used throughout the
codebase. No new error UI introduced — this is a UI-only phase.

## Testing

No automated test suite exists in this repo. Verification is manual, via the dev server:

1. Load Main Feed with no location selected → confirm dark empty-state renders with quick-access row
2. Browse Map tab → select a venue → confirm checked-in Main Feed state renders (check-in fires, people-here list loads)
3. Check out → confirm return to no-location state
4. Messages tab renders in dark theme
5. Profile quick-access button → confirm navigation to Profile tab
6. History / Rewards quick-access buttons → confirm inert "Coming soon" state (no dead links/crashes)

## Open questions / risks

None outstanding — all decisions confirmed with user during brainstorming (color values
verified against iOS asset catalog; 3-tab structure confirmed over keeping 5 tabs; "wing"
language/imagery confirmed fully retired, wording and the tab-bar logo motif both).
