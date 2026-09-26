// P7 review capture harness — screenshots the real, auth-gated logged-in
// screens with realistic mock data, without a real Supabase project.
//
// How it works: the app runs normally (`next dev`) but pointed at a fake
// Supabase URL; Playwright intercepts every request to that host and answers
// from fixtures.mjs (a tiny generic PostgREST/GoTrue/Storage mock). No app
// code is changed except one capture-only line, see README.md.
//
// Run:  node scripts/p7-mockups/capture.mjs [baseUrl] [outDir] [theme]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import * as fx from './fixtures.mjs';

const BASE = process.argv[2] ?? 'http://localhost:3100';
const OUT = process.argv[3] ?? 'scripts/p7-mockups/out';
const THEME = process.argv[4] ?? 'dark';
const SB = 'https://mockproj.supabase.co';
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------ mock images */
const PALETTE = [['#6B5B95', '#2E2A3B'], ['#B5838D', '#3B2B30'], ['#4A6F8A', '#1E2B36'], ['#8A7F5A', '#302C1F'], ['#5E8B7E', '#1F2F2A'], ['#9B6A6C', '#352425'], ['#6D7B8D', '#23282F'], ['#A07855', '#35271C']];
function avatarSvg(seed) {
  const p = fx.profiles.find((x) => x.id === seed);
  const initials = (p?.display_name ?? '?').split(' ').map((s) => s[0]).join('').slice(0, 2);
  const [a, b] = PALETTE[[...seed].reduce((n, c) => n + c.charCodeAt(0), 0) % PALETTE.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs><radialGradient id="g" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient></defs><rect width="120" height="120" fill="url(#g)"/><circle cx="60" cy="48" r="22" fill="rgba(255,255,255,.18)"/><path d="M20 120c4-26 20-38 40-38s36 12 40 38z" fill="rgba(255,255,255,.14)"/><text x="60" y="112" text-anchor="middle" font-family="Montserrat,Arial" font-weight="700" font-size="18" fill="rgba(255,255,255,.75)">${initials}</text></svg>`;
}
function bannerSvg(seed) {
  const hue = { velvet: 340, jazz: 25, rooftop: 210, founders: 265 }[seed] ?? 200;
  const dots = Array.from({ length: 26 }, (_, i) => {
    const x = (i * 97) % 800, y = 40 + ((i * 53) % 260), r = 6 + ((i * 7) % 26);
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="hsla(${hue + (i % 5) * 12},95%,78%,${0.3 + (i % 4) * 0.15})" filter="url(#b)"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="400" viewBox="0 0 800 400"><defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue},45%,42%)"/><stop offset="1" stop-color="hsl(${hue},35%,14%)"/></linearGradient><filter id="b"><feGaussianBlur stdDeviation="6"/></filter></defs><rect width="800" height="400" fill="url(#bg)"/>${dots}<rect y="300" width="800" height="100" fill="hsla(${hue},30%,4%,.6)"/><path d="M0 330 Q200 300 400 330 T800 330 V400 H0z" fill="hsla(${hue},25%,10%,.9)"/></svg>`;
}

/* ------------------------------------------------------- PostgREST mock */
function applyFilters(rows, params) {
  let out = rows;
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(key) || key.includes('.')) continue;
    const m = raw.match(/^(not\.)?(eq|neq|in|is|gte|lte|gt|lt|ilike|like)\.(.*)$/);
    if (!m) continue;
    const [, not, op, val] = m;
    out = out.filter((r) => {
      if (!(key in r)) return true;
      const v = r[key];
      let hit = true;
      if (op === 'eq') hit = String(v) === val;
      else if (op === 'neq') hit = String(v) !== val;
      else if (op === 'in') hit = val.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/"/g, '')).includes(String(v));
      else if (op === 'is') hit = val === 'null' ? v == null : String(v) === val;
      return not ? !hit : hit;
    });
  }
  const limit = Number(params.get('limit'));
  return limit ? out.slice(0, limit) : out;
}

const unhandled = new Set();
async function handle(route) {
  const req = route.request();
  const url = new URL(req.url());
  const path = url.pathname;
  const json = (body, status = 200, headers = {}) =>
    route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range', ...headers }, body: JSON.stringify(body) });

  if (req.method() === 'OPTIONS') {
    return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  }
  if (path.startsWith('/storage/v1/object/public/mock/')) {
    const [, kind, file] = path.replace('/storage/v1/object/public/mock/', '').match(/^([^/]+)\/(.+)\.svg$/) ?? [];
    const svg = kind === 'avatar' ? avatarSvg(file) : bannerSvg(file);
    return route.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: svg });
  }
  if (path.startsWith('/auth/v1/user')) return json(authUser);
  if (path.startsWith('/auth/v1/')) return json({});
  if (path.startsWith('/rest/v1/rpc/')) {
    const name = path.split('/').pop();
    if (!(name in fx.rpc)) unhandled.add(`rpc ${name}`);
    return json(fx.rpc[name] ?? null);
  }
  if (path.startsWith('/rest/v1/')) {
    const table = path.replace('/rest/v1/', '');
    if (req.method() !== 'GET' && req.method() !== 'HEAD') return json([], 201);
    const rows = fx.tables[table];
    if (!rows) { unhandled.add(`table ${table}`); return json([]); }
    const result = applyFilters(rows, url.searchParams);
    const headers = { 'content-range': `0-${Math.max(result.length - 1, 0)}/${result.length}` };
    if ((req.headers()['accept'] ?? '').includes('vnd.pgrst.object')) return json(result[0] ?? null, result[0] ? 200 : 406, headers);
    if (req.method() === 'HEAD') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'Content-Range', ...headers } });
    return json(result, 200, headers);
  }
  unhandled.add(`${req.method()} ${path}`);
  return json({});
}

