# Home Banner + Feed Teaser Restyle (Round 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the dead profile-edit link, split the Home banner into in-range-check-in vs
nearby-peek states with a real manual-refresh path, and restyle the friends-feed teaser —
per `docs/superpowers/specs/2026-08-26-home-banner-feed-round1-design.md`.

**Architecture:** Pure client-side additions on top of existing Supabase-backed data
functions (`fetchVenues`, `fetchBanners`, `checkIn`, `upsertProfile`, `uploadAvatar`) — no
new tables, no new RLS, no new backend calls. Two small new shared modules
(`lib/geo.ts`, `lib/geolocation.ts`) remove duplication and centralize the
manual-refresh logic; the rest is component work in `components/home/` plus one new route.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Zustand (`lib/store.ts`),
Supabase JS client (`lib/data.ts`), inline `style={{}}` (this codebase's established
convention — Tailwind is installed but unused).

## Global Constraints

- No automated test suite exists in this repo (confirmed convention — every existing plan's
  Testing section is manual dev-server verification). Every task below ends with a manual
  browser-verification step, not a unit test.
- Follow the existing inline-style convention exactly — no Tailwind classes, no CSS modules.
- Use `theme` tokens from `lib/theme.ts` for all new colors — never hardcode a hex value that
  already has a token.
- `Venue`'s geofence field is `geofence_radius_meters` (not `radius` — that name only exists
  on the Zustand store's separate `Location` type, used for `selectedLocation`/`nearbyLocations`).
- Run `npx tsc --noEmit` after every task — must stay clean throughout.
- Commit after every task (small, working increments — matches this repo's existing commit
  history style, e.g. "Phase 0", "Phase 1" granularity).
- Do not touch `components/home/CheckedInHero.tsx`'s `useZoneTracking` call, the
  organizer-analytics report page, or anything under `app/main/venue/zones` — unrelated,
  already shipped, explicitly out of scope per the spec.

---

### Task 1: Extract shared `haversineMeters` helper

**Files:**
- Create: `lib/geo.ts`
- Modify: `components/home/NearbyBanner.tsx:10-20` (remove local copy, import instead)
- Modify: `components/home/CheckedInHero.tsx:29-39` (remove local copy, import instead)

**Interfaces:**
- Produces: `haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number`
  — meters between two lat/lng points. Every later task that needs distance math imports
  this from `lib/geo.ts`.

- [ ] **Step 1: Create `lib/geo.ts`**

```ts
// lib/geo.ts

// Straight-line (haversine) distance in meters between two lat/lng points.
// Shared by NearbyBanner (in-range/nearby split) and CheckedInHero (geofence gate).
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

- [ ] **Step 2: Update `components/home/NearbyBanner.tsx`**

Remove lines 10-20 (the local `haversineMeters` function) and add this import near the top
with the other imports:

```ts
import { haversineMeters } from '@/lib/geo';
```

- [ ] **Step 3: Update `components/home/CheckedInHero.tsx`**

Remove lines 29-39 (the local `haversineMeters` function) and add:

```ts
import { haversineMeters } from '@/lib/geo';
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors (both files still compile, function behavior unchanged).

- [ ] **Step 5: Commit**

```bash
git add lib/geo.ts components/home/NearbyBanner.tsx components/home/CheckedInHero.tsx
git commit -m "Extract shared haversineMeters helper to lib/geo.ts"
```

---

### Task 2: Extract `requestLocation()` for manual refresh

**Files:**
- Create: `lib/geolocation.ts`
- Modify: `app/main/page.tsx:41-76` (`handleAllowLocation` calls the shared function
  instead of duplicating the `getCurrentPosition` logic)

**Interfaces:**
- Consumes: `useStore.getState()` (Zustand's non-hook accessor — same store as
  `useStore()`, safe to call outside a component), specifically `setCurrentLocation` and
  `setLocationDenied` (both already exist in `lib/store.ts`).
- Produces: `requestLocation(): Promise<void>` — resolves once `currentLocation` /
  `locationDenied` have been updated in the store (success, denial, timeout, or
  unsupported-browser all resolve, never reject). Task 3's pull-to-refresh hook and Task 5's
  `NearbyBanner` both call this directly.

