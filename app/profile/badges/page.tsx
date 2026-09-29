'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, BadgeCheck } from 'lucide-react';
import { fetchMyRoleBadges, fetchMyActivityWords } from '@/lib/data';
import type { RoleBadge } from '@/lib/types';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Chip, SectionHeader } from '@/components/ui/primitives';
import RolePass from '@/components/profile/RolePass';

// Badges are the roles organizers have approved you for at venues and events
// (verification tags: Staff, Judge, Musician...), newest first. They're
// granted by the venue, not earned automatically, so there is no locked
// catalog to show here.
export default function BadgesPage() {
  const router = useRouter();
  const [badges, setBadges] = useState<RoleBadge[] | null>(null);
  const [words, setWords] = useState<string[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchMyRoleBadges(), fetchMyActivityWords().catch(() => [])])
      .then(([b, w]) => {
        if (cancelled) return;
        setBadges(b);
        setWords(w);
      })
      .catch((e) => {
        console.error('Failed to load badges:', e);
        if (!cancelled) { setBadges([]); setError(true); }
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: typeTokens.family }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 16px', paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <button
          onClick={() => router.back()}
          aria-label="Back"
          style={{ width: 44, height: 44, marginLeft: -10, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill }}
        >
          <ChevronLeft style={{ width: 24, height: 24, color: theme.text }} />
        </button>
        <h1 style={{ margin: 0, fontSize: typeTokens.title.fontSize, fontWeight: 800, color: theme.text }}>Badges</h1>
      </div>

      <div style={{ padding: '4px 16px 48px', maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, color: theme.muted, fontSize: typeTokens.body.fontSize }}>
          Roles organizers have approved you for at their venues and events.
        </p>

        {error && (
          <p role="alert" style={{ margin: 0, color: theme.accent2, fontSize: typeTokens.caption.fontSize }}>
            Couldn&apos;t load your badges. Reload the page to try again.
          </p>
        )}

        {badges === null ? (
          <p style={{ margin: 0, color: theme.muted }}>Loading…</p>
        ) : badges.length === 0 ? (
          <div style={{
            border: `1.5px dashed ${theme.glassBorder}`, borderRadius: 20, padding: '28px 20px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center',
          }}>
            <BadgeCheck size={32} color={theme.muted} />
            <p style={{ margin: 0, color: theme.text, fontWeight: 700 }}>No badges yet</p>
            <p style={{ margin: 0, color: theme.muted, fontSize: typeTokens.caption.fontSize, maxWidth: 280 }}>
              When an organizer approves you for a role at an event, like Staff, Judge or Performer, your credential shows up here.
            </p>
          </div>
        ) : (
          badges.map((b) => <RolePass key={b.id} badge={b} />)
        )}

        {words.length > 0 && (
          <>
            <SectionHeader style={{ marginTop: 16 }}>Your words</SectionHeader>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {words.map((w) => <Chip key={w}>{w}</Chip>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
