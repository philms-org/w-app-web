'use client';

import { useState } from 'react';
import { theme } from '@/lib/theme';
import { startConversation } from '@/lib/data';
import type { Profile } from '@/lib/types';

interface CreateGroupModalProps {
  attendees: Profile[];
  onClose: () => void;
  onCreated?: () => void;
}

// Organizer-only group-creation overlay. Builds its own multi-select list
// (rather than extending AttendeeStrip's single-select contract) so existing
// single-select call sites like CheckedInHero's "Connections" strip stay
// untouched. Calls the already-fully-capable startConversation(recipientIds,
// name, isGroup, firstMessage) — no backend work needed.
export default function CreateGroupModal({ attendees, onClose, onCreated }: CreateGroupModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAttendee = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canCreate = selectedIds.size >= 2 && groupName.trim().length > 0 && !saving;

  const handleCreate = () => {
    if (!canCreate) return;
    setSaving(true);
    setError(null);
    startConversation(Array.from(selectedIds), groupName.trim(), true, firstMessage.trim())
      .then(() => {
        onCreated?.();
        onClose();
      })
      .catch((err) => {
        console.error('Failed to create group:', err);
        setError("Couldn't create group — try again");
        setSaving(false);
      });
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(13, 13, 15, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        zIndex: 100
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: theme.surface,
          border: `1px solid ${theme.divider}`,
          borderRadius: '16px',
          padding: '20px',
          width: '100%',
          maxWidth: '420px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <p style={{
          color: theme.text,
          fontSize: '16px',
          fontWeight: 700,
          marginBottom: '16px',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>Create Group</p>

        <input
          type="text"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Group name..."
          style={{
            backgroundColor: theme.pill,
            border: 'none',
            borderRadius: '9999px',
            padding: '10px 16px',
            fontSize: '14px',
            color: theme.bg,
            fontFamily: 'Montserrat, system-ui, sans-serif',
            marginBottom: '12px'
          }}
        />

        <p style={{
          color: theme.muted,
          fontSize: '11px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '8px',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>Select attendees ({selectedIds.size} selected)</p>

        <div style={{
          overflowY: 'auto',
          flex: 1,
          marginBottom: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          {attendees.length === 0 ? (
            <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              No attendees to add yet
            </p>
          ) : (
            attendees.map((attendee) => {
              const isSelected = selectedIds.has(attendee.id);
              return (
                <button
                  key={attendee.id}
                  onClick={() => toggleAttendee(attendee.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: isSelected ? theme.surface2 : 'none',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '8px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    backgroundColor: theme.pill,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    border: isSelected ? `2px solid ${theme.accent}` : '2px solid transparent'
                  }}>
                    <span style={{ color: theme.bg, fontSize: '14px', fontWeight: 700, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                      {(attendee.display_name ?? '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span style={{
                    color: theme.text,
                    fontSize: '14px',
                    fontFamily: 'Montserrat, system-ui, sans-serif',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}>{attendee.display_name ?? 'Someone'}</span>
                  <span style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '4px',
                    border: `2px solid ${isSelected ? theme.accent : theme.divider}`,
                    backgroundColor: isSelected ? theme.accent : 'transparent',
                    flexShrink: 0
                  }} />
                </button>
              );
            })
          )}
        </div>

        <input
          type="text"
          value={firstMessage}
          onChange={(e) => setFirstMessage(e.target.value)}
          placeholder="First message..."
          style={{
            backgroundColor: theme.pill,
            border: 'none',
            borderRadius: '9999px',
            padding: '10px 16px',
            fontSize: '14px',
            color: theme.bg,
            fontFamily: 'Montserrat, system-ui, sans-serif',
            marginBottom: '12px'
          }}
        />

        {error && (
          <p style={{ color: theme.accent2, fontSize: '12px', marginBottom: '12px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              backgroundColor: theme.surface2,
              color: theme.text,
              border: 'none',
              borderRadius: '9999px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate}
            style={{
              flex: 1,
              backgroundColor: theme.accent,
              color: 'white',
              border: 'none',
              borderRadius: '9999px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: canCreate ? 'pointer' : 'default',
              opacity: canCreate ? 1 : 0.6,
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}
          >
            {saving ? 'Creating...' : 'Create Group'}
          </button>
        </div>
      </div>
    </div>
  );
}
