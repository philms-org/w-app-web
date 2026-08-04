'use client';

import { useStore } from '@/lib/store';
import { theme } from '@/lib/theme';
import { QrCode } from 'lucide-react';

// package.json has no QR-code library, so Phase 1 renders a static
// placeholder visual instead of adding a new dependency. Scanning someone
// else's code / requesting a connection is Phase 3 (requestConnection API
// doesn't exist yet) — the button below is a clearly-stubbed no-op.
export default function ConnectSheet() {
  const { user } = useStore();

  const handleShare = () => {
    // Phase 3: wire this up to a real requestConnection() call once another
    // user scans this code. For now it's a display-only stub.
    console.log('Connect stub — would share profile code for', user?.id);
  };

  return (
    <div style={{
      backgroundColor: theme.surface,
      borderRadius: '16px',
      border: `1px solid ${theme.divider}`,
      padding: '24px 20px',
      margin: '0 20px 20px',
      textAlign: 'center'
    }}>
      <h3 style={{ color: theme.text, fontSize: '16px', fontWeight: 700, marginBottom: '4px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        Connect
      </h3>
      <p style={{ color: theme.muted, fontSize: '13px', marginBottom: '20px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        Let someone scan your code to connect
      </p>

      <div style={{
        width: '180px',
        height: '180px',
        margin: '0 auto 16px',
        borderRadius: '16px',
        border: `2px solid ${theme.accent}`,
        backgroundColor: theme.surface2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px'
      }}>
        <QrCode style={{ width: '72px', height: '72px', color: theme.accent }} />
        <span style={{
          color: theme.muted,
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
        }}>
          SCAN TO CONNECT
        </span>
      </div>

      <p style={{ color: theme.text, fontSize: '14px', fontWeight: 600, marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        {user?.name ?? 'Your profile'}
      </p>

      <button
        onClick={handleShare}
        style={{
          backgroundColor: theme.accent,
          color: 'white',
          border: 'none',
          borderRadius: '9999px',
          padding: '10px 24px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}
      >
        Share my code
      </button>
    </div>
  );
}
