'use client';

import { useEffect, useState } from 'react';
import { Building2, Users, ShieldCheck } from 'lucide-react';
import { theme } from '@/lib/theme';
import {
  deleteAccount, fetchAccountDeletionBlockers, hasDeletionBlockers,
  type AccountDeletionBlockers,
} from '@/lib/auth';

const FONT = 'Montserrat, system-ui, sans-serif';
const DANGER = '#D52600';

// Bottom sheet behind Profile -> "Delete account". Checks first whether the
// user still owns something (venue, team, staff role); if so it lists what
// to hand off. Otherwise they type DELETE to permanently delete everything.
export default function DeleteAccountSheet({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const [blockers, setBlockers] = useState<AccountDeletionBlockers | null>(null);
  const [loadError, setLoadError] = useState<'session' | 'unavailable' | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [typed, setTyped] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAccountDeletionBlockers()
      .then((b) => { if (!cancelled) setBlockers(b); })
      .catch((e: unknown) => {
        if (cancelled) return;
        console.error('DeleteAccountSheet: blockers check failed', e);
        setLoadError(e instanceof Error && e.message === 'not_signed_in' ? 'session' : 'unavailable');
      });
    return () => { cancelled = true; };
  }, [attempt]);

  const handleDelete = async () => {
    if (typed.trim() !== 'DELETE') {
      setError('Type DELETE to confirm.');
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteAccount();
      if (result.deleted) onDeleted();
      else setBlockers(result.blockers);
    } catch {
      setError("Couldn't delete your account. Try again in a moment.");
    } finally {
      setDeleting(false);
    }
  };

  const blocked = blockers && hasDeletionBlockers(blockers);

  return (
    <div
      onClick={() => !deleting && onClose()}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 100, // above TabBar (50)
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: theme.surface, width: '100%', maxWidth: '480px',
          borderRadius: '20px 20px 0 0', padding: '24px',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom) + 16px)',
          fontFamily: FONT, color: theme.text,
        }}
      >
        {!blockers && !loadError && (
          <p style={{ color: theme.muted, fontSize: '15px', margin: 0 }}>Checking your account…</p>
        )}

        {loadError && (
          <>
            <h3 id="delete-account-title" style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>Delete account</h3>
            <p style={{ color: theme.muted, fontSize: '15px', margin: '0 0 20px' }}>
              {loadError === 'session'
                ? 'Your session has expired. Log out and back in, then try again.'
                : <>Couldn&apos;t load your account details. Try again in a moment.</>}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <SheetButton onClick={onClose}>Close</SheetButton>
              {loadError === 'unavailable' && (
                <SheetButton onClick={() => { setLoadError(null); setAttempt((n) => n + 1); }}>Try again</SheetButton>
              )}
            </div>
          </>
        )}

        {blocked && (
          <>
            <h3 id="delete-account-title" style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>Hand off first</h3>
            <p style={{ color: theme.muted, fontSize: '14px', margin: '0 0 12px' }}>You still own:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
              {blockers.staff && <BlockerRow icon={ShieldCheck} label="A W staff admin role" />}
              {blockers.venues.map((v) => <BlockerRow key={v.id} icon={Building2} label={`Organizer of ${v.name}`} />)}
              {blockers.teams.map((t) => <BlockerRow key={t.id} icon={Users} label={`Team “${t.name}”`} />)}
            </div>
            <p style={{ color: theme.muted, fontSize: '14px', lineHeight: 1.5, margin: '0 0 20px' }}>
              Transfer them or ask W staff to, then come back.
            </p>
            <SheetButton onClick={onClose}>Got it</SheetButton>
          </>
        )}

        {blockers && !blocked && (
          <>
            <h3 id="delete-account-title" style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>Delete your account?</h3>
            <p style={{ color: theme.muted, fontSize: '14px', lineHeight: 1.5, margin: '0 0 16px' }}>
              This permanently deletes your profile, posts, comments, messages, connections, check-ins and badges.
              It can&apos;t be undone.
            </p>
            <label htmlFor="delete-account-confirm" style={{ display: 'block', fontSize: '13px', color: theme.muted, marginBottom: '6px' }}>
              Type DELETE to confirm
            </label>
            <input
              id="delete-account-confirm"
              value={typed}
              onChange={(e) => { setTyped(e.target.value); setError(null); }}
              autoCapitalize="characters"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={deleting}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px', fontSize: '16px',
                border: `1px solid ${error ? DANGER : theme.divider}`, backgroundColor: theme.surface2,
                color: theme.text, fontFamily: FONT, boxSizing: 'border-box',
              }}
            />
            <p role="alert" style={{ color: '#FF6B5B', fontSize: '13px', minHeight: '18px', margin: '6px 0 10px' }}>
              {error}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <SheetButton onClick={onClose} disabled={deleting}>Cancel</SheetButton>
              <SheetButton onClick={handleDelete} disabled={deleting} danger>
                {deleting ? 'Deleting…' : 'Delete forever'}
              </SheetButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function BlockerRow({ icon: Icon, label }: { icon: typeof Users; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
      borderRadius: '10px', backgroundColor: theme.surface2, fontSize: '14px',
    }}>
      <Icon style={{ width: '18px', height: '18px', color: theme.muted, flexShrink: 0 }} />
      <span>{label}</span>
    </div>
  );
}

function SheetButton({ children, onClick, disabled, danger }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
        backgroundColor: danger ? DANGER : theme.surface2, color: danger ? 'white' : theme.text,
        fontWeight: 600, fontSize: '16px', fontFamily: FONT,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  );
}
