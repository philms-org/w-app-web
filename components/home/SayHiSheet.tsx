'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { theme, radius, elevation, type as typeTokens } from '@/lib/theme';
import { Button } from '@/components/ui/primitives';
import InlineMessageComposer from '@/components/shared/InlineMessageComposer';
import TagBadge from '@/components/shared/TagBadge';
import type { Profile, VerificationTag } from '@/lib/types';

// "Say hi" from the venue feed. This used to render the composer inline under
// the whole feed — below the fixed "What's up?" bar and the tab bar — so on a
// phone tapping Say hi looked like it did nothing. A sheet opens where you are.
export default function SayHiSheet({
  recipient,
  tags,
  onClose,
}: {
  recipient: Profile;
  tags: VerificationTag[];
  onClose: () => void;
}) {
  const setActiveTab = useStore((s) => s.setActiveTab);
  const [sent, setSent] = useState(false);
  const name = recipient.display_name ?? 'them';

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 70, backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Say hi to ${name}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, maxWidth: 480, margin: '0 auto',
          backgroundColor: theme.surface, color: theme.text, fontFamily: typeTokens.family,
          borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, boxShadow: elevation.glass,
          padding: '10px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div aria-hidden style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.divider, margin: '0 auto 14px' }} />

        {sent ? (
          <div style={{ textAlign: 'center', padding: '8px 0 4px' }}>
            <CheckCircle2 aria-hidden style={{ width: 36, height: 36, color: theme.accent }} />
            <p style={{ ...typeTokens.heading, margin: '8px 0 4px' }}>Sent</p>
            <p style={{ ...typeTokens.caption, color: theme.muted, margin: '0 0 16px' }}>
              {name} will see your message in Messages. Replies show up there too.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button fullWidth onClick={() => { onClose(); setActiveTab('messages'); }}>Go to Messages</Button>
              <Button fullWidth variant="secondary" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              <span style={{ ...typeTokens.heading }}>Say hi to {name}</span>
              {tags.map((t) => <TagBadge key={t.id} tag={t} size="md" />)}
            </div>
            <InlineMessageComposer recipient={recipient} onSent={() => setSent(true)} autoFocus />
          </>
        )}
      </div>
    </div>
  );
}
