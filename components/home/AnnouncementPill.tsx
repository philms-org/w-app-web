'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Megaphone } from 'lucide-react';
import { fetchVenueAnnouncements } from '@/lib/data';
import { useTableSubscription } from '@/lib/hooks/useTableSubscription';
import { theme, radius, type as typeTokens } from '@/lib/theme';
import type { VenuePost } from '@/lib/types';

const SEEN_KEY = (locationId: string) => `w_app_announcements_seen:${locationId}`;

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Page-1 mockup: the pinned organizer post at the top of "Who's here" is a
// pink/purple gradient row. Built from --accent-2 so it follows the theme.
const pinned: React.CSSProperties = {
  background: 'linear-gradient(100deg, color-mix(in srgb, var(--accent-2) 55%, var(--surface)), color-mix(in srgb, var(--accent-2) 18%, var(--surface)))',
  border: `1px solid ${theme.glassBorder}`,
  boxShadow: `inset 0 1px 0 ${theme.glassHighlight}`,
};

// Announcements pill, pinned to the top of the checked-in feed card. Every feed post
// by a venue manager or announcer is an announcement (migration 0031).
// Collapsed: the newest one in a single line. Tap: a panel you scroll up and
// down through all of them. Live, and marks a "new" dot until opened.
export default function AnnouncementPill({ locationId, venueName }: { locationId: string; venueName: string }) {
  const [items, setItems] = useState<VenuePost[]>([]);
  const [open, setOpen] = useState(false);
  const [seenId, setSeenId] = useState<string | null>(null);

  useEffect(() => {
    try { setSeenId(localStorage.getItem(SEEN_KEY(locationId))); } catch { setSeenId(null); }
    setOpen(false);
  }, [locationId]);

  const load = useCallback(() => {
    fetchVenueAnnouncements(locationId)
      .then(setItems)
      .catch((err) => console.error('Failed to load announcements:', err));
  }, [locationId]);

  useEffect(() => { setItems([]); load(); }, [load]);

  useTableSubscription({ table: 'venue_posts', filter: `location_id=eq.${locationId}`, onEvent: load });

  const latest = items[0];
  const hasNew = !!latest && latest.id !== seenId;

  const toggle = () => {
    setOpen((v) => !v);
    if (latest) {
      setSeenId(latest.id);
      try { localStorage.setItem(SEEN_KEY(locationId), latest.id); } catch { /* private mode */ }
    }
  };

  if (!latest) return null;

  return (
    <section aria-label={`Announcements from ${venueName}`} style={{ marginBottom: 12, fontFamily: typeTokens.family }}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="announcement-list"
        style={{
          ...pinned,
          width: '100%', minHeight: 56, borderRadius: open ? `${radius.control}px ${radius.control}px 0 0` : radius.control,
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 8px 8px',
          color: theme.text, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
          transition: 'border-radius .2s ease',
        }}
      >
        <span style={{
          position: 'relative', width: 36, height: 36, borderRadius: 999, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: theme.accent, color: theme.onAccent,
        }}>
          <Megaphone size={18} aria-hidden />
          {hasNew && (
            <span aria-label="New announcement" style={{
              position: 'absolute', top: -1, right: -1, width: 11, height: 11, borderRadius: 999,
              background: theme.accentReact, border: `2px solid ${theme.bg}`,
            }} />
          )}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: 10.5, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: theme.text, opacity: 0.85,
          }}>
            {venueName} · Announcements{items.length > 1 ? ` · ${items.length}` : ''}
          </span>
          <span style={{
            display: 'block', fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis',
            whiteSpace: open ? 'normal' : 'nowrap',
          }}>
            {open ? 'All announcements' : `“${latest.body}”`}
          </span>
        </span>
        <ChevronDown size={18} aria-hidden style={{ flexShrink: 0, color: theme.text, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s ease' }} />
      </button>

      {open && (
        <div
          id="announcement-list"
          role="list"
          style={{
            background: theme.surface2, border: `1px solid ${theme.glassBorder}`,
            borderTop: 'none', borderRadius: `0 0 ${radius.control}px ${radius.control}px`,
            maxHeight: 'min(52vh, 360px)', overflowY: 'auto', overscrollBehavior: 'contain',
            scrollSnapType: 'y proximity', padding: '4px 14px 10px',
          }}
        >
          {items.map((a, i) => (
            <article
              key={a.id}
              role="listitem"
              style={{
                scrollSnapAlign: 'start', padding: '12px 0',
                borderBottom: i < items.length - 1 ? `1px solid ${theme.divider}` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: theme.text }}>{a.author?.display_name ?? `${venueName} team`}</span>
                <span style={{ fontSize: 12, color: theme.muted }}>{timeAgo(a.created_at)}</span>
                {i === 0 && (
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                    padding: '2px 8px', borderRadius: radius.pill, background: theme.accent, color: theme.onAccent,
                  }}>
                    Latest
                  </span>
                )}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: 15, lineHeight: 1.45, color: theme.text, wordBreak: 'break-word' }}>{a.body}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
