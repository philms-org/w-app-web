// Single source of truth for web color tokens.
//
// `lightTheme` / `darkTheme` are the semantic role maps from the web⇄iOS
// design-alignment spec §4 (surface, surfaceRaised, content, accent, ...).
// Both have identical keys. New code (the component layer) reads these.
//
// `theme` is the ACTIVE theme in the shape ~37 files and ~483 call sites
// already use (`bg`, `text`, `divider`, `surface`-as-card, ...). It is a
// separate object — the legacy `surface` key means "card" and would collide
// with the role `surface` ("page background") on one flat map. It is built
// from the light role values, so every existing `theme.*` call site keeps
// compiling while its resolved color flips from the stray dark palette back
// to light. A later plan renames the call sites to role names and deletes
// `theme` in favour of a `useTheme()` that returns light or dark.
//
// Both themes are live. The actual colour values live in app/globals.css as
// `--*` custom properties under `:root` / `:root[data-theme='light']`; every
// key here is just a `var(--token)` string, so a single map serves both
// themes and the resolved colour follows whichever theme is active. Dark is
// the bare-root default; `useTheme()` (client) and `<ThemeScript>` (no-flash
// boot) switch it by setting `data-theme`, honouring `prefers-color-scheme`
// on the first visit only.

type Duo = readonly [string, string];

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

export type ThemeRole = keyof ThemeRoles;

// Legacy-shaped view of a role map. `surface` here is the *card* colour
// (role `surfaceRaised`) — that is what the existing call sites mean by it.
const legacyView = (r: ThemeRoles) =>
  ({
    bg: r.surface,
    pill: 'var(--pill)', // field / input ground
    accent: r.accent,
    accent2: r.accent2,
    gradientStart: '#5A6570', // brand steel gradient — unchanged
    gradientEnd: '#22262B', // brand charcoal gradient — unchanged
    surface: r.surfaceRaised,
    surface2: r.surfaceRaised2,
    text: r.content,
    muted: r.contentMuted,
    divider: r.border,
    warm1: r.gradientWarm[0],
    warm2: r.gradientWarm[1],
    premium1: r.gradientPremium[0],
    premium2: r.gradientPremium[1],
    green: '#3ECF6B', // success green — unchanged
    // New dark-glass roles — surfaced on the legacy object so the component
    // layer (components/ui/primitives.tsx, a later task) can read them off
    // `theme` as `theme.glassFill` etc. All resolve to var() at runtime.
    onAccent: r.onAccent,
    glassFill: r.glassFill,
    glassBorder: r.glassBorder,
    glassHighlight: r.glassHighlight,
    shadowDepth: r.shadowDepth,
    countRest: r.countRest,
    accentReact: r.accentReact,
  }) as const;

// Active theme, legacy-shaped. Both role maps are the same `var(--*)` map,
// so this follows `data-theme` at runtime — it is no longer pinned to light.
export const theme = legacyView(lightTheme);

// Also exported for the eventual switch-over.
export const legacyLight = legacyView(lightTheme);
export const legacyDark = legacyView(darkTheme);

// --- non-color tokens (design-system.md §3–§5) ---

export const radius = {
  control: 12, // buttons, inputs
  card: 16,
  sheet: 20,
  pill: 999, // chips, pills, avatars
} as const;

export const elevation = {
  // Light theme: soft shadow. Dark theme: use a 1px `border` hairline instead.
  card: '0 4px 16px rgba(35,30,32,.08)',
  sheet: '0 8px 28px rgba(35,30,32,.12)',
  glass: 'var(--shadow-depth)',
} as const;

// Frosted-glass surface treatment (theme-agnostic — same blur both modes).
export const glassBlur = 'blur(20px) saturate(1.08)';

export const type = {
  family: 'Montserrat, system-ui, sans-serif',
  display: { fontSize: 32, lineHeight: 1.15, fontWeight: 700 },
  title: { fontSize: 22, lineHeight: 1.2, fontWeight: 700 },
  heading: { fontSize: 18, lineHeight: 1.3, fontWeight: 700 },
  label: { fontSize: 14, lineHeight: 1.3, fontWeight: 600 },
  body: { fontSize: 15, lineHeight: 1.5, fontWeight: 400 },
  caption: { fontSize: 13, lineHeight: 1.4, fontWeight: 400 },
} as const;

// Readable text colour to sit on top of an `accent` fill.
export const onAccent = 'var(--on-accent)';

// localStorage key for the user's explicit theme choice. Lives here (a
// plain module) so both the client `useTheme()` hook and the server
// `ThemeScript` component can import it — importing a plain const across
// the RSC boundary from a `'use client'` module resolves to `undefined`.
export const STORAGE_KEY = 'w-app-theme';
