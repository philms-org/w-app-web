'use client';

import { MapPin, Users, Ticket, Award } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Badge } from '@/lib/types';
import { theme, type as typeTokens, radius } from '@/lib/theme';

const ICONS: Record<string, LucideIcon> = {
  'map-pin': MapPin,
  users: Users,
  ticket: Ticket,
  award: Award,
};

export default function BadgeTile({ badge, earned }: { badge: Badge; earned: boolean }) {
  const Icon = ICONS[badge.icon] ?? Award;
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8, padding: 14,
      borderRadius: radius.card, border: `1px solid ${theme.divider}`,
      backgroundColor: theme.surface, fontFamily: typeTokens.family,
      opacity: earned ? 1 : 0.72,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: radius.pill,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: earned ? theme.accent : theme.surface2,
      }}>
        <Icon style={{ width: 20, height: 20, color: earned ? theme.onAccent : theme.muted }} />
      </div>
      <span style={{ fontSize: typeTokens.label.fontSize, fontWeight: 700, color: earned ? theme.text : theme.muted }}>
        {badge.name}
      </span>
      <span style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, lineHeight: 1.4 }}>
        {badge.description}
      </span>
    </div>
  );
}
