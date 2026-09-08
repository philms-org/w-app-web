'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { theme } from '@/lib/theme';
import { requestPasswordReset } from '@/lib/auth';

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 16px',
  backgroundColor: 'white',
  border: '1px solid #D5D5D5',
  borderRadius: '12px',
  fontSize: '16px',
  fontFamily: 'Montserrat, system-ui, sans-serif',
  boxSizing: 'border-box',
};

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
    <div style={{ minHeight: '100vh', backgroundColor: 'white' }}>
      <div style={{ padding: '16px 8px' }}>
        <button
          onClick={() => router.push('/auth/login')}
          style={{ padding: '8px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}
          aria-label="Back to sign in"
        >
          <ChevronLeft style={{ width: '24px', height: '24px', color: '#231E20' }} />
        </button>
      </div>

      <div style={{ padding: '16px 24px 32px', maxWidth: '440px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#231E20', marginBottom: '8px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          Reset your password
        </h1>
        <p style={{ color: '#919191', marginBottom: '32px', fontSize: '15px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          {sent
            ? 'If that email has an account, a reset link is on its way. The link opens a page where you can set a new password.'
            : 'Enter your account email and we’ll send you a link to set a new password.'}
        </p>

        {error && (
          <div style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        {!sent && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px', color: '#231E20', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                placeholder="Enter your email"
                autoComplete="email"
              />
            </div>
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
              {isLoading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p style={{ marginTop: '24px', fontSize: '14px', color: '#919191', textAlign: 'center', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          <Link href="/auth/login" style={{ color: theme.accent, textDecoration: 'none' }}>
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
