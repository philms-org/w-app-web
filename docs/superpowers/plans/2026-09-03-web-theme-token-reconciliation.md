# Web Theme Token Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `w-app-web` render one consistent **light** theme from a single semantic-role token source, with the dark theme fully defined but inactive.

**Architecture:** `lib/theme.ts` becomes the only place colors are defined. It exports `lightTheme` and `darkTheme` — two maps with identical keys, keyed by semantic roles from the design-alignment spec §4. `theme` (the object 37 files already import) is re-pointed to `lightTheme`, so all 483 existing `theme.*` call sites keep compiling unchanged while their resolved values flip from the stray dark palette back to light. `tailwind.config.ts` and `app/globals.css` are reconciled to the same hex values (dead custom classes removed). Nothing consumes `darkTheme` yet — a later plan wires theme switching.

**Tech Stack:** Next.js 15.5 (App Router), TypeScript, Tailwind v4 (`@tailwindcss/postcss`). No test runner in this repo — verification is a standalone Node assertion script + `tsc --noEmit` + `next build` + a visual check in the preview browser.

## Global Constraints

- **Light role values — spec §4 "Light" column, verbatim:** `surface #F0F6FA` · `surfaceRaised #FFFFFF` · `surfaceRaised2 #F3F3F3` · `content #231E20` · `contentMuted #919191` · `border #E7EDF2` · `accent #22C3C9` · `accent2 #EC2C91` · `tabBarBg #231E20` · `gradientPremium ['#7C5CFF','#D24BD6']` · `gradientWarm ['#F3B56D','#E8836A']`.
- **Dark role values — spec §4 "Dark" column, verbatim:** `surface #0D0D0F` · `surfaceRaised #1A1A1D` · `surfaceRaised2 #232327` · `content #F5F5F7` · `contentMuted rgba(245,245,247,0.55)` · `border rgba(255,255,255,0.09)` · `accent #22C3C9` · `accent2 #EC2C91` · `tabBarBg #000000` · `gradientPremium ['#7C5CFF','#D24BD6']` · `gradientWarm ['#F3B56D','#E8836A']`.
- **Dark is defined, exported, and NOT activated.** Light is forced. No `prefers-color-scheme` or `data-theme` wiring in this plan.
- **Do NOT rename any of the 14 existing `theme` keys** (`bg, pill, accent, accent2, gradientStart, gradientEnd, surface, surface2, text, muted, divider, warm1, warm2, premium1, premium2, green`) and **do NOT touch the 483 `theme.*` call sites.** A later plan does the semantic-name sweep. This plan only changes the *values* those keys resolve to, and *adds* new semantic keys alongside them.
- **No new npm dependencies.**
- Montserrat stays the only font family.
- After every task: `npx tsc --noEmit` passes and `npm run build` passes.

---

### Task 1: Rewrite `lib/theme.ts` as the single semantic-role source

**Files:**
- Modify: `lib/theme.ts` (entire file, currently 19 lines)
- Create: `scripts/verify-theme-tokens.mjs`

**Interfaces:**
- Produces:
  - `export const lightTheme` — a map with keys: `surface, surfaceRaised, surfaceRaised2, content, contentMuted, border, accent, accent2, tabBarBg, gradientPremium, gradientWarm` **plus** the 14 legacy keys listed in Global Constraints.
  - `export const darkTheme` — same keys, dark values.
  - `export const theme = lightTheme` — the active theme (existing `import { theme } from '@/lib/theme'` keeps working).
  - `export type ThemeRole = keyof typeof lightTheme`.

- [ ] **Step 1: Write the failing verification script**

Create `scripts/verify-theme-tokens.mjs`:

