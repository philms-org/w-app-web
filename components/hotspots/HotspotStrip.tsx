'use client';

import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { fetchHotspotParents } from '@/lib/hotspots';
import { useEventHotspots } from '@/lib/hooks/useEventHotspots';
import { hotspotMeterFill, localDay, pickHotspotParent } from '@/lib/hotspotProgress';
import { theme, type as typeTokens } from '@/lib/theme';
import type { Venue } from '@/lib/types';
import { Stamp } from '@/components/hotspots/HotspotsCard';

// Screen 4: shown on a venue that is a hotspot of some event.
export default function HotspotStrip({
  locationId, checkedIn, onOpenEvent,
}: { locationId: string; checkedIn: boolean; onOpenEvent: (event: Venue) => void }) {
  const [parent, setParent] = useState<Venue | null>(null);

  useEffect(() => {
    let cancelled = false;
    setParent(null); // don't show the previous venue's parent while loading
    fetchHotspotParents(locationId)
      .then((events) => {
        if (!cancelled) setParent(pickHotspotParent(events, localDay(new Date().toISOString())));
      })
      .catch((e) => {
        if (!cancelled) setParent(null);
        console.error('Failed to load hotspot parents:', e);
      });
    return () => { cancelled = true; };
  }, [locationId]);

  const { progress, reload } = useEventHotspots(parent?.id);
  useEffect(() => { if (checkedIn) reload(); }, [checkedIn, reload]);

  if (!parent || !progress) return null;
  const stamped = progress.visited.has(locationId);

  return (
    <button
      onClick={() => onOpenEvent(parent)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 56, textAlign: 'left',
        margin: '0 0 16px', padding: '10px 12px', borderRadius: 14, cursor: 'pointer',
        background: 'linear-gradient(90deg, rgba(255,122,69,0.2), rgba(255,61,127,0.15))',
        border: '1px solid rgba(255,122,69,0.5)', color: theme.text, fontFamily: typeTokens.family,
      }}
    >
      <Stamp on={stamped} size={34} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 14 }}>{stamped ? 'Stamp collected!' : 'Check in to collect a stamp'}</b>
        <span style={{ fontSize: 12 }}>Hotspot for {parent.name} · {progress.count} / {progress.target}</span>
        <span aria-hidden style={{ display: 'block', height: 6, borderRadius: 99, background: theme.surface2, marginTop: 6, overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${hotspotMeterFill(progress) * 100}%`, background: 'linear-gradient(90deg,#FF7A45,#FF3D7F)' }} />
        </span>
      </span>
      <ChevronRight size={18} aria-hidden />
    </button>
  );
}
