'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { theme, type as typeTokens } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { updatePassword } from '@/lib/auth';
import { Button, Input } from '@/components/ui/primitives';

type Status = 'checking' | 'ready' | 'invalid' | 'done';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let settled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        settled = true;
        setStatus('ready');
      }
    });

    // The link may already have been consumed into a session by the time this
    // mounts (detectSessionInUrl runs on client init).
    supabase.auth.getSession().then(({ data }) => {
      if (settled) return;
      setStatus(data.session ? 'ready' : 'invalid');
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Use at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match');
      return;
    }
    setIsLoading(true);
    try {
      await updatePassword(password);
      setStatus('done');
      setTimeout(() => router.push('/auth/login'), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: typeTokens.family }}>
      <div style={{ padding: '48px 24px 32px', maxWidth: '440px', margin: '0 auto' }}>
        <h1 style={{ fontSize: typeTokens.title.fontSize, fontWeight: 700, color: theme.text, marginBottom: '8px' }}>
          Set a new password
        </h1>

        {status === 'checking' && (
          <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize }}>Checking your reset link…</p>
        )}

        {status === 'invalid' && (
          <>
            <p style={{ color: theme.muted, marginBottom: '24px', fontSize: typeTokens.body.fontSize }}>
              This reset link is invalid or has expired. Request a new one.
            </p>
            <Link href="/auth/forgot-password" style={{ color: theme.accent, textDecoration: 'none', fontWeight: 600 }}>
              Request a new link
            </Link>
          </>
        )}

        {status === 'done' && (
          <p style={{ color: theme.text, fontSize: typeTokens.body.fontSize }}>
            Password updated. Taking you to sign in…
          </p>
        )}

        {status === 'ready' && (
          <>
            <p style={{ color: theme.muted, marginBottom: '32px', fontSize: typeTokens.body.fontSize }}>
              Choose a new password for your account.
            </p>

            {error && (
              <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', fontSize: '14px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ position: 'relative' }}>
                <Input
                  type={show ? 'text' : 'password'}
                  name="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New password"
                  autoComplete="new-password"
                  style={{ paddingRight: '48px' }}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  style={{ position: 'absolute', right: '16px', top: '12px', background: 'none', border: 'none', cursor: 'pointer', color: theme.muted }}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff style={{ width: '20px', height: '20px' }} /> : <Eye style={{ width: '20px', height: '20px' }} />}
                </button>
              </div>
              <Input
                type={show ? 'text' : 'password'}
                name="confirm-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
              <Button type="submit" fullWidth disabled={isLoading}>
                {isLoading ? 'Saving…' : 'Update password'}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
