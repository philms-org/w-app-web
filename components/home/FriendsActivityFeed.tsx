'use client';

import { useEffect, useState } from 'react';
import { theme } from '@/lib/theme';
import { Users, Lock } from 'lucide-react';
import FeedBlurBackdrop from '@/components/shared/FeedBlurBackdrop';
import { fetchMyConnectionCount, fetchFriendsActivity } from '@/lib/data';
import type { FriendActivityEntry } from '@/lib/types';

const REQUIRED_CONNECTIONS = 3;

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
        if (n >= REQUIRED_CONNECTIONS) return fetchFriendsActivity();
        return [];
      })
      .then((rows) => { if (!cancelled && rows) setEntries(rows); })
      .catch(() => { if (!cancelled) setCount(0); });
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
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            marginTop: '10px', color: theme.muted, fontSize: '12px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}>
            <Users style={{ width: '14px', height: '14px' }} />
            {count ?? 0} / {REQUIRED_CONNECTIONS} connections
          </div>
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
          <div
            key={`${e.user_id}-${e.checked_in_at}`}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0' }}
          >
            <div style={{
              width: '36px', height: '36px', borderRadius: '9999px',
              backgroundColor: theme.surface2, flexShrink: 0, overflow: 'hidden',
            }}>
              {e.avatar_url && (
                <img src={e.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: theme.text, fontSize: '14px', fontWeight: 600 }}>
                {e.name ?? 'Someone'}
              </div>
              <div style={{ color: theme.muted, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {e.is_active ? 'At' : 'Was at'} {e.venue_name}
              </div>
            </div>
            {e.is_active && (
              <span style={{ width: '8px', height: '8px', borderRadius: '9999px', backgroundColor: theme.green, flexShrink: 0 }} />
            )}
          </div>
        ))
      )}
    </div>
  );
}
