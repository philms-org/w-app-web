'use client';

import { useEffect, useState } from 'react';
import { theme } from '@/lib/theme';
import { Users, Lock } from 'lucide-react';
import FeedBlurBackdrop from '@/components/shared/FeedBlurBackdrop';
import { FeedRow } from '@/components/ui/primitives';
import { fetchMyConnectionCount, fetchFriendsActivity } from '@/lib/data';
import type { FriendActivityEntry } from '@/lib/types';

const REQUIRED_CONNECTIONS = 3;

const fmtShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

export default function FriendsActivityFeed() {
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
      <div style={{
        position: 'relative', borderRadius: '16px', overflow: 'hidden',
        margin: '0 20px 20px', backgroundColor: theme.surface,
        border: `1px solid ${theme.divider}`, minHeight: '180px',
      }}>
        <FeedBlurBackdrop />
        <div style={{
          position: 'relative',
          background: `linear-gradient(180deg, transparent 0%, ${theme.bg} 85%)`,
          padding: '24px 20px', textAlign: 'center',
        }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '9999px',
            backgroundColor: theme.premium1, display: 'flex',
            alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
          }}>
            <Lock style={{ width: '22px', height: '22px', color: 'white' }} />
          </div>
          <h3 style={{
            color: theme.text, fontSize: '16px', fontWeight: 700, marginBottom: '6px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}>
            Add friends to see where they&apos;ve been
          </h3>
          {count !== null && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              marginTop: '10px', color: theme.muted, fontSize: '12px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
            }}>
              <Users style={{ width: '14px', height: '14px' }} />
              {count} / {REQUIRED_CONNECTIONS} connections
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: '16px', margin: '0 20px 20px', backgroundColor: theme.surface,
      border: `1px solid ${theme.divider}`, padding: '18px 20px',
      fontFamily: 'Montserrat, system-ui, sans-serif',
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
