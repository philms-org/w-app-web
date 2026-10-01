'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchRewards, fetchVenue } from '@/lib/data';
import { fetchEventHotspots, fetchMyCheckinsAt } from '@/lib/hotspots';
import { computeHotspotProgress, type HotspotProgress } from '@/lib/hotspotProgress';
import type { EventHotspot, Venue } from '@/lib/types';

// One event's hotspots + the signed-in user's progress. `progress` stays null
// for events without hotspots so callers render exactly what they did before.
export function useEventHotspots(eventId: string | null | undefined) {
  const [hotspots, setHotspots] = useState<EventHotspot[]>([]);
  const [event, setEvent] = useState<Venue | null>(null);
  const [progress, setProgress] = useState<HotspotProgress | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!eventId) {
      setHotspots([]); setEvent(null); setProgress(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const list = await fetchEventHotspots(eventId);
        if (cancelled) return;
        setHotspots(list);
        if (list.length === 0) { setProgress(null); return; }
        const [ev, rewards, checkins] = await Promise.all([
          fetchVenue(eventId),
          fetchRewards(eventId),
          fetchMyCheckinsAt(list.map((h) => h.location_id)),
        ]);
        if (cancelled) return;
        setEvent(ev);
        setProgress(computeHotspotProgress({ hotspots: list, checkins, window: ev, rewards }));
      } catch (e) {
        console.error('Failed to load hotspots:', e);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, nonce]);

  return { hotspots, progress, event, loading, error, reload };
}
