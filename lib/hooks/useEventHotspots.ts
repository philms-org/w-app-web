'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchRewards, fetchVenue } from '@/lib/data';
import { fetchEventHotspots, fetchMyCheckinsAt, fetchTrailPauses } from '@/lib/hotspots';
import { computeHotspotProgress, isTrailPaused, type HotspotProgress } from '@/lib/hotspotProgress';
import type { EventHotspot, Venue } from '@/lib/types';

// One event's hotspots + the signed-in user's progress. `progress` stays null
// for events without hotspots so callers render exactly what they did before.
// `paused` (trail off switch, 0038): attendee surfaces hide the trail, but
// progress still reflects stamps earned before the pause (rewards stay).
export function useEventHotspots(eventId: string | null | undefined) {
  const [hotspots, setHotspots] = useState<EventHotspot[]>([]);
  const [event, setEvent] = useState<Venue | null>(null);
  const [progress, setProgress] = useState<HotspotProgress | null>(null);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(!!eventId);
  const [error, setError] = useState(false);
  const [nonce, setNonce] = useState(0);
  const lastIdRef = useRef<string | null | undefined>(eventId);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (eventId !== lastIdRef.current) {
      setHotspots([]);
      setEvent(null);
      setProgress(null);
      setPaused(false);
      lastIdRef.current = eventId;
    }

    if (!eventId) {
      setLoading(false);
      setError(false);
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
        if (list.length === 0) {
          setEvent(null);
          setProgress(null);
          setPaused(false);
          return;
        }
        const [ev, rewards, checkins, pauses] = await Promise.all([
          fetchVenue(eventId),
          fetchRewards(eventId),
          fetchMyCheckinsAt(list.map((h) => h.location_id)),
          fetchTrailPauses([eventId]),
        ]);
        if (cancelled) return;
        setEvent(ev);
        setPaused(isTrailPaused(pauses));
        setProgress(computeHotspotProgress({ hotspots: list, checkins, window: ev, rewards, pauses }));
      } catch (e) {
        console.error('Failed to load hotspots:', e);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, nonce]);

  return { hotspots, progress, event, paused, loading, error, reload };
}
