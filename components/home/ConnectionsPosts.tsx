'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { fetchConnectionsPosts } from '@/lib/data';
import { theme, radius, type as typeTokens, elevation, glassBlur } from '@/lib/theme';
import { SectionHeader } from '@/components/ui/primitives';
import type { VenuePost } from '@/lib/types';

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
}

// What your connections have posted at venues in the last 7 days, wherever
// you are. Only authors who share their check-ins with connections appear
// (RLS, migration 0030): a post says where they were, like a check-in does.
// Renders nothing until there is something to show.
export default function ConnectionsPosts({ excludeLocationId }: { excludeLocationId?: string | null }) {
  const [allPosts, setPosts] = useState<VenuePost[]>([]);
  // While checked in, the venue feed above already shows that venue's posts.
  const posts = excludeLocationId ? allPosts.filter((p) => p.location_id !== excludeLocationId) : allPosts;

  useEffect(() => {
    let cancelled = false;
    fetchConnectionsPosts()
      .then((p) => { if (!cancelled) setPosts(p); })
      .catch((err) => console.error("Failed to load connections' posts:", err));
    return () => { cancelled = true; };
  }, []);

  if (posts.length === 0) return null;

  return (
    <section aria-label="Your connections' posts" style={{ margin: '20px 16px 0', fontFamily: typeTokens.family }}>
      <SectionHeader style={{ marginBottom: 12 }}>Your connections</SectionHeader>
      <div style={{
        borderRadius: radius.card, padding: '4px 16px', background: theme.glassFill,
        border: `1px solid ${theme.glassBorder}`, boxShadow: `${elevation.glass}, inset 0 1px 0 ${theme.glassHighlight}`,
        backdropFilter: glassBlur, WebkitBackdropFilter: glassBlur,
      }}>
        {posts.map((p, i) => (
          <article key={p.id} style={{
            display: 'flex', gap: 12, padding: '14px 0',
            borderBottom: i < posts.length - 1 ? `1px solid ${theme.divider}` : 'none',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 999, overflow: 'hidden', flexShrink: 0, background: theme.pill,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {p.author?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- matches existing avatar convention
                <img src={p.author.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ fontWeight: 700, color: theme.text }}>{(p.author?.display_name ?? '?').charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: theme.text, fontSize: typeTokens.body.fontSize }}>
                  {p.author?.display_name ?? 'A connection'}
                </span>
                <span style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted }}>{timeAgo(p.created_at)}</span>
              </div>
              {p.venue_name && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: typeTokens.caption.fontSize, color: theme.muted, marginTop: 2 }}>
                  <MapPin size={12} aria-hidden />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>at {p.venue_name}</span>
                </div>
              )}
              <p style={{ margin: '6px 0 0', color: theme.text, fontSize: typeTokens.body.fontSize, wordBreak: 'break-word' }}>
                {p.body}
              </p>
              {!!p.like_count && (
                <div style={{ marginTop: 4, fontSize: 12, fontWeight: 800, color: theme.countRest }}>
                  {p.like_count} {p.like_count === 1 ? 'like' : 'likes'}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
