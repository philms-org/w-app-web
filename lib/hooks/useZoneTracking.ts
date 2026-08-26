import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// Pure time-based throttle — the previous OR-based distance override let
// GPS jitter (routinely >5m indoors) bypass the 10s floor on nearly every
// callback, so distance is no longer considered at all.
const MIN_INTERVAL_MS = 10_000;

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

    let cancelled = false;

    // Don't start watching at all for a venue with no zones defined —
    // there's nothing for record_zone_position to match against, so the
    // watch would just burn battery/permissions for no product benefit.
    supabase
      .from('venue_zones')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .then(({ count }) => {
        if (cancelled || !count) return;

        const id = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const now = Date.now();
            const last = lastSentRef.current;
            const elapsed = last ? now - last.at : Infinity;

            // Hard time floor first — GPS jitter (routinely >5m indoors)
            // must never bypass the 10s throttle regardless of distance.
            if (elapsed < MIN_INTERVAL_MS) return;

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
      });

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      lastSentRef.current = null;
    };
  }, [locationId]);
}
