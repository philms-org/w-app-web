'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { theme, elevation } from '@/lib/theme';
import { X } from 'lucide-react';

const DELAY_MS = 4500;

// Mounted on /main. The 5-step wizard is no longer a forced gate after
// signup — this is the non-blocking nudge instead: waits a few seconds
// after landing so the visitor gets to actually use the app first, then
// surfaces a dismissible prompt to finish their profile. Dismissing just
// hides it for this mount; ProfileTab's own "Complete Profile" card (and
// this prompt reappearing on a future /main visit) remain the way back in.
export default function ProfileSetupPrompt() {
  const router = useRouter();
  const { user } = useStore();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Anonymous guests always start with setupComplete: false (see
    // EnsureSession.tsx) but have no `profiles` row yet until VitalsGate
    // identifies them. /profile/setup's handleFinish calls updateProfile
    // (a bare UPDATE ... WHERE id = uid), which matches zero rows for a
    // guest with no row — the wizard would silently discard everything.
    // Suppress this prompt for anonymous sessions; once VitalsGate has
    // identified them (upsertProfile ran, so a real row exists) and
    // setupComplete is still false, it's safe for this prompt to fire.
    if (user?.isAnonymous || user?.setupComplete !== false) return;
    const timer = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, [user?.isAnonymous, user?.setupComplete]);

  if (!visible || dismissed || user?.isAnonymous || user?.setupComplete !== false) return null;

  return (
    <div style={{
      position: 'fixed', left: 16, right: 16, bottom: 84, zIndex: 500,
      display: 'flex', justifyContent: 'center',
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        backgroundColor: theme.surface, border: `1px solid ${theme.divider}`,
        borderRadius: 16, padding: '14px 16px', boxShadow: elevation.glass,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            color: theme.text, fontSize: 14, fontWeight: 700, margin: '0 0 2px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}>
            Finish setting up your profile
          </p>
          <p style={{
            color: theme.muted, fontSize: 12, margin: 0,
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}>
            Takes under a minute — helps people you meet know more about you.
          </p>
        </div>
        <button
          onClick={() => router.push('/profile/setup')}
          style={{
            flexShrink: 0, backgroundColor: theme.accent, color: theme.onAccent,
            border: 'none', borderRadius: 10, padding: '9px 14px', fontWeight: 700,
            fontSize: 13, cursor: 'pointer', fontFamily: 'Montserrat, system-ui, sans-serif',
          }}
        >
          Complete
        </button>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          style={{
            flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer',
            padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <X style={{ width: 16, height: 16, color: theme.muted }} />
        </button>
      </div>
    </div>
  );
}
