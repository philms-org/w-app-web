'use client';

import { BadgeCheck, Heart, Reply } from 'lucide-react';
import { theme, type as typeTokens } from '@/lib/theme';
import type { Profile, VenuePost } from '@/lib/types';

function computeAge(dob?: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

// dating_id/networking_id/socialising_id are FK ids into lookup tables;
// 0/null means "not opted into this category" (same convention
// ProfileFieldsList's isDone() already uses for the string-typed wizard form).
function lookingForIcons(p: Profile): string {
  const icons: string[] = [];
  if (p.dating_id) icons.push('❤️');
  if (p.networking_id) icons.push('💼');
  if (p.socialising_id) icons.push('🤝');
  return icons.join(' ');
}

export default function VenueFeedRow({
  profile,
  post,
  onReply,
  onToggleLike,
}: {
  profile: Profile;
  post?: VenuePost;
  onReply: (profile: Profile) => void;
  onToggleLike?: (postId: string) => void;
}) {
  const age = computeAge(profile.date_of_birth);
  const meta = [age != null ? `Age ${age}` : null, profile.city, profile.nationality].filter(Boolean);

  return (
    <div style={{ display: 'flex', gap: 10, padding: '12px 0', borderBottom: `1px solid ${theme.divider}` }}>
      <div style={{ width: 44, height: 44, borderRadius: 999, overflow: 'hidden', flexShrink: 0, background: theme.pill, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {profile.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- matches existing avatar convention (ProfileTab, ConnectSheet)
          <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontWeight: 700, color: theme.text, fontSize: typeTokens.body.fontSize }}>
            {(profile.display_name ?? '?').charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: theme.text, fontSize: typeTokens.body.fontSize }}>
            {profile.display_name ?? 'Someone'}
          </span>
          {profile.is_verified && <BadgeCheck size={14} color={theme.accent} aria-label="Verified" />}
          {lookingForIcons(profile) && <span style={{ fontSize: 13 }}>{lookingForIcons(profile)}</span>}
        </div>

        {meta.length > 0 && (
          <div style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted }}>{meta.join(' · ')}</div>
        )}

        {post ? (
          <>
            <p style={{ margin: '4px 0 0', color: theme.text, fontSize: typeTokens.body.fontSize, wordBreak: 'break-word' }}>
              {post.body}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => onReply(profile)}
                aria-label={`Reply to ${profile.display_name ?? 'this post'}`}
                style={{ background: 'none', border: 'none', padding: 10, margin: -10, cursor: 'pointer', color: theme.accent, display: 'flex' }}
              >
                <Reply size={16} />
              </button>
              <button
                type="button"
                onClick={() => onToggleLike?.(post.id)}
                aria-label={post.liked_by_me ? 'Unlike' : 'Like'}
                style={{ background: 'none', border: 'none', padding: 10, margin: -10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: post.liked_by_me ? theme.accent2 : theme.muted }}
              >
                <Heart size={16} fill={post.liked_by_me ? theme.accent2 : 'none'} />
                {!!post.like_count && <span style={{ fontSize: 12, fontWeight: 700 }}>{post.like_count}</span>}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => onReply(profile)}
            style={{ background: 'none', border: 'none', padding: 0, marginTop: 2, color: theme.muted, fontSize: typeTokens.caption.fontSize, fontWeight: 600, cursor: 'pointer' }}
          >
            Say hi
          </button>
        )}
      </div>
    </div>
  );
}
