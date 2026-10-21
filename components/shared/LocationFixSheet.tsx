'use client';

import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useStore } from '@/lib/store';
import { locationFixSteps, requestLocation } from '@/lib/geolocation';
import { theme, radius, elevation, type as typeTokens } from '@/lib/theme';
import { Button } from '@/components/ui/primitives';

// Step-by-step help for a browser that has location blocked. No web page can
// open Settings or change its own permission, so the best we can do is make
// the steps obvious and pick the change up as soon as they come back
// (useLocationRecovery, mounted on /main).
export default function LocationFixSheet({ onClose }: { onClose: () => void }) {
  const { steps, extra, openInSafari } = locationFixSteps();
  const [checking, setChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDone = async () => {
    setChecking(true);
    await requestLocation();
    if (!useStore.getState().locationPermissionBlocked) {
      onClose();
      return;
    }
    // Some browsers (Safari in particular) only notice a Settings change
    // after a reload; the store is persisted, so nothing is lost.
    window.location.reload();
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(window.location.href).then(() => setCopied(true)).catch(() => {});
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="location-fix-title"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000, backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, backgroundColor: theme.surface, color: theme.text,
          borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
          boxShadow: elevation.glass, fontFamily: typeTokens.family,
          padding: '24px 20px calc(20px + env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <MapPin style={{ width: 22, height: 22, color: theme.accent }} />
          <h2 id="location-fix-title" style={{ ...typeTokens.heading, margin: 0 }}>
            Turn on location
          </h2>
        </div>

        <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 12px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {steps.map((step, i) => (
            <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span style={{
                flexShrink: 0, width: 26, height: 26, borderRadius: radius.pill,
                backgroundColor: theme.accent, color: theme.onAccent, fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i + 1}
              </span>
              <span style={{ ...typeTokens.body, paddingTop: 2 }}>{step}</span>
            </li>
          ))}
        </ol>

        {extra && <p style={{ ...typeTokens.caption, color: theme.muted, margin: '0 0 12px' }}>{extra}</p>}

        <p style={{ ...typeTokens.caption, color: theme.muted, margin: '0 0 20px' }}>
          You can still join without location: search for your event on Home.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {openInSafari ? (
            <Button fullWidth onClick={handleCopy}>{copied ? 'Link copied' : 'Copy link'}</Button>
          ) : (
            <Button fullWidth onClick={handleDone} disabled={checking}>
              {checking ? 'Checking…' : "I've done it"}
            </Button>
          )}
          <Button fullWidth variant="secondary" onClick={onClose}>Not now</Button>
        </div>
      </div>
    </div>
  );
}
