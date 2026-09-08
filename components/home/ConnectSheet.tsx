'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { useStore } from '@/lib/store';
import { theme } from '@/lib/theme';
import { mintConnectToken } from '@/lib/data';
import { encodeConnectPayload } from '@/lib/connect';
import { Camera } from 'lucide-react';

// Token TTL is 90s (migration 0019); re-mint every 60s so the code on screen
// always has >= 30s of validity.
const REMINT_MS = 60_000;

export default function ConnectSheet() {
  const { user } = useStore();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;

    const refresh = async () => {
      try {
        const token = await mintConnectToken();
        if (cancelledRef.current) return;
        // Rendered dark-on-white and placed on a white plate below: the app's
        // dark theme would otherwise invert the code and many scanners fail.
        const url = await QRCode.toDataURL(encodeConnectPayload(token), {
          width: 360,
          margin: 1,
          color: { dark: '#0d0d0f', light: '#ffffff' },
        });
        if (!cancelledRef.current) setQrDataUrl(url);
      } catch {
        if (!cancelledRef.current) setQrDataUrl(null);
      }
    };

    void refresh();
    const id = setInterval(() => void refresh(), REMINT_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(id);
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
          <img src={qrDataUrl} alt="Your connect code" style={{ width: '164px', height: '164px', display: 'block' }} />
        ) : (
          <span style={{ color: '#0d0d0f', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            LOADING
          </span>
        )}
      </div>

      <p style={{ color: theme.text, fontSize: '14px', fontWeight: 600, marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
        {user?.name ?? 'Your profile'}
      </p>

      <Link
        href="/main/connect/scan"
        style={{
          backgroundColor: theme.accent,
          color: '#0D0D0F',
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
    </div>
  );
}
