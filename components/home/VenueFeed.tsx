'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchFeed, postToFeed } from '@/lib/data';
import { useTableSubscription } from '@/lib/hooks/useTableSubscription';
import { theme } from '@/lib/theme';
import type { FeedItem } from '@/lib/types';
import FeedPostCard from '@/components/shared/FeedPostCard';

interface VenueFeedProps {
  locationId: string;
  // Cheap client-side signal (same haversineMeters check CheckedInHero
  // already uses for the check-in gate) used only to show/hide the composer.
  // The actual write is re-verified server-side against a fresh position at
  // submit time in post_to_feed() — this prop never gates the write itself.
  withinGeofence: boolean;
}

// Live per-venue feed: a geofence-gated composer plus the realtime list of
// posts. Read-only history of past visits still lives in HistoryTab/
// HistoryPanel — this is the "happening right now, at this venue" surface.
export default function VenueFeed({ locationId, withinGeofence }: VenueFeedProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchFeed(locationId)
      .then(setItems)
      .catch((err) => console.error('Failed to load venue feed:', err))
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useTableSubscription({
    table: 'feed_posts',
    filter: `location_id=eq.${locationId}`,
    onEvent: load,
  });

  const handlePost = () => {
    const content = text.trim();
    if (!content || posting) return;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError("Can't post without location access");
      return;
    }

    setPosting(true);
    setError(null);
    // A fresh fix at submit time, not the store's possibly-stale
    // currentLocation — post_to_feed() verifies this server-side anyway, so
    // an accurate check here just avoids a submit that predictably fails.
    navigator.geolocation.getCurrentPosition(
      (position) => {
        postToFeed(locationId, content, position.coords.latitude, position.coords.longitude)
          .then(() => {
            setText('');
            load();
          })
          .catch((err) => {
            console.error('Failed to post to feed:', err);
            setError("Couldn't post — make sure you're still at this venue");
          })
          .finally(() => setPosting(false));
      },
      () => {
        setError("Couldn't get your location — try again");
        setPosting(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div style={{
      backgroundColor: theme.surface,
      borderRadius: '16px',
      border: `1px solid ${theme.divider}`,
      padding: '16px',
      marginBottom: '20px'
    }}>
      <p style={{
        color: theme.muted,
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '12px',
        fontFamily: 'Montserrat, system-ui, sans-serif'
      }}>Venue Feed</p>

      {withinGeofence ? (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handlePost(); }}
            placeholder="Share what's happening here…"
            maxLength={1000}
            style={{
              flex: 1,
              backgroundColor: theme.pill,
              border: 'none',
              borderRadius: '9999px',
              padding: '10px 16px',
              fontSize: '14px',
              color: theme.text,
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}
          />
          <button
            onClick={handlePost}
            disabled={posting || !text.trim()}
            style={{
              backgroundColor: theme.accent,
              color: theme.onAccent,
              border: 'none',
              borderRadius: '9999px',
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: posting || !text.trim() ? 'default' : 'pointer',
              opacity: posting || !text.trim() ? 0.6 : 1,
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}
          >
            {posting ? 'Posting…' : 'Post'}
          </button>
        </div>
      ) : (
        <p style={{ color: theme.muted, fontSize: '13px', marginBottom: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          Get closer to this venue to post to its feed.
        </p>
      )}

      {error && (
        <p style={{ color: theme.accent2, fontSize: '12px', marginBottom: '10px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          {error}
        </p>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}>
          <span className="spinner" />
        </div>
      )}

      {!loading && items.length === 0 && (
        <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          Nothing posted here yet — be the first.
        </p>
      )}

      {!loading && items.map((item) => (
        <FeedPostCard key={item.id} item={item} dense />
      ))}
    </div>
  );
}
