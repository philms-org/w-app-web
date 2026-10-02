import { useStore } from '@/lib/store';

// "Enable it in your browser settings" tells a blocked user THAT something
// needs fixing but not HOW — the actual steps differ enough by platform
// (no universal "reset this site's permission" API exists) that a vague
// pointer just strands people. This gives the concrete path for their
// platform instead.
export function locationSettingsInstructions(): string {
  if (typeof navigator === 'undefined') return 'Enable location for this site in your browser settings, then refresh.';
  const ua = navigator.userAgent;
  // iPadOS reports a Mac UA; touch support tells it apart from a real Mac.
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (isIOS) {
    // Other iOS browsers each get their own row under Location Services.
    const otherBrowser = /CriOS/.test(ua) ? 'Chrome' : /FxiOS/.test(ua) ? 'Firefox' : /EdgiOS/.test(ua) ? 'Edge' : null;
    if (otherBrowser) {
      return `Open Settings → Privacy & Security → Location Services → ${otherBrowser}, choose "While Using the App", then come back and refresh this page.`;
    }
    // In-app browsers (Instagram, LinkedIn, Slack, …) are WKWebViews that
    // inherit the host app's location permission, which usually isn't
    // granted — no settings change in Safari fixes that.
    if (!/Safari\//.test(ua) || /FBAN|FBAV|Instagram|LinkedInApp|Line\//.test(ua)) {
      return 'This in-app browser can\'t share your location. Open this page in Safari (tap ••• or the share icon → Open in Safari).';
    }
    // The most common block is the system-wide switch, not Safari's
    // per-site setting: Location Services → Safari Websites = "Never"
    // denies every site instantly without ever showing a prompt.
    return 'Open Settings → Privacy & Security → Location Services → Safari Websites and choose "While Using the App". Also check Settings → Apps → Safari → Location is "Ask" or "Allow". Then come back and refresh this page.';
  }
  if (/Android/.test(ua)) {
    return 'Tap the lock icon next to the address bar → Permissions → Location → Allow, then refresh this page.';
  }
  return 'Click the lock icon in your address bar → Site settings → Location → Allow, then refresh this page.';
}

// On failure we never invent a position (this used to write NYC, which put
// every skipped/blocked user in New York). Denied/unsupported clears it; a
// timeout or GPS hiccup keeps the last real fix so a check-in isn't dropped.
// Fetches a fresh position and writes it to the store. Used by the first-run
// permission modal AND by every manual-refresh entry point (header button,
// pull-to-refresh, "Enable Location" retry) — there is exactly one place
// that calls navigator.geolocation now.
//
// `maximumAge` defaults to 0 (no stale cached fix) for manual refreshes;
// callers that just want a reasonably fresh position on mount (e.g. MapTab)
// can pass a larger value.
export function requestLocation(maximumAge = 0): Promise<void> {
  const { setCurrentLocation, setLocationDenied, setLocationPermissionBlocked } = useStore.getState();

  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      setCurrentLocation(null);
      setLocationDenied(true);
      setLocationPermissionBlocked(false);
      resolve();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLocationDenied(false);
        setLocationPermissionBlocked(false);
        resolve();
      },
      (error) => {
        console.error('Location error:', error);
        if (error.code === error.PERMISSION_DENIED) setCurrentLocation(null);
        setLocationDenied(true);
        // code 1 = PERMISSION_DENIED: the browser has this site blocked and
        // will keep failing instantly on every retry until the user changes
        // it in their browser's site settings — no in-app retry can fix it.
        setLocationPermissionBlocked(error.code === error.PERMISSION_DENIED);
        resolve();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge,
      }
    );
  });
}

// A fresh, high-accuracy fix for server-verified actions (e.g. posting to a
// venue feed, where create_venue_post re-checks the distance). Doesn't touch
// the store. Rejects if location is unavailable or denied.
export function getFreshPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}
