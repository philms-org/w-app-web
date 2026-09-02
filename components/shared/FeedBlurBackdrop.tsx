'use client';

const ROW_WIDTHS = ['70%', '45%', '85%', '55%'];

// Skeleton fill colors: `theme.surface2` sat almost on top of the surfaces
// these render over (`theme.surface` / `theme.bg`) and, once `opacity` and
// `blur()` were applied, the whole mock washed out to nothing. Translucent
// white reads against any dark surface — the blur keeps it abstract.
const AVATAR_FILL = 'rgba(255, 255, 255, 0.16)';
const BAR_FILL = 'rgba(255, 255, 255, 0.20)';

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
        filter: 'blur(5px)',
        opacity: 0.9,
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
            backgroundColor: AVATAR_FILL,
            flexShrink: 0,
          }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ width, height: '10px', borderRadius: '4px', backgroundColor: BAR_FILL }} />
            <div style={{ width: '40%', height: '8px', borderRadius: '4px', backgroundColor: BAR_FILL }} />
          </div>
        </div>
      ))}
    </div>
  );
}
