'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import { signUp } from '@/lib/auth';
import { upsertProfile, uploadAvatar } from '@/lib/data';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Button, Input, Chip } from '@/components/ui/primitives';
import Captcha, { captchaEnabled } from '@/components/ui/Captcha';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { Eye, EyeOff, ChevronLeft, Camera } from 'lucide-react';

const GENDERS = [
  { id: 'M', label: 'Male' },
  { id: 'F', label: 'Female' },
  { id: 'O', label: 'Other' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { setUser, setToken } = useStore();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    gender: '',
    birthDate: '',
  });

  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [countryCode, setCountryCode] = useState('+1');
  const [captchaToken, setCaptchaToken] = useState('');
  const captchaRef = useRef<TurnstileInstance>(undefined);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    if (
      !formData.name || !formData.email || !formData.phone ||
      !formData.password || !formData.confirmPassword ||
      !formData.gender || !formData.birthDate
    ) {
      setError('Please fill in all fields');
      return false;
    }
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    if (captchaEnabled && !captchaToken) {
      setError('Please complete the verification challenge');
      return false;
    }
    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const { user: authUser, session } = await signUp(formData.email, formData.password, captchaToken);
      if (!authUser) {
        setError('Registration failed');
        return;
      }

      let avatarUrl: string | undefined;
      if (profileImage) {
        try {
          avatarUrl = await uploadAvatar(profileImage, authUser.id);
        } catch {
          avatarUrl = undefined;
        }
      }

      await upsertProfile({
        id: authUser.id,
        display_name: formData.name,
        email: formData.email,
        phone: countryCode + formData.phone,
        avatar_url: avatarUrl ?? null,
      });

      if (session) setToken(session.access_token);
      setUser({
        id: authUser.id,
        name: formData.name,
        email: formData.email,
        phone: countryCode + formData.phone,
        gender: formData.gender,
        birth: formData.birthDate,
        image: avatarUrl,
        datingId: '0',
        socialisingId: '0',
        networkingId: '0',
        setupComplete: false,
      });

      // Straight into the app — the 5-step wizard is no longer a forced
      // gate; ProfileSetupPrompt (mounted on /main) nudges completion a few
      // seconds after landing instead.
      router.push('/main');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
      captchaRef.current?.reset();
      setCaptchaToken('');
    } finally {
      setIsLoading(false);
    }
  };

  const iconBtn: React.CSSProperties = {
    position: 'absolute',
    right: '16px',
    top: '38px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: theme.muted,
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: typeTokens.family }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px',
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          borderBottom: `1px solid ${theme.divider}`,
          backgroundColor: theme.surface,
        }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Back"
          style={{ padding: '8px', marginLeft: '-8px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}
        >
          <ChevronLeft style={{ width: '24px', height: '24px', color: theme.text }} />
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text }}>
          Create account
        </h1>
        <div style={{ width: '40px' }} />
      </div>

      <div style={{ padding: '24px', paddingBottom: '80px', maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
          <label style={{ position: 'relative', cursor: 'pointer' }}>
            <div
              style={{
                width: '112px',
                height: '112px',
                backgroundColor: theme.surface2,
                borderRadius: radius.pill,
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="Profile preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Camera style={{ width: '32px', height: '32px', color: theme.muted }} />
              )}
            </div>
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: '32px',
                height: '32px',
                backgroundColor: theme.accent,
                borderRadius: radius.pill,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: theme.onAccent, fontSize: '18px', fontWeight: 700 }}>+</span>
            </div>
            <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
          </label>
        </div>

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

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Full name" type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder="Enter your full name" autoComplete="name" />

          <Input label="Email" type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="Enter your email" autoComplete="email" />

          <div>
            <label style={{ display: 'block', fontSize: typeTokens.label.fontSize, fontWeight: 600, marginBottom: '6px', color: theme.text }}>
              Phone number
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                aria-label="Country code"
                style={{
                  width: '96px',
                  padding: '12px 8px',
                  backgroundColor: theme.surface,
                  color: theme.text,
                  border: `1px solid ${theme.divider}`,
                  borderRadius: radius.control,
                  fontSize: '16px',
                  fontFamily: typeTokens.family,
                }}
              >
                <option value="+1">+1</option>
                <option value="+44">+44</option>
                <option value="+91">+91</option>
                <option value="+86">+86</option>
                <option value="+81">+81</option>
              </select>
              <div style={{ flex: 1 }}>
                <Input type="tel" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="Phone number" />
              </div>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: typeTokens.label.fontSize, fontWeight: 600, marginBottom: '6px', color: theme.text }}>
              Gender
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {GENDERS.map((g) => (
                <Chip
                  key={g.id}
                  selected={formData.gender === g.id}
                  onClick={() => setFormData((prev) => ({ ...prev, gender: g.id }))}
                  style={{ flex: 1, padding: '12px', borderRadius: radius.control }}
                >
                  {g.label}
                </Chip>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: typeTokens.label.fontSize, fontWeight: 600, marginBottom: '6px', color: theme.text }}>
              Date of birth
            </label>
            <Input
              type="date"
              name="birthDate"
              value={formData.birthDate}
              onChange={handleInputChange}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Create a password"
              autoComplete="new-password"
              style={{ paddingRight: '48px' }}
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} style={iconBtn}>
              {showPassword ? <EyeOff style={{ width: '20px', height: '20px' }} /> : <Eye style={{ width: '20px', height: '20px' }} />}
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <Input
              label="Confirm password"
              type={showConfirmPassword ? 'text' : 'password'}
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              placeholder="Confirm your password"
              autoComplete="new-password"
              style={{ paddingRight: '48px' }}
            />
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Hide password' : 'Show password'} style={iconBtn}>
              {showConfirmPassword ? <EyeOff style={{ width: '20px', height: '20px' }} /> : <Eye style={{ width: '20px', height: '20px' }} />}
            </button>
          </div>

          {captchaEnabled && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Captcha ref={captchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken('')} />
            </div>
          )}

          <Button type="submit" fullWidth disabled={isLoading}>
            {isLoading ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', color: theme.muted, fontSize: typeTokens.body.fontSize }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: theme.accent, fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
