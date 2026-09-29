'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchProfile, updateProfile, uploadAvatar } from '@/lib/data';
import { theme, radius, type as typeTokens } from '@/lib/theme';
import { Camera, ChevronDown, ChevronRight } from 'lucide-react';
import StepLocation from './StepLocation';
import StepWork from './StepWork';
import StepFun from './StepFun';
import StepLookingFor from './StepLookingFor';
import { EMPTY_DATA, profileToData, dataToProfilePatch, type OnboardingData } from './types';

type FieldKey = 'photo' | 'city' | 'looking' | 'work' | 'fun';

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'photo', label: 'Profile photo' },
  { key: 'city', label: 'Where you are' },
  { key: 'looking', label: 'Looking for' },
  { key: 'work', label: 'What you do' },
  { key: 'fun', label: 'Fun stuff' },
];

export default function ProfileFieldsList({ userId, avatarUrl }: { userId: string; avatarUrl?: string | null }) {
  const [data, setData] = useState<OnboardingData>(EMPTY_DATA);
  const [open, setOpen] = useState<FieldKey | null>(null);
  const [avatar, setAvatar] = useState<string | null | undefined>(avatarUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProfile(userId)
      .then((p) => { if (!cancelled) setData(profileToData(p)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  const savePatch = (patch: Partial<OnboardingData>) => {
    const next = { ...data, ...patch };
    setData(next);
    // updateProfile, not upsertProfile: this only ever runs for an
    // already-identified user's existing profiles row (Task 4's vitals
    // gate creates it), and dataToProfilePatch() never includes
    // display_name — an upsert() validates NOT NULL columns against the
    // insert branch even when the conflict resolves to an UPDATE, so it
    // would fail every save outright (see lib/data.ts's updateProfile
    // doc comment, and app/profile/setup/page.tsx's identical use of
    // updateProfile for the same dataToProfilePatch() shape).
    updateProfile(dataToProfilePatch(userId, next)).catch((err) =>
      console.error('Profile field save failed:', err)
    );
  };

  const handlePickPhoto = async (file: File) => {
    try {
      const url = await uploadAvatar(file, userId);
      setAvatar(url);
      await updateProfile({ id: userId, avatar_url: url });
    } catch (err) {
      console.error('Avatar upload failed:', err);
    }
  };

  const isDone = (key: FieldKey): boolean => {
    switch (key) {
      case 'photo': return !!avatar;
      case 'city': return !!data.city.trim();
      case 'looking': return data.socialisingId !== '0' || data.networkingId !== '0' || data.datingId !== '0';
      case 'work': return !!data.profession.trim();
      case 'fun': return !!data.favouriteDrink.trim() || !!data.fridayNight.trim();
    }
  };

  const doneCount = FIELDS.filter((f) => isDone(f.key)).length;

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.divider}`, borderRadius: radius.card }}>
      <div style={{ padding: '14px 16px 0' }}>
        <p style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, margin: 0 }}>
          {doneCount} of {FIELDS.length} details added
        </p>
        <div style={{ height: 6, borderRadius: 999, background: theme.pill, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(doneCount / FIELDS.length) * 100}%`, background: theme.accent2, borderRadius: 999 }} />
        </div>
      </div>

      {FIELDS.map(({ key, label }) => (
        <div key={key} style={{ borderTop: `1px solid ${theme.divider}` }}>
          <button
            onClick={() => key === 'photo' ? fileInputRef.current?.click() : setOpen(open === key ? null : key)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
              background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 10, background: theme.pill, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {key === 'photo' ? <Camera size={17} color={theme.text} /> : <span style={{ fontSize: 15 }}>{isDone(key) ? '✓' : ''}</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: typeTokens.body.fontSize, fontWeight: 700, color: theme.text, margin: 0 }}>{label}</p>
              <p style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted, margin: '1px 0 0' }}>
                {isDone(key) ? 'Added' : 'Not added yet'}
              </p>
            </div>
            {key !== 'photo' && (open === key ? <ChevronDown size={16} color={theme.muted} /> : <ChevronRight size={16} color={theme.muted} />)}
          </button>
          {open === key && key === 'city' && (
            <div style={{ padding: '0 16px 16px' }}>
              <StepLocation data={data} patch={savePatch} />
            </div>
          )}
          {open === key && key === 'looking' && (
            <div style={{ padding: '0 16px 16px' }}>
              <StepLookingFor data={data} patch={savePatch} />
            </div>
          )}
          {open === key && key === 'work' && (
            <div style={{ padding: '0 16px 16px' }}>
              <StepWork data={data} patch={savePatch} />
            </div>
          )}
          {open === key && key === 'fun' && (
            <div style={{ padding: '0 16px 16px' }}>
              <StepFun data={data} patch={savePatch} />
            </div>
          )}
        </div>
      ))}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePickPhoto(f); }}
      />
    </div>
  );
}
