'use client';

import { useState } from 'react';
import { theme } from '@/lib/theme';
import { EVENT_ROLES, setEventRole, type EventRole } from '@/lib/eventTracking';

interface EventRoleSheetProps {
  locationId: string;
  venueName: string;
  onDone: (role: EventRole) => void;
}

// Asked once per event at check-in when the organizer turns it on (0046).
// Required: there's no close button, one tap answers it. Organizers use the
// answers to see the room's skill mix and balance teams.
export default function EventRoleSheet({ locationId, venueName, onDone }: EventRoleSheetProps) {
  const [saving, setSaving] = useState<EventRole | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pick = async (role: EventRole) => {
    if (saving) return;
    setSaving(role);
    setError(null);
    try {
      await setEventRole(locationId, role);
      onDone(role);
    } catch (err) {
      console.error('Failed to save event role:', err);
      setError("Couldn't save that. Check your connection and tap again.");
      setSaving(null);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-role-title"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          maxWidth: 480, margin: '0 auto',
          backgroundColor: theme.surface,
          borderTop: `1px solid ${theme.divider}`,
          borderRadius: '24px 24px 0 0',
          padding: '10px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}
      >
        <div aria-hidden style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.divider, margin: '0 auto 14px' }} />
        <p id="event-role-title" style={{ color: theme.text, fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>
          What are you here as?
        </p>
        <p style={{ color: theme.muted, fontSize: '13px', margin: '0 0 14px' }}>
          {venueName} organizers use this to help everyone find a team.
        </p>
        {EVENT_ROLES.map(({ value, label, hint }) => (
          <button
            key={value}
            type="button"
            onClick={() => pick(value)}
            disabled={!!saving}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center',
              width: '100%', minHeight: '58px', padding: '8px 16px', marginBottom: '8px',
              borderRadius: '14px', fontFamily: 'inherit', textAlign: 'left',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving && saving !== value ? 0.5 : 1,
              backgroundColor: saving === value ? theme.accent : theme.surface2,
              color: saving === value ? theme.onAccent : theme.text,
              border: saving === value ? 'none' : `1px solid ${theme.divider}`,
            }}
          >
            <span style={{ fontSize: '15px', fontWeight: 700 }}>{saving === value ? 'Saving…' : label}</span>
            <span style={{ fontSize: '12px', opacity: 0.75 }}>{hint}</span>
          </button>
        ))}
        {error && (
          <p role="alert" style={{ color: theme.accent, fontSize: '13px', margin: '4px 0 0' }}>{error}</p>
        )}
      </div>
    </div>
  );
}
