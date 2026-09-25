# The W App — Design System

**Status:** v2, 2026-09-10. Shared reference for `w-app-web` and `w-app-ios`
(Android inherits it when rebuilt). Derived from the web⇄iOS design-alignment
spec (`docs/superpowers/specs/2026-09-03-web-ios-design-alignment-design.md`)
and the P1 dark-glass design-system plan
(`.superpowers/sdd/2026-09-10-p1-dark-glass-design-system/`).

The web implementation of the colour roles is `app/globals.css` — each role is
a `--*` custom property defined twice (dark under bare `:root`, light under
`:root[data-theme='light']`). `lib/theme.ts` exposes them as `var(--token)`
strings (`theme.*`, `lightTheme` / `darkTheme`); `useTheme()` and
`<ThemeScript>` flip `data-theme`. This doc is the human-readable source; the
code must match it.

> **iOS divergence (2026-09-10):** web has moved to a dark-default
> frosted-glass system (P1). `w-app-ios` still tracks the light spec. Role
> names are shared; the active theme and the glass treatment are web-only
> until iOS catches up.

---

## 1. Themes

**Dark is the default and active.** Light is fully specified and switchable via
`useTheme()` + a toggle (on the Profile tab); `prefers-color-scheme` is
honoured on first visit only — once the user (or `<ThemeScript>`) has set an
explicit `data-theme`, the OS preference is ignored. Light ≈ iOS's current
look.

## 2. Color roles

Dark values first (the default). Pull the literals from
`app/globals.css`; the table below mirrors it.

| Role | Dark (default) | Light | Use |
|---|---|---|---|
| `surface` | `#0C0C0E` | `#F0F6FA` | Page / screen background |
| `surfaceRaised` | `#1A1A1D` | `#FFFFFF` | Cards, sheets, list rows |
| `surfaceRaised2` | `#232327` | `#F3F3F3` | Inset fields, nested panels |
| `content` | `#F5F5F7` | `#231E20` | Primary text, icons |
| `contentMuted` | `rgba(245,245,247,.55)` | `#6B6B70` | Secondary text, captions (light was `#919191`, raised to pass 4.5:1) |
| `border` | `rgba(255,255,255,.09)` | `#E7EDF2` | Hairlines, card outlines |
| `accent` | `#EDEDF0` | `#231E20` | Primary actions, links, active nav — **now a neutral** (near-white on dark, near-black on light) |
| `onAccent` | `#0C0C0E` | `#FFFFFF` | Text / icon on top of an `accent` fill |
| `accent2` | `#EC2C91` | `#EC2C91` | Error / destructive role, secondary pink highlight (unchanged) |
| `accentReact` | `#E5322D` | `#E5322D` | The one chromatic token — reaction / like red. **Placeholder** for the founder's landing-page red |
| `countRest` | `#B9B9C0` | `#6B7280` | Resting (non-emphasised) count / meta numerals |
| `tabBarBg` | `#000000` | `#231E20` | Bottom tab bar background |
| `glassFill` | `rgba(255,255,255,.05)` | `rgba(255,255,255,.75)` | Frosted-glass panel fill (behind `backdrop-filter`) |
| `glassBorder` | `rgba(255,255,255,.12)` | `rgba(20,20,25,.10)` | 1px edge on glass surfaces |
| `glassHighlight` | `rgba(255,255,255,.14)` | `rgba(255,255,255,.90)` | Top inset rim highlight on glass |
| `bloomTop` | `rgba(255,255,255,.06)` | `rgba(255,255,255,0)` | Ambient bloom off the top edge of `body` (dark only; transparent in light) |
| `liftBottom` | `rgba(200,212,228,.05)` | `rgba(0,0,0,0)` | Cool ambient lift off the bottom of `body` (dark only) |
| `shadowDepth` | `0 6px 22px rgba(0,0,0,.32)` | `0 4px 16px rgba(35,30,32,.08)` | Elevation shadow for glass surfaces (`elevation.glass`) |
| `gradientPremium` | `#7C5CFF → #D24BD6` | same | Premium / rewards surfaces |
| `gradientWarm` | `#F3B56D → #E8836A` | same | Warm accent surfaces |

Theme-agnostic (same in both, not roles): brand steel gradient
`#5A6570 → #22262B`, success green `#3ECF6B`, field grey `#D5D5D5`.

