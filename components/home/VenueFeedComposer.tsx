'use client';

import { useState } from 'react';
import { theme, radius } from '@/lib/theme';
import { createVenuePost } from '@/lib/data';

export default function VenueFeedComposer({
  locationId,
  avatarUrl,
  onPosted,
}: {
  locationId: string;
  avatarUrl?: string | null;
  onPosted: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await createVenuePost(locationId, body);
      setText('');
      onPosted();
    } catch (err) {
      console.error('Failed to post to venue feed:', err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 2px' }}
    >
      <div style={{ width: 32, height: 32, borderRadius: 999, overflow: 'hidden', flexShrink: 0, background: theme.pill }}>
        {avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- matches existing avatar convention
          <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What's up?"
        maxLength={280}
        aria-label="Post an update"
        style={{
          flex: 1, background: theme.surface2, border: `1px solid ${theme.divider}`,
          borderRadius: radius.control, padding: '11px 14px', color: theme.text,
          fontSize: 16, outline: 'none', fontFamily: 'inherit',
        }}
      />
      <button
        type="submit"
        disabled={!text.trim() || busy}
        style={{
          background: 'none', border: 'none', color: theme.accent, fontWeight: 700,
          padding: '11px 6px', cursor: text.trim() ? 'pointer' : 'default',
          opacity: text.trim() ? 1 : 0.5,
        }}
      >
        {busy ? '…' : 'Post'}
      </button>
    </form>
  );
}
