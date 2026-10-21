'use client';

import { theme, type as typeTokens, radius } from '@/lib/theme';

// fill: optional CSS background for the bar (e.g. a gradient); defaults to the accent.
export default function Meter({ value, label, fill }: { value: number; label?: string; fill?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div style={{ fontFamily: typeTokens.family }}>
      {label && (
        <div style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, marginBottom: 6 }}>{label}</div>
      )}
      <div style={{ height: 8, borderRadius: radius.pill, backgroundColor: theme.surface2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: fill ?? theme.accent, transition: 'width .25s ease' }} />
      </div>
    </div>
  );
}
