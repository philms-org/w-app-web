'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { theme, type as typeTokens } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { LockedOverlay } from '@/components/ui/primitives';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { getFreshPosition } from '@/lib/geolocation';
import { canAnnounceAt, canReadVenueFeed, createVenuePost, hasEarlyAccess, deleteVenuePost, fetchMyConnectionCount, fetchTeams, fetchVenuePosts, toggleLike } from '@/lib/data';
import { useTableSubscription } from '@/lib/hooks/useTableSubscription';
import { Search } from 'lucide-react';
import type { Profile, VenuePost } from '@/lib/types';
import VenueFeedRow from './VenueFeedRow';
import VenueFeedComposer from './VenueFeedComposer';
import VenueFeedFilters, { type FeedFilter } from './VenueFeedFilters';
import AddPhotoPrompt, { shouldShowPhotoPrompt } from './AddPhotoPrompt';

const REQUIRED_CONNECTIONS = 3;

// A post refusal the composer can show as-is (not a generic network error).
export class FeedPostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedPostError';
  }
}
const TEMP_PREFIX = 'temp-';

function matchesFilter(
  row: { profile: Profile; post?: VenuePost },
  filter: FeedFilter,
  teamMemberIds: Set<string>,
): boolean {
  const p = row.profile;
  switch (filter) {
    case 'all': return true;
    case 'posted': return !!row.post;
    case 'noteam': return !teamMemberIds.has(p.id);
    case 'networking': return !!p.networking_id;
    case 'socialising': return !!p.socialising_id;
  }
}

const FILTER_KEYS: FeedFilter[] = ['all', 'posted', 'noteam', 'networking', 'socialising'];

const EMPTY_COPY: Record<FeedFilter, string> = {
  all: 'No one else is checked in yet',
  posted: 'No posts yet',
  noteam: 'Everyone here is on a team',
  networking: 'No one here is networking yet',
  socialising: 'No one here is socialising yet',
};

type PostRow = { id: string; location_id: string; author_id: string; body: string; created_at: string };
type LikeRow = { post_id: string; user_id: string };

