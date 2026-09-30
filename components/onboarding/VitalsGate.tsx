'use client';

import { useState, useEffect, useRef } from 'react';
import { useStore } from '@/lib/store';
import { upgradeGuestAccount, GuestUpgradeError, signInWithMagicLink } from '@/lib/auth';
import { upsertProfile } from '@/lib/data';
import { theme, radius, type as typeTokens, elevation, glassBlur } from '@/lib/theme';
import { Button, Input } from '@/components/ui/primitives';

type Intent = 'checkin' | 'messages' | 'profile';

const INTENT_COPY: Record<Intent, string> = {
  checkin: "Add your name and email to check in — that's it.",
  messages: "Add your name and email to start chatting — that's it.",
  profile: 'Add your name and email to save a profile.',
};

// Server-side error code for "this email already belongs to another,
// real account" when upgrading an anonymous session (GoTrue's documented
// code is `email_exists`). Falls back to a message substring in case the
// exact code differs — confirmed/corrected against a live call in Step 4.
function isEmailTakenError(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === 'email_exists') return true;
  return !!e.message && /already (registered|exists|in use)/i.test(e.message);
}

export default function VitalsGate({
  open,
  intent,
  onClose,
  onIdentified,
}: {
  open: boolean;
  intent: Intent;
  onClose: () => void;
  onIdentified: () => void;
}) {
  const { user, setUser } = useStore();
  const [mode, setMode] = useState<'new' | 'returning'>('new');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  // First input of whichever mode is currently rendered — the Name field in
  // 'new' mode, the Email field in 'returning' mode. Re-attaches automatically
  // when JSX swaps which Input it's on, since it's a plain object ref.
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Reset state when the sheet opens (but not on mount or when it closes).
  useEffect(() => {
    if (open) {
      setMode('new');
      setName('');
      setEmail('');
      setError('');
      setLinkSent(false);
    }
  }, [open]);

  // Move focus into the sheet when it opens, and again whenever the mode
  // switches (new/returning) so the newly-shown form's first field gets it.
  // No-ops harmlessly in 'linkSent' mode, where there's no input to focus.
  useEffect(() => {
    if (open) {
      firstFieldRef.current?.focus();
    }
  }, [open, mode]);

  // Sheets are expected to be dismissible via Escape, same as a native
  // dialog. Attached to the backdrop below, where it catches the bubbled
  // keydown from whichever field currently has focus.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  if (!open) return null;

  const isValidEmail = (v: string) => /\S+@\S+\.\S+/.test(v);

  const handleSubmitVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !isValidEmail(email)) return;
    setBusy(true);
    setError('');
    try {
      await upgradeGuestAccount(email.trim(), name.trim());
      if (user) {
        await upsertProfile({ id: user.id, display_name: name.trim(), email: email.trim() });
        setUser({ ...user, name: name.trim(), email: email.trim(), isAnonymous: false });
      }
      onIdentified();
    } catch (err) {
      if (isEmailTakenError(err) || (err instanceof GuestUpgradeError && err.code === 'email_exists')) {
        setMode('returning');
        setError('');
      } else if (err instanceof GuestUpgradeError && err.code === 'rate_limited') {
        setError('Too many tries. Wait a minute and try again.');
      } else {
        setError("Couldn't save that — try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSendMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(email)) return;
    setBusy(true);
    setError('');
    try {
      await signInWithMagicLink(email.trim());
      setLinkSent(true);
    } catch {
      setError("Couldn't send the link — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={onClose}
      onKeyDown={handleKeyDown}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vitals-gate-heading"
        style={{
          width: '100%', maxWidth: 480,
          background: theme.glassFill,
          backdropFilter: glassBlur,
          WebkitBackdropFilter: glassBlur,
          borderTop: `1px solid ${theme.glassBorder}`,
          borderRadius: `${radius.sheet}px ${radius.sheet}px 0 0`,
          padding: '22px 22px calc(22px + env(safe-area-inset-bottom, 10px))',
          boxShadow: `${elevation.sheet}, inset 0 1px 0 ${theme.glassHighlight}`,
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 3, background: theme.divider, margin: '0 auto 16px' }} />

        {mode === 'new' ? (
          <>
            <p style={{ fontSize: typeTokens.label.fontSize, fontWeight: 700, color: theme.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
              Almost there
            </p>
            <h3 id="vitals-gate-heading" style={{ fontSize: typeTokens.title.fontSize, fontWeight: 800, color: theme.text, margin: '0 0 4px' }}>
              {INTENT_COPY[intent]}
            </h3>
            <p style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, margin: '2px 0 16px', lineHeight: 1.5 }}>
              No password to create. We&apos;ll email a confirmation, but you&apos;re in right away.
            </p>
            <form onSubmit={handleSubmitVitals} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input ref={firstFieldRef} label="Name" name="name" autoComplete="name" placeholder="Jordan Ruiz"
                value={name} onChange={(e) => setName(e.target.value)} required />
              <Input label="Email" name="email" type="email" inputMode="email" autoComplete="email"
                placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              {error && <p role="alert" style={{ color: theme.accent2, fontSize: typeTokens.caption.fontSize, margin: 0 }}>{error}</p>}
              <Button type="submit" fullWidth disabled={busy || !name.trim() || !isValidEmail(email)}>
                {busy ? 'Saving…' : 'Continue'}
              </Button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 2 }}>
              <button type="button" onClick={() => { setMode('returning'); setError(''); }}
                style={{ background: 'none', border: 'none', color: theme.muted, fontSize: typeTokens.caption.fontSize, fontWeight: 600, cursor: 'pointer', padding: '14px 8px', minHeight: 44 }}>
                Already checked in before? Sign in
              </button>
            </div>
          </>
        ) : linkSent ? (
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <h3 id="vitals-gate-heading" style={{ fontSize: typeTokens.title.fontSize, fontWeight: 800, color: theme.text, margin: '0 0 6px' }}>Check your inbox</h3>
            <p style={{ fontSize: typeTokens.body.fontSize, color: theme.muted, margin: 0 }}>
              We sent a sign-in link to {email}.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: typeTokens.label.fontSize, fontWeight: 700, color: theme.muted, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
              Welcome back
            </p>
            <h3 id="vitals-gate-heading" style={{ fontSize: typeTokens.title.fontSize, fontWeight: 800, color: theme.text, margin: '0 0 4px' }}>
              Sign in with a magic link
            </h3>
            <p style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, margin: '2px 0 16px', lineHeight: 1.5 }}>
              No password — we&apos;ll email you a one-tap link.
            </p>
            <form onSubmit={handleSendMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input ref={firstFieldRef} label="Email" name="email" type="email" inputMode="email" autoComplete="email"
                placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              {error && <p role="alert" style={{ color: theme.accent2, fontSize: typeTokens.caption.fontSize, margin: 0 }}>{error}</p>}
              <Button type="submit" fullWidth disabled={busy || !isValidEmail(email)}>
                {busy ? 'Sending…' : 'Send magic link'}
              </Button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 2 }}>
              <button type="button" onClick={() => { setMode('new'); setError(''); }}
                style={{ background: 'none', border: 'none', color: theme.muted, fontSize: typeTokens.caption.fontSize, fontWeight: 600, cursor: 'pointer', padding: '14px 8px', minHeight: 44 }}>
                New here? Get instant access
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
