'use client';

import { useState } from 'react';
import { theme } from '@/lib/theme';
import { startConversation } from '@/lib/data';
import type { Profile } from '@/lib/types';

interface InlineMessageComposerProps {
  recipient: Profile;
  onSent: () => void;
}

// Compose-row + send logic extracted from HistoryTab's inline "reconnect"
// composer so it can be reused by CheckedInHero as well.
export default function InlineMessageComposer({ recipient, onSent }: InlineMessageComposerProps) {
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const handleSend = () => {
    if (!messageText.trim()) return;
    setSending(true);
    setSendError(null);
    startConversation([recipient.id], null, false, messageText.trim())
      .then(() => {
        setMessageText('');
        onSent();
      })
      .catch((err) => {
        console.error('Failed to start conversation:', err);
        setSendError("Couldn't send — try again");
      })
      .finally(() => setSending(false));
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder={`Say hi to ${recipient.display_name ?? 'them'}...`}
          style={{
            flex: 1,
            backgroundColor: theme.pill,
            border: 'none',
            borderRadius: '9999px',
            padding: '10px 16px',
            fontSize: '14px',
            color: theme.bg,
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !messageText.trim()}
          style={{
            backgroundColor: theme.accent,
            color: 'white',
            border: 'none',
            borderRadius: '9999px',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: sending || !messageText.trim() ? 'default' : 'pointer',
            opacity: sending || !messageText.trim() ? 0.6 : 1,
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}
        >
          {sending ? 'Sending...' : 'Message'}
        </button>
      </div>
      {sendError && (
        <p style={{ color: theme.accent2, fontSize: '12px', marginTop: '6px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          {sendError}
        </p>
      )}
    </div>
  );
}
