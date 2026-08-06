'use client';

import { theme } from '@/lib/theme';
import type { Venue } from '@/lib/types';

// A row of pill buttons to switch between venues an organizer manages.
// Renders nothing when there's only one (or zero) venues to choose from.
export default function VenueSwitcher({
  venues,
  selectedId,
  onSelect,
}: {
  venues: Venue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (venues.length <= 1) return null;

  return (
    <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '12px 20px 0' }}>
      {venues.map((v) => {
        const active = v.id === selectedId;
        return (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            style={{
              flexShrink: 0,
              backgroundColor: active ? theme.accent : theme.surface2,
              color: active ? 'white' : theme.text,
              border: 'none',
              borderRadius: '9999px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'Montserrat, system-ui, sans-serif',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {v.name}
          </button>
        );
      })}
    </div>
  );
}
