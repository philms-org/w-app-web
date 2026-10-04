'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useStore } from '@/lib/store';
import { theme } from '@/lib/theme';
import { mintConnectToken, fetchMyConnectionCount } from '@/lib/data';
import { encodeConnectPayload, connectErrorMessage } from '@/lib/connect';
import { Camera } from 'lucide-react';

// Token TTL is 90s (migration 0019) and SINGLE-USE: the first successful scan
// deletes it, so a code left on screen fails for everyone after the first
// scanner ("That code has expired"). With no realtime on connections, poll the
// cheap connection count while the sheet is visible and re-mint the moment it
// goes up; also re-mint on a short timer.
const REMINT_MS = 20_000;
const POLL_MS = 3_000;

export default function ConnectSheet() {
  const { user } = useStore();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  // Shown instead of an endless "LOADING" when minting fails (dropped
  // network, a session that lapsed while the phone slept, not signed in).
  const [loadError, setLoadError] = useState<string | null>(null);
  const [justConnected, setJustConnected] = useState(false);
  const cancelledRef = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    cancelledRef.current = false;

    const mint = async () => {
      const token = await mintConnectToken();
      // Rendered dark-on-white and placed on a white plate below: the app's
      // dark theme would otherwise invert the code and many scanners fail.
      return QRCode.toDataURL(encodeConnectPayload(token), {
        width: 360,
        margin: 1,
        color: { dark: '#0d0d0f', light: '#ffffff' },
      });
    };

    // Each mint deletes the previous token, so two overlapping refreshes
    // (wake-up + interval firing together) could leave the older, already
    // dead code on screen. Only one at a time.
    let inFlight = false;
    const refresh = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        await doRefresh();
      } finally {
        inFlight = false;
      }
    };

    const doRefresh = async () => {
      let url: string;
      try {
        url = await mint();
      } catch {
        // One quick retry covers the common case: the auth token was being
        // refreshed right as the phone woke up.
        await new Promise((r) => setTimeout(r, 1500));
        if (cancelledRef.current) return;
        try {
          url = await mint();
        } catch (err) {
          if (cancelledRef.current) return;
          setQrDataUrl(null);
          setLoadError(
            connectErrorMessage(err) === 'You need to be signed in.'
              ? 'Sign in to get your connect code.'
              : "Couldn't load your code. Check your connection and try again.",
          );
          return;
        }
      }
      if (cancelledRef.current) return;
      setLoadError(null);
      setQrDataUrl(url);
    };
    refreshRef.current = refresh;

    let lastCount: number | null = null;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const n = await fetchMyConnectionCount();
        if (cancelledRef.current) return;
        if (lastCount !== null && n > lastCount) {
          setJustConnected(true);
          setTimeout(() => { if (!cancelledRef.current) setJustConnected(false); }, 3000);
          void refresh();
        }
        lastCount = n;
      } catch {
        // Best-effort; the timer re-mint still covers us.
      }
    };

    void refresh();
    void poll();
    const id = setInterval(() => { if (!document.hidden) void refresh(); }, REMINT_MS);
    const pollId = setInterval(() => void poll(), POLL_MS);
    // Timers are frozen while the phone is locked, so after unlocking the
    // code on screen could be past its 90s TTL. Re-mint as soon as we're back.
    const onVisibility = () => {
      if (!document.hidden) { void refresh(); void poll(); }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelledRef.current = true;
      clearInterval(id);
      clearInterval(pollId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div style={{
      backgroundColor: theme.surface,
      borderRadius: '16px',
      border: `1px solid ${theme.divider}`,
      padding: '24px 20px',
      margin: '0 20px 20px',
      textAlign: 'center',
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
        backgroundColor: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {qrDataUrl ? (
          <img
            src={qrDataUrl}
            alt="Your connect code. Tap for a fresh one."
            onClick={() => void refreshRef.current()}
            style={{ width: '164px', height: '164px', display: 'block', cursor: 'pointer' }}
          />
        ) : loadError ? (
          <div style={{ padding: '0 14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            <p style={{ color: '#0d0d0f', fontSize: '12px', lineHeight: 1.4, marginBottom: '10px' }}>{loadError}</p>
            <button
              onClick={() => { setLoadError(null); void refreshRef.current(); }}
              style={{ background: '#0d0d0f', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        ) : (
          <span style={{ color: '#0d0d0f', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            LOADING
          </span>
        )}
      </div>

      <p style={{ color: theme.text, fontSize: '14px', fontWeight: 600, marginBottom: '4px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        {user?.name ?? 'Your profile'}
      </p>
      <p style={{ color: justConnected ? theme.accent : theme.muted, fontSize: '12px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        {justConnected ? 'Connected! New code ready for the next person.' : 'Scan it from the W App, not the phone camera.'}
      </p>

      <Link
        href="/main/connect/scan"
        style={{
          backgroundColor: theme.accent,
          color: theme.onAccent,
          border: 'none',
          borderRadius: '12px',
          padding: '10px 24px',
          fontSize: '14px',
          fontWeight: 700,
          cursor: 'pointer',
          fontFamily: 'Montserrat, system-ui, sans-serif',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          textDecoration: 'none',
        }}
      >
        <Camera style={{ width: '16px', height: '16px' }} />
        Scan a code
      </Link>

      <Link
        href="/main/connect/links"
        style={{
          display: 'block',
          marginTop: '12px',
          color: theme.accent,
          fontSize: '13px',
          fontWeight: 600,
          textDecoration: 'none',
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}
      >
        Edit my links
      </Link>
    </div>
  );
}
