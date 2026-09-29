'use client';

import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { useStore } from '@/lib/store';
import { updateProfile, uploadAvatar } from '@/lib/data';
import { theme, radius, type as typeTokens, elevation, glassBlur } from '@/lib/theme';
import { Button } from '@/components/ui/primitives';

// Shown once, right after someone without a profile photo posts to the venue
// feed for the first time. Photos are optional at sign-up for guests
// (founder decision 2026-09-25), so this is where we ask: the moment their
// face would start appearing next to what they write.
export const PHOTO_PROMPT_SEEN_KEY = 'w_app_photo_prompt_seen';

export function shouldShowPhotoPrompt(avatarUrl?: string | null): boolean {
  if (avatarUrl) return false;
  try {
    return !localStorage.getItem(PHOTO_PROMPT_SEEN_KEY);
  } catch {
    return false;
  }
}

export default function AddPhotoPrompt({ onClose }: { onClose: () => void }) {
  const { user, setUser } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const dismiss = () => {
    try { localStorage.setItem(PHOTO_PROMPT_SEEN_KEY, '1'); } catch { /* private mode */ }
    onClose();
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || !user) return;
    setBusy(true);
    setError('');
    try {
      const url = await uploadAvatar(file, user.id);
      await updateProfile({ id: user.id, avatar_url: url });
      setUser({ ...user, image: url });
      dismiss();
    } catch (err) {
      console.error('Failed to upload profile photo:', err);
      setError("Couldn't upload that photo. Try another one.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      onClick={dismiss}
      onKeyDown={(e) => { if (e.key === 'Escape') dismiss(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-photo-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, padding: '24px 20px calc(24px + env(safe-area-inset-bottom))',
          borderRadius: `${radius.sheet}px ${radius.sheet}px 0 0`, background: theme.surface,
          border: `1px solid ${theme.glassBorder}`, boxShadow: elevation.glass,
          backdropFilter: glassBlur, WebkitBackdropFilter: glassBlur,
          fontFamily: typeTokens.family, textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}
      >
        <div style={{
          width: 64, height: 64, borderRadius: radius.pill, background: theme.glassFill,
          border: `1px solid ${theme.glassBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Camera size={28} color={theme.text} />
        </div>
        <h2 id="add-photo-title" style={{ margin: 0, fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text }}>
          Add a photo so people know it&apos;s you
        </h2>
        <p style={{ margin: 0, fontSize: typeTokens.body.fontSize, color: theme.muted, maxWidth: 320 }}>
          Your post is up. A photo next to it makes it easier for people here to find you and say hi.
        </p>
        {error && <p role="alert" style={{ margin: 0, color: theme.accent2, fontSize: typeTokens.caption.fontSize }}>{error}</p>}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handleFile(e.target.files?.[0])}
          style={{ display: 'none' }}
        />
        <Button fullWidth disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Uploading…' : 'Add a photo'}
        </Button>
        <Button variant="ghost" fullWidth disabled={busy} onClick={dismiss} style={{ minHeight: 44 }}>
          Not now
        </Button>
      </div>
    </div>
  );
}
