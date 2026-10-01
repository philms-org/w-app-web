'use client';

import { useEffect, useState } from 'react';
import { fetchActiveHotspots, fetchMyCheckinsAt } from '@/lib/hotspots';
import { visitedHotspotIds, localDay } from '@/lib/hotspotProgress';
import type { Venue } from '@/lib/types';

export interface ActiveHotspotPlace {
  place: Venue;
  stamped: boolean;
  eventName: string;
  note: string | null;
}

// Places that are hotspots of an event running today, plus every hotspot of
// `includeEventId` (the event you're at). Keyed by place id, so a place that
// is a hotspot of two running events appears once (stamped if either counts).
// Shared by the Map tab's flame pins and Home's venue pills.
export function useActiveHotspotPlaces(includeEventId: string | null | undefined) {
  const [places, setPlaces] = useState<Map<string, ActiveHotspotPlace>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const today = localDay(new Date().toISOString());
    fetchActiveHotspots(today, includeEventId ?? null)
      .then(async (rows) => {
        const checkins = await fetchMyCheckinsAt([...new Set(rows.map((r) => r.location_id))]);
        const byEvent = new Map<string, typeof rows>();
        for (const r of rows) byEvent.set(r.event_id, [...(byEvent.get(r.event_id) ?? []), r]);
        const next = new Map<string, ActiveHotspotPlace>();
        for (const r of rows) {
          if (!r.place) continue;
          const stamped = visitedHotspotIds(byEvent.get(r.event_id)!, checkins, r.event).has(r.location_id);
          const prev = next.get(r.location_id);
          if (prev) {
            prev.stamped = prev.stamped || stamped;
          } else {
            next.set(r.location_id, { place: r.place, stamped, eventName: r.event.name, note: r.note });
          }
        }
        if (!cancelled) setPlaces(next);
      })
      .catch((err) => console.error('Failed to load hotspots:', err));
    return () => { cancelled = true; };
  }, [includeEventId]);

  return places;
}
