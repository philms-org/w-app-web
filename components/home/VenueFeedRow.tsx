'use client';

import { useCallback, useState } from 'react';
import { BadgeCheck, Flag, Heart, Megaphone, MessageSquare, Reply, Trash2 } from 'lucide-react';
import { reportVenueContent } from '@/lib/data';
import PostComments from './PostComments';
import InlineReport from './InlineReport';
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

// 44 x 44 hit box around a 16px icon (WCAG 2.5.5 / iOS HIG).
const iconButton: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, minWidth: 44, minHeight: 44, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontFamily: 'inherit',
};

export default function VenueFeedRow({
  profile,
  post,
  isMine,
  onReply,
  onToggleLike,
  onDelete,
  myUserId,
  canComment = false,
  canModerate = false,
}: {
  profile: Profile;
  post?: VenuePost;
  isMine?: boolean;
  onReply: (profile: Profile) => void;
  onToggleLike?: (postId: string) => void;
  onDelete?: (postId: string) => Promise<void>;
  myUserId?: string;
  /** Currently checked in at this venue (RLS lets only them comment). */
  canComment?: boolean;
  /** Venue manager: may remove anyone's post or comment. */
  canModerate?: boolean;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const [reporting, setReporting] = useState(false);
  const handleCount = useCallback((n: number) => setCommentCount(n), []);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const pending = !!post?.id.startsWith('temp-');

  const confirmDelete = async () => {
    if (!post || !onDelete) return;
    setDeleting(true);
    setDeleteError(false);
    try {
      await onDelete(post.id);
    } catch {
      setDeleteError(true);
      setConfirmingDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  // profiles_public (PR #7, migration 0026) returns a computed `age` and never
  // the birth date; fall back to computing it for rows that still carry one.
  const age = profile.age ?? computeAge(profile.date_of_birth);
  const meta = [age != null ? `Age ${age}` : null, profile.city, profile.nationality].filter(Boolean);

  return (
    <div style={{ display: 'flex', gap: 10, padding: '12px 0', borderBottom: `1px solid ${theme.divider}`, fontFamily: typeTokens.family }}>
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
            {post.is_announcement && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: '2px 8px', borderRadius: 999,
                background: theme.accent, color: theme.onAccent, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              }}>
                <Megaphone size={11} aria-hidden /> Announcement
              </span>
            )}
            <p style={{ margin: '4px 0 0', color: theme.text, fontSize: typeTokens.body.fontSize, wordBreak: 'break-word' }}>
              {post.body}
            </p>
            {confirmingDelete ? (
              <div role="group" aria-label="Delete this post?" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={{ fontSize: typeTokens.caption.fontSize, color: theme.text, marginRight: 4 }}>
                  {isMine ? 'Delete this post?' : 'Remove this post for everyone?'}
                </span>
                <button type="button" onClick={confirmDelete} disabled={deleting} style={{ ...iconButton, padding: '0 10px', color: theme.accent2, fontWeight: 700, fontSize: typeTokens.caption.fontSize }}>
                  {deleting ? 'Deleting…' : isMine ? 'Delete' : 'Remove'}
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)} disabled={deleting} style={{ ...iconButton, padding: '0 10px', color: theme.muted, fontWeight: 600, fontSize: typeTokens.caption.fontSize }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, margin: '0 0 -8px -14px', opacity: pending ? 0.6 : 1 }}>
                <button
                  type="button"
                  onClick={() => onReply(profile)}
                  aria-label={`Reply to ${profile.display_name ?? 'this post'}`}
                  style={{ ...iconButton, color: theme.accent }}
                >
                  <Reply size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleLike?.(post.id)}
                  disabled={pending}
                  aria-label={post.liked_by_me ? 'Unlike' : 'Like'}
                  style={{ ...iconButton, color: post.liked_by_me ? theme.accent2 : theme.muted }}
                >
                  <Heart size={16} fill={post.liked_by_me ? theme.accent2 : 'none'} />
                  {!!post.like_count && <span style={{ fontSize: 12, fontWeight: 700 }}>{post.like_count}</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setShowComments((v) => !v)}
                  disabled={pending}
                  aria-expanded={showComments}
                  aria-label={showComments ? 'Hide comments' : 'Show comments'}
                  style={{ ...iconButton, color: showComments ? theme.text : theme.muted }}
                >
                  <MessageSquare size={16} />
                  {!!(commentCount ?? post.comment_count) && (
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{commentCount ?? post.comment_count}</span>
                  )}
                </button>
                <span style={{ marginLeft: 'auto' }} />
                {(isMine || canModerate) && onDelete && !pending && (
                  <button
                    type="button"
                    onClick={() => { setDeleteError(false); setConfirmingDelete(true); }}
                    aria-label={isMine ? 'Delete your post' : 'Remove this post'}
                    style={{ ...iconButton, color: theme.muted }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                {!isMine && !pending && (
                  <button
                    type="button"
                    onClick={() => setReporting((v) => !v)}
                    aria-label="Report this post"
                    style={{ ...iconButton, color: theme.muted }}
                  >
                    <Flag size={16} />
                  </button>
                )}
              </div>
            )}
            {reporting && (
              <InlineReport
                what="post"
                onSubmit={(reason, details) => reportVenueContent('post', post.id, reason, details)}
                onCancel={() => setReporting(false)}
              />
            )}
            {showComments && !pending && (
              <PostComments
                postId={post.id}
                myUserId={myUserId}
                canComment={canComment}
                canModerate={canModerate}
                onCountChange={handleCount}
              />
            )}
            {deleteError && (
              <p role="alert" style={{ margin: '8px 0 0', color: theme.accent2, fontSize: typeTokens.caption.fontSize }}>
                Couldn&apos;t delete that post. Try again.
              </p>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={() => onReply(profile)}
            style={{ background: 'none', border: 'none', padding: 0, minHeight: 44, margin: '-8px 0 -12px', color: theme.muted, fontFamily: 'inherit', fontSize: typeTokens.caption.fontSize, fontWeight: 600, cursor: 'pointer' }}
          >
            Say hi
          </button>
        )}
      </div>
    </div>
  );
}
