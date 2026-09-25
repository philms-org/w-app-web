'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { theme, type as typeTokens } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { LockedOverlay } from '@/components/ui/primitives';
import { createVenuePost, deleteVenuePost, fetchMyConnectionCount, fetchVenuePosts, toggleLike } from '@/lib/data';
import type { Profile, VenuePost } from '@/lib/types';
import VenueFeedRow from './VenueFeedRow';
import VenueFeedComposer from './VenueFeedComposer';
import VenueFeedFilters, { type FeedFilter } from './VenueFeedFilters';
import AddPhotoPrompt, { shouldShowPhotoPrompt } from './AddPhotoPrompt';

const REQUIRED_CONNECTIONS = 3;
const TEMP_PREFIX = 'temp-';

function matchesFilter(profile: Profile, filter: FeedFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'dating') return !!profile.dating_id;
  if (filter === 'networking') return !!profile.networking_id;
  return !!profile.socialising_id;
}

type PostRow = { id: string; location_id: string; author_id: string; body: string; created_at: string };
type LikeRow = { post_id: string; user_id: string };

export default function VenueFeed({
  locationId,
  presenceProfiles,
  myUserId,
  myAvatarUrl,
  onReply,
}: {
  locationId: string;
  presenceProfiles: Profile[];
  myUserId?: string;
  myAvatarUrl?: string | null;
  onReply: (profile: Profile) => void;
}) {
  const [connectionCount, setConnectionCount] = useState<number | null>(null);
  const [posts, setPosts] = useState<VenuePost[]>([]);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);

  // Realtime handlers are bound once per channel; read the latest props
  // through refs instead of resubscribing whenever presence changes.
  const presenceRef = useRef(presenceProfiles);
  presenceRef.current = presenceProfiles;
  const myUserIdRef = useRef(myUserId);
  myUserIdRef.current = myUserId;

  useEffect(() => {
    let cancelled = false;
    fetchMyConnectionCount()
      .then((n) => { if (!cancelled) setConnectionCount(n); })
      .catch((err) => {
        console.error('Failed to load connection count:', err);
        if (!cancelled) setConnectionCount(0);
      });
    return () => { cancelled = true; };
  }, []);

  const unlocked = connectionCount !== null && connectionCount >= REQUIRED_CONNECTIONS;

  // Keeps optimistic (temp-*) posts that the server hasn't confirmed yet, so a
  // refetch racing an in-flight post doesn't make it flicker out.
  const loadPosts = useCallback(() => {
    fetchVenuePosts(locationId)
      .then((fresh) => {
        setPosts((prev) => {
          const pending = prev.filter((p) => p.id.startsWith(TEMP_PREFIX) && p.location_id === locationId);
          return [...pending, ...fresh];
        });
      })
      .catch((err) => console.error('Failed to load venue feed:', err));
  }, [locationId]);

  useEffect(() => {
    setPosts([]);
    if (!unlocked) return;
    loadPosts();
  }, [unlocked, locationId, loadPosts]);

  // Live updates. One channel per venue; torn down on unmount and whenever
  // the venue changes (the effect re-runs with the new locationId).
  useEffect(() => {
    if (!unlocked) return;

    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    const refetchSoon = () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      refetchTimer = setTimeout(() => { refetchTimer = null; loadPosts(); }, 250);
    };

    const onPostInsert = (row: PostRow) => {
      if (row.location_id !== locationId) return;
      const author = presenceRef.current.find((p) => p.id === row.author_id);
      if (!author && row.author_id !== myUserIdRef.current) {
        // Someone we have no profile for yet: let the query attach it.
        refetchSoon();
        return;
      }
      setPosts((prev) => {
        if (prev.some((p) => p.id === row.id)) return prev; // already have it
        // Echo of our own optimistic post that arrived before the insert
        // call returned: swap the temp copy for the real row.
        const tempIdx = prev.findIndex(
          (p) => p.id.startsWith(TEMP_PREFIX) && p.author_id === row.author_id && p.body === row.body,
        );
        if (tempIdx !== -1) {
          const next = [...prev];
          next[tempIdx] = { ...next[tempIdx], id: row.id, created_at: row.created_at };
          return next;
        }
        return [{ ...row, author: author ?? null, like_count: 0, liked_by_me: false }, ...prev];
      });
    };

    const onPostDelete = (old: Partial<PostRow>) => {
      if (!old.id) return;
      setPosts((prev) => prev.filter((p) => p.id !== old.id));
    };

    const onLike = (row: Partial<LikeRow>, delta: 1 | -1) => {
      if (!row.post_id) return;
      const mine = row.user_id === myUserIdRef.current;
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== row.post_id) return p;
          // Our own taps are applied optimistically; only apply the echo if
          // it came from another device and the state actually differs.
          if (mine && p.liked_by_me === (delta === 1)) return p;
          return {
            ...p,
            like_count: Math.max(0, (p.like_count ?? 0) + delta),
            liked_by_me: mine ? delta === 1 : p.liked_by_me,
          };
        }),
      );
    };

    // DELETE events can't be filtered server-side and carry only the primary
    // key (see migration 0025), so those two listen unfiltered and ignore ids
    // this feed doesn't hold. post_likes has no location_id to filter on;
    // INSERTs are still RLS-scoped to venues the viewer is checked in at.
    const channel = supabase
      .channel(`venue-feed:${locationId}:${crypto.randomUUID()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'venue_posts', filter: `location_id=eq.${locationId}` },
        (payload) => onPostInsert(payload.new as PostRow))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'venue_posts' },
        (payload) => onPostDelete(payload.old as Partial<PostRow>))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'post_likes' },
        (payload) => onLike(payload.new as Partial<LikeRow>, 1))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'post_likes' },
        (payload) => onLike(payload.old as Partial<LikeRow>, -1))
      .subscribe((status) => {
        // (Re)connected: reconcile anything missed while the socket was down.
        if (status === 'SUBSCRIBED') refetchSoon();
      });

    const onVisible = () => { if (document.visibilityState === 'visible') refetchSoon(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, [unlocked, locationId, loadPosts]);

  const rows = useMemo(() => {
    const postedByAuthor = new Map<string, VenuePost>();
    for (const post of posts) {
      if (!postedByAuthor.has(post.author_id)) postedByAuthor.set(post.author_id, post);
    }

    const posted = Array.from(postedByAuthor.values())
      .map((post) => ({ profile: post.author ?? presenceProfiles.find((p) => p.id === post.author_id), post }))
      .filter((r): r is { profile: Profile; post: VenuePost } => !!r.profile);

    const silent = presenceProfiles
      .filter((p) => p.id !== myUserId && !postedByAuthor.has(p.id))
      .map((profile) => ({ profile, post: undefined as VenuePost | undefined }));

    return [...posted, ...silent].filter((r) => matchesFilter(r.profile, filter));
  }, [posts, presenceProfiles, myUserId, filter]);

  const handleToggleLike = (postId: string) => {
    if (postId.startsWith(TEMP_PREFIX)) return;
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, liked_by_me: !p.liked_by_me, like_count: (p.like_count ?? 0) + (p.liked_by_me ? -1 : 1) }
          : p
      )
    );
    toggleLike(postId).catch((err) => {
      console.error('Failed to toggle like:', err);
      loadPosts();
    });
  };

  // Optimistic: the post shows at the top immediately under a temp id, then
  // takes the real id when the insert returns (or when its realtime echo
  // lands first — see onPostInsert). Throws so the composer keeps the text.
  const handlePost = async (body: string) => {
    if (!myUserId) throw new Error('Not signed in');
    const tempId = `${TEMP_PREFIX}${crypto.randomUUID()}`;
    const me: Profile =
      presenceProfiles.find((p) => p.id === myUserId) ??
      { id: myUserId, display_name: 'You', avatar_url: myAvatarUrl ?? null };
    setPosts((prev) => [
      { id: tempId, location_id: locationId, author_id: myUserId, body, created_at: new Date().toISOString(), author: me, like_count: 0, liked_by_me: false },
      ...prev,
    ]);
    try {
      const saved = await createVenuePost(locationId, body);
      setPosts((prev) =>
        prev.some((p) => p.id === saved.id)
          ? prev.filter((p) => p.id !== tempId) // realtime echo already swapped in
          : prev.map((p) => (p.id === tempId ? { ...p, id: saved.id, created_at: saved.created_at } : p)),
      );
      if (shouldShowPhotoPrompt(myAvatarUrl)) setShowPhotoPrompt(true);
    } catch (err) {
      setPosts((prev) => prev.filter((p) => p.id !== tempId));
      throw err;
    }
  };

  const handleDelete = async (postId: string) => {
    const removed = posts.find((p) => p.id === postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      await deleteVenuePost(postId);
    } catch (err) {
      console.error('Failed to delete post:', err);
      if (removed) setPosts((prev) => (prev.some((p) => p.id === postId) ? prev : [removed, ...prev]));
      throw err;
    }
  };

  if (connectionCount === null) return null;

  if (!unlocked) {
    return (
      <LockedOverlay
        title="Unlock who's here"
        body="Finish setting up your friends to unlock who's here."
      >
        <div>
          {presenceProfiles.slice(0, 3).map((profile) => (
            <VenueFeedRow key={profile.id} profile={profile} onReply={() => {}} />
          ))}
        </div>
      </LockedOverlay>
    );
  }

  return (
    <div style={{ fontFamily: typeTokens.family }}>
      <VenueFeedFilters value={filter} onChange={setFilter} />
      {rows.length === 0 ? (
        <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize }}>
          No one to connect with here yet
        </p>
      ) : (
        rows.map(({ profile, post }) => (
          <VenueFeedRow
            key={profile.id}
            profile={profile}
            post={post}
            isMine={!!myUserId && post?.author_id === myUserId}
            onReply={onReply}
            onToggleLike={handleToggleLike}
            onDelete={handleDelete}
          />
        ))
      )}
      <VenueFeedComposer avatarUrl={myAvatarUrl} onSubmit={handlePost} />
      {showPhotoPrompt && <AddPhotoPrompt onClose={() => setShowPhotoPrompt(false)} />}
    </div>
  );
}
