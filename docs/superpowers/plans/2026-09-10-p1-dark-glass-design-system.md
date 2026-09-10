# P1 — Dark-Glass Design System + Theme Switching — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `w-app-web` a runtime-switchable theme (dark default, light kept) and a dark, frosted-glass token + primitive layer, and make every existing screen legible under it.

**Architecture:** Colour tokens move from hard-coded hex in `lib/theme.ts` to **CSS custom properties** defined in `app/globals.css`; the `theme`/`lightTheme`/`darkTheme` objects keep their keys but their values become `var(--token)` strings, so all ~784 `theme.*` call sites keep working untouched and just resolve differently. A pre-paint inline script stamps `data-theme` on `<html>` (localStorage → `prefers-color-scheme` → dark) so there is no flash; a small `useTheme()` context drives an explicit toggle. Existing primitives are restyled to glass and six new primitives are added. A triage sweep then remaps the hard-coded light-only colours still sprinkled through screens so nothing is unreadable in dark. Full glass/bloom polish per screen is **P7**, out of scope here.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind (config-level colours only; components use inline `style={{}}` per repo convention), plain CSS custom properties, `localStorage`, `matchMedia`. No new dependency.

**Spec:** `docs/superpowers/specs/2026-09-10-p1-dark-neon-design-system-design.md`

## Global Constraints

- **No automated test suite exists in this repo.** `package.json` scripts are `dev`/`build`/`build:vercel`/`start`/`lint`. Every task ends with `npx tsc --noEmit` (must stay clean), `npm run build` (lint + type gates are ON in `next.config.ts` — a warning is fine, an error fails), and a **manual browser check** in the running dev server. Tasks that touch tokens also run `node scripts/verify-theme-tokens.mjs`.
- **Inline `style={{}}`** everywhere — no Tailwind utility classes in components, no CSS modules. The only Tailwind edit in this plan is `tailwind.config.ts` colour values.
- **Dark is the default theme.** Light stays fully defined and reachable via the toggle — never deleted.
- **`prefers-color-scheme` is respected on first visit only** (no stored choice). Once the user toggles, their choice persists and wins, and the app stops following the OS.
- **No cyan.** `accent` is a neutral: dark `#EDEDF0`, light `#231E20`. `accentReact` (placeholder landing-red `#E5322D`) is the only chromatic token. Any `#22C3C9` / `#17BFD9` literal found in the sweep maps to `accent`.
- **Placeholder landing-red** is `#E5322D` — one token, `--accent-react`, so the founder's real hex is a one-line change later.
- **Placeholder brand mark** — `WMark` is an inline SVG stand-in, commented as swap-on-delivery. Do not spend effort making it "final".
- **Montserrat stays.** No font swap. Heavier weights / tighter tracking only.
- `'use client'` at the top of every file using React state, context, or browser APIs.
- Commit after every task. Build gates are ON.
- The dev server for manual checks: `.claude/launch.json` config `w-app-web-dev` (port 3000). `.env.local` points at the QA Supabase project.
- After Task 1 the app renders **dark and visually rough** until Tasks 6–8. That is the documented interim — reviewers gate Tasks 1–5 on `tsc`/`build`/`lint`/verify-script and contract correctness, not on screen polish.

---

## File structure

**Created:**
- `components/ThemeScript.tsx` — the pre-paint inline `<script>` (no-flash boot). ~20 lines.
- `lib/hooks/useTheme.tsx` — `ThemeProvider` + `useTheme()` context. One responsibility: hold the current mode, persist it, expose `toggle`/`setMode`.
- `components/ui/ThemeToggle.tsx` — the visible control. Consumes `useTheme()`.
- `app/dev/primitives/page.tsx` — unlinked preview of every primitive in every state, both themes.

**Modified:**
- `lib/theme.ts` — role values → `var()` strings; add roles `accent` (redefined), `onAccent` (now a role), `glassFill`, `glassBorder`, `glassHighlight`, `bloomTop`, `liftBottom`, `shadowDepth`, `countRest`, `accentReact`; add non-colour `glassBlur`; `elevation.glass`.
- `app/globals.css` — `:root` / `:root[data-theme="dark"]` / `:root[data-theme="light"]` / `@media (prefers-color-scheme: light)` token blocks; `body` background/colour from tokens; `body::before` / `body::after` bloom + lift layers.
- `tailwind.config.ts` — `w-*` colour values → `var(--…)` so `.bg-w-*` utilities become theme-aware.
- `scripts/verify-theme-tokens.mjs` — **rewritten** to assert the `var()` contract + `globals.css` coverage instead of hard hex values.
- `app/layout.tsx` — `suppressHydrationWarning` on `<html>`; `<ThemeScript />` as first child of `<body>`; `<ThemeProvider>` around `{children}`; drop the forcing `bg-w-back-gray text-w-black` classes.
- `components/ui/primitives.tsx` — restyle `Button`/`Card`/`Chip`/`Input`/`FeedRow`; add `GlassPanel`, `GlowIconButton`, `SectionHeader`, `LockedOverlay`, `ReactionCount`, `WMark`.
- `components/tabs/ProfileTab.tsx` — mount `<ThemeToggle />`.
- ~30–45 screen files across Tasks 6–8 — mechanical colour-literal → token remap per the mapping table below.
- `docs/design-system.md` — §1 (themes), §2 (colour roles) rewrite for dark-default + new roles; iOS-divergence note.

---

## Token mapping table (Tasks 1, 6–8)

The single source of truth for every remap in this plan. Left = literal found in code; middle = role; right = what to write.

| Literal in code | Role | Replace with |
|---|---|---|
| `#F0F6FA`, `#fff`/`#FFFFFF`/`white` **as page bg** | `surface` | `theme.bg` |
| `#FFFFFF`/`white`/`#fff` **as a card/sheet/modal bg** | `surfaceRaised` | `theme.surface` |
| `#F3F3F3`, `#F3F4F6`, `#E5E7EB` **as inset field / nested panel** | `surfaceRaised2` | `theme.surface2` |
| `#231E20`, `#111`, `#000`/`black` **as text** | `content` | `theme.text` |
| `#374151`, `#6B7280`, `#919191`, `#9CA3AF` **as text** | `contentMuted` | `theme.muted` |
| `#E7EDF2`, `#D1D5DB`, `#E5E7EB` **as border/hairline** | `border` | `theme.divider` |
| `#22C3C9`, `#17BFD9` (any use) | `accent` | `theme.accent` |
| `#EC2C91` (error / destructive text) | `accent2` | `theme.accent2` (unchanged) |
| a card with a hand-rolled light `boxShadow` | `shadowDepth` | `elevation.glass` |
| hard-coded `color: 'white'` **on an `accent` fill** | `onAccent` | `theme.onAccent` |

