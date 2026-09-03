'use client';

import { theme } from '@/lib/theme';

export default function ConnectResult({ connectionId }: { connectionId: string }) {
  return (
    <div style={{ color: theme.text, padding: '20px', textAlign: 'center', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <p style={{ fontWeight: 700 }}>Connected</p>
      <p style={{ color: theme.muted, fontSize: '12px' }}>{connectionId}</p>
    </div>
  );
}
