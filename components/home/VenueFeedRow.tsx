'use client';

import { contribute } from '@/lib/meter';
import { useCallback, useState } from 'react';
import { BadgeCheck, Flag, Heart, Megaphone, MessageSquare, MoreHorizontal, Send, Trash2 } from 'lucide-react';
import { reportVenueContent } from '@/lib/data';
import PostComments from './PostComments';
import InlineReport from './InlineReport';
import GuestBadge from './GuestBadge';
import { AvatarWithLight } from './InRoomStrip';
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
  inRoom = false,
  isGuest = false,
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
  /** Checked in right now: green light on the avatar (0037). */
  inRoom?: boolean;
  /** On the venue's guest pass: guest label (0037). */
  isGuest?: boolean;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const [reporting, setReporting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
      <AvatarWithLight profile={profile} size={44} inRoom={inRoom} ring={theme.bg} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, color: theme.text, fontSize: typeTokens.body.fontSize }}>
            {profile.display_name ?? 'Someone'}
          </span>
          {profile.is_verified && <BadgeCheck size={14} color={theme.accent} aria-label="Verified" />}
          {lookingForIcons(profile) && <span style={{ fontSize: 13 }}>{lookingForIcons(profile)}</span>}
          {isGuest && <GuestBadge />}
          {inRoom && <span style={{ fontSize: typeTokens.caption.fontSize, color: theme.green, fontWeight: 600 }}>· in the room</span>}
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
                  onClick={(e) => {
                    onToggleLike?.(post.id);
                    if (!post.liked_by_me) contribute('like', e.currentTarget);
                  }}
                  disabled={pending}
                  aria-label={post.liked_by_me ? 'Unlike' : 'Like'}
                  style={{ ...iconButton, color: post.liked_by_me ? theme.accent2 : theme.muted }}
                >
                  <Heart size={18} fill={post.liked_by_me ? theme.accent2 : 'none'} />
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
                  <MessageSquare size={18} />
                  {!!(commentCount ?? post.comment_count) && (
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{commentCount ?? post.comment_count}</span>
                  )}
                </button>
                {!isMine && (
                  <button
                    type="button"
                    onClick={() => onReply(profile)}
                    aria-label={`Message ${profile.display_name ?? 'them'} privately`}
                    style={{ ...iconButton, padding: '0 10px', color: theme.muted, fontSize: 13, fontWeight: 600 }}
                  >
                    <Send size={16} aria-hidden />
                    Message
                  </button>
                )}
                <span style={{ marginLeft: 'auto' }} />
                {!pending && (!isMine || ((isMine || canModerate) && onDelete)) && (
                  <button
                    type="button"
                    onClick={() => setMenuOpen((v) => !v)}
                    aria-expanded={menuOpen}
                    aria-label="More options"
                    style={{ ...iconButton, color: theme.muted }}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                )}
              </div>
            )}
            {menuOpen && !confirmingDelete && (
              <div role="group" aria-label="Post options" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '10px 0 2px' }}>
                {!isMine && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setReporting(true); }}
                    style={{ ...iconButton, padding: '0 14px', borderRadius: 999, border: `1px solid ${theme.glassBorder}`, color: theme.text, fontSize: 13, fontWeight: 600 }}
                  >
                    <Flag size={15} aria-hidden /> Report
                  </button>
                )}
                {(isMine || canModerate) && onDelete && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setDeleteError(false); setConfirmingDelete(true); }}
                    style={{ ...iconButton, padding: '0 14px', borderRadius: 999, border: `1px solid ${theme.glassBorder}`, color: theme.accent2, fontSize: 13, fontWeight: 600 }}
                  >
                    <Trash2 size={15} aria-hidden /> {isMine ? 'Delete' : 'Remove'}
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
            aria-label={`Say hi to ${profile.display_name ?? 'them'}`}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, minHeight: 44, padding: '0 16px',
              borderRadius: 999, border: `1px solid ${theme.glassBorder}`, background: 'transparent',
              color: theme.text, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <Send size={15} aria-hidden />
            Say hi
          </button>
        )}
      </div>
    </div>
  );
}
