'use client';

import { Check, Flame } from 'lucide-react';
import { HOTSPOT_ORANGE } from '@/components/hotspots/HotspotsCard';

// Small solid marker matching the map's flame pins: orange flame for a
// hotspot you haven't visited, green check once it's stamped.
export default function HotspotBadge({ stamped, size = 20 }: { stamped: boolean; size?: number }) {
  return (
    <span aria-hidden style={{
      width: size, height: size, borderRadius: 999, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: stamped ? '#3ECF6B' : HOTSPOT_ORANGE,
      color: stamped ? '#0b1a0f' : '#1a0a02',
      textShadow: 'none',
    }}>
      {stamped ? <Check size={size * 0.6} strokeWidth={3} /> : <Flame size={size * 0.6} />}
    </span>
  );
}
