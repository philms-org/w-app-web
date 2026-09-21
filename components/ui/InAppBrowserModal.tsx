'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { theme } from '@/lib/theme';

interface InAppBrowserModalProps {
  url: string;
  onClose: () => void;
}

// How long we wait for the iframe to report a load before assuming the
// target blocked embedding (X-Frame-Options / frame-ancestors). Blocked
// frames don't reliably fire an error event, so a timeout is the only
// client-side signal available without a server-side HEAD-request proxy.
const LOAD_TIMEOUT_MS = 2500;

// Sites blocked via X-Frame-Options still fire the iframe's onLoad event
// (the navigation completes, it just renders nothing) — LOAD_TIMEOUT_MS
// alone misses that case. This hint appears regardless of load state, so a
// silently blank embed is never a dead end.
const HINT_DELAY_MS = 4000;

export default function InAppBrowserModal({ url, onClose }: InAppBrowserModalProps) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'failed'>('loading');
  const [showHint, setShowHint] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setStatus((current) => (current === 'loading' ? 'failed' : current));
    }, LOAD_TIMEOUT_MS);
    const hintTimeout = setTimeout(() => setShowHint(true), HINT_DELAY_MS);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      clearTimeout(hintTimeout);
    };
  }, [url]);

  const handleLoad = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus('loaded');
  };

  const openExternally = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  };

  let hostname = url;
  try {
    hostname = new URL(url).hostname;
  } catch {
    // leave hostname as the raw url if it doesn't parse
  }

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: theme.bg, zIndex: 200,
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px', padding: '12px 16px',
          borderBottom: `1px solid ${theme.divider}`,
          backgroundColor: theme.surface,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            width: '32px', height: '32px', borderRadius: '9999px',
            backgroundColor: 'rgba(0,0,0,0.35)', border: 'none', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <X style={{ width: '18px', height: '18px' }} />
        </button>

        <span style={{
          flex: 1, textAlign: 'center', fontSize: '13px', color: theme.muted,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {hostname}
        </span>

        <button
          onClick={openExternally}
          aria-label="Open in new tab"
          style={{
            width: '32px', height: '32px', borderRadius: '9999px',
            backgroundColor: 'rgba(0,0,0,0.35)', border: 'none', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <ExternalLink style={{ width: '16px', height: '16px' }} />
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1 }}>
        {status !== 'failed' && (
          <iframe
            src={url}
            onLoad={handleLoad}
            title={hostname}
            // No allow-top-navigation: an embedded page can run scripts and
            // open popups like a normal site, but can't redirect the app's
            // top-level window out from under the user.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
            style={{ width: '100%', height: '100%', border: 'none' }}
          />
        )}

        {status === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', backgroundColor: theme.bg, pointerEvents: 'none',
          }}>
            <span style={{ color: theme.muted, fontSize: '14px' }}>Loading…</span>
          </div>
        )}

        {status === 'failed' && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '32px',
            textAlign: 'center',
          }}>
            <span style={{ color: theme.text, fontSize: '16px', fontWeight: 600 }}>
              This page can&apos;t be displayed here
            </span>
            <span style={{ color: theme.muted, fontSize: '14px' }}>
              {hostname} doesn&apos;t allow embedding.
            </span>
            <button
              onClick={openExternally}
              style={{
                padding: '10px 20px', borderRadius: '9999px', border: 'none',
                backgroundColor: theme.accent, color: theme.onAccent ?? '#fff',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Open in new tab
            </button>
          </div>
        )}

        {status === 'loaded' && showHint && (
          <button
            onClick={openExternally}
            style={{
              position: 'absolute', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
              padding: '8px 16px', borderRadius: '9999px', border: 'none',
              backgroundColor: 'rgba(0,0,0,0.65)', color: 'white',
              fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Trouble loading? Open in new tab
          </button>
        )}
      </div>
    </div>
  );
}