```js
// Standalone token assertions — this repo has no test runner.
// Run: node scripts/verify-theme-tokens.mjs
import { lightTheme, darkTheme, theme } from '../lib/theme.ts';
import { readFileSync } from 'node:fs';

const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const eq = (a, b, m) => { if (a !== b) fail(`${m}: expected ${b}, got ${a}`); };

// Light values (spec §4)
eq(lightTheme.surface, '#F0F6FA', 'lightTheme.surface');
eq(lightTheme.surfaceRaised, '#FFFFFF', 'lightTheme.surfaceRaised');
eq(lightTheme.surfaceRaised2, '#F3F3F3', 'lightTheme.surfaceRaised2');
eq(lightTheme.content, '#231E20', 'lightTheme.content');
eq(lightTheme.contentMuted, '#919191', 'lightTheme.contentMuted');
eq(lightTheme.border, '#E7EDF2', 'lightTheme.border');
eq(lightTheme.accent, '#22C3C9', 'lightTheme.accent');
eq(lightTheme.accent2, '#EC2C91', 'lightTheme.accent2');
eq(lightTheme.tabBarBg, '#231E20', 'lightTheme.tabBarBg');

// Dark values (spec §4)
eq(darkTheme.surface, '#0D0D0F', 'darkTheme.surface');
eq(darkTheme.surfaceRaised, '#1A1A1D', 'darkTheme.surfaceRaised');
eq(darkTheme.content, '#F5F5F7', 'darkTheme.content');
eq(darkTheme.tabBarBg, '#000000', 'darkTheme.tabBarBg');
eq(darkTheme.accent, '#22C3C9', 'darkTheme.accent');

// Legacy keys re-pointed to LIGHT values (no call-site churn)
eq(theme.bg, '#F0F6FA', 'theme.bg (legacy) -> light surface');
eq(theme.surface, '#FFFFFF', 'theme.surface (legacy) -> light card');
eq(theme.surface2, '#F3F3F3', 'theme.surface2 (legacy)');
eq(theme.text, '#231E20', 'theme.text (legacy) -> light content');
eq(theme.muted, '#919191', 'theme.muted (legacy)');
eq(theme.divider, '#E7EDF2', 'theme.divider (legacy) -> light border');
eq(theme.accent, '#22C3C9', 'theme.accent (legacy)');
eq(theme.accent2, '#EC2C91', 'theme.accent2 (legacy)');
eq(theme.pill, '#F0F6FA', 'theme.pill (legacy, unchanged)');

// Light/dark key parity
const lk = Object.keys(lightTheme).sort().join(',');
const dk = Object.keys(darkTheme).sort().join(',');
if (lk !== dk) fail(`key parity: light=[${lk}] dark=[${dk}]`);

// theme IS lightTheme
if (theme !== lightTheme) fail('theme must be the lightTheme reference');

// --- Task 2 adds tailwind.config checks below this line ---

if (!process.exitCode) console.log('OK: theme tokens verified');
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `node scripts/verify-theme-tokens.mjs`
Expected: FAIL — `lightTheme` is undefined (current file only exports `theme`); first assertion logs `FAIL: lightTheme.surface` or the import throws.

- [ ] **Step 3: Rewrite `lib/theme.ts`**

Replace the entire file with:

```ts
// Single source of truth for web color tokens.
//
// Semantic roles (surface, content, accent, ...) each resolve to a light
// value and a dark value. `theme` is the ACTIVE theme and is currently
// forced to light — a later plan wires prefers-color-scheme / a toggle.
//
// The keys inside `legacyFrom` are the names 37 files and ~483 call sites
// already use. They are kept verbatim and re-pointed to the light role
// values so nothing has to change yet. A later plan renames them to the
// semantic roles and deletes that block.

const lightRoles = {
  surface: '#F0F6FA',
  surfaceRaised: '#FFFFFF',
  surfaceRaised2: '#F3F3F3',
  content: '#231E20',
  contentMuted: '#919191',
  border: '#E7EDF2',
  accent: '#22C3C9',
  accent2: '#EC2C91',
  tabBarBg: '#231E20',
  gradientPremium: ['#7C5CFF', '#D24BD6'] as [string, string],
  gradientWarm: ['#F3B56D', '#E8836A'] as [string, string],
} as const;

