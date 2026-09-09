'use client';

import { theme } from '@/lib/theme';
import type { Profile, VerificationTag } from '@/lib/types';
import TagBadge from '@/components/shared/TagBadge';

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
              <span style={{ color: theme.text, fontSize: '16px', fontWeight: 700, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
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
              <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
                {tags.map((t) => <TagBadge key={t.id} tag={t} size="sm" />)}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
