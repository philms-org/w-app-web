'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { fetchBadges, fetchMyBadgeIds, recomputeMyBadges, fetchMyActivityWords } from '@/lib/data';
import type { Badge } from '@/lib/types';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Chip } from '@/components/ui/primitives';
import BadgeTile from '@/components/profile/BadgeTile';

const SNAP_KEY = 'w_badges_snapshot';

export default function BadgesPage() {
  const router = useRouter();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earned, setEarned] = useState<Set<string>>(new Set());
  const [words, setWords] = useState<string[]>([]);
  const [toast, setToast] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try { await recomputeMyBadges(); } catch { /* best-effort */ }
      try {
        const [cat, mine, w] = await Promise.all([fetchBadges(), fetchMyBadgeIds(), fetchMyActivityWords()]);
        if (cancelled) return;
        setBadges(cat);
        setWords(w);
        const set = new Set(mine);
        setEarned(set);
        try {
          const prev = new Set(JSON.parse(sessionStorage.getItem(SNAP_KEY) ?? '[]') as string[]);
          if (prev.size > 0 && [...set].some((id) => !prev.has(id))) {
            setToast(true);
            setTimeout(() => setToast(false), 2500);
          }
          sessionStorage.setItem(SNAP_KEY, JSON.stringify([...set]));
        } catch { /* sessionStorage unavailable */ }
      } catch (e) {
        console.error('Failed to load badges:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const sorted = useMemo(
    () => [...badges].sort((a, b) => {
      const ea = earned.has(a.id) ? 0 : 1;
      const eb = earned.has(b.id) ? 0 : 1;
      return ea - eb || a.sort_order - b.sort_order;
    }),
    [badges, earned],
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: typeTokens.family }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ padding: 8, marginLeft: -8, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
          <ChevronLeft style={{ width: 24, height: 24, color: theme.text }} />
        </button>
        <h1 style={{ fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text }}>Badges</h1>
      </div>

      <div style={{ padding: '8px 20px 40px', maxWidth: 480, margin: '0 auto' }}>
        {words.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <p style={{ color: theme.muted, fontSize: typeTokens.caption.fontSize, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 8 }}>
              Your words
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {words.map((w) => <Chip key={w}>{w}</Chip>)}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          {sorted.map((b) => <BadgeTile key={b.id} badge={b} earned={earned.has(b.id)} />)}
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 24, display: 'flex', justifyContent: 'center', zIndex: 60 }}>
          <div style={{
            backgroundColor: theme.accent, color: '#0D0D0F', fontWeight: 700,
            fontSize: typeTokens.label.fontSize, padding: '10px 18px', borderRadius: radius.pill,
            fontFamily: typeTokens.family,
          }}>
            New badge earned!
          </div>
        </div>
      )}
    </div>
  );
}
