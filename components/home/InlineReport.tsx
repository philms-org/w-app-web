'use client';

import { useState } from 'react';
import { theme, radius, type as typeTokens } from '@/lib/theme';
import { Chip } from '@/components/ui/primitives';
import type { VenueReportReason } from '@/lib/types';

const REASONS: { key: VenueReportReason; label: string }[] = [
  { key: 'spam', label: 'Spam' },
  { key: 'harassment', label: 'Harassment' },
  { key: 'inappropriate', label: 'Inappropriate' },
  { key: 'other', label: 'Something else' },
];

// Inline "Report this" form under a post or comment. Goes to the venue's
// organizers (Reports page), not to the person reported.
export default function InlineReport({
  what,
  onSubmit,
  onCancel,
}: {
  what: 'post' | 'comment';
  onSubmit: (reason: VenueReportReason, details?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<VenueReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  if (state === 'sent') {
    return (
      <p role="status" style={{ margin: '8px 0 0', fontSize: typeTokens.caption.fontSize, color: theme.muted }}>
        Thanks. The venue&apos;s organizers will review this {what}.
      </p>
    );
  }

  const send = async () => {
    if (!reason) return;
    setState('sending');
    try {
      await onSubmit(reason, details.trim() || undefined);
      setState('sent');
    } catch (err) {
      console.error('Failed to send report:', err);
      setState('error');
    }
  };

  return (
    <div role="group" aria-label={`Report this ${what}`} style={{
      marginTop: 8, padding: 12, borderRadius: radius.control, background: theme.glassFill,
      border: `1px solid ${theme.glassBorder}`, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <span style={{ fontSize: typeTokens.caption.fontSize, fontWeight: 700, color: theme.text }}>
        What&apos;s wrong with this {what}?
      </span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {REASONS.map((r) => (
          <Chip key={r.key} selected={reason === r.key} onClick={() => setReason(r.key)} style={{ minHeight: 36 }}>
            {r.label}
          </Chip>
        ))}
      </div>
      {reason === 'other' && (
        <input
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, 500))}
          placeholder="Tell the organizers what happened"
          aria-label="Details"
          style={{
            fontFamily: 'inherit', fontSize: 16, color: theme.text, background: theme.surface2,
            border: `1px solid ${theme.divider}`, borderRadius: radius.control, padding: '10px 12px', outline: 'none',
          }}
        />
      )}
      {state === 'error' && (
        <p role="alert" style={{ margin: 0, color: theme.accent2, fontSize: typeTokens.caption.fontSize }}>
          Couldn&apos;t send that report. Try again.
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{
          minHeight: 44, padding: '0 14px', background: 'none', border: 'none', color: theme.muted,
          fontFamily: 'inherit', fontWeight: 600, fontSize: typeTokens.caption.fontSize, cursor: 'pointer',
        }}>
          Cancel
        </button>
        <button type="button" onClick={send} disabled={!reason || state === 'sending'} style={{
          minHeight: 44, padding: '0 16px', borderRadius: radius.control, border: 'none',
          background: theme.accent, color: theme.onAccent, fontFamily: 'inherit', fontWeight: 700,
          fontSize: typeTokens.caption.fontSize, cursor: reason ? 'pointer' : 'default', opacity: reason ? 1 : 0.5,
        }}>
          {state === 'sending' ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </div>
  );
}