**`accent` is now a neutral**, not the old cyan `#22C3C9` — cyan is fully
retired from the system. **`accentReact` (`#E5322D`) is the only chromatic
token.** Both `accent` (as the CTA colour) and `accentReact` are placeholders
pending the founder's landing-page red; `accent2` pink is unchanged and now
also carries the error/destructive role.

## 3. Typography

**Montserrat**, four weights: Light 300 · Regular 400 · SemiBold 600 · Bold 700.

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `display` | 32 / 1.15 | 700 | Landing / auth headline |
| `title` | 22 / 1.2 | 700 | Screen title, section header |
| `heading` | 18 / 1.3 | 700 | Card title |
| `label` | 14 / 1.3 | 600 | Buttons, form labels, nav |
| `body` | 15 / 1.5 | 400 | Paragraph text |
| `caption` | 13 / 1.4 | 400 | Metadata, helper text |

## 4. Radius

| Element | Radius |
|---|---|
| Buttons, inputs | `12` |
| Cards | `16` |
| Sheets, modals | `20` |
| Chips, pills, avatars | `999` (fully round) |

## 5. Elevation

- **Light:** soft shadow — `0 4px 16px rgba(35,30,32,.08)` for cards,
  `0 8px 28px rgba(35,30,32,.12)` for sheets/modals.
- **Dark:** uses `--shadow-depth` (a soft black, `0 6px 22px rgba(0,0,0,.32)`,
  exposed as `elevation.glass`) **plus** a `1px` `glassBorder` and a top
  `glassHighlight` inset rim on glass surfaces — the border + rim do the
  edge-definition work a hard shadow would in light.
- `body` also carries two fixed, non-scrolling ambient layers in dark
  (`bloomTop` off the top edge, `liftBottom` off the bottom); both tokens are
  transparent in light, so the layers render nothing there.

## 6. Components

All built natively per platform; one shared vocabulary.

### Button
- **Primary:** filled `accent`, text `onAccent`, weight 700, radius 12,
  padding `14px 24px`, full-width in forms.
- **Secondary:** transparent fill, `1.5px` `accent` border, `accent` text,
  same metrics.
- **Ghost:** no fill/border, `accent` text — inline actions only.
- Disabled: 60% opacity, no pointer.

### Chip / Pill
- Radius 999, padding `6px 12px`, `label` type.
- Default: `surfaceRaised2` fill, `content` text.
- Selected: `accent` fill, `onAccent` text.

### Card
- `surfaceRaised` fill, radius 16, padding 20, elevation per §5.
- CTA card variant: `1.5px` `accent` border.

### Input
- `surfaceRaised` fill, `1px` `border`, radius 12, padding `12px 16px`,
  `16px` font (prevents iOS focus zoom).
- Focus: `border` → `accent`.
- Error: `border` → `accent2`, helper text `accent2`.

### Feed row
- `surfaceRaised` fill, `1px` bottom `border` (or 12-gap stack), padding
  `12px 16px`, round avatar 40, `heading`+`caption` text block.

### Tab bar
- `tabBarBg` background, 3 tabs: **Map · Home (center W) · Messages**.
- Inactive icon `rgba(255,255,255,.55)`, active `accent`.
- Center **W** is emphasised (larger, `accent`).
- Profile is a header icon, not a tab.

## 7. Information architecture

- **3 tabs:** Map · Home · Messages. Profile = header icon (top-right).
- **Home** is context-aware: not-checked-in (nearby venue card + quick-access
  row + friends activity) ⇄ checked-in (venue + live connections + quick-access
  row + venue feed).
- **Quick-access row** inside Home: History · Rewards · Connect.
- Header: W wordmark left, profile icon right.

## 8. Open items

- Confirm light `border` `#E7EDF2` against iOS asset catalog.
- Replace the `accent` / `accentReact` red placeholders with the founder's
  real landing-page red; decide `accent2`'s fate once that lands.
- P7: tokenize the remaining ad-hoc literals flagged with `// TODO(P7)` —
  auth error-banner backgrounds (`#FEF2F2` / `#FECACA`), the ProfileTab
  accent-tint (`rgba(34,195,201,.12)`), MapTab badge tints, and the Leaflet
  map chrome in `components/WMap.tsx` (always-light, sits on OSM tiles).
- iOS: adopt the dark theme + glass treatment; adopt the neutral `accent` /
  `onAccent` / `accentReact` split; shift cyan `#17BFD9` → the new roles;
  5-tab → 3-tab IA.
