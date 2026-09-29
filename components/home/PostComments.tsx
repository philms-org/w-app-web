'use client';

import { useCallback, useEffect, useState } from 'react';
import { Flag, Trash2 } from 'lucide-react';
import { theme, radius, type as typeTokens } from '@/lib/theme';
import { createPostComment, deletePostComment, fetchPostComments, reportVenueContent } from '@/lib/data';
import { useTableSubscription } from '@/lib/hooks/useTableSubscription';
import type { VenuePostComment } from '@/lib/types';
import InlineReport from './InlineReport';

const iconButton: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, minWidth: 44, minHeight: 44, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.muted,
};

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h` : new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// The comment thread under one venue post. Anyone who has visited the venue
// can read it (live, via realtime); only people checked in there can write
// (RLS, migration 0030). Authors and venue managers can delete; everyone
// else can report.
export default function PostComments({
  postId,
  myUserId,
  canComment,
  canModerate,
  onCountChange,
}: {
  postId: string;
  myUserId?: string;
  canComment: boolean;
  canModerate: boolean;
  onCountChange?: (count: number) => void;
}) {
  const [comments, setComments] = useState<VenuePostComment[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchPostComments(postId)
      .then(setComments)
      .catch((err) => console.error('Failed to load comments:', err));
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  // Report the count to the row's badge after render, never from inside a
  // state updater (that would update the parent while this one renders).
  useEffect(() => {
    if (comments) onCountChange?.(comments.length);
  }, [comments, onCountChange]);

  useTableSubscription({ table: 'venue_post_comments', filter: `post_id=eq.${postId}`, onEvent: load });

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const c = await createPostComment(postId, body);
      setText('');
      setComments((prev) => (prev?.some((x) => x.id === c.id) ? prev : [...(prev ?? []), c]));
    } catch (err) {
      console.error('Failed to comment:', err);
      setError("Couldn't post that comment. You need to be checked in at this venue.");
    } finally {
      setSending(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deletePostComment(id);
      setConfirmDeleteId(null);
      setComments((prev) => (prev ?? []).filter((c) => c.id !== id));
    } catch (err) {
      console.error('Failed to delete comment:', err);
      setError("Couldn't delete that comment. Try again.");
    }
  };

  return (
    <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: `2px solid ${theme.glassBorder}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {comments === null ? (
        <p style={{ margin: 0, fontSize: typeTokens.caption.fontSize, color: theme.muted }}>Loading comments…</p>
      ) : comments.length === 0 ? (
        <p style={{ margin: 0, fontSize: typeTokens.caption.fontSize, color: theme.muted }}>No comments yet.</p>
      ) : (
        comments.map((c) => {
          const mine = !!myUserId && c.author_id === myUserId;
          return (
            <div key={c.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                <p style={{ flex: 1, minWidth: 0, margin: '10px 0 0', fontSize: typeTokens.caption.fontSize, color: theme.text, wordBreak: 'break-word' }}>
                  <strong>{c.author?.display_name ?? 'Someone'}</strong>{' '}
                  <span style={{ color: theme.muted }}>· {timeAgo(c.created_at)}</span>
                  <br />
                  {c.body}
                </p>
                {(mine || canModerate) && (
                  <button type="button" aria-label="Delete comment" onClick={() => setConfirmDeleteId(c.id)} style={iconButton}>
                    <Trash2 size={15} />
                  </button>
                )}
                {!mine && (
                  <button type="button" aria-label="Report comment" onClick={() => setReportingId(c.id)} style={iconButton}>
                    <Flag size={15} />
                  </button>
                )}
              </div>
              {confirmDeleteId === c.id && (
                <div role="group" aria-label="Delete this comment?" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: typeTokens.caption.fontSize, color: theme.text }}>
                    {mine ? 'Delete this comment?' : 'Remove this comment for everyone?'}
                  </span>
                  <button type="button" onClick={() => remove(c.id)} style={{ ...iconButton, padding: '0 10px', color: theme.accent2, fontWeight: 700, fontFamily: 'inherit' }}>
                    {mine ? 'Delete' : 'Remove'}
                  </button>
                  <button type="button" onClick={() => setConfirmDeleteId(null)} style={{ ...iconButton, padding: '0 10px', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                </div>
              )}
              {reportingId === c.id && (
                <InlineReport
                  what="comment"
                  onSubmit={(reason, details) => reportVenueContent('comment', c.id, reason, details)}
                  onCancel={() => setReportingId(null)}
                />
              )}
            </div>
          );
        })
      )}

      {canComment ? (
        <form onSubmit={send} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 500))}
            placeholder="Add a comment"
            aria-label="Add a comment"
            style={{
              flex: 1, minWidth: 0, fontFamily: 'inherit', fontSize: 16, color: theme.text, background: theme.surface2,
              border: `1px solid ${theme.divider}`, borderRadius: radius.pill, padding: '10px 14px', outline: 'none',
            }}
          />
          <button type="submit" disabled={!text.trim() || sending} style={{
            minWidth: 44, minHeight: 44, padding: '0 8px', background: 'none', border: 'none', fontFamily: 'inherit',
            fontWeight: 700, color: theme.accent, cursor: text.trim() ? 'pointer' : 'default', opacity: text.trim() ? 1 : 0.5,
          }}>
            {sending ? '…' : 'Send'}
          </button>
        </form>
      ) : (
        <p style={{ margin: '6px 0 0', fontSize: typeTokens.caption.fontSize, color: theme.muted }}>
          Check in at this venue to comment.
        </p>
      )}
      {error && <p role="alert" style={{ margin: 0, color: theme.accent2, fontSize: typeTokens.caption.fontSize }}>{error}</p>}
    </div>
  );
}