If a literal's role is genuinely ambiguous in context, leave it and add a `// TODO(P7): tokenize` comment — do **not** guess.

---

### Task 1: Token contract — `lib/theme.ts`, `globals.css`, Tailwind, verify script

**Files:**
- Modify: `lib/theme.ts`
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`
- Rewrite: `scripts/verify-theme-tokens.mjs`

**Interfaces:**
- Produces:
  ```ts
  // lib/theme.ts — ThemeRoles now also has:
  //   accent, onAccent, glassFill, glassBorder, glassHighlight,
  //   bloomTop, liftBottom, shadowDepth, countRest, accentReact  : string
  // every ThemeRoles value is the string "var(--<kebab-name>)"
  export const glassBlur: string;          // "blur(20px) saturate(1.08)" — theme-agnostic
  // elevation gains:  glass: string        // "var(--shadow-depth)"
  ```
  Every later task consumes `theme.*` / `lightTheme.*` / `darkTheme.*` exactly as before — only the resolved colour changes.

- [ ] **Step 1: Re-run the JS-colour-math grep**

Run: `grep -rnE "theme\.[a-zA-Z0-9]+ *\+" --include=*.tsx --include=*.ts app components | grep -v node_modules`
Expected: no matches. If any appear (string-concatenating a token, e.g. `theme.accent + '80'`), stop and add a dedicated alpha token `--<name>-a<NN>` for that exact use in Steps 2–3 instead of the concatenation.

- [ ] **Step 2: Rewrite the colour maps in `lib/theme.ts`**

Replace the `lightTheme` / `darkTheme` object bodies so every colour value is a `var()` string, and add the new roles. Keep `type Duo`, `ThemeRole`, `radius`, `type`, `legacyView`'s shape.

```ts
export interface ThemeRoles {
  surface: string;
  surfaceRaised: string;
  surfaceRaised2: string;
  content: string;
  contentMuted: string;
  border: string;
  accent: string;
  onAccent: string;
  accent2: string;
  accentReact: string;
  countRest: string;
  tabBarBg: string;
  glassFill: string;
  glassBorder: string;
  glassHighlight: string;
  bloomTop: string;
  liftBottom: string;
  shadowDepth: string;
  gradientPremium: Duo;
  gradientWarm: Duo;
}

// Values are CSS custom properties — see app/globals.css for the actual
// colours per theme. Both maps are identical (that is the point: the role
// contract is theme-independent; globals.css swaps the values).
const roles: ThemeRoles = {
  surface: 'var(--surface)',
  surfaceRaised: 'var(--surface-raised)',
  surfaceRaised2: 'var(--surface-raised-2)',
  content: 'var(--content)',
  contentMuted: 'var(--content-muted)',
  border: 'var(--border)',
  accent: 'var(--accent)',
  onAccent: 'var(--on-accent)',
  accent2: 'var(--accent-2)',
  accentReact: 'var(--accent-react)',
  countRest: 'var(--count-rest)',
  tabBarBg: 'var(--tab-bar-bg)',
  glassFill: 'var(--glass-fill)',
  glassBorder: 'var(--glass-border)',
  glassHighlight: 'var(--glass-highlight)',
  bloomTop: 'var(--bloom-top)',
  liftBottom: 'var(--lift-bottom)',
  shadowDepth: 'var(--shadow-depth)',
  gradientPremium: ['var(--gradient-premium-a)', 'var(--gradient-premium-b)'],
  gradientWarm: ['var(--gradient-warm-a)', 'var(--gradient-warm-b)'],
};

export const lightTheme: ThemeRoles = roles;
export const darkTheme: ThemeRoles = roles;
```

Update `legacyView` so it also exposes `onAccent: r.onAccent` in its returned object; everything else in `legacyView` stays (its `bg`/`surface`/`text`/… already map through `r.*` and now yield `var()` strings). Replace the standalone `export const onAccent = '#0D0D0F';` with `export const onAccent = 'var(--on-accent)';` (keep the name — it is imported by `components/ui/primitives.tsx`).

Add after `elevation`:

```ts
// Frosted-glass surface treatment (theme-agnostic — same blur both modes).
export const glassBlur = 'blur(20px) saturate(1.08)';
```

and add `glass: 'var(--shadow-depth)'` to the `elevation` object.

- [ ] **Step 3: Add the token blocks to `app/globals.css`**

Inside `@layer base`, replace the `:root { --font-montserrat … }` block with:

```css
:root {
  --font-montserrat: 'Montserrat', system-ui, sans-serif;
}

/* ---- Theme tokens -------------------------------------------------------
   Dark is the bare-root default. @media below flips a *first-time* visitor
   (no data-theme yet) to light when their OS asks for it. An explicit
   [data-theme] (set by ThemeScript / the toggle) always wins. */
:root,
:root[data-theme='dark'] {
  --surface: #0C0C0E;
  --surface-raised: #1A1A1D;
  --surface-raised-2: #232327;
  --content: #F5F5F7;
  --content-muted: rgba(245, 245, 247, 0.55);
  --border: rgba(255, 255, 255, 0.09);
  --accent: #EDEDF0;
  --on-accent: #0C0C0E;
  --accent-2: #EC2C91;
  --accent-react: #E5322D;      /* PLACEHOLDER landing-red — founder to confirm */
  --count-rest: #B9B9C0;
  --tab-bar-bg: #000000;
  --glass-fill: rgba(255, 255, 255, 0.05);
  --glass-border: rgba(255, 255, 255, 0.12);
  --glass-highlight: rgba(255, 255, 255, 0.14);
  --bloom-top: rgba(255, 255, 255, 0.06);
  --lift-bottom: rgba(200, 212, 228, 0.05);
  --shadow-depth: 0 6px 22px rgba(0, 0, 0, 0.32);
  --gradient-premium-a: #7C5CFF;
  --gradient-premium-b: #D24BD6;
  --gradient-warm-a: #F3B56D;
  --gradient-warm-b: #E8836A;
}

