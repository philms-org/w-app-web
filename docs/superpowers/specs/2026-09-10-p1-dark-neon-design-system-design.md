# P1 — Dark-Glass Design System + Theme Switching

**Status:** design, 2026-09-10. First sub-project of the dark-direction
re-skin program (P1–P7 — see "Program context" below).

**Spec author note:** the visual direction was settled interactively with
the founder via the brainstorming visual companion
(`.superpowers/brainstorm/52148-1789057393/content/07-final.html` is the
locked reference). This doc turns that into an engineering shape.

---

## Program context

The founder's product mockups are a **dark, frosted-glass** design — the
opposite of what shipped. A prior "web⇄iOS design alignment" pass flipped
the web app to **light** (`docs/design-system.md` v1: "light is default
and active"). The mockups also introduce content the app has no data for
(message reactions, venue posts, role badges, rich feed rows).

That is program-sized, decomposed into:

| # | Sub-project | New DB? | Depends on |
|---|---|---|---|
| **P1** | **this doc** — dark-glass token system + theme switching + primitives | no | — |
| P2 | Rich feed rows (age/city/nationality/role/verified + quoted message) | no | P1 |
| P3 | Message reactions (`message_reactions` + RLS + toggle RPC + count UI) | yes | P1 |
| P4 | Venue posts (organizer-authored feed entries + composer) | yes | P1 |
| P5 | "WHO'S HERE" venue screen (banner + blurred backdrop + unified feed) | no | P1,P2,P4 |
| P6 | Locked-feed gate (blur + padlock "Unlock who's near") | no | P1 |
| P7 | Whole-app screen re-skin onto P1 (glass/bloom treatment everywhere) | no | P1 |

Each Pn gets its own spec → plan → build. This doc is **P1 only**.

---

## Goals

1. `lib/theme.ts` carries a full **dark-glass** token set (glass fill /
   blur / border / highlight, super-light top bloom, super-light bottom
   lift, black drop-shadow depth, sober-grey→red reaction count).
2. The active theme is **switchable at runtime**: dark by default,
   `prefers-color-scheme` respected on first visit, an explicit toggle
   that persists and wins. **No flash** on load. Light stays fully
   defined and reachable — not removed.
3. The shared **primitives** (`components/ui/primitives.tsx`) render in
   the glass language, and the new primitives the mockups need exist.
4. A **triage sweep** makes every existing screen *legible* in dark
   (no light-on-black text, no stark white cards) — not polished.

## Non-goals (explicitly deferred)

- Any per-screen glass/bloom re-skin beyond legibility → **P7**.
- The winged-**W** brand mark as a final asset — P1 ships a **placeholder**
  inline SVG; the founder provides the real SVG/PNG later.
- The real **landing-page red** — P1 uses placeholder `#E5322D`; the token
  is swapped when the founder sends the hex.
- Where the theme toggle finally lives in the IA → P7. P1 parks it on
  `/profile`.
- Typography change — staying on **Montserrat** (heavier weights only).
- Message-reaction data/behaviour — the `ReactionCount` primitive is
  presentational only in P1; wiring is **P3**.
- iOS. `docs/design-system.md` is shared with `w-app-ios`; P1 updates the
  web section and flags the divergence, it does not touch iOS.

---

## Locked visual reference

From `07-final.html` (founder-approved):

- **Ground** `#0C0C0E`. Top ~30%: a *super-light* white bloom
  `linear-gradient(180deg, rgba(255,255,255,.06) 0%, rgba(255,255,255,.025) 45%, transparent 100%)`.
  Bottom ~26%: a *super-light* cool lift
  `linear-gradient(0deg, rgba(200,212,228,.05), transparent)`, `blur(6px)`.
  **No** haze clouds, **no** fog band (the "smoked" variants were rejected).
- **Glass** — panels, icon tiles, feed card, bottom nav: translucent
  white fill `rgba(255,255,255,.045–.055)`, `backdrop-filter: blur(16–26px)`
  (+ `saturate(1.05–1.1)` on the large panels), `1px solid rgba(255,255,255,.12–.14)`
  border, `inset 0 1px 0 rgba(255,255,255,.12–.16)` top rim. Depth from
  `0 4–8px 14–30px rgba(0,0,0,.3–.4)` **black drop shadow — not glow**.
- **`+` button** — white glass, **no colour**.
- **Reaction count** — `#B9B9C0` at rest; turns **landing-red** when the
  current user has reacted; **number only, no heart, no glow**.
- **Section header** — uppercase, `letter-spacing:.17em`,
  `border-bottom:1.5px solid rgba(255,255,255,.32)`.
- **Nav logo** — placeholder; colour parked.
- Feed card sits over a blurred copy of what's behind it.

---

## Mechanism — CSS custom properties + a thin `useTheme()`

`theme.*` is spread into inline `style={{}}` at **784 call sites across 65
files**; it is a static module constant, only **13 distinct keys** are in
use, and there is no provider today.

### Decision

Tokens become **CSS custom properties**; the `theme` object's values
become `var(--token)` **strings**. All 784 call sites keep compiling and
keep working — they just resolve to whatever `--token` currently is.

- **`app/globals.css`** defines every token twice:
  `:root, :root[data-theme="dark"] { … }` (dark = the bare-root default)
  and `:root[data-theme="light"] { … }`. A
  `@media (prefers-color-scheme: light)` block re-states the light values
  under `:root:not([data-theme])` so a first-time visitor with an OS
  light preference and no stored choice gets light.
- **Switching** = set `document.documentElement.dataset.theme`. No React
  re-render, SSR-safe, instant.
- **No flash** — `components/ThemeScript.tsx` renders a tiny
  `dangerouslySetInnerHTML` `<script>` in `app/layout.tsx` `<head>`,
  before any body paint:
  ```js
  try {
    var s = localStorage.getItem('w-app-theme');
    var m = s || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.dataset.theme = m;
  } catch (e) { document.documentElement.dataset.theme = 'dark'; }
  ```
- **`lib/hooks/useTheme.ts`** — `ThemeProvider` (wraps `<body>`'s children
  once in `app/layout.tsx`) + `useTheme()` returning
  `{ mode: 'dark'|'light', setMode, toggle }`. It hydrates `mode` from
  `document.documentElement.dataset.theme`, writes `localStorage` +
  `dataset.theme` on change, and — only while no stored choice exists —
  follows live `prefers-color-scheme` changes.

### Rejected alternatives

- **React context returning a theme object** — would force all 65 files to
  `const theme = useTheme()` in P1, make every consumer a client
  component, and re-render the tree on toggle. Too big a blast radius for
  a foundation sub-project.
- **Hard flip with no switch** — founder wants both themes kept.

### Constraint this imposes

No JS colour math on a token (`theme.accent + '80'` breaks when the value
is `var(--accent)`). A grep of the repo shows **zero** such usage today
(alpha is always `rgba()` literals). Task 1 re-runs that grep; any hit
gets a dedicated `--token-NN` alpha token instead.

---

## `lib/theme.ts` changes

Keep `ThemeRoles`, `lightTheme`, `darkTheme`, `legacyView`, `theme`,
`radius`, `type`, `onAccent` **names** intact. Changes:

1. **Every colour literal in `lightTheme` / `darkTheme` moves to a
   `var(--x)` string.** The maps become the *contract* (which roles
   exist); `globals.css` holds the *values*. e.g.
   `darkTheme.surface = 'var(--surface)'`.
2. **No cyan.** `accent` (was `#22C3C9`) becomes a **neutral** — it is
   the filled-CTA / interactive / link colour only, never a brand hue.
   `onAccent` (text on an `accent` fill) becomes a role so it can flip.
   | role | dark value | light value |
   |---|---|---|
   | `accent` | `#EDEDF0` (near-white) | `#231E20` (ink) |
   | `onAccent` | `#0C0C0E` | `#FFFFFF` |
   `accent2` (`#EC2C91` pink — currently used for form errors / alerts)
   is **left untouched** in P1; whether it collapses into `accentReact`
   is a P7 question.
3. **New roles** (added to `ThemeRoles`, defined for both themes):
   | role | dark value | light value (P1 = "legible", polish in P7) |
   |---|---|---|
   | `glassFill` | `rgba(255,255,255,.05)` | `rgba(255,255,255,.75)` |
   | `glassBorder` | `rgba(255,255,255,.12)` | `rgba(20,20,25,.10)` |
   | `glassHighlight` | `rgba(255,255,255,.14)` | `rgba(255,255,255,.9)` |
   | `bloomTop` | `rgba(255,255,255,.06)` | `rgba(255,255,255,0)` |
   | `liftBottom` | `rgba(200,212,228,.05)` | `rgba(0,0,0,0)` |
   | `shadowDepth` | `0 6px 22px rgba(0,0,0,.32)` | `0 4px 16px rgba(35,30,32,.08)` |
   | `countRest` | `#B9B9C0` | `#6B7280` |
   | `accentReact` | `#E5322D` *(placeholder landing-red)* | `#E5322D` |
   `glassBlur` is a non-colour token: `'blur(20px) saturate(1.08)'` — put
   it on the `type`/`elevation` side, not `ThemeRoles`, since it is
   theme-agnostic.
4. **`elevation`** gains `glass: 'var(--shadow-depth)'`.
5. **`legacyView`** unchanged in shape; its outputs are now `var()`
   strings via the role maps. `onAccent` moves from a bare constant to a
   per-theme role (see item 2).

`scripts/verify-theme-tokens.mjs` is extended: for every key in
`ThemeRoles`, assert (a) the value is `var(--x)`, (b) `--x` is defined in
`globals.css` under both `[data-theme="dark"]` and `[data-theme="light"]`.

---

## Primitives — `components/ui/primitives.tsx`

**Restyle in place** (same exports, same props): `Button`, `Card`,
`Chip`, `Input`, `FeedRow` — glass fill, `glassBorder`, top rim
highlight, `shadowDepth` for depth. `Button` primary stays a solid
`accent` fill (that is the toggle/CTA affordance, not the red).

**New primitives:**

| primitive | shape |
|---|---|
| `GlassPanel` | the frosted container (banner / hero). `blur`, border, rim, shadow. Optional `floatingAction` slot for the dipping `+`. |
| `GlowIconButton` | square-ish (radius 18–20) glass tile, icon centred, hairline border + inner rim. Name kept for familiarity; it does **not** glow — depth is shadow. |
| `SectionHeader` | uppercase, tracked, 1.5px bottom rule. |
| `LockedOverlay` | absolutely-positioned blur layer + centred padlock (plain, no neon) + 2-line copy. Children = the real (blurred) content. |
| `ReactionCount` | `{ count, reacted }` → `countRest` grey, or `accentReact` when `reacted`. Number only. **Presentational** — P3 wires the toggle. |
| `WMark` | inline SVG placeholder winged-W. Single `size` prop, `currentColor`. Clearly commented as swap-on-brand-delivery. |

**`app/dev/primitives/page.tsx`** — a preview route rendering every
primitive in every state, in both themes (via a local toggle). Not linked
from the app.

---

## `app/globals.css`

- Add the `:root` / `[data-theme]` / `@media` token blocks above.
- `body` background becomes `var(--surface)`; add the two bloom/lift
  gradient layers as fixed pseudo-elements on a wrapper (or `body::before`
  / `body::after`) so they sit behind all content and don't scroll.
- Remove any remaining hardcoded light-only `background`/`color` on
  `body` / `html`.

---

## Triage sweep

**Goal: legible, not polished.** Grep the 65 screens for the offenders
that won't respond to the token flip:

- `background: '#fff'` / `'white'` / `#FFFFFF` on cards, sheets, modals
- text colours `#374151`, `#6B7280`, `#111`, `#231E20` used as literals
- `#17BFD9` (old cyan), `#F3F4F6`, `#D1D5DB`, `#E5E7EB`

Map each to the nearest role (`surfaceRaised`, `content`, `contentMuted`,
`border`, `accent`). Scope: **only** swaps that prevent an unreadable
screen. Anything cosmetic → noted in the P7 backlog, not touched here.
Expected touch set is known-large (MapTab modal, admin pages, auth,
onboarding, profile/edit) — Task list groups them.

---

## Tasks (outline — full plan via writing-plans)

1. `lib/theme.ts` role contract + `globals.css` token blocks + extend
   `verify-theme-tokens.mjs`; re-run the JS-colour-math grep.
2. `ThemeScript` + `useTheme`/`ThemeProvider` + wire into `app/layout.tsx`;
   no-flash verified on hard reload.
3. `ThemeToggle` primitive + drop on `/profile`.
4. Restyle existing primitives + add the 6 new ones + `/dev/primitives`.
5. `globals.css` body bloom/lift layers.
6. Triage sweep — group A: auth + onboarding + profile.
7. Triage sweep — group B: home + venue + map.
8. Triage sweep — group C: admin + connect + misc.
9. Full-route legibility pass in both themes; update
   `docs/design-system.md` web section + flag iOS divergence.

Each task: `npx tsc --noEmit` + `next build` clean, commit.

---

## Testing

No automated suite in the repo. Gate per task = `tsc` + `next build` +
`npm run lint` + `node scripts/verify-theme-tokens.mjs`. Final:

- Every route visited in **dark** and **light** — text readable, no white
  flashes, no invisible controls.
- Hard reload on 3+ routes with each of: no stored pref + OS dark, no
  stored pref + OS light, stored `light`, stored `dark` — correct theme
  paints with **no flash**.
- Toggle on `/profile` flips live, persists across reload, and stops
  following the OS once used.
- `prefers-color-scheme` changed at the OS while the app is open and no
  explicit choice made → app follows.

---

## Open items (tracked, not blocking P1 start)

1. **Landing-page red** — founder to send the hex; swap `--accent-react`
   (currently `#E5322D`).
2. **Winged-W asset** — founder to send SVG/PNG; swap `WMark` internals.
3. **Toggle placement** — final IA home for the theme control is a P7
   decision.
4. ~~`accent` cyan scope~~ **RESOLVED (founder, 2026-09-10): no cyan.**
   `accent` is neutral (dark `#EDEDF0` / light `#231E20`), used only for
   filled CTAs / interactive / links. `accentReact` (landing-red) is the
   only chromatic token. `#17BFD9` / `#22C3C9` literals found in the
   triage sweep map to `accent`, not kept.
