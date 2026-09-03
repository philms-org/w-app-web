# Privacy Copy Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two factually-false claims in the location-tracking disclosure copy with accurate wording (no SQL change), and gate the checked-in "location" indicator so it only appears at venues where tracking actually happens.

**Architecture:** Pure copy edits on three surfaces plus one small behavior gate. `path (b)` from `docs/privacy-copy-rewrite-2026-09-02.md` — approved by the founder 2026-09-03 (rewrite the copy to match the code; do **not** add a k=3 floor to dwell/transitions). The indicator gate reuses the exact `venue_zones` head-count pattern already in `lib/hooks/useZoneTracking.ts`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript. Inline `style={{}}`; JSX text needs HTML entities for apostrophes/quotes (`&apos;`, `&ldquo;`, `&rdquo;`).

**Source of truth for wording:** `docs/privacy-copy-rewrite-2026-09-02.md` ("PROPOSED" blocks).

## Global Constraints

- **No automated test suite exists in this repo.** Every task ends with `npx tsc --noEmit` (must stay clean) plus a manual browser check. No unit tests.
- Copy the "PROPOSED" wording from `docs/privacy-copy-rewrite-2026-09-02.md` verbatim; the exact strings are also reproduced in each task below.
- `'use client'` is already present on all three files — don't remove it.
- Build gates are ON (`next.config.ts`): lint and type errors fail the build.
- **No SQL, no migration.** If you find yourself writing SQL, the requirement has drifted — stop.
- Commit after every task.
- This pass does **not** cover the connections-geotag disclosure (that's timed with `docs/superpowers/plans/2026-09-03-connections-write-path-v2.md` shipping — see its "Deferred / follow-up").
- A lawyer reviewing the final `/privacy` wording before launch remains a founder action item, out of scope here.

---

### Task 1: Rewrite `/privacy` page copy

**Files:**
- Modify: `app/privacy/page.tsx` (the three section `<p style={bodyStyle}>` bodies at ~lines 54–78, the "Your controls" body at ~lines 83–87, and the stale DRAFT header comment at lines 26–28)

**Interfaces:**
- Consumes: nothing. Produces: nothing consumed elsewhere. Self-contained copy change.

- [ ] **Step 1: Replace the "What we collect" paragraph**

Current (`app/privacy/page.tsx` ~54–59):
```tsx
          <p style={bodyStyle}>
            While you&apos;re checked in to a venue, we periodically record your approximate position
            within that venue. This only happens while you have an active check-in — we don&apos;t
            track your location before you check in, after you check out, or anywhere outside the
            venue you&apos;re checked into.
          </p>
```

Replace with:
```tsx
          <p style={bodyStyle}>
            Some venues divide their space into named areas (for example &ldquo;Main Bar&rdquo; or
            &ldquo;Patio&rdquo;). While you&apos;re checked in to a venue like that, about once every
            10 seconds your device sends its location to us, we match it to the nearest named area,
            and we store <strong>only that area name and the time</strong> — not your actual
            coordinates.
          </p>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            This happens only while you have an active check-in. We don&apos;t record anything before
            you check in, after you check out, at venues that haven&apos;t defined areas, or anywhere
            outside the venue you&apos;re checked into.
          </p>
```

- [ ] **Step 2: Replace the "Why we collect it" paragraph**

Current (~64–69):
```tsx
          <p style={bodyStyle}>
            Venue organizers use this data in aggregate to understand things like which areas of
            their venue are busiest and how long attendees typically stay. Individual attendees are
            never identified in these reports — figures below 3 people are hidden so no one can be
            singled out from a small count.
          </p>
```

Replace with:
```tsx
          <p style={bodyStyle}>
            Venue organizers see summary reports for their own venue: how many people are in each
            area, the average time people spend in each area, how people move between areas, and what
            share of their attendees also visited other venues nearby.{' '}
            <strong>Reports show area names and totals only — never your name, your account, or your
            coordinates.</strong>
          </p>
          <p style={{ ...bodyStyle, marginTop: '10px' }}>
            Head-count figures — how many people are in an area, and how many of a venue&apos;s
            attendees also went to another venue — are hidden when fewer than 3 people are involved,
            so no one can be picked out of a small number. Average-time and area-to-area movement
            figures can be shown for smaller groups; they still carry no identifying information, but
            a venue could in principle relate them to who was present at the time.
          </p>
```

- [ ] **Step 3: Replace the "How long we keep it" paragraph**

Current (~74–78):
```tsx
          <p style={bodyStyle}>
            Raw position data is deleted within 48 hours. Only the aggregated, anonymized statistics
            derived from it (e.g. &ldquo;Main Bar was busiest at 9pm&rdquo;) are kept longer, for the
            venue&apos;s ongoing reporting.
          </p>
```

Replace with:
```tsx
          <p style={bodyStyle}>
            Area-and-time records are deleted within 48 hours — an automated job runs every hour.{' '}
            <strong>Nothing derived from them is stored separately.</strong> Each time an organizer
            opens their report it&apos;s recalculated from scratch using only the last 48 hours of
            data, so anything older has already disappeared from every report.
          </p>
```

- [ ] **Step 4: Append one sentence to "Your controls"**

Current (~83–87):
```tsx
          <p style={bodyStyle}>
            You can deny or revoke location access at any time in your browser or device settings.
            Without location access, you can still use The W App, but you won&apos;t be able to check
            in to venues or see nearby locations.
          </p>
```

Replace with:
```tsx
          <p style={bodyStyle}>
            You can deny or revoke location access at any time in your browser or device settings.
            Without location access, you can still use The W App, but you won&apos;t be able to check
            in to venues or see nearby locations. Denying location doesn&apos;t delete area-and-time
            records already collected during a past check-in; those age out on the normal 48-hour
            schedule.
          </p>
```

- [ ] **Step 5: Update the stale DRAFT header comment**

Current (lines 26–28):
```tsx
// DRAFT — placeholder copy for founder review, not final legal language.
// Covers only the location-tracking disclosure gap flagged in
// docs/RESUME-launch-prep.md; not a full privacy policy for the whole app.
```

Replace with:
```tsx
// Location-tracking disclosure. Wording is the accuracy-checked "path (b)"
// rewrite from docs/privacy-copy-rewrite-2026-09-02.md (founder-approved
// 2026-09-03). NOT lawyer-reviewed yet, and NOT a full privacy policy for the
// whole app — it covers venue zone/area analytics only. The connections-geotag
// disclosure is added separately when that feature ships.
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 7: Manual browser check**

Run `npm run dev`, visit `/privacy` (no auth needed — it's a static page).
Expected: all four sections render the new wording, apostrophes and quotes display correctly (no literal `&apos;` visible), the two bold spans show. No "kept longer" claim, no unqualified "figures below 3 people are hidden" claim.

- [ ] **Step 8: Commit**

```bash
git add app/privacy/page.tsx
git commit -m "Privacy page: accuracy rewrite (path b) — no false k=3 / retention claims

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Rewrite the location-permission modal copy

**Files:**
- Modify: `app/main/page.tsx:153` (the single `<p>` inside the "Share Your Location" modal)

**Interfaces:**
- Consumes: nothing. Produces: nothing consumed elsewhere.

- [ ] **Step 1: Replace the modal paragraph**

Current (`app/main/page.tsx:153`, one line):
```tsx
              The W App works best when we know your location. This helps us show you nearby people and places to connect. While you&apos;re checked in to a venue, we also share your approximate position with that venue for anonymized attendance analytics — never before check-in or after checkout.
```

Replace with:
```tsx
              The W App works best when we know your location — it&apos;s how we show you nearby people and places. While you&apos;re checked in to a venue that has defined areas, we also match your location to those areas (like &ldquo;Main Bar&rdquo;) so the organizer can see which areas are busy. They see totals for their venue only — never your name or your exact location — and this stops the moment you check out.
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Manual browser check**

Run `npm run dev`, sign in, trigger the "Share Your Location" modal (it shows on `/main` when location hasn't been granted/denied yet — clear the relevant flag in the Zustand store or use a fresh session/incognito).
Expected: the modal body shows the new wording; "share your approximate position with that venue" is gone; the "venue that has defined areas" condition is present.

- [ ] **Step 4: Commit**

```bash
git add app/main/page.tsx
git commit -m "Location permission modal: accurate copy (area-match, not position-share)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Checked-in indicator — copy + zone gate

**Files:**
- Modify: `components/home/CheckedInHero.tsx` (add `venueHasZones` state + effect near the other hooks around line 40–60; gate the `{checkedIn && (...)}` `<Link href="/privacy">` block at ~262–282; update the indicator text at ~280)

**Interfaces:**
- Consumes: `supabase` — **check whether it's already imported** in `CheckedInHero.tsx`; it imports from `@/lib/data` but may not import `supabase` directly. If not, add `import { supabase } from '@/lib/supabase';` alongside the existing imports.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Add `venueHasZones` state and a populating effect**

Near the top of the component, alongside the other `useState` declarations (the component already uses `useState`, `useEffect`, `useCallback`, `useRef`, `useMemo` — all imported line 3):

```tsx
  const [venueHasZones, setVenueHasZones] = useState(false);
```

Then add an effect (place it near the existing `useZoneTracking(...)` call on line 57 — same data, same gate concept):

```tsx
  // The "location is used for area analytics" indicator below must only show
  // at venues that actually have zones — for a zone-less venue nothing is
  // ever recorded (useZoneTracking bails on the same check), so the notice
  // would be false. Same venue_zones head-count query useZoneTracking uses.
  useEffect(() => {
    const locationId = checkedIn ? selectedLocation?.id ?? null : null;
    if (!locationId) {
      setVenueHasZones(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('venue_zones')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .then(({ count }) => {
        if (!cancelled) setVenueHasZones(!!count);
      });
    return () => { cancelled = true; };
  }, [checkedIn, selectedLocation?.id]);
```

(If `supabase` is not already imported in this file, add `import { supabase } from '@/lib/supabase';`.)

- [ ] **Step 2: Gate the indicator and update its text**

Current (`components/home/CheckedInHero.tsx` ~262–282):
```tsx
        {checkedIn && (
          <Link
            href="/privacy"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: theme.muted,
              fontSize: '12px',
              textDecoration: 'none',
              marginBottom: '16px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
            }}
          >
            <MapPin style={{ width: '12px', height: '12px' }} />
            Sharing location with this venue while checked in — Learn more
          </Link>
        )}
```

Replace the guard and the text line:
```tsx
        {checkedIn && venueHasZones && (
          <Link
            href="/privacy"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: theme.muted,
              fontSize: '12px',
              textDecoration: 'none',
              marginBottom: '16px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
            }}
          >
            <MapPin style={{ width: '12px', height: '12px' }} />
            Location is used for this venue&apos;s area analytics while you&apos;re checked in — Learn more
          </Link>
        )}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Manual browser check (needs the two QA venues)**

`w-app-qa` has `QA Test Venue` (no zones) and `QA Test Venue Two`. Confirm which has zones:
```bash
supabase link --project-ref ducadjakxmkfcvrteoqz
echo "select l.name, count(z.id) as zones from locations l left join venue_zones z on z.location_id = l.id group by l.name order by l.name;" | supabase db query --linked
```

Then run `npm run dev`, sign in, check in (geo-sim) to a venue **with 0 zones**.
Expected: no "Location is used for … area analytics" line under the people/radius row.

If neither QA venue has zones, add one via the master-admin "Manage Zones" UI (`/main/venue/zones`) for `QA Test Venue`, check in there, and confirm the line now appears with the new wording.

- [ ] **Step 5: Commit**

```bash
git add components/home/CheckedInHero.tsx
git commit -m "CheckedInHero: gate location-analytics notice on venue-has-zones, accurate copy

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** the two false claims from `docs/privacy-copy-rewrite-2026-09-02.md` — the unqualified k=3 claim (Task 1 Step 2) and the "aggregated statistics kept longer" claim (Task 1 Step 3) — are both replaced. Surface 2 (permission modal) is Task 2. Surface 3 (indicator) copy + the founder-chosen behavior gate is Task 3. The optional "Your controls" append is included (Task 1 Step 4). No SQL — `path (b)` explicitly rules it out.
- **Consistency:** all three surfaces now say the same three things — area name + time only (not coordinates), venue-with-areas only, 48h deletion with nothing derived kept. The indicator gate uses the identical `venue_zones` head-count predicate as `useZoneTracking`, so the notice shows exactly when tracking runs.
- **Deliberate omission:** connections-geotag disclosure is not here — it's tied to that feature's rollout.
