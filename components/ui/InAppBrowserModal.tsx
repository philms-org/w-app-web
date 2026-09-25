'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { theme } from '@/lib/theme';

interface InAppBrowserModalProps {
  url: string;
  onClose: () => void;
}

// Blocked embeds (X-Frame-Options / frame-ancestors) are indistinguishable
// from slow ones client-side: some fire onLoad and render blank, others never
// fire it. So the iframe is never torn down on a timer — a slow page on venue
// mobile data must still be allowed to finish. Instead, this hint appears
// after a delay regardless of load state, so a blank embed is never a dead end.
const HINT_DELAY_MS = 4000;

const headerButtonStyle: React.CSSProperties = {
  width: '44px', height: '44px', borderRadius: '9999px',
  backgroundColor: 'rgba(0,0,0,0.35)', border: 'none', color: 'white',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  flexShrink: 0,
};

export default function InAppBrowserModal({ url, onClose }: InAppBrowserModalProps) {
  const [loaded, setLoaded] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Callers pass an inline arrow; keep the latest one without re-running the
  // mount-only dialog effect below on every parent render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    setLoaded(false);
    setShowHint(false);
    const hintTimeout = setTimeout(() => setShowHint(true), HINT_DELAY_MS);
    return () => clearTimeout(hintTimeout);
  }, [url]);

  // Dialog behaviour: move focus in on open, Esc closes, focus returns to
  // whatever opened the modal (the carousel's link button) on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

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
      role="dialog"
      aria-modal="true"
      aria-label={`Web page: ${hostname}`}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: theme.bg, zIndex: 200,
        display: 'flex', flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '12px',
          padding: '8px 12px',
          paddingTop: 'calc(8px + env(safe-area-inset-top))',
          borderBottom: `1px solid ${theme.divider}`,
          backgroundColor: theme.surface,
        }}
      >
        <button ref={closeButtonRef} onClick={onClose} aria-label="Close" style={headerButtonStyle}>
          <X style={{ width: '18px', height: '18px' }} />
        </button>

        <span style={{
          flex: 1, textAlign: 'center', fontSize: '13px', color: theme.muted,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {hostname}
        </span>

        <button onClick={openExternally} aria-label="Open in new tab" style={headerButtonStyle}>
          <ExternalLink style={{ width: '16px', height: '16px' }} />
        </button>
      </div>

      <div style={{ position: 'relative', flex: 1 }}>
        <iframe
          src={url}
          onLoad={() => setLoaded(true)}
          title={hostname}
          // No allow-top-navigation: an embedded page can run scripts and
          // open popups like a normal site, but can't redirect the app's
          // top-level window out from under the user.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
          style={{ width: '100%', height: '100%', border: 'none' }}
        />

        {!loaded && (
          <div
            role="status"
            style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', backgroundColor: theme.bg, pointerEvents: 'none',
            }}
          >
            <span style={{ color: theme.muted, fontSize: '14px' }}>Loading…</span>
          </div>
        )}

        {showHint && (
          <button
            onClick={openExternally}
            style={{
              position: 'absolute', left: '50%', transform: 'translateX(-50%)',
              bottom: 'calc(16px + env(safe-area-inset-bottom))',
              minHeight: '44px', padding: '10px 18px', borderRadius: '9999px', border: 'none',
              backgroundColor: 'rgba(0,0,0,0.65)', color: 'white',
              fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {loaded ? 'Trouble loading? Open in new tab' : 'Taking a while? Open in new tab'}
          </button>
        )}
      </div>
    </div>
  );
}
