# The W App — Design System

**Status:** v1, 2026-09-08. Shared reference for `w-app-web` and `w-app-ios`
(Android inherits it when rebuilt). Derived from the web⇄iOS design-alignment
spec (`docs/superpowers/specs/2026-09-03-web-ios-design-alignment-design.md`).

The web implementation of the color roles is `lib/theme.ts`
(`lightTheme` / `darkTheme`). This doc is the human-readable source; the code
must match it.

---

## 1. Themes

Two themes, **light is the default and active**. Dark is fully specified and
implemented (`darkTheme`) but not yet wired to `prefers-color-scheme` or a
toggle. Light ≈ iOS's current look.

## 2. Color roles

| Role | Light | Dark | Use |
|---|---|---|---|
| `surface` | `#F0F6FA` | `#0D0D0F` | Page / screen background |
| `surfaceRaised` | `#FFFFFF` | `#1A1A1D` | Cards, sheets, list rows |
| `surfaceRaised2` | `#F3F3F3` | `#232327` | Inset fields, nested panels |
| `content` | `#231E20` | `#F5F5F7` | Primary text, icons |
| `contentMuted` | `#919191` | `rgba(245,245,247,.55)` | Secondary text, captions |
| `border` | `#E7EDF2` | `rgba(255,255,255,.09)` | Hairlines, card outlines |
| `accent` | `#22C3C9` | `#22C3C9` | Primary actions, links, active nav |
| `accent2` | `#EC2C91` | `#EC2C91` | Secondary highlight (pink) |
| `tabBarBg` | `#231E20` | `#000000` | Bottom tab bar background |
| `gradientPremium` | `#7C5CFF → #D24BD6` | same | Premium / rewards surfaces |
| `gradientWarm` | `#F3B56D → #E8836A` | same | Warm accent surfaces |

Theme-agnostic (same in both, not roles): brand steel gradient
`#5A6570 → #22262B`, success green `#3ECF6B`, field grey `#D5D5D5`.

`accent` may be tuned per-theme later (slightly brighter in dark) — one value
for now.

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
- **Dark:** no shadow — a `1px` `border` hairline instead.

## 6. Components

All built natively per platform; one shared vocabulary.

### Button
- **Primary:** filled `accent`, text `#0D0D0F`, weight 700, radius 12,
  padding `14px 24px`, full-width in forms.
- **Secondary:** transparent fill, `1.5px` `accent` border, `accent` text,
  same metrics.
- **Ghost:** no fill/border, `accent` text — inline actions only.
- Disabled: 60% opacity, no pointer.

### Chip / Pill
- Radius 999, padding `6px 12px`, `label` type.
- Default: `surfaceRaised2` fill, `content` text.
- Selected: `accent` fill, `#0D0D0F` text.

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
- Decide whether dark `accent` brightens for the dark theme.
- Decide if dark ships at launch or fast-follow.
- iOS: adopt these roles in `Colors.swift` / asset catalog; shift cyan
  `#17BFD9` → `#22C3C9`; 5-tab → 3-tab IA.