export default function VenueFeed({
  locationId,
  presenceProfiles,
  myUserId,
  myAvatarUrl,
  onReply,
  checkedIn = true,
}: {
  locationId: string;
  presenceProfiles: Profile[];
  myUserId?: string;
  myAvatarUrl?: string | null;
  onReply: (profile: Profile) => void;
  /** Actually checked in (inside the geofence); only then can you comment. */
  checkedIn?: boolean;
}) {
  const [connectionCount, setConnectionCount] = useState<number | null>(null);
  const [posts, setPosts] = useState<VenuePost[]>([]);
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const { canManage: canModerate } = useIsOrganizer(locationId);
  const [canAnnounce, setCanAnnounce] = useState(false);
  const [teamMemberIds, setTeamMemberIds] = useState<Set<string>>(new Set());

  // Who is already on a team, for the "Needs a team" pill. Teams are optional:
  // if they can't load, everyone simply counts as not on a team.
  const loadTeams = useCallback(() => {
    fetchTeams(locationId)
      .then((teams) => setTeamMemberIds(new Set(teams.flatMap((t) => t.members.map((m) => m.user_id)))))
      .catch(() => {});
  }, [locationId]);
  useTableSubscription({ table: 'team_members', filter: `location_id=eq.${locationId}`, onEvent: loadTeams });

  useEffect(() => {
    let cancelled = false;
    setCanAnnounce(false);
    canAnnounceAt(locationId)
      .then((v) => { if (!cancelled) setCanAnnounce(v); })
      .catch(() => { /* treat as a regular poster */ });
    return () => { cancelled = true; };
  }, [locationId]);

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

  // Checked in here before, or joined by invite link while early access lasts:
  // the server already lets you read this feed. Early access also lets you
  // post / like / comment before you arrive (migration 0035).
  const [hasFeedAccess, setHasFeedAccess] = useState(false);
  const [earlyAccess, setEarlyAccess] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setHasFeedAccess(false);
    setEarlyAccess(false);
    if (checkedIn) return;
    Promise.all([canReadVenueFeed(locationId), hasEarlyAccess(locationId)])
      .then(([read, early]) => {
        if (cancelled) return;
        setHasFeedAccess(read);
        setEarlyAccess(early);
      })
      .catch(() => { /* fall back to the connections gate */ });
    return () => { cancelled = true; };
  }, [locationId, checkedIn]);
  const canEngage = checkedIn || earlyAccess;

  // Checked in: you see everyone in the room. Only a preview from outside the
  // venue stays locked behind the connections gate (or an invite link).
  const unlocked = checkedIn || hasFeedAccess || (connectionCount !== null && connectionCount >= REQUIRED_CONNECTIONS);

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

  const allRows = useMemo(() => {
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

    return [...posted, ...silent];
  }, [posts, presenceProfiles, myUserId]);

  const counts = useMemo(() => {
    const c = {} as Record<FeedFilter, number>;
    for (const k of FILTER_KEYS) c[k] = allRows.filter((r) => matchesFilter(r, k, teamMemberIds)).length;
    return c;
  }, [allRows, teamMemberIds]);

  const rows = useMemo(
    () => allRows.filter((r) => matchesFilter(r, filter, teamMemberIds)),
    [allRows, filter, teamMemberIds],
  );

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
      // Invitees posting before they arrive don't need a location fix.
      let pos: { lat: number | null; lng: number | null } = { lat: null, lng: null };
      if (!earlyAccess || checkedIn) {
        try {
          pos = await getFreshPosition();
        } catch {
          throw new FeedPostError("Couldn't get your location. Allow location access to post here.");
        }
      }
      let saved: VenuePost;
      try {
        saved = await createVenuePost(locationId, body, pos.lat, pos.lng);
      } catch (err) {
        const msg = (err as { message?: string })?.message ?? '';
        if (/geofence/.test(msg)) throw new FeedPostError("You need to be at the venue to post. Move closer and try again.");
        if (/not checked in/.test(msg)) throw new FeedPostError('Check in at this venue to post.');
        throw err;
      }
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

  if (connectionCount === null && !checkedIn && !hasFeedAccess) return null;

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
      <VenueFeedFilters value={filter} onChange={setFilter} counts={counts} />
      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 12px' }}>
          <Search size={28} aria-hidden="true" style={{ color: theme.muted }} />
          <p style={{ margin: '8px 0 4px', color: theme.text, fontSize: typeTokens.body.fontSize, fontWeight: 700 }}>
            {EMPTY_COPY[filter]}
          </p>
          <p style={{ margin: 0, color: theme.muted, fontSize: typeTokens.caption.fontSize }}>
            {filter === 'all' ? 'Post something and people will see it when they check in.' : 'Try another filter.'}
          </p>
          {filter !== 'all' && (
            <button
              type="button"
              onClick={() => setFilter('all')}
              style={{
                marginTop: 12, minHeight: 44, padding: '0 18px', borderRadius: 999, cursor: 'pointer',
                background: 'transparent', color: theme.text, border: `1px solid ${theme.glassBorder}`,
                fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
              }}
            >
              Show everyone
            </button>
          )}
        </div>
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
            myUserId={myUserId}
            canComment={canEngage}
            canModerate={canModerate}
          />
        ))
      )}
      <VenueFeedComposer
        docked
        avatarUrl={myAvatarUrl}
        onSubmit={handlePost}
        placeholder={canAnnounce ? 'Post an announcement…' : "What's up?"}
        disabledReason={canEngage || canAnnounce ? undefined : 'Check in at the venue to post'}
      />
      {showPhotoPrompt && <AddPhotoPrompt onClose={() => setShowPhotoPrompt(false)} />}
    </div>
  );
}
