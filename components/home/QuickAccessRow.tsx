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
// History / Rewards / Connect — Profile moved to AppHeader.
export default function QuickAccessRow({ items, activeId = null }: QuickAccessRowProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '32px', padding: '20px 24px' }}>
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <button
            key={item.id}
            onClick={item.onClick}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              background: 'none',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: isActive ? theme.accent : theme.surface2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: isActive ? `2px solid ${theme.accent}` : `1px solid ${theme.divider}`,
              transition: 'background-color 0.2s ease, border-color 0.2s ease'
            }}>
              {item.icon}
            </div>
            <span style={{
              color: isActive ? theme.accent : theme.muted,
              fontSize: '12px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
