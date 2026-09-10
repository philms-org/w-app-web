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

if (!process.exitCode) console.log('OK: theme token contract verified');
