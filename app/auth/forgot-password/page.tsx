'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Mail } from 'lucide-react';
import { requestPasswordReset } from '@/lib/auth';
import { getErrorMessage } from '@/lib/errors';
import { theme, type as typeTokens } from '@/lib/theme';
import { Button, Input } from '@/components/ui/primitives';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Enter your email address');
      return;
    }
    setIsLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send reset email — try again'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: typeTokens.family }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '16px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        borderBottom: `1px solid ${theme.divider}`,
        backgroundColor: theme.surface,
      }}>
        <button
          onClick={() => router.back()}
          aria-label="Back"
          style={{ padding: '8px', marginLeft: '-8px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}
        >
          <ChevronLeft style={{ width: '24px', height: '24px', color: theme.text }} />
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text }}>
          Reset password
        </h1>
        <div style={{ width: '40px' }} />
      </div>

      <div style={{ padding: '32px 24px', maxWidth: '480px', margin: '0 auto' }}>
        {sent ? (
          <div style={{ textAlign: 'center', paddingTop: '24px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              backgroundColor: theme.surface2,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <Mail style={{ width: '32px', height: '32px', color: theme.accent }} />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, color: theme.text, marginBottom: '8px' }}>
              Check your email
            </h2>
            <p style={{ fontSize: '15px', color: theme.muted, lineHeight: 1.5, marginBottom: '32px' }}>
              We sent a reset link to <strong style={{ color: theme.text }}>{email}</strong>.
              Click the link in that email to set a new password.
            </p>
            <p style={{ fontSize: '13px', color: theme.muted }}>
              Didn&apos;t get it?{' '}
              <button
                onClick={() => setSent(false)}
                style={{ color: theme.accent, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontFamily: typeTokens.family }}
              >
                Try again
              </button>
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '15px', color: theme.muted, marginBottom: '24px', lineHeight: 1.5 }}>
              Enter the email you signed up with and we&apos;ll send you a link to reset your password.
            </p>

            {error && (
              <div style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                color: theme.accent2,
                padding: '12px 16px',
                borderRadius: '12px',
                marginBottom: '16px',
                fontSize: '14px',
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                autoComplete="email"
                autoFocus
              />
              <Button type="submit" fullWidth disabled={isLoading}>
                {isLoading ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>

            <p style={{ textAlign: 'center', marginTop: '24px', color: theme.muted, fontSize: typeTokens.body.fontSize }}>
              Remember it?{' '}
              <Link href="/auth/login" style={{ color: theme.accent, fontWeight: 600, textDecoration: 'none' }}>
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
