'use client';

import { useEffect, useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import { theme } from '@/lib/theme';
import { FeedRow } from '@/components/ui/primitives';
import { fetchMyConnectionCount, fetchFriendsActivity } from '@/lib/data';
import type { FriendActivityEntry } from '@/lib/types';

const REQUIRED_CONNECTIONS = 3;
const FONT = 'Montserrat, system-ui, sans-serif';
// Neon-blue lock from the founder's Home mock.
const LOCK_GLOW = '#38BDF8';
// Illustrative blurred "people" behind the lock — no real data, just a tease
// of who's around once unlocked. Avatar tints + name bar widths.
const TEASE_ROWS = [
  { tint: '#C9A89A', name: '46%' },
  { tint: '#4F6A8F', name: '38%' },
  { tint: '#7A4B63', name: '52%' },
  { tint: '#3E7CA8', name: '42%' },
];

const fmtShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// The people-discovery area at the bottom of Home ("the main feed"). Locked
// until you have REQUIRED_CONNECTIONS connections: a large blurred card
// teasing who else is present, per the founder's mock (2026-09-30).
export default function FriendsActivityFeed({ onAddFriends }: { onAddFriends?: () => void }) {
  const [count, setCount] = useState<number | null>(null);
  const [entries, setEntries] = useState<FriendActivityEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchMyConnectionCount()
      .then((n) => {
        if (cancelled) return;
        setCount(n);
        // Only spend a query on activity once the gate is actually open.
        if (n < REQUIRED_CONNECTIONS) return;
        fetchFriendsActivity()
          .then((rows) => { if (!cancelled) setEntries(rows); })
          .catch((err) => console.error('Failed to load friends activity:', err));
      })
      .catch((err) => {
        console.error('Failed to load connection count:', err);
        if (!cancelled) setCount(0);
      });
    return () => { cancelled = true; };
  }, []);

  const unlocked = count !== null && count >= REQUIRED_CONNECTIONS;

  if (!unlocked) {
    return (
      <section
        aria-label="Who's near"
        style={{
          position: 'relative', margin: '0 16px 20px', minHeight: 380, borderRadius: 40,
          border: `2px solid ${theme.glassHighlight}`, backgroundColor: '#050506', overflow: 'hidden',
          fontFamily: FONT,
        }}
      >
        <div aria-hidden style={{
          position: 'absolute', inset: 0, padding: '24px 28px', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-around', filter: 'blur(9px)', opacity: 0.85, pointerEvents: 'none',
        }}>
          {TEASE_ROWS.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 64, height: 64, borderRadius: 999, backgroundColor: r.tint, flexShrink: 0 }} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ width: r.name, height: 14, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.35)' }} />
                <div style={{ width: '30%', height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.2)' }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{
          position: 'relative', minHeight: 380, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 8, padding: '24px', textAlign: 'center',
          background: 'radial-gradient(closest-side, rgba(5,5,6,0.75), rgba(5,5,6,0.15))',
        }}>
          <Lock aria-hidden style={{
            width: 44, height: 44, color: LOCK_GLOW, marginBottom: 6,
            filter: `drop-shadow(0 0 8px ${LOCK_GLOW})`,
          }} />
          <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>Unlock who&apos;s near</h3>
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15, lineHeight: 1.4, margin: 0, maxWidth: 260 }}>
            Finish setting up your friends to unlock who&apos;s close by.
          </p>
          {onAddFriends && (
            <button
              onClick={onAddFriends}
              aria-label="Add friends"
              style={{
                marginTop: 10, width: 52, height: 52, borderRadius: 999, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.9)',
              }}
            >
              <Plus style={{ width: 26, height: 26, color: '#fff' }} strokeWidth={3} />
            </button>
          )}
          {count !== null && (
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, margin: '4px 0 0' }}>
              {count} / {REQUIRED_CONNECTIONS} friends
            </p>
          )}
        </div>
      </section>
    );
  }

  return (
    <div style={{
      borderRadius: '16px', margin: '0 20px 20px', backgroundColor: theme.surface,
      border: `1px solid ${theme.divider}`, padding: '18px 20px',
      fontFamily: FONT,
    }}>
      <h3 style={{ color: theme.text, fontSize: '16px', fontWeight: 700, marginBottom: '14px' }}>
        Friends&apos; activity
      </h3>

      {entries.length === 0 ? (
        <p style={{ color: theme.muted, fontSize: '13px' }}>
          No recent activity from your connections yet.
        </p>
      ) : (
        entries.map((e) => (
          <FeedRow
            key={`${e.user_id}-${e.checked_in_at}`}
            style={{ background: 'transparent', padding: '10px 0' }}
            avatar={
              e.avatar_url ?? (
                <div style={{ width: 40, height: 40, borderRadius: 999, backgroundColor: theme.surface2 }} />
              )
            }
            title={e.name ?? 'Someone'}
            subtitle={`${e.is_active ? 'At' : 'Was at'} ${e.venue_name} · ${fmtShortDate(e.checked_in_at)}`}
            trailing={
              e.is_active ? (
                <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: theme.green, display: 'block' }} />
              ) : undefined
            }
          />
        ))
      )}
    </div>
  );
}
