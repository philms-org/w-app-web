'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { signIn } from '@/lib/auth';
import { fetchProfile } from '@/lib/data';
import { theme, type as typeTokens } from '@/lib/theme';
import { Button, Input } from '@/components/ui/primitives';
import Captcha, { captchaEnabled } from '@/components/ui/Captcha';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { Eye, EyeOff, ChevronLeft } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setToken } = useStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRef = useRef<TurnstileInstance>(undefined);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (captchaEnabled && !captchaToken) {
      setError('Please complete the verification challenge');
      return;
    }

    setIsLoading(true);

    try {
      const { user: authUser, session } = await signIn(email, password, captchaToken);
      if (!authUser || !session) {
        setError('Invalid email or password');
        return;
      }

      setToken(session.access_token);

      let profile = null;
      try {
        profile = await fetchProfile(authUser.id);
      } catch {
        profile = null;
      }

      setUser({
        id: authUser.id,
        name: profile?.display_name ?? authUser.email ?? email,
        email: authUser.email ?? email,
        phone: profile?.phone ?? '',
        gender: '',
        birth: '',
        image: profile?.avatar_url ?? undefined,
        height: profile?.height != null ? String(profile.height) : undefined,
        relationship: profile?.relationship ?? undefined,
        datingId: profile?.dating_id ? String(profile.dating_id) : '0',
        socialisingId: profile?.socialising_id ? String(profile.socialising_id) : '0',
        networkingId: profile?.networking_id ? String(profile.networking_id) : '0',
        nationality: profile?.nationality ?? undefined,
        city: profile?.city ?? undefined,
        drink: profile?.fave_drink ?? undefined,
        activity: profile?.friday_night ?? undefined,
        profession: profile?.profession ?? undefined,
        setupComplete: !!profile?.city,
        isMasterAdmin: !!profile?.is_master_admin,
      });

      if (profile?.city) {
        router.push('/main');
      } else {
        router.push('/profile/setup');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
      captchaRef.current?.reset();
      setCaptchaToken('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: typeTokens.family }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button
          onClick={() => router.back()}
          aria-label="Back"
          style={{ padding: '8px', marginLeft: '-8px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}
        >
          <ChevronLeft style={{ width: '24px', height: '24px', color: theme.text }} />
        </button>
      </div>

      <div style={{ padding: '32px 24px', maxWidth: '440px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '96px',
              height: '96px',
              background: `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '48px', fontWeight: 700, color: 'white' }}>W</span>
          </div>
        </div>

        <h1 style={{ fontSize: typeTokens.title.fontSize, fontWeight: 700, textAlign: 'center', marginBottom: '8px', color: theme.text }}>
          Welcome back
        </h1>
        <p style={{ color: theme.muted, textAlign: 'center', marginBottom: '32px', fontSize: typeTokens.body.fontSize }}>
          Sign in to continue to The W App
        </p>

        {error && (
          <div
            style={{
              backgroundColor: '#FEF2F2', // TODO(P7): tokenize error-banner bg
              border: '1px solid #FECACA',
              color: theme.accent2,
              padding: '12px 16px',
              borderRadius: '12px',
              marginBottom: '16px',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            type="email"
            name="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            autoComplete="email"
          />

          <div style={{ position: 'relative' }}>
            <Input
              type={showPassword ? 'text' : 'password'}
              name="password"
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              style={{ paddingRight: '48px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              style={{ position: 'absolute', right: '16px', top: '38px', background: 'none', border: 'none', cursor: 'pointer', color: theme.muted }}
            >
              {showPassword ? <EyeOff style={{ width: '20px', height: '20px' }} /> : <Eye style={{ width: '20px', height: '20px' }} />}
            </button>
          </div>

          <div style={{ textAlign: 'right', marginTop: '-4px' }}>
            <Link href="/auth/forgot-password" style={{ color: theme.accent, fontSize: '14px', textDecoration: 'none' }}>
              Forgot password?
            </Link>
          </div>

          {captchaEnabled && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Captcha ref={captchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} />
            </div>
          )}

          <Button type="submit" fullWidth disabled={isLoading}>
            {isLoading ? 'Signing in…' : 'Log in'}
          </Button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '32px', color: theme.muted, fontSize: typeTokens.body.fontSize }}>
          Don&apos;t have an account?{' '}
          <Link href="/auth/register" style={{ color: theme.accent, fontWeight: 600, textDecoration: 'none' }}>
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
