'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { theme, type as typeTokens } from '@/lib/theme';
import { requestPasswordReset } from '@/lib/auth';
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
    if (!email) {
      setError('Enter the email for your account');
      return;
    }
    setIsLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch {
      // Don't reveal whether an address is registered.
      setSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: typeTokens.family }}>
      <div style={{ padding: '16px 8px' }}>
        <button
          onClick={() => router.push('/auth/login')}
          style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}
          aria-label="Back to sign in"
        >
          <ChevronLeft style={{ width: '24px', height: '24px', color: theme.text }} />
        </button>
      </div>

      <div style={{ padding: '16px 24px 32px', maxWidth: '440px', margin: '0 auto' }}>
        <h1 style={{ fontSize: typeTokens.title.fontSize, fontWeight: 700, color: theme.text, marginBottom: '8px' }}>
          Reset your password
        </h1>
        <p style={{ color: theme.muted, marginBottom: '32px', fontSize: typeTokens.body.fontSize }}>
          {sent
            ? 'If that email has an account, a reset link is on its way. The link opens a page where you can set a new password.'
            : 'Enter your account email and we’ll send you a link to set a new password.'}
        </p>

        {error && (
          <div style={{ backgroundColor: '#FEF2F2' /* TODO(P7): tokenize error-banner bg */, border: '1px solid #FECACA', color: theme.accent2, padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {!sent && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              type="email"
              name="email"
              label="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
            />
            <Button type="submit" fullWidth disabled={isLoading}>
              {isLoading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}

        <p style={{ marginTop: '24px', fontSize: '14px', color: theme.muted, textAlign: 'center' }}>
          <Link href="/auth/login" style={{ color: theme.accent, textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
