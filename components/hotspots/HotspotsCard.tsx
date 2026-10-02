'use client';

import { Check, Flame, RotateCw } from 'lucide-react';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import type { EventHotspot } from '@/lib/types';
import type { HotspotProgress } from '@/lib/hotspotProgress';
import Meter from '@/components/ui/Meter';

export const HOTSPOT_ORANGE = '#FF7A45';
export const HOTSPOT_GRADIENT = 'linear-gradient(90deg, #FF7A45, #FF3D7F)';

export function Stamp({ on, size = 28 }: { on: boolean; size?: number }) {
  return (
    <span aria-hidden style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: on ? HOTSPOT_ORANGE : 'transparent',
      border: on ? 'none' : '1.5px dashed rgba(255,255,255,0.3)',
      color: on ? '#1a0a02' : 'rgba(255,255,255,0.35)',
    }}>
      {on ? <Check size={size * 0.55} strokeWidth={3} /> : <Flame size={size * 0.5} />}
    </span>
  );
}

// Screen 3: the event's hotspots in organizer order, stamped when visited.
export default function HotspotsCard({
  hotspots, progress, error, onRetry, meter,
}: {
  hotspots: EventHotspot[];
  progress: HotspotProgress | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  // Progress toward the next reward, shown as the card's header.
  meter?: { value: number; label: string; rewardText: string | null };
}) {
  // Keep showing the list while a reload is in flight (no flicker).
  if (!error && hotspots.length === 0) return null;

  return (
    <section aria-label="Hotspots" style={{
      backgroundColor: theme.surface, borderRadius: radius.card, border: `1px solid ${theme.divider}`,
      padding: 16, marginBottom: 20, fontFamily: typeTokens.family,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <p style={{ color: theme.muted, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Hotspots
        </p>
        {meter?.rewardText && (
          <span style={{ color: theme.muted, fontSize: typeTokens.caption.fontSize }}>{meter.rewardText}</span>
        )}
      </div>
      {meter && !error && (
        <div style={{ marginBottom: 8 }}>
          <span style={{ color: theme.text, fontWeight: 700, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
            <Flame size={14} color={HOTSPOT_ORANGE} aria-hidden /> {meter.label}
          </span>
          <Meter value={meter.value} fill={HOTSPOT_GRADIENT} />
        </div>
      )}
      {error ? (
        <button onClick={onRetry} style={{
          display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, background: 'none', border: 'none',
          color: theme.text, fontSize: 14, cursor: 'pointer', fontFamily: typeTokens.family, padding: 0,
        }}>
          <RotateCw size={16} aria-hidden /> Couldn&apos;t load hotspots. Try again
        </button>
      ) : (
        hotspots.map((h, i) => {
          const on = !!progress?.visited.has(h.location_id);
          return (
            <div key={h.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
              borderBottom: i < hotspots.length - 1 ? `1px solid ${theme.divider}` : 'none',
            }}>
              <Stamp on={on} />
              <div style={{ minWidth: 0 }}>
                <div style={{ color: theme.text, fontWeight: 700, fontSize: 14 }}>{h.place?.name ?? 'Hotspot'}</div>
                {h.note && <div style={{ color: theme.muted, fontSize: 12 }}>{h.note}</div>}
              </div>
              <span className="sr-only">{on ? 'Visited' : 'Not visited yet'}</span>
            </div>
          );
        })
      )}
    </section>
  );
}
