'use client';

import { useStore } from '@/lib/store';
import { theme } from '@/lib/theme';
import { UserCircle } from 'lucide-react';

// Sticky header shown above the Home tab: W wordmark on the left, profile
// icon on the right (Profile now lives behind this icon instead of a tab).
export default function AppHeader() {
  const { setActiveTab } = useStore();

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 40,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16px 20px',
      paddingTop: 'max(16px, env(safe-area-inset-top))',
      backgroundColor: theme.bg,
      borderBottom: `1px solid ${theme.divider}`
    }}>
      <span style={{
        fontSize: '22px',
        fontWeight: 'bold',
        color: theme.accent,
        fontFamily: 'Montserrat, system-ui, sans-serif',
        textShadow: `0 0 16px ${theme.accent}66`
      }}>
        W
      </span>

      <button
        onClick={() => setActiveTab('profile')}
        aria-label="Profile"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px'
        }}
      >
        <UserCircle style={{ width: '28px', height: '28px', color: theme.text }} />
      </button>
    </div>
  );
}
