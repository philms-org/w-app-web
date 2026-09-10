'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { upsertProfile, uploadAvatar } from '@/lib/data';
import { ChevronLeft, Camera } from 'lucide-react';
import { theme } from '@/lib/theme';

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: theme.surface,
  border: `1px solid ${theme.divider}`,
  borderRadius: '10px',
  padding: '12px 14px',
  color: theme.text,
  fontSize: '14px',
  fontFamily: 'Montserrat, system-ui, sans-serif',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  color: theme.muted,
  fontSize: '12px',
  fontWeight: 600,
  marginBottom: '6px',
  display: 'block',
  fontFamily: 'Montserrat, system-ui, sans-serif',
};

export default function ProfileEditPage() {
  const router = useRouter();
  const { user, setUser, hasHydrated } = useStore();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('');
  const [birth, setBirth] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // The persisted store rehydrates from localStorage *after* first render, so
  // `user` is null on mount for a hard load / refresh / deep link. Seed the
  // form once, when `user` first becomes available — never with `useState`
  // initializers, which would latch the empty values and then let Save write
  // blank display_name/phone over the real profile.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !user) return;
    seeded.current = true;
    setName(user.name ?? '');
    setPhone(user.phone ?? '');
    setGender(user.gender ?? '');
    setBirth(user.birth ?? '');
    setImagePreview(user.image ?? '');
  }, [user]);

  // Once we know the store is hydrated and there's still no user, they're
  // actually logged out — same destination handleSave falls back to.
  useEffect(() => {
    if (hasHydrated && !user) router.replace('/auth/login');
  }, [hasHydrated, user, router]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProfileImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setError('');
    setIsLoading(true);

    try {
      let avatarUrl = user.image;
      if (profileImage) {
        avatarUrl = await uploadAvatar(profileImage, user.id);
        // uploadAvatar writes to a fixed storage path and returns the same
        // URL every time, so bust CDN/browser caching of the old image.
        if (avatarUrl) {
          avatarUrl = `${avatarUrl}?v=${Date.now()}`;
        }
      }

      await upsertProfile({
        id: user.id,
        display_name: name,
        phone,
        avatar_url: avatarUrl ?? null,
      });

      // gender/birth have no DB column today (see plan note) — local only,
      // same as registration already does.
      setUser({ ...user, name, phone, gender, birth, image: avatarUrl });

      router.back();
    } catch (err: any) {
      setError(err?.message ?? 'Could not save changes');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render the form until the store has hydrated and we have a user —
  // otherwise it flashes blank and Save could clobber the profile.
  if (!hasHydrated || !user) return null;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, paddingBottom: '48px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px', padding: '20px',
        borderBottom: `1px solid ${theme.divider}`,
      }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: theme.text, display: 'flex', cursor: 'pointer' }}>
          <ChevronLeft style={{ width: '24px', height: '24px' }} />
        </button>
        <h1 style={{ color: theme.text, fontSize: '18px', fontWeight: 700, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          Edit Profile
        </h1>
      </div>

      <div style={{ padding: '24px 20px', maxWidth: '480px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
          <label style={{ position: 'relative', cursor: 'pointer' }}>
            <div style={{
              width: '96px', height: '96px', backgroundColor: theme.surface2, borderRadius: '9999px',
              overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {imagePreview ? (
                <img src={imagePreview} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Camera style={{ width: '28px', height: '28px', color: theme.muted }} />
              )}
            </div>
            <div style={{
              position: 'absolute', bottom: 0, right: 0, width: '28px', height: '28px',
              backgroundColor: theme.accent, borderRadius: '9999px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: theme.onAccent, fontSize: '16px', fontWeight: 'bold' }}>+</span>
            </div>
            <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
          </label>
        </div>

        {error && (
          <p style={{ color: theme.accent2, fontSize: '13px', marginBottom: '16px', textAlign: 'center', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {error}
          </p>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Full Name</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Phone Number</label>
          <input style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Gender</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {['Male', 'Female', 'Other'].map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: '10px',
                  border: `1px solid ${gender === g ? theme.accent : theme.divider}`,
                  backgroundColor: gender === g ? theme.accent : theme.surface,
                  color: gender === g ? theme.onAccent : theme.text,
                  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '28px' }}>
          <label style={labelStyle}>Date of Birth</label>
          <input type="date" style={inputStyle} value={birth} onChange={(e) => setBirth(e.target.value)} />
        </div>

        <button
          onClick={handleSave}
          disabled={isLoading || !name.trim()}
          style={{
            width: '100%', backgroundColor: theme.accent, color: theme.onAccent, border: 'none',
            borderRadius: '12px', padding: '14px 0', fontSize: '15px', fontWeight: 700,
            cursor: isLoading || !name.trim() ? 'default' : 'pointer',
            opacity: isLoading || !name.trim() ? 0.6 : 1,
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}
        >
          {isLoading ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