- [ ] **Step 1: Create `lib/geolocation.ts`**

```ts
// lib/geolocation.ts
import { useStore } from '@/lib/store';

// Same fallback center app/main/page.tsx's modal has always used when
// geolocation is denied/unsupported — kept identical so behavior doesn't change.
const FALLBACK_LOCATION = { lat: 40.7128, lng: -74.0060 };

// Fetches a fresh position and writes it to the store. Used by the first-run
// permission modal AND by every manual-refresh entry point (header button,
// pull-to-refresh, "Enable Location" retry) added in this round — there is
// exactly one place that calls navigator.geolocation now.
export function requestLocation(): Promise<void> {
  const { setCurrentLocation, setLocationDenied } = useStore.getState();

  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      setCurrentLocation(FALLBACK_LOCATION);
      setLocationDenied(true);
      resolve();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationDenied(false);
        resolve();
      },
      (error) => {
        console.error('Location error:', error);
        setCurrentLocation(FALLBACK_LOCATION);
        setLocationDenied(true);
        resolve();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0, // manual refresh must not return a stale cached fix
      }
    );
  });
}
```

- [ ] **Step 2: Simplify `app/main/page.tsx`'s `handleAllowLocation`**

Replace the current `handleAllowLocation` function (lines 41-76) with:

```ts
  const handleAllowLocation = () => {
    setLocationPermissionAsked(true);
    localStorage.setItem('w_app_location_permission_asked', 'true');
    setShowLocationPrompt(false);
    requestLocation();
  };
```

Add the import near the top of the file:

```ts
import { requestLocation } from '@/lib/geolocation';
```

`handleDenyLocation` (lines 78-84) stays exactly as-is — "Maybe Later" must not trigger a
geolocation call, and it already sets the same fallback directly.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Manual check: dev server, clear `localStorage` (`w_app_location_permission_asked`), reload
`/main`, click "Allow Location Access" in the modal — confirm the browser's native permission
prompt still fires and `currentLocation` still updates (unchanged first-run behavior).

- [ ] **Step 4: Commit**

```bash
git add lib/geolocation.ts app/main/page.tsx
git commit -m "Extract requestLocation() for reuse by manual-refresh entry points"
```

---

### Task 3: Pull-to-refresh hook

**Files:**
- Create: `lib/hooks/usePullToRefresh.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks directly (a standalone DOM-event hook).
- Produces: `usePullToRefresh(onRefresh: () => void): { pulling: boolean; pullDistance: number }`
  — `pullDistance` (0 to 120) drives a visual indicator while dragging; `pulling` is true
  while `onRefresh` is presumed in-flight (cleared after a fixed 800ms, since
  `requestLocation()` doesn't expose real completion timing to a naive caller — good enough
  for a spinner, not used for correctness). Task 5's `NearbyBanner` is the only consumer.

- [ ] **Step 1: Create `lib/hooks/usePullToRefresh.ts`**

```ts
'use client';

import { useEffect, useRef, useState } from 'react';

const THRESHOLD = 80;
const MAX_PULL = 120;

// Standard mobile pull-to-refresh gesture: drag down from the top of a
// scrolled-to-top page, release past THRESHOLD to fire onRefresh. Listens on
// `window` rather than a ref so it works regardless of which element actually
// scrolls in this codebase's plain-div layout (no scroll container convention
// exists yet).
export function usePullToRefresh(onRefresh: () => void) {
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 0) return;
      startY.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY === 0) {
        setPullDistance(Math.min(delta, MAX_PULL));
      }
    };

    const onTouchEnd = () => {
      setPullDistance((current) => {
        if (current >= THRESHOLD) {
          setPulling(true);
          onRefresh();
          setTimeout(() => setPulling(false), 800);
        }
        return 0;
      });
      startY.current = null;
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [onRefresh]);

  return { pulling, pullDistance };
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors. (No visual effect yet — nothing calls this hook until Task 5.)

- [ ] **Step 3: Commit**

```bash
git add lib/hooks/usePullToRefresh.ts
git commit -m "Add usePullToRefresh hook"
```

---

### Task 4: Shared blurred feed backdrop

**Files:**
- Create: `components/shared/FeedBlurBackdrop.tsx`