/* ---------------------------------------------------------- auth state */
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = Math.floor(Date.now() / 1000) + 86400 * 30;
const authUser = { id: fx.ME, aud: 'authenticated', role: 'authenticated', email: 'alex@example.com', is_anonymous: false, app_metadata: {}, user_metadata: {} };
const session = {
  access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: fx.ME, exp, role: 'authenticated', aud: 'authenticated' })}.sig`,
  refresh_token: 'mock-refresh', token_type: 'bearer', expires_in: 86400 * 30, expires_at: exp, user: authUser,
};
const me = fx.profiles[0];
const storeUser = {
  id: fx.ME, name: me.display_name, email: me.email, phone: me.phone, gender: 'Other', birth: me.date_of_birth,
  image: me.avatar_url, nationality: me.nationality, city: me.city, setupComplete: true, isMasterAdmin: true,
};
const venue = fx.locations[0];
const selectedLocation = {
  id: venue.id, name: venue.name, description: venue.description, latitude: venue.lat, longitude: venue.lng,
  radius: venue.geofence_radius_meters, count: 7, banner_image: venue.banner_image,
};

/* ------------------------------------------------------------- screens */
const V = `locationId=${fx.VENUE}`;
const SCREENS = [
  { id: 'home', url: '/main', tab: 'home', checkedIn: true, full: true },
  { id: 'history', url: '/main', tab: 'history' },
  { id: 'messages', url: '/main', tab: 'messages' },
  { id: 'profile', url: '/main', tab: 'profile', full: true },
  { id: 'venue-chat', url: `/main/venue/chat?${V}` },
  { id: 'venue-members', url: `/main/venue/members?${V}` },
  { id: 'venue-rewards', url: `/main/venue/rewards?${V}`, full: true },
  { id: 'venue-carousel', url: `/main/venue/carousel?${V}`, full: true },
  { id: 'venue-titles', url: `/main/venue/titles?${V}`, full: true },
  { id: 'venue-activities', url: `/main/venue/activities?${V}` },
  { id: 'venue-zones', url: `/main/venue/zones?${V}` },
  { id: 'venue-report', url: `/main/venue/report?${V}`, full: true },
  { id: 'admin', url: '/admin', full: true },
  { id: 'admin-location-requests', url: '/admin/location-requests' },
  { id: 'admin-venue-tags', url: `/admin/venue/${fx.VENUE}/tags`, full: true },
];

const only = process.env.ONLY?.split(',');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  geolocation: { latitude: venue.lat, longitude: venue.lng }, permissions: ['geolocation'],
  colorScheme: THEME,
});
await ctx.route(`${SB}/**`, handle);
await ctx.routeWebSocket(/mockproj\.supabase\.co/, () => { /* swallow realtime */ });
await ctx.addInitScript(({ session, storeUser, theme }) => {
  localStorage.setItem('sb-mockproj-auth-token', JSON.stringify(session));
  localStorage.setItem('w-app-storage', JSON.stringify({ state: { user: storeUser, token: 'mock', isAuthenticated: true }, version: 0 }));
  localStorage.setItem('w-app-theme', theme);
  localStorage.setItem('w_app_organizer_welcome_seen', '1');
  localStorage.setItem('w_app_location_permission_asked', 'true');
}, { session, storeUser, theme: THEME });

const AUDIT = readFileSync(new URL('./audit.js', import.meta.url), 'utf8');
const manifest = [];
for (const s of SCREENS) {
  if (only && !only.includes(s.id)) continue;
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(BASE + s.url, { waitUntil: 'networkidle' });
  if (s.tab) {
    await page.waitForFunction(() => !!window.__wStore);
    await page.evaluate(({ tab, checkedIn, selectedLocation, venue }) => {
      const st = window.__wStore.getState();
      st.setCurrentLocation({ lat: venue.lat, lng: venue.lng });
      if (checkedIn) st.setSelectedLocation(selectedLocation);
      st.setActiveTab(tab);
    }, { tab: s.tab, checkedIn: !!s.checkedIn, selectedLocation, venue });
  }
  // /main raises its own location prompt on a fresh session; accept it (the
  // context grants geolocation at the venue) so it doesn't cover the screen.
  const allow = page.getByRole('button', { name: 'Allow Location Access' });
  if (await allow.isVisible().catch(() => false)) await allow.click();
  await page.addStyleTag({ content: 'nextjs-portal{display:none!important}' });
  await page.waitForTimeout(2500);
  const file = `${OUT}/${s.id}.png`;
  // Grow the viewport to the page height instead of fullPage, so fixed
  // chrome (tab bar, sticky headers) lands where a user would see it.
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  if (s.full) { await page.setViewportSize({ width: 390, height: Math.min(Math.max(h, 844), 4000) }); await page.waitForTimeout(600); }
  await page.screenshot({ path: file });
  const audit = await page.evaluate(AUDIT);
  manifest.push({ id: s.id, url: s.url, file: `${s.id}.png`, height: h, errors, audit });
  console.log(`${s.id}: ${h}px contrast=${audit.contrast.length} targets=${audit.targets.length} ${errors.length ? 'ERRORS ' + errors.join(' | ') : ''}`);
  await page.close();
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2));
if (unhandled.size) console.log('unhandled:', [...unhandled].join(', '));
await browser.close();
