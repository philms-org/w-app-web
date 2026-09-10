// Standalone token assertions — this repo has no test runner.
// Run: node scripts/verify-theme-tokens.mjs
import { lightTheme, darkTheme, theme, onAccent } from '../lib/theme.ts';
import { readFileSync, readdirSync } from 'node:fs';

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

// 4. Legacy `theme` still exposes its keys (call sites depend on them),
//    plus the new dark-glass roles the component layer reads off `theme`.
for (const k of [
  'bg', 'surface', 'surface2', 'text', 'muted', 'divider', 'accent', 'accent2', 'pill',
  'glassFill', 'glassBorder', 'glassHighlight', 'countRest', 'accentReact', 'onAccent',
]) {
  if (!(k in theme)) fail(`legacy theme.${k} missing`);
}

// 5. Tailwind w-* colours point at vars, not hex.
for (const cls of ['w-blue', 'w-pink', 'w-back-gray', 'w-black', 'w-light-gray', 'w-dark-gray']) {
  if (!new RegExp(`'${cls}':\\s*'var\\(--`).test(tw)) fail(`tailwind.config ${cls} is not a var()`);
}

// 6. No `${theme.x}HH` hex-alpha string math under app/ & components/.
//    `var(--x)` cannot carry a 2-hex alpha suffix — the browser drops the
//    whole declaration. Use color-mix() instead (see globals.css). Guards I1.
const alphaConcatRe = /\$\{(theme|lightTheme|darkTheme)\.[a-zA-Z0-9_]+\}[0-9A-Fa-f]{2}\b/;
for (const root of ['app', 'components']) {
  const dir = new URL(`../${root}/`, import.meta.url);
  let entries = [];
  try { entries = readdirSync(dir, { recursive: true, encoding: 'utf8' }); } catch { entries = []; }
  for (const rel of entries) {
    if (rel.includes('node_modules') || !/\.tsx?$/.test(rel)) continue;
    let text;
    try { text = readFileSync(new URL(`../${root}/${rel}`, import.meta.url), 'utf8'); } catch { continue; }
    text.split('\n').forEach((line, i) => {
      if (alphaConcatRe.test(line)) {
        fail(`${root}/${rel}:${i + 1} hex-alpha concat on a theme token — use color-mix(): ${line.trim()}`);
      }
    });
  }
}

// 7. Every value on the legacy `theme` object must be a bare var() ref, so a
//    hard-coded literal (like the old near-white `pill`) can't sneak back and
//    go invisible in one theme. `green` and the two brand-gradient endpoints
//    are the only sanctioned theme-agnostic literals. Guards C1.
const themeLiteralWhitelist = {
  green: '#3ECF6B',
  gradientStart: '#5A6570',
  gradientEnd: '#22262B',
};
for (const [k, v] of Object.entries(theme)) {
  if (k in themeLiteralWhitelist) {
    if (v !== themeLiteralWhitelist[k]) {
      fail(`theme.${k} whitelisted literal changed: expected ${themeLiteralWhitelist[k]}, got ${v}`);
    }
    continue;
  }
  if (typeof v !== 'string' || !varRe.test(v)) fail(`theme.${k} is not a var() ref: ${v}`);
}

// 8. The @media (prefers-color-scheme: light) first-visit block must define
//    every role --token, EXCEPT the 4 theme-agnostic gradient tokens, which
//    correctly cascade from bare :root.
const mediaLightBlock =
  css.match(/@media \(prefers-color-scheme: light\)\s*{\s*:root:not\(\[data-theme\]\)\s*{([^}]*)}/s)?.[1] ?? '';
const gradientExempt = new Set([
  '--gradient-premium-a', '--gradient-premium-b', '--gradient-warm-a', '--gradient-warm-b',
]);
for (const v of usedVars) {
  if (gradientExempt.has(v)) continue;
  if (!mediaLightBlock.includes(`${v}:`)) fail(`globals.css @media light block missing ${v}`);
}

if (!process.exitCode) console.log('OK: theme token contract verified');