**Interfaces:**
- Produces: `<FeedBlurBackdrop />` — a static illustrative mock of feed rows (avatar circle
  + two text bars per row), rendered pre-blurred via CSS `filter: blur()`, absolutely
  positioned to fill its nearest `position: relative` ancestor. No props, no data
  dependency. Task 6 (`VenuePeekModal`) and Task 7 (`FriendsActivityFeed`) both render it.

- [ ] **Step 1: Create `components/shared/FeedBlurBackdrop.tsx`**

```tsx
'use client';

import { theme } from '@/lib/theme';

const ROW_WIDTHS = ['70%', '45%', '85%', '55%'];

// Static illustrative mock of a social feed, pre-blurred — no real posts, no
// data fetch, just a visual hint of "what it could look like" once unlocked.
// Reused by FriendsActivityFeed's locked state and VenuePeekModal's preview.
// Parent must be `position: relative` (or similar) for this to fill it.
export default function FeedBlurBackdrop() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        filter: 'blur(6px)',
        opacity: 0.55,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {ROW_WIDTHS.map((width, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '9999px',
            backgroundColor: theme.surface2,
            flexShrink: 0,
          }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ width, height: '10px', borderRadius: '4px', backgroundColor: theme.surface2 }} />
            <div style={{ width: '40%', height: '8px', borderRadius: '4px', backgroundColor: theme.surface2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors. (Not rendered anywhere yet — visual check happens in Tasks 6/7.)

- [ ] **Step 3: Commit**

```bash
git add components/shared/FeedBlurBackdrop.tsx
git commit -m "Add shared FeedBlurBackdrop component"
```

---

### Task 5: Rebuild `NearbyBanner` — in-range/nearby split + manual refresh

**Files:**
- Modify: `components/home/NearbyBanner.tsx` (full rewrite of the component body; keeps the
  file's existing `handlePeek` removal — replaced by real modal wiring in Task 6)
- Modify: `app/globals.css` (append `@keyframes spin`, used by the new refresh-icon animation)

**Interfaces:**
- Consumes: `haversineMeters` (Task 1), `requestLocation` (Task 2),
  `usePullToRefresh` (Task 3), `useStore().currentLocation` / `setSelectedLocation`
  (existing, `lib/store.ts`), `fetchVenues` (existing, `lib/data.ts`).
- Produces: renders a `Check In` action that calls `setSelectedLocation(...)` with the
  store's `Location` shape (see the exact mapping in Step 1 below — this must match
  `components/tabs/MapTab.tsx:101-112`'s existing `Venue` → `Location` conversion exactly, or
  `CheckedInHero`'s geofence math breaks). Also produces the `onPeek(venue: Venue)` callback
  contract Task 6's `VenuePeekModal` expects: `(venue: Venue) => void`.

- [ ] **Step 1: Add the spin keyframe used by the refresh icon**

`app/globals.css` has no `@keyframes spin` today (confirmed via grep — the pre-existing
`className="spinner"` loading indicator elsewhere in this codebase is a separate, already-broken
reference, out of scope for this plan). Append to the end of `app/globals.css`:

```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 2: Replace `components/home/NearbyBanner.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchVenues } from '@/lib/data';
import { useStore } from '@/lib/store';
import { requestLocation } from '@/lib/geolocation';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { haversineMeters } from '@/lib/geo';
import { theme } from '@/lib/theme';
import type { Venue } from '@/lib/types';
import { MapPinOff, MapPin, RefreshCw, Eye } from 'lucide-react';
import VenuePeekModal from '@/components/home/VenuePeekModal';

const DEFAULT_RADIUS_METERS = 50;

export default function NearbyBanner() {
  const { currentLocation, setSelectedLocation } = useStore();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [peekVenue, setPeekVenue] = useState<Venue | null>(null);

  useEffect(() => {
    fetchVenues()
      .then(setVenues)
      .catch((err) => console.error('Failed to load nearby venues:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    requestLocation().finally(() => setRefreshing(false));
  };

  const { pullDistance } = usePullToRefresh(handleRefresh);

  const { inRange, nearby } = useMemo(() => {
    const withCoords = venues.filter((v) => v.lat != null && v.lng != null);
    if (!currentLocation) return { inRange: [] as Venue[], nearby: withCoords };

    const withDistance = withCoords
      .map((v) => ({
        venue: v,
        distance: haversineMeters(currentLocation.lat, currentLocation.lng, v.lat as number, v.lng as number),
      }))
      .sort((a, b) => a.distance - b.distance);

    const inRangeList: Venue[] = [];
    const nearbyList: Venue[] = [];
    for (const { venue, distance } of withDistance) {
      const radius = venue.geofence_radius_meters ?? DEFAULT_RADIUS_METERS;
      if (distance <= radius) inRangeList.push(venue);
      else nearbyList.push(venue);
    }
    return { inRange: inRangeList, nearby: nearbyList };
  }, [venues, currentLocation]);

  const handleCheckIn = (venue: Venue) => {
    // Same Venue -> store Location conversion MapTab.tsx uses for its own
    // "Check In Here" button — CheckedInHero's geofence math depends on this
    // exact shape (latitude/longitude/radius, not lat/lng/geofence_radius_meters).
    setSelectedLocation({
      id: venue.id,
      name: venue.name,
      description: venue.description ?? '',
      latitude: venue.lat as number,
      longitude: venue.lng as number,
      radius: venue.geofence_radius_meters ?? DEFAULT_RADIUS_METERS,
      count: 0,
      category: 'venue',
      isHot: false,
      banner_image: venue.banner_image ?? null,
    });
  };

  const cardStyle: React.CSSProperties = {
    flexShrink: 0,
    width: '220px',
    borderRadius: '16px',
    overflow: 'hidden',
    backgroundColor: theme.surface,
    border: `1px solid ${theme.divider}`,
  };

  const renderCard = (venue: Venue, action: 'checkin' | 'peek') => (
    <div key={venue.id} style={cardStyle}>
      <div style={{
        height: '110px',
        backgroundImage: venue.banner_image ? `url(${venue.banner_image})` : undefined,
        background: venue.banner_image
          ? undefined
          : `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />
      <div style={{ padding: '12px 14px 14px' }}>
        <h3 style={{
          color: theme.text, fontSize: '15px', fontWeight: 700, marginBottom: '4px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}>{venue.name}</h3>
        {venue.description && (
          <p style={{
            color: theme.muted, fontSize: '12px', marginBottom: '10px',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', fontFamily: 'Montserrat, system-ui, sans-serif',
          }}>{venue.description}</p>
        )}
        {action === 'checkin' ? (
          <button
            onClick={() => handleCheckIn(venue)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              width: '100%', backgroundColor: theme.accent, color: 'white', border: 'none',
              borderRadius: '9999px', padding: '8px 0', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Montserrat, system-ui, sans-serif',
            }}
          >
            <MapPin style={{ width: '14px', height: '14px' }} />
            Check In
          </button>
        ) : (
          <button
            onClick={() => setPeekVenue(venue)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              width: '100%', backgroundColor: theme.surface2, color: theme.accent,
              border: `1px solid ${theme.divider}`, borderRadius: '9999px', padding: '8px 0',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Montserrat, system-ui, sans-serif',
            }}
          >
            <Eye style={{ width: '14px', height: '14px' }} />
            Peek
          </button>
        )}
      </div>
    </div>
  );

  const headerRow = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', marginBottom: '12px',
    }}>
      <p style={{
        color: currentLocation ? theme.text : theme.muted,
        fontSize: '13px', fontWeight: 700,
        fontFamily: 'Montserrat, system-ui, sans-serif',
      }}>
        {currentLocation ? 'Location detected' : 'Location not detected'}
      </p>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        aria-label="Refresh location"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '28px', height: '28px', borderRadius: '9999px', border: 'none',
          backgroundColor: theme.surface2, cursor: refreshing ? 'default' : 'pointer',
        }}
      >
        <RefreshCw style={{
          width: '14px', height: '14px', color: theme.text,
          animation: refreshing ? 'spin 1s linear infinite' : undefined,
        }} />
      </button>
    </div>
  );

  const pullIndicator = pullDistance > 0 && (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: `${pullDistance}px`, overflow: 'hidden', transition: 'height 0.15s ease',
    }}>
      <RefreshCw style={{
        width: '18px', height: '18px', color: theme.accent,
        transform: `rotate(${pullDistance * 3}deg)`,
      }} />
    </div>
  );

  if (!currentLocation) {
    return (
      <div style={{ padding: '20px 0 4px' }}>
        {pullIndicator}
        {headerRow}
        <div style={{ padding: '32px 24px', textAlign: 'center' }}>
          <MapPinOff style={{ width: '32px', height: '32px', color: theme.muted, margin: '0 auto 12px' }} />
          <p style={{ color: theme.muted, fontSize: '14px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            Turn on location to see nearby venues.
          </p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              backgroundColor: theme.accent, color: 'white', border: 'none',
              borderRadius: '9999px', padding: '10px 24px', fontSize: '14px', fontWeight: 600,
              cursor: refreshing ? 'default' : 'pointer', marginBottom: '12px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
            }}
          >
            {refreshing ? 'Enabling…' : 'Enable Location'}
          </button>
          <div>
            <button
              onClick={() => setShowManualEntry((v) => !v)}
              style={{
                background: 'none', border: 'none', color: theme.muted, fontSize: '12px',
                textDecoration: 'underline', cursor: 'pointer',
                fontFamily: 'Montserrat, system-ui, sans-serif',
              }}
            >
              or enter it manually
            </button>
          </div>
          {showManualEntry && (
            <div style={{ marginTop: '16px', textAlign: 'left' }}>
              <p style={{ color: theme.muted, fontSize: '12px', marginBottom: '8px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                Pick a venue to use as your location:
              </p>
              {venues.filter((v) => v.lat != null && v.lng != null).map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    useStore.getState().setCurrentLocation({ lat: v.lat as number, lng: v.lng as number });
                    useStore.getState().setLocationDenied(false);
                    setShowManualEntry(false);
                  }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', backgroundColor: theme.surface,
                    border: `1px solid ${theme.divider}`, borderRadius: '10px', padding: '10px 14px',
                    marginBottom: '6px', color: theme.text, fontSize: '13px', cursor: 'pointer',
                    fontFamily: 'Montserrat, system-ui, sans-serif',
                  }}
                >
                  {v.name}{v.city ? ` — ${v.city}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 0 4px' }}>
      {pullIndicator}
      {headerRow}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
          <span className="spinner" />
        </div>
      )}

      {!loading && inRange.length === 0 && nearby.length === 0 && (
        <p style={{ color: theme.muted, fontSize: '14px', padding: '0 20px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          No locations nearby yet
        </p>
      )}

      {!loading && inRange.length > 0 && (
        <>
          <p style={{
            color: theme.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.5px', margin: '0 0 8px', padding: '0 20px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}>You&apos;re here — check in</p>
          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', padding: '0 20px 8px' }}>
            {inRange.map((v) => renderCard(v, 'checkin'))}
          </div>
        </>
      )}

      {!loading && nearby.length > 0 && (
        <>
          <p style={{
            color: theme.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.5px', margin: '16px 0 8px', padding: '0 20px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}>Nearby — peek in</p>
          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', padding: '0 20px 8px' }}>
            {nearby.map((v) => renderCard(v, 'peek'))}
          </div>
        </>
      )}

      {peekVenue && <VenuePeekModal venue={peekVenue} onClose={() => setPeekVenue(null)} />}
    </div>
  );
}
```

- [ ] **Step 3: Verify (typecheck only — VenuePeekModal doesn't exist until Task 6)**

This task intentionally references `@/components/home/VenuePeekModal`, which Task 6 creates.
Run: `npx tsc --noEmit` — expect an error here (`Cannot find module`), which is resolved by
completing Task 6 immediately after. Do not attempt to run the dev server / browser-verify
this task in isolation; verify Tasks 5+6 together at the end of Task 6.

- [ ] **Step 4: Commit**

```bash
git add components/home/NearbyBanner.tsx app/globals.css
git commit -m "Rebuild NearbyBanner: in-range check-in / nearby peek split, manual refresh"
```

---

### Task 6: `VenuePeekModal` — preview-only Peek

**Files:**
- Create: `components/home/VenuePeekModal.tsx`

**Interfaces:**
- Consumes: `Venue` (existing type), `fetchBanners` (existing, `lib/data.ts`),
  `HeroCarousel` (existing, `components/HeroCarousel.tsx` — props
  `{ images: string[]; title: string; onBack: () => void; links?: (string | null)[] }`),
  `FeedBlurBackdrop` (Task 4). Full-screen overlay pattern copied from
  `components/organizer/OrganizerWelcomeModal.tsx` (`position: fixed`, backdrop, `zIndex`).
- Produces: `<VenuePeekModal venue={Venue} onClose={() => void} />` — this is the exact
  prop contract `NearbyBanner.tsx` (Task 5) already calls.

- [ ] **Step 1: Create `components/home/VenuePeekModal.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchBanners } from '@/lib/data';
import { theme } from '@/lib/theme';
import type { Venue, Banner } from '@/lib/types';
import HeroCarousel from '@/components/HeroCarousel';
import FeedBlurBackdrop from '@/components/shared/FeedBlurBackdrop';

interface VenuePeekModalProps {
  venue: Venue;
  onClose: () => void;
}

// Round 1 Peek is preview-only: venue info, real photo carousel, and a
// blurred feed teaser. No peek-tracking row, no notification to anyone at
// the venue, no reciprocal matching — that mechanic is Round 2's spec.
export default function VenuePeekModal({ venue, onClose }: VenuePeekModalProps) {
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    fetchBanners(venue.id)
      .then(setBanners)
      .catch((err) => console.error('Failed to load venue banners:', err));
  }, [venue.id]);

  const images = banners.length > 0
    ? banners.map((b) => b.image_url)
    : venue.banner_image
      ? [venue.banner_image]
      : [];

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: theme.bg, borderRadius: '20px', width: '100%', maxWidth: '420px',
          maxHeight: '85vh', overflowY: 'auto', position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: '12px', right: '12px', zIndex: 10,
            width: '32px', height: '32px', borderRadius: '9999px',
            backgroundColor: 'rgba(0,0,0,0.5)', border: 'none', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <X style={{ width: '18px', height: '18px' }} />
        </button>

        {images.length > 0 && (
          <HeroCarousel images={images} title={venue.name} onBack={onClose} />
        )}

        <div style={{ padding: '20px' }}>
          <h2 style={{
            color: theme.text, fontSize: '18px', fontWeight: 700, marginBottom: '8px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}>{venue.name}</h2>
          {venue.description && (
            <p style={{
              color: theme.muted, fontSize: '13px', lineHeight: 1.5, marginBottom: '20px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
            }}>{venue.description}</p>
          )}

          <div style={{
            position: 'relative', height: '160px', borderRadius: '16px', overflow: 'hidden',
            backgroundColor: theme.surface, border: `1px solid ${theme.divider}`,
          }}>
            <FeedBlurBackdrop />
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', textAlign: 'center', padding: '0 24px',
            }}>
              <p style={{
                color: theme.text, fontSize: '13px', fontWeight: 600,
                fontFamily: 'Montserrat, system-ui, sans-serif',
                textShadow: '0 1px 4px rgba(0,0,0,0.6)',
              }}>
                Check in to see what&apos;s happening here
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify Tasks 5+6 together**

Run: `npx tsc --noEmit`
Expected: clean (this resolves Task 5's expected `Cannot find module` error).

Manual check via dev server + Browser pane:
1. On the Home tab with location granted and at least one QA venue seeded within radius and
   one outside (seed via the master-admin panel if QA has none): confirm the header reads
   "Location detected" with a working refresh icon, an "You're here — check in" row for the
   in-range venue, and a "Nearby — peek in" row for the rest.
2. Tap Check In on an in-range card → confirm `CheckedInHero` renders (existing behavior,
   unchanged code path).
3. Tap Peek on a nearby card → confirm the modal opens with venue name/description, real
   carousel images (if any banners exist) or no carousel section (if none), and the blurred
   feed placeholder with its caption. Close via the X button and via backdrop click.
4. With location denied: confirm "Location not detected" + "Enable Location" button +
   "or enter it manually" link; click the link, confirm a venue list appears, click one,
   confirm it flips to the location-detected state.

- [ ] **Step 3: Commit**

```bash
git add components/home/VenuePeekModal.tsx
git commit -m "Add VenuePeekModal: preview-only venue peek (Round 1 scope)"
```

---

### Task 7: Restyle `FriendsActivityFeed`

**Files:**
- Modify: `components/home/FriendsActivityFeed.tsx` (full rewrite)

**Interfaces:**
- Consumes: `FeedBlurBackdrop` (Task 4).
- Produces: same as before — `<FriendsActivityFeed />`, no props, no exports beyond the
  default component. `HomeTab.tsx` needs no change.

- [ ] **Step 1: Replace `components/home/FriendsActivityFeed.tsx`**

```tsx
'use client';

import { theme } from '@/lib/theme';
import { Users, Lock } from 'lucide-react';
import FeedBlurBackdrop from '@/components/shared/FeedBlurBackdrop';

// Round 1 restyle: real copy + a blurred illustrative backdrop instead of a
// flat gradient card. Still locked-state only — the 3-connections gate and
// real fetchFriendsActivity() wiring is Round 2+ (needs the real connections
// schema this repo's paused 2026-08-04 plan flagged as unresolved).
export default function FriendsActivityFeed() {
  return (
    <div style={{
      position: 'relative',
      borderRadius: '16px',
      overflow: 'hidden',
      margin: '0 20px 20px',
      backgroundColor: theme.surface,
      border: `1px solid ${theme.divider}`,
      minHeight: '180px',
    }}>
      <FeedBlurBackdrop />

      <div style={{
        position: 'relative',
        background: `linear-gradient(180deg, transparent 0%, ${theme.bg} 85%)`,
        padding: '24px 20px',
        textAlign: 'center',
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '9999px',
          backgroundColor: theme.premium1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px',
        }}>
          <Lock style={{ width: '22px', height: '22px', color: 'white' }} />
        </div>
        <h3 style={{
          color: theme.text, fontSize: '16px', fontWeight: 700, marginBottom: '6px',
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}>
          Add friends to see where they&apos;ve been
        </h3>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          marginTop: '10px', color: theme.muted, fontSize: '12px',
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}>
          <Users style={{ width: '14px', height: '14px' }} />
          0 / 3 connections
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Manual check: Home tab, no panel open (default state below the quick-access row) — confirm
the card shows the blurred backdrop, the new copy, and the `0/3` counter, and that it's
visually distinct from the flat-gradient version it replaced.

- [ ] **Step 3: Commit**

```bash
git add components/home/FriendsActivityFeed.tsx
git commit -m "Restyle FriendsActivityFeed: real copy + blurred backdrop"
```

---

### Task 8: Real `/profile/edit` page

**Files:**
- Create: `app/profile/edit/page.tsx`

**Interfaces:**
- Consumes: `useStore().user` / `setUser` (existing, `lib/store.ts`), `upsertProfile`
  (existing, `lib/data.ts`, signature `(profile: Partial<Profile> & { id: string }) => Promise<void>`),
  `uploadAvatar` (existing, `lib/data.ts`, signature `(file: File, userId: string) => Promise<string>`).
- Produces: the route `ProfileTab.tsx:29` already links to (`router.push('/profile/edit')`)
  — no change needed in `ProfileTab.tsx`, this task only needs to make the destination exist.

**Important DB-schema note:** `Profile` (the `profiles` table) has no `gender` or
`birth`/date-of-birth column — confirmed by reading `lib/types.ts`'s `Profile` interface and
`app/auth/register/page.tsx`'s own `upsertProfile()` call, which already omits both fields
today even though the registration form collects them. Those two fields only ever live in
the Zustand store's local `User.gender`/`User.birth` (persisted to `localStorage`, not the
database) — this is pre-existing behavior, not something this task should try to fix. So
this edit page's gender/DOB fields update local state via `setUser` only; name, phone, and
avatar update both local state and the database via `upsertProfile`.

- [ ] **Step 1: Create `app/profile/edit/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { upsertProfile, uploadAvatar } from '@/lib/data';
import { ChevronLeft, Camera } from 'lucide-react';
import { theme } from '@/lib/theme';

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: theme.surface,
  border: `1px solid ${theme.divider}`,
  borderRadius: '10px',
  padding: '12px 14px',
  color: theme.text,
  fontSize: '14px',
  fontFamily: 'Montserrat, system-ui, sans-serif',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  color: theme.muted,
  fontSize: '12px',
  fontWeight: 600,
  marginBottom: '6px',
  display: 'block',
  fontFamily: 'Montserrat, system-ui, sans-serif',
};

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, setUser } = useStore();

  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [gender, setGender] = useState(user?.gender ?? '');
  const [birth, setBirth] = useState(user?.birth ?? '');
  const [imagePreview, setImagePreview] = useState(user?.image ?? '');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      let avatarUrl = user.image;
      if (profileImage) {
        avatarUrl = await uploadAvatar(profileImage, user.id);
      }

      await upsertProfile({
        id: user.id,
        display_name: name,
        phone,
        avatar_url: avatarUrl ?? null,
      });

      // gender/birth have no DB column today (see plan note) — local only,
      // same as registration already does.
      setUser({ ...user, name, phone, gender, birth, image: avatarUrl });

      router.back();
    } catch (err: any) {
      setError(err?.message ?? 'Could not save changes');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, paddingBottom: '48px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '20px',
        borderBottom: `1px solid ${theme.divider}`,
      }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: theme.text, display: 'flex', cursor: 'pointer' }}>
          <ChevronLeft style={{ width: '24px', height: '24px' }} />
        </button>
        <h1 style={{ color: theme.text, fontSize: '18px', fontWeight: 700, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          Edit Profile
        </h1>
      </div>

      <div style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <label style={{ position: 'relative', cursor: 'pointer' }}>
            <div style={{
              width: '96px', height: '96px', backgroundColor: theme.surface2, borderRadius: '9999px',
              overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {imagePreview ? (
                <img src={imagePreview} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Camera style={{ width: '28px', height: '28px', color: theme.muted }} />
              )}
            </div>
            <div style={{
              position: 'absolute', bottom: 0, right: 0, width: '28px', height: '28px',
              backgroundColor: theme.accent, borderRadius: '9999px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>+</span>
            </div>
            <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
          </label>
        </div>

        {error && (
          <p style={{ color: theme.accent2, fontSize: '13px', marginBottom: '16px', textAlign: 'center', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {error}
          </p>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Full Name</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Phone Number</label>
          <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Gender</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['Male', 'Female', 'Other'].map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: '10px',
                  border: `1px solid ${gender === g ? theme.accent : theme.divider}`,
                  backgroundColor: gender === g ? theme.accent : theme.surface,
                  color: gender === g ? 'white' : theme.text,
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '28px' }}>
          <label style={labelStyle}>Date of Birth</label>
          <input type="date" style={inputStyle} value={birth} onChange={(e) => setBirth(e.target.value)} />
        </div>

        <button
          onClick={handleSave}
          disabled={isLoading || !name.trim()}
          style={{
            width: '100%', backgroundColor: theme.accent, color: 'white', border: 'none',
            borderRadius: '12px', padding: '14px 0', fontSize: '15px', fontWeight: 700,
            cursor: isLoading || !name.trim() ? 'default' : 'pointer',
            opacity: isLoading || !name.trim() ? 0.6 : 1,
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}
        >
          {isLoading ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

Manual check via dev server + Browser pane: Profile tab → Edit Profile → confirm the form
loads pre-filled with the current session's name/phone/gender/birth/avatar, change the name,
Save, confirm it navigates back and the Profile tab now shows the updated name. Reload the
page and confirm the name persisted (via `upsertProfile` + the store's own localStorage
persistence).

- [ ] **Step 3: Commit**

```bash
git add app/profile/edit/page.tsx
git commit -m "Add real /profile/edit page, fixing the dead ProfileTab link"
```

---

## Final verification (after all 8 tasks)

- [ ] Run `npx tsc --noEmit` once more from a clean tree — must be fully clean.
- [ ] Full click-through per the spec's Testing section: profile edit round-trip, both
  banner states, in-range check-in, nearby peek preview, pull-to-refresh, friends-feed
  teaser visual.
- [ ] Update `docs/RESUME-launch-prep.md` (or note in commit message) that Round 1 is
  complete, matching this repo's existing convention of a status doc reflecting the latest
  shipped work.