const darkRoles = {
  surface: '#0D0D0F',
  surfaceRaised: '#1A1A1D',
  surfaceRaised2: '#232327',
  content: '#F5F5F7',
  contentMuted: 'rgba(245,245,247,0.55)',
  border: 'rgba(255,255,255,0.09)',
  accent: '#22C3C9',
  accent2: '#EC2C91',
  tabBarBg: '#000000',
  gradientPremium: ['#7C5CFF', '#D24BD6'] as [string, string],
  gradientWarm: ['#F3B56D', '#E8836A'] as [string, string],
} as const;

// --- legacy keys (do not rename in this plan) ---
// Each maps to a role value so resolved colors flip dark -> light.
const legacyFrom = (r: typeof lightRoles | typeof darkRoles) => ({
  bg: r.surface,
  pill: '#F0F6FA',            // iOS Colors.back_gray — theme-agnostic field bg, unchanged
  accent: r.accent,
  accent2: r.accent2,
  gradientStart: '#5A6570',   // brand steel gradient — unchanged
  gradientEnd: '#22262B',     // brand charcoal gradient — unchanged
  surface: r.surfaceRaised,
  surface2: r.surfaceRaised2,
  text: r.content,
  muted: r.contentMuted,
  divider: r.border,
  warm1: r.gradientWarm[0],
  warm2: r.gradientWarm[1],
  premium1: r.gradientPremium[0],
  premium2: r.gradientPremium[1],
  green: '#3ECF6B',           // success green — unchanged
});

export const lightTheme = { ...lightRoles, ...legacyFrom(lightRoles) } as const;
export const darkTheme = { ...darkRoles, ...legacyFrom(darkRoles) } as const;

export type ThemeRole = keyof typeof lightTheme;

// Active theme — forced light until the theme-switching plan lands.
export const theme = lightTheme;
```

- [ ] **Step 4: Run the verification script — expect PASS**

Run: `node scripts/verify-theme-tokens.mjs`
Expected: `OK: theme tokens verified`
If it fails on `theme !== lightTheme`: ensure `export const theme = lightTheme` (same reference, not a spread copy).

- [ ] **Step 5: Typecheck and build**

Run: `npx tsc --noEmit`
Expected: no errors. (`warm2` / `premium2` are already referenced by name in components — they remain present via `legacyFrom`, so no call site breaks.)

Run: `npm run build`
Expected: build completes.

- [ ] **Step 6: Commit**

```bash
git add lib/theme.ts scripts/verify-theme-tokens.mjs
git commit -m "web: single semantic-role token source in lib/theme.ts (light active, dark defined)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Reconcile `tailwind.config.ts` to the shared hexes

**Files:**
- Modify: `tailwind.config.ts` (the `colors` block inside `theme.extend`, currently lines ~9–18)

**Interfaces:**
- Consumes: the `lightTheme` hexes from Task 1 (matched by hand — Tailwind config is static, it cannot import the TS map at build time here).
- Produces: `w-*` utility classes resolving to the same light hexes as `lightTheme`. Only 3 call sites use them (`app/layout.tsx`, `app/main/page.tsx`, `app/global-error.tsx`).

- [ ] **Step 1: Extend the verification script with tailwind checks**

In `scripts/verify-theme-tokens.mjs`, replace the line `// --- Task 2 adds tailwind.config checks below this line ---` with:

```js
const tw = readFileSync(new URL('../tailwind.config.ts', import.meta.url), 'utf8');
for (const [cls, hex] of [
  ['w-blue', '#22C3C9'],
  ['w-pink', '#EC2C91'],
  ['w-back-gray', '#F0F6FA'],
  ['w-black', '#231E20'],
  ['w-light-gray', '#F3F3F3'],
  ['w-dark-gray', '#919191'],
]) {
  if (!tw.includes(`'${cls}': '${hex}'`)) fail(`tailwind.config missing ${cls}: '${hex}'`);
}
```

- [ ] **Step 2: Run — expect FAIL**

