'use client';

import { theme } from '@/lib/theme';
import type { FeedItem } from '@/lib/types';
import { User, BadgeCheck } from 'lucide-react';

const timeFormatter = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

// Single feed-post rendering, shared by HistoryTab/HistoryPanel (read-only
// history view) and VenueFeed (the live composer view). Phase 3 adds a
// comments section as an optional child slot here rather than forking this
// component a third time.
export default function FeedPostCard({ item, dense = false }: { item: FeedItem; dense?: boolean }) {
  return (
    <div style={{
      backgroundColor: dense ? theme.surface2 : theme.pill,
      borderRadius: '10px',
      padding: '12px 14px',
      marginBottom: '8px',
      display: 'flex',
      gap: '10px'
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        flexShrink: 0,
        backgroundColor: dense ? theme.pill : '#F3F3F3',
        borderRadius: '9999px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <User style={{ width: '16px', height: '16px', color: dense ? theme.text : '#919191' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            color: theme.text,
            fontSize: '14px',
            fontWeight: 600,
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>{item.profiles?.display_name ?? 'Someone'}</span>
          {item.profiles?.is_verified && (
            <BadgeCheck style={{ width: '14px', height: '14px', color: theme.accent }} />
          )}
        </div>
        <p style={{
          color: theme.text,
          fontSize: '15px',
          marginTop: '2px',
          fontFamily: 'Montserrat, system-ui, sans-serif',
          overflowWrap: 'break-word'
        }}>{item.content}</p>
        <p style={{
          color: dense ? theme.muted : '#919191',
          fontSize: '11px',
          marginTop: '6px',
          fontFamily: 'Montserrat, system-ui, sans-serif'
        }}>{timeFormatter.format(new Date(item.created_at))}</p>
      </div>
    </div>
  );
}
