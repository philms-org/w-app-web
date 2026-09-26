'use client';

import { useState } from 'react';
import { theme, radius, type as typeTokens } from '@/lib/theme';

// `onSubmit` owns the optimistic insert (see VenueFeed.handlePost). The input
// clears straight away and gets the text back if posting fails.
export default function VenueFeedComposer({
  avatarUrl,
  onSubmit,
}: {
  avatarUrl?: string | null;
  onSubmit: (body: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    setText('');
    try {
      await onSubmit(body);
    } catch (err) {
      console.error('Failed to post to venue feed:', err);
      setText(body);
      setError("Couldn't post that. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} style={{ padding: '10px 0 2px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 999, overflow: 'hidden', flexShrink: 0, background: theme.pill }}>
          {avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- matches existing avatar convention
            <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          )}
        </div>
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); if (error) setError(null); }}
          placeholder="What's up?"
          maxLength={280}
          aria-label="Post an update"
          style={{
            flex: 1, minWidth: 0, background: theme.surface2, border: `1px solid ${theme.divider}`,
            borderRadius: radius.control, padding: '11px 14px', color: theme.text,
            fontSize: 16, outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          style={{
            flexShrink: 0, minWidth: 44, minHeight: 44, background: 'none', border: 'none',
            color: theme.accent, fontWeight: 700, fontFamily: 'inherit', fontSize: typeTokens.label.fontSize,
            padding: '0 6px', cursor: text.trim() ? 'pointer' : 'default',
            opacity: text.trim() ? 1 : 0.5,
          }}
        >
          Post
        </button>
      </div>
      {error && (
        <p role="alert" style={{ margin: '6px 0 0 42px', color: theme.accent2, fontSize: typeTokens.caption.fontSize }}>
          {error}
        </p>
      )}
    </form>
  );
}
