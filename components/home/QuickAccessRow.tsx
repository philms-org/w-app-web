'use client';

import type { ReactNode } from 'react';
import { theme } from '@/lib/theme';

export interface QuickAccessItem {
  id: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

interface QuickAccessRowProps {
  items: QuickAccessItem[];
  activeId?: string | null;
}

// Generalized from MainFeedTab's 3-icon quick-access row. Home passes
// History / Rewards / Connect — Profile moved to AppHeader. Styled as the
// large rounded-square tiles from the founder's Home mock (2026-09-30).
export default function QuickAccessRow({ items, activeId = null }: QuickAccessRowProps) {
  return (
    <div style={{ display: 'flex', gap: '10px', padding: '28px 16px 16px' }}>
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            onClick={item.onClick}
            aria-pressed={isActive}
            style={{
              flex: 1,
              minWidth: 0,
              height: '88px',
              borderRadius: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: 'pointer',
              backgroundColor: isActive ? theme.accent : theme.surface2,
              border: `1.5px solid ${isActive ? theme.accent : theme.glassHighlight}`,
              boxShadow: `inset 0 1px 0 ${theme.glassHighlight}`,
              transition: 'background-color 0.2s ease, border-color 0.2s ease'
            }}
          >
            {item.icon}
            <span style={{
              color: isActive ? theme.onAccent : theme.muted,
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
