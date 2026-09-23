'use client';

import { useEffect, useMemo, useState } from 'react';
import { theme, type as typeTokens } from '@/lib/theme';
import { LockedOverlay } from '@/components/ui/primitives';
import { fetchMyConnectionCount, fetchVenuePosts, toggleLike } from '@/lib/data';
import type { Profile, VenuePost } from '@/lib/types';
import VenueFeedRow from './VenueFeedRow';
import VenueFeedComposer from './VenueFeedComposer';
import VenueFeedFilters, { type FeedFilter } from './VenueFeedFilters';

const REQUIRED_CONNECTIONS = 3;

function matchesFilter(profile: Profile, filter: FeedFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'dating') return !!profile.dating_id;
  if (filter === 'networking') return !!profile.networking_id;
  return !!profile.socialising_id;
}

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

  const loadPosts = () => {
    fetchVenuePosts(locationId)
      .then(setPosts)
      .catch((err) => console.error('Failed to load venue feed:', err));
  };

  useEffect(() => {
    if (!unlocked) return;
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked, locationId]);

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
    // Optimistic — the feed is small and re-fetches on the next mount/post anyway.
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
    <div>
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
            onReply={onReply}
            onToggleLike={handleToggleLike}
          />
        ))
      )}
      <VenueFeedComposer locationId={locationId} avatarUrl={myAvatarUrl} onPosted={loadPosts} />
    </div>
  );
}