:root[data-theme='light'] {
  --surface: #F0F6FA;
  --surface-raised: #FFFFFF;
  --surface-raised-2: #F3F3F3;
  --content: #231E20;
  --content-muted: #919191;
  --border: #E7EDF2;
  --accent: #231E20;
  --on-accent: #FFFFFF;
  --accent-2: #EC2C91;
  --accent-react: #E5322D;
  --count-rest: #6B7280;
  --tab-bar-bg: #231E20;
  --glass-fill: rgba(255, 255, 255, 0.75);
  --glass-border: rgba(20, 20, 25, 0.10);
  --glass-highlight: rgba(255, 255, 255, 0.90);
  --bloom-top: rgba(255, 255, 255, 0);
  --lift-bottom: rgba(0, 0, 0, 0);
  --shadow-depth: 0 4px 16px rgba(35, 30, 32, 0.08);
  --gradient-premium-a: #7C5CFF;
  --gradient-premium-b: #D24BD6;
  --gradient-warm-a: #F3B56D;
  --gradient-warm-b: #E8836A;
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --surface: #F0F6FA;
    --surface-raised: #FFFFFF;
    --surface-raised-2: #F3F3F3;
    --content: #231E20;
    --content-muted: #919191;
    --border: #E7EDF2;
    --accent: #231E20;
    --on-accent: #FFFFFF;
    --accent-2: #EC2C91;
    --accent-react: #E5322D;
    --count-rest: #6B7280;
    --tab-bar-bg: #231E20;
    --glass-fill: rgba(255, 255, 255, 0.75);
    --glass-border: rgba(20, 20, 25, 0.10);
    --glass-highlight: rgba(255, 255, 255, 0.90);
    --bloom-top: rgba(255, 255, 255, 0);
    --lift-bottom: rgba(0, 0, 0, 0);
    --shadow-depth: 0 4px 16px rgba(35, 30, 32, 0.08);
  }
}
```

Then change the `body` rule in the same file to:

```css
  body {
    @apply min-h-screen;
    overscroll-behavior: none;
    background: var(--surface);
    color: var(--content);
  }
```

(The `body::before` / `body::after` bloom layers are Task 4 — not here.)

- [ ] **Step 4: Point Tailwind colours at the vars in `tailwind.config.ts`**

Change the `w-*` colour values (currently fixed hex) to:

```ts
'w-blue': 'var(--accent)',
'w-pink': 'var(--accent-2)',
'w-back-gray': 'var(--surface)',
'w-black': 'var(--content)',
'w-light-gray': 'var(--surface-raised-2)',
'w-dark-gray': 'var(--content-muted)',
```

Keep the keys — `.bg-w-back-gray` etc. are still referenced. They are now theme-aware.

- [ ] **Step 5: Rewrite `scripts/verify-theme-tokens.mjs`**

Replace the whole file:

```js
// Standalone token assertions — this repo has no test runner.
// Run: node scripts/verify-theme-tokens.mjs
import { lightTheme, darkTheme, theme, onAccent } from '../lib/theme.ts';
import { readFileSync } from 'node:fs';

const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const tw = readFileSync(new URL('../tailwind.config.ts', import.meta.url), 'utf8');

// 1. Every ThemeRoles colour value is a bare var() reference.
const varRe = /^var\(--[a-z0-9-]+\)$/;
for (const [name, obj] of [['lightTheme', lightTheme], ['darkTheme', darkTheme]]) {
  for (const [k, v] of Object.entries(obj)) {
    for (const val of (Array.isArray(v) ? v : [v])) {
      if (!varRe.test(val)) fail(`${name}.${k} is not a var() ref: ${val}`);
    }
  }
}

// 2. light/dark key parity (unchanged invariant).
const lk = Object.keys(lightTheme).sort().join(',');
const dk = Object.keys(darkTheme).sort().join(',');
if (lk !== dk) fail(`key parity: light=[${lk}] dark=[${dk}]`);

// 3. Every --token used by a role is defined for BOTH themes in globals.css.
const usedVars = new Set();
for (const v of Object.values(lightTheme)) {
  for (const s of (Array.isArray(v) ? v : [v])) {
    const m = s.match(/^var\((--[a-z0-9-]+)\)$/);
    if (m) usedVars.add(m[1]);
  }
}
const oa = onAccent.match(/var\((--[a-z0-9-]+)\)/);
usedVars.add(oa ? oa[1] : '--on-accent');
const darkBlock = css.match(/:root,\s*:root\[data-theme='dark'\]\s*{([^}]*)}/s)?.[1] ?? '';
const lightBlock = css.match(/:root\[data-theme='light'\]\s*{([^}]*)}/s)?.[1] ?? '';
for (const v of usedVars) {
  if (!darkBlock.includes(`${v}:`)) fail(`globals.css dark block missing ${v}`);
  if (!lightBlock.includes(`${v}:`)) fail(`globals.css light block missing ${v}`);
}

// 4. Legacy `theme` still exposes its keys (call sites depend on them).
for (const k of ['bg', 'surface', 'surface2', 'text', 'muted', 'divider', 'accent', 'accent2', 'pill']) {
  if (!(k in theme)) fail(`legacy theme.${k} missing`);
}

// 5. Tailwind w-* colours point at vars, not hex.
for (const cls of ['w-blue', 'w-pink', 'w-back-gray', 'w-black', 'w-light-gray', 'w-dark-gray']) {
  if (!new RegExp(`'${cls}':\\s*'var\\(--`).test(tw)) fail(`tailwind.config ${cls} is not a var()`);
}

if (!process.exitCode) console.log('OK: theme token contract verified');
```

- [ ] **Step 6: Verify**

Run: `node scripts/verify-theme-tokens.mjs` → `OK: theme token contract verified`
Run: `npx tsc --noEmit` → clean
Run: `npm run build` → succeeds (lint warnings OK, errors not)

- [ ] **Step 7: Manual browser check**

`npm run dev` (or reuse the running server), open `http://localhost:3000/`. Expected: the landing page renders **dark** (`#0C0C0E` ground, light text). Set the OS to "Light" and hard-reload → renders light. Set OS back to Dark. Screens will look rough — that is expected here; you are only confirming the token flip works and nothing is a blank white page or unreadable void.

