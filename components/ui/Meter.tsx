'use client';

import { theme, type as typeTokens, radius } from '@/lib/theme';

export default function Meter({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div style={{ fontFamily: typeTokens.family }}>
      {label && (
        <div style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, marginBottom: 6 }}>{label}</div>
      )}
      <div style={{ height: 8, borderRadius: radius.pill, backgroundColor: theme.surface2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: theme.accent, transition: 'width .25s ease' }} />
      </div>
    </div>
  );
}
