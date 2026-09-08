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
// Dark is fully defined but NOT activated here — no prefers-color-scheme or
// toggle wiring in this plan.

type Duo = readonly [string, string];

export interface ThemeRoles {
  surface: string;
  surfaceRaised: string;
  surfaceRaised2: string;
  content: string;
  contentMuted: string;
  border: string;
  accent: string;
  accent2: string;
  tabBarBg: string;
  gradientPremium: Duo;
  gradientWarm: Duo;
}

export const lightTheme: ThemeRoles = {
  surface: '#F0F6FA',
  surfaceRaised: '#FFFFFF',
  surfaceRaised2: '#F3F3F3',
  content: '#231E20',
  contentMuted: '#919191',
  border: '#E7EDF2',
  accent: '#22C3C9',
  accent2: '#EC2C91',
  tabBarBg: '#231E20',
  gradientPremium: ['#7C5CFF', '#D24BD6'],
  gradientWarm: ['#F3B56D', '#E8836A'],
};

export const darkTheme: ThemeRoles = {
  surface: '#0D0D0F',
  surfaceRaised: '#1A1A1D',
  surfaceRaised2: '#232327',
  content: '#F5F5F7',
  contentMuted: 'rgba(245,245,247,0.55)',
  border: 'rgba(255,255,255,0.09)',
  accent: '#22C3C9',
  accent2: '#EC2C91',
  tabBarBg: '#000000',
  gradientPremium: ['#7C5CFF', '#D24BD6'],
  gradientWarm: ['#F3B56D', '#E8836A'],
};

export type ThemeRole = keyof ThemeRoles;

// Legacy-shaped view of a role map. `surface` here is the *card* colour
// (role `surfaceRaised`) — that is what the existing call sites mean by it.
const legacyView = (r: ThemeRoles) =>
  ({
    bg: r.surface,
    pill: '#F0F6FA', // iOS Colors.back_gray — theme-agnostic field bg, unchanged
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
  }) as const;

// Active theme — forced light until the theme-switching plan lands.
export const theme = legacyView(lightTheme);

// Also exported for the eventual switch-over.
export const legacyLight = legacyView(lightTheme);
export const legacyDark = legacyView(darkTheme);