Run: `node scripts/verify-theme-tokens.mjs`
Expected: `FAIL: tailwind.config missing w-blue: '#22C3C9'` (currently `#17BFD9`).

- [ ] **Step 3: Edit the `colors` block**

In `tailwind.config.ts`, replace the `colors` object inside `theme.extend` with:

```ts
      colors: {
        // Bridges the few remaining `w-*` utility classes to the shared
        // light palette. New work should use lib/theme.ts, not these.
        'w-blue': '#22C3C9',       // == accent
        'w-pink': '#EC2C91',       // == accent2
        'w-gray': '#D5D5D5',
        'w-light-gray': '#F3F3F3', // == surfaceRaised2
        'w-back-gray': '#F0F6FA',  // == surface
        'w-light-blue': '#D0F2F7',
        'w-dark-gray': '#919191',  // == contentMuted
        'w-black': '#231E20',      // == content
      },
```

Leave `fontFamily`, `animation`, and `keyframes` untouched.

- [ ] **Step 4: Run check + build**

Run: `node scripts/verify-theme-tokens.mjs` → `OK: theme tokens verified`
Run: `npm run build` → completes.

- [ ] **Step 5: Commit**

```bash
git add tailwind.config.ts scripts/verify-theme-tokens.mjs
git commit -m "web: point w-* tailwind palette at the shared light hexes (w-blue -> #22C3C9)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Strip dead / dark-drifted custom classes from `app/globals.css`

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: nothing.
- Produces: a `globals.css` with only base resets, safe-area helpers, scrollbar styling, and the two animation utilities that are actually referenced. All `.bg-w-*` / `.text-w-*` / `.border-w-*` / `.bg-gradient-w` / `.text-gradient` / `.shadow-w` custom rules are removed.

- [ ] **Step 1: Prove the custom classes are unused**

Run:
```bash
grep -rn --include='*.tsx' -E "bg-gradient-w|text-gradient|shadow-w\b|\bbg-w-(blue|pink|gray|light-gray|light-blue)\b|\btext-w-(blue|pink|black|dark-gray)\b|\bborder-w-" app components
```
Expected: **no output.** (`bg-w-back-gray` and `text-w-black` do survive — but as Tailwind-config classes from Task 2, not as these CSS rules.) If any line prints, stop and report: a component depends on a rule this task removes; convert that component to `theme.*` inline styles first, then resume.

- [ ] **Step 2: Rewrite `app/globals.css`**

Replace the entire file with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --font-montserrat: 'Montserrat', system-ui, sans-serif;
  }

  * {
    -webkit-tap-highlight-color: transparent;
  }

  html {
    -webkit-text-size-adjust: 100%;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    @apply min-h-screen;
    overscroll-behavior: none;
  }

  .safe-top { padding-top: env(safe-area-inset-top); }
  .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background-color: #D5D5D5; border-radius: 9999px; }
  ::-webkit-scrollbar-thumb:hover { background-color: #919191; }
}

@layer utilities {
  .animate-pulse-slow {
    animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  .ios-scroll { -webkit-overflow-scrolling: touch; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 3: Confirm the kept helpers are still referenced**

Run:
```bash
grep -rn --include='*.tsx' -E "animate-pulse-slow|ios-scroll|safe-top|safe-bottom" app components | head
```
Expected: some matches. For any of the four with **zero** matches, delete that rule from the file too (keep the scrollbar + resets regardless).

- [ ] **Step 4: Build + visual check**

Run: `npm run build` → completes.
Start the preview server (`preview_start` with the dev script) and load `/main`.
Expected: Home tab, TabBar, and AppHeader render on the **light** `#F0F6FA` background with white cards — no dark `#0d0d0f` panels. Check `read_console_messages` for CSS/build errors.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "web: drop unused/dark-drifted custom CSS classes from globals.css

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Verify the three `-w-` class call sites render light

**Files:**
- Verify (edit only if broken): `app/layout.tsx`, `app/main/page.tsx`, `app/global-error.tsx`

