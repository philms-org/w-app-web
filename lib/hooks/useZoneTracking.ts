import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const MIN_INTERVAL_MS = 10_000;
const MIN_DISTANCE_METERS = 5;

// Haversine distance in meters — good enough at the scale this needs (tens
// of meters), no external geo library required.
function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// While locationId is non-null, watches position and reports throttled
// fixes to record_zone_position(). Silently does nothing if geolocation is
// denied/unavailable — this is an analytics nice-to-have, never something
// that should block or interrupt the check-in flow itself.
export function useZoneTracking(locationId: string | null): void {
  const lastSentRef = useRef<{ lat: number; lng: number; at: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!locationId || typeof navigator === 'undefined' || !navigator.geolocation) {
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const now = Date.now();
        const last = lastSentRef.current;
        const elapsed = last ? now - last.at : Infinity;
        const moved = last ? distanceMeters(last.lat, last.lng, latitude, longitude) : Infinity;

        if (elapsed < MIN_INTERVAL_MS && moved < MIN_DISTANCE_METERS) return;

        lastSentRef.current = { lat: latitude, lng: longitude, at: now };
        supabase
          .rpc('record_zone_position', {
            p_location_id: locationId,
            p_lat: latitude,
            p_lng: longitude,
          })
          .then(({ error }) => {
            if (error) console.error('record_zone_position failed:', error);
          });
      },
      (err) => {
        // Permission denied / position unavailable / timeout — no UI
        // interruption, just stop trying for this session.
        console.warn('Zone tracking geolocation error:', err.message);
      },
      { enableHighAccuracy: false, maximumAge: 5000 }
    );
    watchIdRef.current = id;

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      lastSentRef.current = null;
    };
  }, [locationId]);
}
