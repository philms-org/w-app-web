'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import {
  fetchActivityMenu,
  createActivityMenuItem,
  updateActivityMenuItem,
  deleteActivityMenuItem,
} from '@/lib/data';
import type { ActivityMenuItem } from '@/lib/types';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import { Button, Input } from '@/components/ui/primitives';

function Inner() {
  const router = useRouter();
  const locationId = useSearchParams().get('locationId') ?? '';
  const { canManage } = useIsOrganizer(locationId || null);

  const [items, setItems] = useState<ActivityMenuItem[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!locationId) return;
    fetchActivityMenu(locationId).then(setItems).catch((e) => console.error('Failed to load activity menu:', e));
  }, [locationId]);

  useEffect(() => { load(); }, [load]);

  const sorted = useMemo(() => [...items].sort((a, b) => a.sort_order - b.sort_order), [items]);

  const add = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setBusy(true);
    try {
      const nextOrder = sorted.length ? sorted[sorted.length - 1].sort_order + 1 : 0;
      await createActivityMenuItem(locationId, label, nextOrder);
      setNewLabel('');
      load();
    } finally {
      setBusy(false);
    }
  };

  const move = async (item: ActivityMenuItem, dir: -1 | 1) => {
    const idx = sorted.findIndex((i) => i.id === item.id);
    const other = sorted[idx + dir];
    if (!other) return;
    setBusy(true);
    try {
      await Promise.all([
        updateActivityMenuItem(item.id, { sort_order: other.sort_order }),
        updateActivityMenuItem(other.id, { sort_order: item.sort_order }),
      ]);
      load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await deleteActivityMenuItem(id);
      load();
    } finally {
      setBusy(false);
    }
  };

  if (locationId && !canManage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: typeTokens.family }}>
        <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize }}>
          You&apos;re not authorized to manage this venue&apos;s activity menu.
        </p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: typeTokens.family }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ padding: 8, marginLeft: -8, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
          <ChevronLeft style={{ width: 24, height: 24, color: theme.text }} />
        </button>
        <h1 style={{ fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text }}>Activity menu</h1>
      </div>

      <div style={{ padding: '8px 20px 40px', maxWidth: 480, margin: '0 auto' }}>
        <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize, marginBottom: 16 }}>
          Words checked-in guests can pick from — what they&apos;re here for, what they do, what they want to talk about.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {sorted.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: theme.surface, border: `1px solid ${theme.divider}`, borderRadius: radius.control, padding: '10px 12px' }}>
              <span style={{ flex: 1, color: theme.text, fontSize: typeTokens.body.fontSize }}>{item.label}</span>
              <button onClick={() => move(item, -1)} disabled={busy || i === 0} aria-label="Move up" style={{ background: theme.surface2, border: 'none', borderRadius: '9999px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: busy || i === 0 ? 'default' : 'pointer', opacity: i === 0 ? 0.4 : 1 }}>
                <ArrowUp style={{ width: 14, height: 14, color: theme.text }} />
              </button>
              <button onClick={() => move(item, 1)} disabled={busy || i === sorted.length - 1} aria-label="Move down" style={{ background: theme.surface2, border: 'none', borderRadius: '9999px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: busy || i === sorted.length - 1 ? 'default' : 'pointer', opacity: i === sorted.length - 1 ? 0.4 : 1 }}>
                <ArrowDown style={{ width: 14, height: 14, color: theme.text }} />
              </button>
              <button onClick={() => remove(item.id)} disabled={busy} aria-label="Delete" style={{ background: 'transparent', border: 'none', borderRadius: '9999px', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: busy ? 'default' : 'pointer' }}>
                <Trash2 style={{ width: 14, height: 14, color: theme.accent2 }} />
              </button>
            </div>
          ))}
          {sorted.length === 0 && (
            <p style={{ color: theme.muted, fontSize: typeTokens.caption.fontSize }}>No words yet — add a few below.</p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Networking, Live music, First-timer" />
          </div>
          <Button onClick={add} disabled={busy || !newLabel.trim()}>Add</Button>
        </div>
      </div>
    </div>
  );
}

export default function VenueActivitiesPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
