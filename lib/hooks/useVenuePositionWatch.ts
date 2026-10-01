'use client';

import { useEffect, useRef } from 'react';

export type PositionFix = { lat: number; lng: number; accuracy: number };

// Fixes worse than this are too vague to decide in/out of a venue on.
const MAX_ACCURACY_METERS = 100;

// Watches the device's position while a venue is open (venueId set) and hands
// each usable fix to onFix. Only real GPS fixes come through here — never the
// store's fallback location — so callers can safely act on them (e.g. check
// someone out when they walk out of the room). Silently does nothing without
// geolocation or permission.
export function useVenuePositionWatch(venueId: string | null, onFix: (fix: PositionFix) => void) {
  const onFixRef = useRef(onFix);
  onFixRef.current = onFix;

  useEffect(() => {
    if (!venueId || typeof navigator === 'undefined' || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (pos.coords.accuracy > MAX_ACCURACY_METERS) return;
        onFixRef.current({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      },
      () => { /* denied / unavailable: keep whatever check-in state we have */ },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [venueId]);
}
