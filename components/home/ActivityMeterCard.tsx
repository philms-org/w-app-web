'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchActivityMenu, fetchMyActivityPicks, setMyActivityPicks } from '@/lib/data';
import type { ActivityMenuItem } from '@/lib/types';
import { ACTIVITY_TARGET, meterFill } from '@/lib/activity';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Chip } from '@/components/ui/primitives';
import Meter from '@/components/ui/Meter';

export default function ActivityMeterCard({ locationId }: { locationId: string }) {
  const [items, setItems] = useState<ActivityMenuItem[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    Promise.all([fetchActivityMenu(locationId), fetchMyActivityPicks(locationId)])
      .then(([menu, mine]) => {
        setItems(menu);
        setPicked(new Set(mine));
      })
      .catch((e) => console.error('Failed to load activity menu:', e))
      .finally(() => setLoaded(true));
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  if (!loaded || items.length === 0) return null;

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setMyActivityPicks(locationId, [...next]).catch((e) => console.error('Failed to save picks:', e));
      return next;
    });
  };

  return (
    <div style={{
      backgroundColor: theme.surface,
      borderRadius: radius.card,
      border: `1px solid ${theme.divider}`,
      padding: 16,
      marginBottom: 20,
      fontFamily: typeTokens.family,
    }}>
      <p style={{ color: theme.text, fontSize: typeTokens.heading.fontSize, fontWeight: 700, marginBottom: 4 }}>
        What are you here for?
      </p>
      <p style={{ color: theme.muted, fontSize: typeTokens.caption.fontSize, marginBottom: 12 }}>
        Pick a few — other guests see what you tapped.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {items.map((it) => (
          <Chip key={it.id} selected={picked.has(it.id)} onClick={() => toggle(it.id)}>
            {it.label}
          </Chip>
        ))}
      </div>

      <Meter value={meterFill(picked.size, ACTIVITY_TARGET)} label={`${picked.size} / ${ACTIVITY_TARGET} picked`} />
    </div>
  );
}
