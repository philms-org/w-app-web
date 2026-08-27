'use client';

import { theme } from '@/lib/theme';

const ROW_WIDTHS = ['70%', '45%', '85%', '55%'];

// Static illustrative mock of a social feed, pre-blurred — no real posts, no
// data fetch, just a visual hint of "what it could look like" once unlocked.
// Reused by FriendsActivityFeed's locked state and VenuePeekModal's preview.
// Parent must be `position: relative` (or similar) for this to fill it.
export default function FeedBlurBackdrop() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        filter: 'blur(6px)',
        opacity: 0.55,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      {ROW_WIDTHS.map((width, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '9999px',
            backgroundColor: theme.surface2,
            flexShrink: 0,
          }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ width, height: '10px', borderRadius: '4px', backgroundColor: theme.surface2 }} />
            <div style={{ width: '40%', height: '8px', borderRadius: '4px', backgroundColor: theme.surface2 }} />
          </div>
        </div>
      ))}
    </div>
  );
}
