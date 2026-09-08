'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { updatePassword } from '@/lib/auth';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 48px 12px 16px',
  backgroundColor: 'white',
  border: '1px solid #D5D5D5',
  borderRadius: '12px',
  fontSize: '16px',
  fontFamily: 'Montserrat, system-ui, sans-serif',
  boxSizing: 'border-box',
};

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
    <div style={{ minHeight: '100vh', backgroundColor: 'white' }}>
      <div style={{ padding: '48px 24px 32px', maxWidth: '440px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#231E20', marginBottom: '8px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          Set a new password
        </h1>

        {status === 'checking' && (
          <p style={{ color: '#919191', fontSize: '15px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>Checking your reset link…</p>
        )}

        {status === 'invalid' && (
          <>
            <p style={{ color: '#919191', marginBottom: '24px', fontSize: '15px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              This reset link is invalid or has expired. Request a new one.
            </p>
            <Link href="/auth/forgot-password" style={{ color: theme.accent, textDecoration: 'none', fontWeight: 600, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              Request a new link
            </Link>
          </>
        )}

        {status === 'done' && (
          <p style={{ color: '#231E20', fontSize: '15px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            Password updated. Taking you to sign in…
          </p>
        )}

        {status === 'ready' && (
          <>
            <p style={{ color: '#919191', marginBottom: '32px', fontSize: '15px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              Choose a new password for your account.
            </p>

            {error && (
              <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', fontSize: '14px' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle}
                  placeholder="New password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#919191' }}
                  aria-label={show ? 'Hide password' : 'Show password'}
                >
                  {show ? <EyeOff style={{ width: '20px', height: '20px' }} /> : <Eye style={{ width: '20px', height: '20px' }} />}
                </button>
              </div>
              <input
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                style={{ ...inputStyle, padding: '12px 16px' }}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  backgroundColor: theme.accent,
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '16px',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: isLoading ? 'default' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                }}
              >
                {isLoading ? 'Saving…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