**Interfaces:**
- Consumes: the Task 2 `w-*` palette + Task 1 `theme`.
- Produces: confirmation the app shell is light end-to-end.

- [ ] **Step 1: Read each file's class usage**

Run:
```bash
grep -rn -E "(bg|text|border)-w-|bg-gradient-w|text-gradient" app/layout.tsx app/main/page.tsx app/global-error.tsx
```
Expected:
- `app/layout.tsx` → `<body className="font-montserrat bg-w-back-gray text-w-black antialiased">` — correct (light), no change.
- `app/main/page.tsx` → wrapper `className="min-h-screen bg-w-back-gray"` — correct (light), no change.
- `app/global-error.tsx` → if it references a removed rule (`bg-gradient-w` / `text-gradient` / `.bg-w-*`), it needs Step 2. Otherwise no change.

- [ ] **Step 2: Fix `app/global-error.tsx` only if Step 1 shows a removed rule**

Swap the removed class for explicit values on the outer container:

```tsx
style={{ minHeight: '100vh', background: '#F0F6FA', color: '#231E20',
         display: 'flex', alignItems: 'center', justifyContent: 'center',
         fontFamily: 'Montserrat, system-ui, sans-serif' }}
```

Leave the file untouched if it already uses valid Tailwind-config classes or inline styles.

- [ ] **Step 3: Full visual sweep in the preview browser**

Navigate in turn: `/`, `/welcome`, `/auth/login`, `/main` (Home / Map / Messages / Profile / History tabs), `/main/venue/chat`, `/main/venue/zones`, `/main/venue/rewards`, `/privacy`, `/profile/edit`, `/admin`.
For each: confirm light background, readable `#231E20` text, `#22C3C9` accents, no dark panels, no white-on-white text. Note (do not fix) any screen still forcing a dark value via a pre-existing inline hardcode — that is follow-up cleanup, out of scope here unless a one-line inline swap.

- [ ] **Step 4: Typecheck + build + lint**

Run: `npx tsc --noEmit` → clean.
Run: `npm run build` → completes.
Run: `npm run lint` → no new errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "web: verify app shell renders light end-to-end after token reconciliation

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage** (design-alignment spec §3.1, §3.2, §4, §6 step 2):
- §3.1 dual-theme, light default → Task 1 (`lightTheme`/`darkTheme`, `theme = lightTheme`). ✓
- §3.2 canonical accent `#22C3C9` → Task 1 (`accent`), Task 2 (`w-blue`). ✓
- §4 semantic role map, both columns verbatim → Task 1. ✓ (light `border #E7EDF2` is the spec's "approx — confirm"; carried as-is per the user's "proceed with §4 values" decision.)
- §6 step 2 "collapse theme.ts + tailwind.config.ts + globals.css into one token source; fix half-migrated screens" → Tasks 1–4. ✓
- Dark NOT activated → Task 1 (`theme = lightTheme`; no switching code). ✓
- Correctly out of scope for this plan: the semantic-name sweep of the 483 call sites, `prefers-color-scheme` wiring, the component layer (Plan 2), `MapTab`'s hardcoded `#E5E7EB` loader (pre-existing; flagged, not fixed, in Task 4 Step 3).

**2. Placeholder scan:** No "TBD" / "add error handling" / "similar to Task N". Every code step has literal content. Task 4 Step 2 is conditional but fully specified for both branches.

**3. Type consistency:** `lightTheme` / `darkTheme` / `theme` / `ThemeRole` used identically across the Task 1 definition and the Task 1–2 verification script. Legacy keys (`bg, pill, accent, accent2, gradientStart, gradientEnd, surface, surface2, text, muted, divider, warm1, warm2, premium1, premium2, green`) all retained via `legacyFrom` — satisfies "don't touch 483 call sites". `gradientPremium` / `gradientWarm` typed `[string, string]` in both maps.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-09-03-web-theme-token-reconciliation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
