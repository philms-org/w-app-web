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

// `theme` is the legacy-shaped view of the light role map (a separate object,
// because legacy `surface` == card collides with the role `surface` == page bg).
eq(theme.bg, lightTheme.surface, 'theme.bg == lightTheme.surface');
eq(theme.surface, lightTheme.surfaceRaised, 'theme.surface == lightTheme.surfaceRaised');
eq(theme.divider, lightTheme.border, 'theme.divider == lightTheme.border');

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

if (!process.exitCode) console.log('OK: theme tokens verified');
