'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { STORAGE_KEYS } from '@/lib/constants';
import { recordQrScan } from '@/lib/data';
import { connectErrorMessage, getScanCoords, isValidConnectToken } from '@/lib/connect';
import { theme, type as typeTokens } from '@/lib/theme';
import { Button } from '@/components/ui/primitives';
import ConnectResult from '@/components/connect/ConnectResult';

// Connect link encoded in every QR code (/c/<token>), so a plain phone camera
// works, not only the in-app scanner. Signed in: connect right away. Signed
// out: stash the token and send them through sign-up / log-in; /main hands it
// back here (usePendingConnect). Tokens last 5 minutes (migration 0040).
export default function ConnectLinkPage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, hasHydrated } = useStore();
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const valid = isValidConnectToken(token);

  useEffect(() => {
    if (!hasHydrated || !valid) return;

    if (!isAuthenticated) {
      try {
        localStorage.setItem(STORAGE_KEYS.PENDING_CONNECT, token);
      } catch {
        /* private mode: they'll need to scan again after signing in */
      }
      return;
    }

    if (started.current) return;
    started.current = true;
    try {
      localStorage.removeItem(STORAGE_KEYS.PENDING_CONNECT);
    } catch { /* ignore */ }

    getScanCoords(3000)
      .then((coords) => recordQrScan(token, coords?.lat, coords?.lng))
      .then(setConnectionId)
      .catch((err) => setError(connectErrorMessage(err)));
  }, [hasHydrated, isAuthenticated, token, valid]);

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100dvh', backgroundColor: theme.bg, color: theme.text, fontFamily: typeTokens.family }}>
      {children}
    </div>
  );

  const centered = (title: string, body: string, actions: React.ReactNode) =>
    shell(
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px' }}>{title}</h1>
          <p style={{ color: theme.muted, fontSize: 15, lineHeight: 1.5, margin: '0 0 24px' }}>{body}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{actions}</div>
        </div>
      </div>,
    );

  if (!hasHydrated) return null;

  if (!valid) {
    return centered(
      "That code didn't work",
      'Ask them to open Connect in their W App and show their code again.',
      <Button fullWidth onClick={() => router.replace('/main')}>Open the W App</Button>,
    );
  }

  if (!isAuthenticated) {
    return centered(
      'Connect on the W App',
      'Sign up or log in and you will be connected right after.',
      <>
        <Button fullWidth onClick={() => router.push('/auth/register')}>Sign up</Button>
        <Button fullWidth variant="secondary" onClick={() => router.push('/auth/login')}>
          I already have an account
        </Button>
      </>,
    );
  }

  if (error) {
    return centered(
      "Couldn't connect",
      error,
      <Button fullWidth onClick={() => router.replace('/main')}>Back to the W App</Button>,
    );
  }

  if (!connectionId) {
    return centered('Connecting…', 'One moment.', null);
  }

  return shell(
    <>
      <div style={{ padding: '16px 20px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <h1 style={{ fontSize: 16, fontWeight: 700 }}>Connected</h1>
      </div>
      <ConnectResult connectionId={connectionId} />
      <div style={{ padding: '0 20px 32px', maxWidth: 480, margin: '0 auto' }}>
        <Button fullWidth variant="secondary" onClick={() => router.replace('/main')}>Done</Button>
      </div>
    </>,
  );
}