- [ ] **Step 8: Commit**

```bash
git add lib/theme.ts app/globals.css tailwind.config.ts scripts/verify-theme-tokens.mjs
git commit -m "P1: theme tokens become CSS custom properties (dark default)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: No-flash boot + `useTheme()` provider

**Files:**
- Create: `components/ThemeScript.tsx`
- Create: `lib/hooks/useTheme.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: nothing from Task 1 at the type level (reads the same `--*` vars at runtime).
- Produces:
  ```ts
  // lib/hooks/useTheme.tsx
  export const STORAGE_KEY = 'w-app-theme';
  export type ThemeMode = 'dark' | 'light';
  export function ThemeProvider(props: { children: React.ReactNode }): JSX.Element;
  export function useTheme(): { mode: ThemeMode; setMode: (m: ThemeMode) => void; toggle: () => void };
  // components/ThemeScript.tsx
  export function ThemeScript(): JSX.Element;   // renders a <script> — no props
  ```
  `STORAGE_KEY` is defined in `useTheme.tsx` and imported by `ThemeScript.tsx`.

- [ ] **Step 1: `lib/hooks/useTheme.tsx`**

```tsx
'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const STORAGE_KEY = 'w-app-theme';
export type ThemeMode = 'dark' | 'light';

interface ThemeCtx {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

function currentAttr(): ThemeMode {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from whatever ThemeScript already stamped — no second guess, no flash.
  const [mode, setModeState] = useState<ThemeMode>(currentAttr);

  const apply = useCallback((m: ThemeMode, persist: boolean) => {
    setModeState(m);
    document.documentElement.setAttribute('data-theme', m);
    if (persist) {
      try { localStorage.setItem(STORAGE_KEY, m); } catch { /* private mode */ }
    }
  }, []);

  const setMode = useCallback((m: ThemeMode) => apply(m, true), [apply]);
  const toggle = useCallback(
    () => apply(currentAttr() === 'dark' ? 'light' : 'dark', true),
    [apply],
  );

  // Follow the OS ONLY while the user has never made an explicit choice.
  useEffect(() => {
    let stored: string | null = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch { /* ignore */ }
    if (stored === 'light' || stored === 'dark') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => apply(mq.matches ? 'light' : 'dark', false);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [apply]);

  return <Ctx.Provider value={{ mode, setMode, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used within <ThemeProvider>');
  return v;
}
```

- [ ] **Step 2: `components/ThemeScript.tsx`**

```tsx
import { STORAGE_KEY } from '@/lib/hooks/useTheme';

// Runs synchronously before the browser paints <body>, so the correct
// theme is on <html> from the first frame — no flash. Kept tiny and
// dependency-free on purpose.
const SNIPPET = `(function(){try{
var k=${JSON.stringify(STORAGE_KEY)};
var s=localStorage.getItem(k);
var m=s==='light'||s==='dark'?s:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');
document.documentElement.setAttribute('data-theme',m);
}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: SNIPPET }} />;
}
```

- [ ] **Step 3: Wire `app/layout.tsx`**

- Add `import { ThemeScript } from '@/components/ThemeScript';` and `import { ThemeProvider } from '@/lib/hooks/useTheme';`.
- `<html lang="en" className={montserrat.variable}>` → add `suppressHydrationWarning`.
- `<body className="font-montserrat bg-w-back-gray text-w-black antialiased">` → `<body className="font-montserrat antialiased">`.
- Body children:
  ```tsx
  <body className="font-montserrat antialiased">
    <ThemeScript />
    <ThemeProvider>
      {children}
    </ThemeProvider>
    <Analytics />
  </body>
  ```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit` → clean
Run: `npm run build` → succeeds

- [ ] **Step 5: Manual no-flash check**

`npm run dev`. Hard-reload (Cmd-Shift-R) `http://localhost:3000/main` in each state:
1. `localStorage.removeItem('w-app-theme')` + OS = Dark → loads dark, no white flash.
2. same, OS = Light → loads light, no dark flash.
3. `localStorage.setItem('w-app-theme','light')` + OS = Dark → loads light.
4. `localStorage.setItem('w-app-theme','dark')` + OS = Light → loads dark.
Throttle Network to "Slow 3G" to make any flash obvious. In each case the `<html data-theme>` attribute is correct in the Elements panel before first paint.

- [ ] **Step 6: Commit**

```bash
git add components/ThemeScript.tsx lib/hooks/useTheme.tsx app/layout.tsx
git commit -m "P1: no-flash theme boot script + useTheme() provider

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Theme toggle control

**Files:**
- Create: `components/ui/ThemeToggle.tsx`
- Modify: `components/tabs/ProfileTab.tsx`

**Interfaces:**
- Consumes: `useTheme()` from `lib/hooks/useTheme.tsx`; `theme`, `radius`, `type as typeTokens` from `lib/theme.ts`.
- Produces: `export function ThemeToggle(props?: { style?: React.CSSProperties }): JSX.Element`.

- [ ] **Step 1: `components/ui/ThemeToggle.tsx`**

```tsx
'use client';

import { useTheme } from '@/lib/hooks/useTheme';
import { theme, radius, type as typeTokens } from '@/lib/theme';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const { mode, toggle } = useTheme();
  const isDark = mode === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '12px 16px',
        background: theme.surface,
        border: `1px solid ${theme.divider}`,
        borderRadius: radius.control,
        color: theme.text,
        fontFamily: typeTokens.family,
        fontSize: typeTokens.label.fontSize,
        fontWeight: 600,
        cursor: 'pointer',
        ...style,
      }}
    >
      {isDark ? <Moon size={18} /> : <Sun size={18} />}
      <span style={{ flex: 1, textAlign: 'left' }}>Theme</span>
      <span style={{ color: theme.muted, fontWeight: 400 }}>{isDark ? 'Dark' : 'Light'}</span>
    </button>
  );
}
```

- [ ] **Step 2: Mount it in `components/tabs/ProfileTab.tsx`**

Add `import { ThemeToggle } from '@/components/ui/ThemeToggle';`. Find the settings/menu list of nav rows in `ProfileTab` (entries like "Edit Profile", "Badges", "Privacy"). Insert `<ThemeToggle style={{ marginBottom: 12 }} />` directly above that list, or as its first row if the list is a styled container — match the surrounding row markup's spacing. It just needs to be reachable and visible on the Profile tab.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit` → clean
Run: `npm run build` → succeeds

