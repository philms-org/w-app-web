import { useStore } from '@/lib/store';

// Same fallback center app/main/page.tsx's modal has always used when
// geolocation is denied/unsupported — kept identical so behavior doesn't change.
const FALLBACK_LOCATION = { lat: 40.7128, lng: -74.0060 };

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
      setCurrentLocation(FALLBACK_LOCATION);
      setLocationDenied(true);
      setLocationPermissionBlocked(false);
      resolve();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationDenied(false);
        setLocationPermissionBlocked(false);
        resolve();
      },
      (error) => {
        console.error('Location error:', error);
        setCurrentLocation(FALLBACK_LOCATION);
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
