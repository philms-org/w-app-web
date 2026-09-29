# P7 review capture harness

Screenshots the auth-gated, logged-in screens (checked-in Home, History,
Messages, Profile, `/main/venue/*`, `/admin/*`) with realistic mock data and
audits each one for WCAG AA contrast and sub-44px touch targets. Output feeds
the founder review page in `docs/p7-review/index.html`.

No real Supabase project is touched. The app runs normally but points at a
fake Supabase host; Playwright answers every request to that host from
`fixtures.mjs` (a small generic PostgREST / GoTrue / Storage mock).

## Run

1. Point a checkout at the fake host (`.env.local`, never commit):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://mockproj.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=mock-anon-key
   ```

2. Tab screens need non-persisted store state (checked-in venue, active tab).
   Append this capture-only line to `lib/store.ts` in that checkout (do not
   commit it):

   ```ts
   if (typeof window !== 'undefined') (window as unknown as { __wStore: typeof useStore }).__wStore = useStore;
   ```

3. `npx next dev -p 3100`, then:

   ```
   node scripts/p7-mockups/capture.mjs http://localhost:3100 docs/p7-review/shots/dark dark
   node scripts/p7-mockups/capture.mjs http://localhost:3100 docs/p7-review/shots/light light
   ```

   Needs `playwright` resolvable (global install is fine) and Chromium
   (`CHROMIUM=/path/to/chromium` to override). `ONLY=home,profile` limits
   the run. Each run writes `manifest.json` with the audit results.

To include the venue feed from PR #3, run it from a checkout that has that
branch merged in.

## Files

- `fixtures.mjs` — fictional venue (Velvet Room), 8 people, posts, likes,
  chats, rewards, zones, titles, badges, admin data.
- `capture.mjs` — Playwright driver + request mock.
- `audit.js` — injected per page: contrast (alpha-composited backgrounds;
  text over photos is skipped) and interactive elements under 44 × 44.
