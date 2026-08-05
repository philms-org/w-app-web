'use client';

import { theme } from '@/lib/theme';
import type { Profile, VerificationTag } from '@/lib/types';

interface AttendeeStripProps {
  attendees: Profile[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  tagsByUserId?: Map<string, VerificationTag[]>;
}

// Avatar-scroller extracted from HistoryTab's "Who was there" strip so it can
// be reused by both HistoryTab and CheckedInHero's "Connections" card.
export default function AttendeeStrip({ attendees, selectedId, onSelect, tagsByUserId }: AttendeeStripProps) {
  return (
    <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '4px' }}>
      {attendees.map((attendee) => {
        const tags = tagsByUserId?.get(attendee.id);
        return (
          <button
            key={attendee.id}
            onClick={() => onSelect(attendee.id === selectedId ? null : attendee.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              flexShrink: 0,
              width: '56px'
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: theme.pill,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: attendee.id === selectedId ? `2px solid ${theme.accent}` : '2px solid transparent'
            }}>
              <span style={{ color: theme.bg, fontSize: '16px', fontWeight: 700, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                {(attendee.display_name ?? '?').charAt(0).toUpperCase()}
              </span>
            </div>
            <span style={{
              color: theme.text,
              fontSize: '10px',
              textAlign: 'center',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>{attendee.display_name ?? 'Someone'}</span>
            {tags && tags.length > 0 && (
              <span style={{
                backgroundColor: theme.surface2,
                color: theme.text,
                fontSize: '10px',
                lineHeight: 1.2,
                borderRadius: '9999px',
                padding: '2px 8px',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontFamily: 'Montserrat, system-ui, sans-serif'
              }}>{tags.map((t) => t.tag).join(', ')}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
