'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';

// Keeps the store's currentLocation following the device while the app is
// open. requestLocation() only takes one fix at launch, so someone who opened
// the app before walking into a venue stayed "not here" until they pulled to
// refresh. Only runs once we already have a real fix (permission granted), so
// it never triggers a permission prompt of its own.
export function useLiveLocation(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        useStore.getState().setCurrentLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => { /* transient errors: keep the last good fix */ },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);
}