- [ ] **Step 4: Manual check**

`npm run dev`, Profile tab. Expected: a "Theme — Dark" row. Click → app flips to light instantly, row reads "Theme — Light", `localStorage['w-app-theme'] === 'light'`. Reload → still light. Change OS appearance → app does **not** follow. `localStorage.removeItem('w-app-theme')`, reload, change OS appearance → app now follows.

- [ ] **Step 5: Commit**

```bash
git add components/ui/ThemeToggle.tsx components/tabs/ProfileTab.tsx
git commit -m "P1: theme toggle on the Profile tab

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Body bloom + lift layers

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `--bloom-top`, `--lift-bottom` from Task 1.
- Produces: nothing consumed by later tasks (pure visual).

- [ ] **Step 1: Add the layers in `app/globals.css`**

Inside `@layer base`, after the `body { … }` rule, add:

```css
  /* Super-light ambient light — behind everything, does not scroll.
     Dark: a faint white bloom off the top edge + a cool lift off the
     bottom. Light: both tokens are transparent, so these render nothing. */
  body::before,
  body::after {
    content: '';
    position: fixed;
    left: 0;
    right: 0;
    pointer-events: none;
    z-index: 0;
  }
  body::before {
    top: 0;
    height: 30vh;
    background: linear-gradient(180deg,
      var(--bloom-top) 0%,
      color-mix(in srgb, var(--bloom-top) 40%, transparent) 45%,
      transparent 100%);
  }
  body::after {
    bottom: 0;
    height: 26vh;
    background: linear-gradient(0deg, var(--lift-bottom) 0%, transparent 100%);
    filter: blur(6px);
  }

  body > * {
    position: relative;
    z-index: 1;
  }
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit` → clean
Run: `npm run build` → succeeds

- [ ] **Step 3: Manual check**

`npm run dev`, dark theme, open `/` and `/main`. Expected: a barely-there light haze along the very top of the viewport and a faint cool lift at the very bottom, both fixed while the page scrolls, both *subtle* (if it looks like a spotlight, the tokens are wrong). Toggle to light → both disappear entirely. No layer intercepts clicks (top/bottom buttons still work).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "P1: fixed body bloom + lift ambient layers (dark only)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Primitives — restyle + new primitives + preview route

**Files:**
- Modify: `components/ui/primitives.tsx`
- Create: `app/dev/primitives/page.tsx`

**Interfaces:**
- Consumes: `theme` (incl. new `glassFill`/`glassBorder`/`glassHighlight`/`countRest`/`accentReact`), `radius`, `elevation` (incl. `glass`), `type as typeTokens`, `glassBlur`, `onAccent` from `lib/theme.ts`; `useTheme` from `lib/hooks/useTheme.tsx` (preview page only).
- Produces:
  ```tsx
  // existing, restyled, SAME prop types as today:
  export const Button;   // { variant?: 'primary'|'secondary'|'ghost'; fullWidth?: boolean } & button attrs
  export function Card;   // { cta?: boolean; as?: 'div'|'section'|'article'; style?; children }
  export function Chip;   // { selected?: boolean; onClick?: () => void; style?; children }
  export const Input;     // { invalid?: boolean; label?: string; hint?: string } & input attrs
  export function FeedRow; // { avatar?: string|ReactNode; title; subtitle?; trailing?; onClick?; divider?; style? }

  // new:
  export function GlassPanel(p: { style?: React.CSSProperties; floatingAction?: ReactNode; children: ReactNode }): JSX.Element;
  export function GlowIconButton(p: { icon: ReactNode; label: string; onClick?: () => void; style?: React.CSSProperties }): JSX.Element;
  export function SectionHeader(p: { children: ReactNode; style?: React.CSSProperties }): JSX.Element;
  export function LockedOverlay(p: { title: string; body: string; children: ReactNode }): JSX.Element;
  export function ReactionCount(p: { count: number; reacted?: boolean; onClick?: () => void; style?: React.CSSProperties }): JSX.Element;
  export function WMark(p: { size?: number; style?: React.CSSProperties }): JSX.Element;
  ```

- [ ] **Step 1: Update the import line at the top of `components/ui/primitives.tsx`**

```tsx
import { theme, radius, elevation, type as typeTokens, onAccent, glassBlur } from '@/lib/theme';
import { Lock } from 'lucide-react';
```
(`forwardRef`, `ButtonHTMLAttributes`, `InputHTMLAttributes`, `ReactNode` imports stay.)

- [ ] **Step 2: Restyle the five existing primitives** (style objects only; props/exports unchanged)

- **`buttonVariants`:**
  ```ts
  const buttonVariants: Record<ButtonVariant, React.CSSProperties> = {
    primary: { background: theme.accent, color: onAccent, border: 'none' },
    secondary: {
      background: theme.glassFill,
      color: theme.text,
      border: `1px solid ${theme.glassBorder}`,
      backdropFilter: glassBlur,
      WebkitBackdropFilter: glassBlur,
    },
    ghost: { background: 'transparent', color: theme.text, border: 'none', padding: '8px 12px' },
  };
  ```
- **`Card`** style object: `background: theme.glassFill`, `border: 1px solid ${cta ? theme.accent : theme.glassBorder}`, `boxShadow: `${elevation.glass}, inset 0 1px 0 ${theme.glassHighlight}``, add `backdropFilter: glassBlur` + `WebkitBackdropFilter: glassBlur`. Keep `borderRadius: radius.card`, `padding: 20`.
- **`Chip`:** unselected → `background: theme.glassFill`, `border: 1px solid ${theme.glassBorder}`, `color: theme.text`; selected → `background: theme.accent`, `color: onAccent`, `border: 'none'`. Keep `borderRadius: radius.pill`.
- **`Input`:** `background: theme.surface2`, `border: 1px solid ${invalid ? theme.accent2 : theme.divider}`, `color: theme.text`. No blur. (Label/hint already use `theme.text`/`theme.muted`.)
- **`FeedRow`:** `background: 'transparent'`, `borderBottom: divider ? 1px solid ${theme.divider} : undefined`. Title/subtitle colours unchanged.

- [ ] **Step 3: Append the six new primitives**

```tsx
/* --------------------------------------------------------------- GlassPanel */
export function GlassPanel({
  style,
  floatingAction,
  children,
}: {
  style?: React.CSSProperties;
  floatingAction?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: radius.card,
        padding: 16,
        background: theme.glassFill,
        border: `1px solid ${theme.glassBorder}`,
        backdropFilter: glassBlur,
        WebkitBackdropFilter: glassBlur,
        boxShadow: `${elevation.glass}, inset 0 1px 0 ${theme.glassHighlight}`,
        ...style,
      }}
    >
      {children}
      {floatingAction != null && (
        <div style={{ position: 'absolute', left: '50%', bottom: -16, transform: 'translateX(-50%)' }}>
          {floatingAction}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ GlowIconButton */
// Name kept for continuity with the design conversation; it does NOT glow —
// depth is a soft black drop shadow.
export function GlowIconButton({
  icon,
  label,
  onClick,
  style,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        flex: 1,
        aspectRatio: '1 / 1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 18,
        color: theme.text,
        background: theme.glassFill,
        border: `1px solid ${theme.glassBorder}`,
        backdropFilter: glassBlur,
        WebkitBackdropFilter: glassBlur,
        boxShadow: `${elevation.glass}, inset 0 1px 0 ${theme.glassHighlight}`,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {icon}
    </button>
  );
}

/* ------------------------------------------------------------- SectionHeader */
export function SectionHeader({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ textAlign: 'center', ...style }}>
      <span
        style={{
          display: 'inline-block',
          fontFamily: typeTokens.family,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.17em',
          textTransform: 'uppercase',
          color: theme.text,
          borderBottom: `1.5px solid ${theme.glassHighlight}`,
          paddingBottom: 3,
        }}
      >
        {children}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------- LockedOverlay */
export function LockedOverlay({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ filter: 'blur(6px)', pointerEvents: 'none', userSelect: 'none' }} aria-hidden>
        {children}
      </div>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 8,
          padding: 22,
          background: 'rgba(12,12,14,0.28)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          borderRadius: radius.card,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: theme.text,
            background: theme.glassFill,
            border: `1.5px solid ${theme.glassHighlight}`,
          }}
        >
          <Lock size={22} />
        </div>
        <div style={{ fontFamily: typeTokens.family, fontWeight: 700, fontSize: 14, color: theme.text }}>{title}</div>
        <div style={{ fontFamily: typeTokens.family, fontSize: 12, color: theme.muted, maxWidth: 220 }}>{body}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- ReactionCount */
