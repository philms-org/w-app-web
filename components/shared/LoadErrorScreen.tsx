'use client';

import Link from 'next/link';
import { theme } from '@/lib/theme';

// Full-screen "couldn't load" state with a retry. Organizer pages used to
// fall through to "You're not authorized…" when a request failed, which
// told owners they'd lost access to their own venue.
export default function LoadErrorScreen({ what = 'this page' }: { what?: string }) {
  return (
    <div style={{
      minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px',
      fontFamily: 'Montserrat, system-ui, sans-serif',
    }}>
      <p style={{ color: theme.text, fontSize: '16px', textAlign: 'center', lineHeight: 1.5 }}>
        Couldn&apos;t load {what}. Check your connection and try again.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '10px 20px', borderRadius: '9999px', border: 'none', cursor: 'pointer',
          backgroundColor: theme.accent, color: theme.onAccent, fontWeight: 600, fontSize: '14px',
          fontFamily: 'inherit',
        }}
      >
        Try again
      </button>
      <Link href="/main" style={{ color: theme.accent, fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}>
        Back to app
      </Link>
    </div>
  );
}
