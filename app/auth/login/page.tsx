'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { signIn } from '@/lib/auth';
import { fetchProfile } from '@/lib/data';
import { theme } from '@/lib/theme';
import { Eye, EyeOff, ChevronLeft } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setToken } = useStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      const { user: authUser, session } = await signIn(email, password);
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
        datingId: profile?.dating_id != null ? String(profile.dating_id) : undefined,
        socialisingId: profile?.socialising_id != null ? String(profile.socialising_id) : undefined,
        networkingId: profile?.networking_id != null ? String(profile.networking_id) : undefined,
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
    } catch (err: any) {
      setError(err?.message ?? 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFacebookLogin = () => {
    // Placeholder for Facebook login
    alert('Facebook login will be implemented with proper OAuth setup');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F0F6FA' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        padding: '16px', 
        paddingTop: 'max(16px, env(safe-area-inset-top))' 
      }}>
        <button
          onClick={() => router.back()}
          style={{
            padding: '8px',
            marginLeft: '-8px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ChevronLeft style={{ width: '24px', height: '24px', color: '#231E20' }} />
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: '32px 24px' }}>
        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '96px',
            height: '96px',
            background: `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <span style={{
              fontSize: '48px',
              fontWeight: 'bold',
              color: 'white',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>W</span>
          </div>
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '32px',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '8px',
          color: '#231E20',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>Welcome Back</h1>
        <p style={{
          color: '#919191',
          textAlign: 'center',
          marginBottom: '32px',
          fontSize: '16px',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>
          Sign in to continue to The W App
        </p>

        {/* Error message */}
        {error && (
          <div style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#DC2626',
            padding: '12px 16px',
            borderRadius: '12px',
            marginBottom: '16px',
            fontSize: '14px',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Email */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px',
              color: '#231E20',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: 'white',
                border: '1px solid #D5D5D5',
                borderRadius: '12px',
                fontSize: '16px',
                fontFamily: 'Montserrat, system-ui, sans-serif',
                boxSizing: 'border-box'
              }}
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          {/* Password */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              marginBottom: '8px',
              color: '#231E20',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 48px 12px 16px',
                  backgroundColor: 'white',
                  border: '1px solid #D5D5D5',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#919191'
                }}
              >
                {showPassword ? (
                  <EyeOff style={{ width: '20px', height: '20px' }} />
                ) : (
                  <Eye style={{ width: '20px', height: '20px' }} />
                )}
              </button>
            </div>
          </div>

          {/* Forgot Password */}
          <div style={{ textAlign: 'right' }}>
            <Link
              href="/auth/forgot-password"
              style={{
                color: '#17BFD9',
                fontSize: '14px',
                textDecoration: 'none',
                fontFamily: 'Montserrat, system-ui, sans-serif'
              }}
            >
              Forgot Password?
            </Link>
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              backgroundColor: '#17BFD9',
              color: 'white',
              fontWeight: '600',
              padding: '12px 24px',
              borderRadius: '9999px',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
              fontSize: '16px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isLoading ? (
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid rgba(255,255,255,0.3)',
                borderTop: '2px solid white',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
            ) : (
              'Login'
            )}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0' }}>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#D5D5D5' }}></div>
          <span style={{ color: '#919191', fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>OR</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#D5D5D5' }}></div>
        </div>

        {/* Facebook Login */}
        <button
          onClick={handleFacebookLogin}
          style={{
            width: '100%',
            backgroundColor: '#4267B2',
            color: 'white',
            fontWeight: '600',
            padding: '12px 24px',
            borderRadius: '9999px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '16px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '20px' }}>f</span>
          Continue with Facebook
        </button>

        {/* Sign Up Link */}
        <p style={{
          textAlign: 'center',
          marginTop: '32px',
          color: '#919191',
          fontSize: '16px',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>
          Don't have an account?{' '}
          <Link href="/auth/register" style={{
            color: '#17BFD9',
            fontWeight: '600',
            textDecoration: 'none'
          }}>
            Sign Up
          </Link>
        </p>
      </div>
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