// Presentational only in P1. P3 wires the toggle + real counts.
export function ReactionCount({
  count,
  reacted,
  onClick,
  style,
}: {
  count: number;
  reacted?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <span
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      style={{
        fontFamily: typeTokens.family,
        fontWeight: 800,
        fontSize: 13,
        color: reacted ? theme.accentReact : theme.countRest,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {count}
    </span>
  );
}

/* --------------------------------------------------------------------- WMark */
// PLACEHOLDER winged-W. Swap the <svg> body when the founder delivers the
// real asset — keep the name, the `size` prop, and currentColor.
export function WMark({ size = 28, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 32" fill="none" style={style} aria-label="The W App">
      <path
        d="M2 4c6 0 10 3 12 9 2-6 6-9 10-9 4 0 8 3 10 9 2-6 6-9 12-9-3 8-9 22-13 24-3-2-5-8-9-14-4 6-6 12-9 14C13 26 5 12 2 4Z"
        fill="currentColor"
      />
    </svg>
  );
}
```

- [ ] **Step 4: `app/dev/primitives/page.tsx`**

```tsx
'use client';

import { useTheme } from '@/lib/hooks/useTheme';
import { theme } from '@/lib/theme';
import {
  Button, Card, Chip, Input, FeedRow,
  GlassPanel, GlowIconButton, SectionHeader, LockedOverlay, ReactionCount, WMark,
} from '@/components/ui/primitives';
import { Clock, Award, User } from 'lucide-react';

export default function PrimitivesPreview() {
  const { mode, toggle } = useTheme();
  return (
    <div style={{ minHeight: '100vh', background: theme.bg, color: theme.text, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <button onClick={toggle} style={{ alignSelf: 'flex-start', padding: '8px 14px', background: theme.accent, color: theme.onAccent, border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
        mode: {mode} — toggle
      </button>

      <WMark size={40} style={{ color: theme.text }} />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button disabled>Disabled</Button>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Chip>Unselected</Chip>
        <Chip selected>Selected</Chip>
      </div>

      <Input label="Location Name" placeholder="Enter a name" />
      <Input label="Bad field" hint="Something is wrong" invalid defaultValue="oops" />

      <Card><span>Plain card over the ground.</span></Card>
      <Card cta><span>CTA card (accent border).</span></Card>

      <GlassPanel floatingAction={<GlowIconButton icon={<span style={{ fontSize: 20 }}>+</span>} label="Add" />}>
        <SectionHeader>Friends</SectionHeader>
        <FeedRow title="Samira" subtitle={'Blue Note · "so good"'} trailing={<ReactionCount count={17} reacted />} divider />
        <FeedRow title="Barb" subtitle="Club Space" trailing={<ReactionCount count={10} />} divider />
        <FeedRow title="Sofia" subtitle="Hooters" trailing={<ReactionCount count={4} />} />
      </GlassPanel>

      <div style={{ display: 'flex', gap: 11 }}>
        <GlowIconButton icon={<Clock size={20} />} label="History" />
        <GlowIconButton icon={<Award size={20} />} label="Rewards" />
        <GlowIconButton icon={<User size={20} />} label="Profile" />
      </div>

      <LockedOverlay title="Unlock who's near" body="Finish setting up your friends to unlock who's closeby.">
        <FeedRow title="Hidden" subtitle="blurred" />
        <FeedRow title="Hidden" subtitle="blurred" />
        <FeedRow title="Hidden" subtitle="blurred" />
      </LockedOverlay>
    </div>
  );
}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → clean
Run: `npm run build` → succeeds; route list includes `/dev/primitives`

- [ ] **Step 6: Manual check**

`npm run dev`, open `http://localhost:3000/dev/primitives`. Expected in **dark**: frosted panels with a faint top rim + soft shadow; primary button near-white with dark text; the `+` over a glass tile; `ReactionCount` 17 red, 10 and 4 grey; `LockedOverlay` blurs the rows behind a padlock. Click "toggle" → re-renders light and stays legible (glass → light frost, primary button → dark with white text). No console errors.

- [ ] **Step 7: Commit**

```bash
git add components/ui/primitives.tsx app/dev/primitives/page.tsx
git commit -m "P1: restyle primitives to glass + add GlassPanel/GlowIconButton/SectionHeader/LockedOverlay/ReactionCount/WMark

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Triage sweep — group A (auth · onboarding · profile)

**Files (modify — apply the mapping table to every hard-coded colour literal found):**
- `app/auth/login/page.tsx`, `app/auth/register/page.tsx`, `app/auth/forgot-password/page.tsx`, `app/auth/reset/page.tsx`
- `components/onboarding/*` (all files), `app/profile/setup/page.tsx`
- `components/tabs/ProfileTab.tsx`, `app/profile/edit/page.tsx`, `app/profile/badges/page.tsx`, `components/profile/BadgeTile.tsx`

**Interfaces:** consumes `theme.*` / `elevation.glass` from Task 1. No new exports.

- [ ] **Step 1: Find every offender in the group**

Run from the repo root:
```
grep -nE "#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b|'white'|\"white\"|rgb\(|rgba\(" \
  app/auth app/profile/setup app/profile/edit app/profile/badges \
  components/onboarding components/tabs/ProfileTab.tsx components/profile/BadgeTile.tsx
```
Each hit is either (a) already a `theme.*` reference — skip, (b) in the mapping table — replace per the right column, or (c) genuinely ambiguous — add `// TODO(P7): tokenize` and leave.

- [ ] **Step 2: Apply the mapping table**

For every group-(b) hit, replace the literal with the token. Concrete shape:

```tsx
// before
<div style={{ background: 'white', color: '#374151' }}>
// after
<div style={{ background: theme.surface, color: theme.muted }}>
```
```tsx
// before
border: '1px solid #D1D5DB'
// after
border: `1px solid ${theme.divider}`
```
```tsx
// before  (old cyan CTA)
backgroundColor: '#17BFD9', color: 'white'
// after
backgroundColor: theme.accent, color: theme.onAccent
```

Add `import { theme } from '@/lib/theme';` (and `elevation` where a hand-rolled shadow is swapped for `elevation.glass`) to any file that now needs it.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → clean
Run: `npm run build` → succeeds

- [ ] **Step 4: Manual check (both themes)**

`npm run dev`. In **dark** then **light** (toggle on Profile), visit `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/profile/setup` (all 5 steps), Profile tab, `/profile/edit`, `/profile/badges`. Expected: no white cards on the dark ground, no dark-grey text on dark, every label/input/button readable, focus states visible. Readable, not designed.

- [ ] **Step 5: Commit**

```bash
git add app/auth app/profile components/onboarding components/tabs/ProfileTab.tsx components/profile
git commit -m "P1: triage sweep A — auth / onboarding / profile legible in dark

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Triage sweep — group B (home · venue · map)

**Files (modify — mapping table):**
- `components/tabs/HomeTab.tsx`, `components/home/*` (all files)
- `components/tabs/MapTab.tsx`
- `app/main/venue/*` (all `page.tsx`), `components/venue/*` (all files)

**Interfaces:** consumes `theme.*` / `elevation.glass`. No exports.

- [ ] **Step 1: Find offenders**

```
grep -nE "#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b|'white'|\"white\"|rgb\(|rgba\(" \
  components/tabs/HomeTab.tsx components/tabs/MapTab.tsx components/home components/venue app/main/venue
```

- [ ] **Step 2: Apply the mapping table**

Same rules/examples as Task 6 Step 2. Known offenders here:
- `components/tabs/MapTab.tsx` — the "Request a Location" modal card is `background: 'white'` with `#374151` / `#6B7280` / `#D1D5DB` / `#17BFD9` / `#F3F4F6` literals. Remap all per the table; its `#17BFD9` CTA → `theme.accent` / `theme.onAccent`.
- `components/home/CheckedInHero.tsx`, `NearbyBanner.tsx`, `VenuePeekModal.tsx` — mix of `theme.*` and stray hex.
- Leaflet map tiles are third-party — only touch the app chrome around the map.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → clean
Run: `npm run build` → succeeds

- [ ] **Step 4: Manual check (both themes)**

`npm run dev`, dark then light. Home tab (logged-out empty state), Map tab + open the "Request a Location" modal, and each `/main/venue/*` route that renders without a live venue session (note which redirect). Expected: readable, no white modals on dark, CTA buttons legible.

- [ ] **Step 5: Commit**

```bash
git add components/tabs/HomeTab.tsx components/tabs/MapTab.tsx components/home components/venue app/main/venue
git commit -m "P1: triage sweep B — home / venue / map legible in dark

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Triage sweep — group C (admin · connect · messages · misc)

**Files (modify — mapping table):**
- `app/admin/*` (all `page.tsx` incl. `app/admin/location-requests`, `app/admin/venue/[id]/tags`), `app/admin/layout.tsx`
- `app/main/connect/*` (all), `components/tabs/MessagesTab.tsx`, the chat components under `components/` (locate in Step 1)
- `app/privacy/page.tsx`, `app/welcome/page.tsx`, `app/page.tsx`, `app/global-error.tsx`
- **Leave** `app/opengraph-image.tsx` — server-rendered to a static PNG, not themed; note it in the P7 backlog.

**Interfaces:** consumes `theme.*` / `elevation.glass`. No exports.

- [ ] **Step 1: Find offenders + locate chat components**

```
grep -nE "#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b|'white'|\"white\"|rgb\(|rgba\(" \
  app/admin app/main/connect components/tabs/MessagesTab.tsx app/privacy app/welcome app/page.tsx app/global-error.tsx
grep -rlnE "ChatView|MessageBubble|conversation" components | grep -v node_modules
```
Then grep the chat component files the second command finds.

- [ ] **Step 2: Apply the mapping table**

Same rules/examples as Task 6 Step 2. Known: `app/page.tsx` hard-codes a dark gradient + `#22c3c9` CTA + `#0d0d0f`/`#f5f5f7`/`#1a1a1d` — the page is now always themed, so `#22c3c9` → `theme.accent`, and the inline dark hex → `theme.bg` / `theme.text` / `theme.surface`. `app/admin/*` mostly uses `theme.*` already but has ad-hoc hex noted in its own file comments — sweep those.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` → clean
Run: `npm run build` → succeeds

- [ ] **Step 4: Manual check (both themes)**

`npm run dev`, dark then light. Visit `/`, `/welcome`, `/privacy`, `/admin` (redirects without master-admin — confirm the redirect isn't a white flash), `/main/connect/links`. Read `app/global-error.tsx` and confirm no `background:'#fff'` (or trigger it if feasible). Expected: readable in both themes.

- [ ] **Step 5: Commit**

```bash
git add app/admin app/main/connect components/tabs/MessagesTab.tsx app/privacy app/welcome app/page.tsx app/global-error.tsx components
git commit -m "P1: triage sweep C — admin / connect / messages / misc legible in dark

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Full-route legibility pass + docs

**Files:**
- Modify: `docs/design-system.md`
- Modify: `lib/theme.ts` (header comment), `components/ui/primitives.tsx` (header comment)
- Modify: any straggler screen files found in the pass

**Interfaces:** none.

- [ ] **Step 1: Walk every route in both themes**

`npm run dev`. Build a checklist: `find app -name 'page.tsx' | sed 's#app##;s#/page.tsx##;s#^$#/#'`. Open each in **dark** and **light**. For any unreadable element, apply the mapping table and note the file. Final net over the whole tree:
```
grep -rnE "background:\s*['\"]?#?(fff|ffffff|white)|color:\s*['\"]?#(111|000|374151|6B7280)" app components | grep -v node_modules
```
Every remaining hit is either intentional-on-a-known-surface (leave + comment `// intentional: always-dark surface`) or a miss (fix).

- [ ] **Step 2: Update `docs/design-system.md`**

- **§1 Themes:** rewrite to "**Dark is the default and active.** Light is fully specified and switchable via `useTheme()` + a toggle; `prefers-color-scheme` is honoured on first visit only."
- **§2 Colour roles:** replace the table with the Task 1 role set, dark values in the first column. Add `glassFill`, `glassBorder`, `glassHighlight`, `bloomTop`, `liftBottom`, `shadowDepth`, `countRest`, `accentReact`, `onAccent`. Note `accent` is now a neutral, `accentReact` is the only chromatic token, both placeholders pending the founder's landing-red.
- **§5 Elevation:** add "Dark uses `--shadow-depth` (soft black) plus a 1px `glassBorder` and a top `glassHighlight` inset rim on glass surfaces."
- Add a callout at the top: "**iOS divergence (2026-09-10):** web has moved to a dark-default frosted-glass system (P1). `w-app-ios` still tracks the light spec. Role names are shared; the active theme and the glass treatment are web-only until iOS catches up."

- [ ] **Step 3: Refresh the code header comments**

- `lib/theme.ts` top comment: replace the "Dark is fully defined but NOT activated" paragraph — values now live in `app/globals.css` as `--*` custom properties, dark is the default, `useTheme()` / `ThemeScript` drive switching.
- `components/ui/primitives.tsx` top comment: drop "Light theme only for now"; state primitives render from `theme.*` custom properties and follow the active theme automatically.

- [ ] **Step 4: Verify**

Run: `node scripts/verify-theme-tokens.mjs` → OK
Run: `npx tsc --noEmit` → clean
Run: `npm run build` → succeeds
Run: `npm run lint` → no new errors

- [ ] **Step 5: Commit**

```bash
git add docs/design-system.md lib/theme.ts components/ui/primitives.tsx app components
git commit -m "P1: full-route legibility pass + design-system.md dark-default rewrite

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** mechanism (Task 1–2) · no-flash script (Task 2) · `useTheme` + `prefers-color-scheme` first-visit-only (Task 2) · toggle on `/profile` (Task 3) · `lib/theme.ts` role additions incl. `onAccent` role + `accent` neutral + no cyan (Task 1) · `verify-theme-tokens.mjs` rewrite (Task 1) · `globals.css` token blocks + body bg (Task 1) + bloom/lift (Task 4) · primitives restyle + 6 new + `/dev/primitives` (Task 5) · triage sweep with offender greps + mapping table (Tasks 6–8) · full legibility pass + `design-system.md` + iOS divergence note (Task 9). Every spec section maps to a task. The spec's four "Open items" (real red, real `WMark`, toggle IA home, `accent2` fate) are intentionally placeholders/notes, not tasks.
- **Placeholder scan:** no "TBD" / "add error handling" / "similar to Task N". Triage tasks (6–8) don't inline every file's diff — dozens of files — but give the exact grep, the exact mapping table, and 3 concrete before/after examples: a mechanical procedure, not a vague instruction.
- **Type consistency:** every `theme.*` key used in Tasks 3–8 exists after Task 1 (`accent`, `onAccent`, `glassFill`, `glassBorder`, `glassHighlight`, `countRest`, `accentReact`, `shadowDepth` via `elevation.glass`). `STORAGE_KEY` defined in `useTheme.tsx`, imported by `ThemeScript.tsx` (Task 2). `useTheme()` return shape (`mode`/`setMode`/`toggle`) consistent across Tasks 2, 3, 5. New primitive signatures in Task 5's Interfaces match their `/dev/primitives` usage. `onAccent` kept as an exported name (now a `var()` string) so `primitives.tsx`'s existing import keeps working.
- **Ordering risk:** Task 1 flips the app to dark before the triage sweep — called out in Global Constraints as the accepted interim; Tasks 1–5 gate on build/lint/verify, not visuals.
