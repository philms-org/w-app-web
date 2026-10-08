'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';

// Keeps the store's currentLocation following the device while the app is
// open. requestLocation() only takes one fix at launch, so someone who opened
// the app before walking into a venue stayed "not here" until they pulled to
// refresh. Only enable it once permission is granted (or just requested), so
// it never triggers a permission prompt of its own. Every fix it gets also
// clears a "location's off" left behind by a timed-out one-shot request.
export function useLiveLocation(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) return;
    let gotFix = false;
    let id: number;
    const watch = (enableHighAccuracy: boolean) => navigator.geolocation.watchPosition(
      (pos) => {
        gotFix = true;
        const store = useStore.getState();
        store.setCurrentLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        store.setLocationDenied(false);
        store.setLocationPermissionBlocked(false);
      },
      (err) => {
        // Blocked in Settings: hand over to useLocationRecovery.
        if (err.code === err.PERMISSION_DENIED) {
          const store = useStore.getState();
          store.setCurrentLocation(null);
          store.setLocationDenied(true);
          store.setLocationPermissionBlocked(true);
          return;
        }
        // GPS-only never got a fix (no precise location, or stuck indoors):
        // fall back to Wi-Fi/cell positioning rather than staying "off".
        // Anything later is transient — keep the last good fix and watch.
        if (enableHighAccuracy && !gotFix) {
          navigator.geolocation.clearWatch(id);
          id = watch(false);
        }
      },
      { enableHighAccuracy, maximumAge: 15000, timeout: 30000 },
    );
    id = watch(true);
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);
}
