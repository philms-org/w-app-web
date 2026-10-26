'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useStore } from '@/lib/store';
import { fetchContactMethods, upsertContactMethod } from '@/lib/data';
import type { ContactMethod } from '@/lib/types';
import { theme, type as typeTokens } from '@/lib/theme';
import ContactGrid from '@/components/connect/ContactGrid';
import EditLinkSheet from '@/components/connect/EditLinkSheet';

export default function MyLinksPage() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const [methods, setMethods] = useState<ContactMethod[]>([]);
  const [editSlot, setEditSlot] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!user?.id) return;
    fetchContactMethods(user.id)
      .then(setMethods)
      .catch((err) => console.error('Failed to load contact methods:', err));
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const existing = editSlot === null ? null : methods.find((m) => m.slot_order === editSlot) ?? null;

  const handleSave = async (patch: { slot_order: number; type: string; value: string; is_enabled: boolean }) => {
    if (!user?.id) return;
    await upsertContactMethod({
      user_id: user.id,
      ...(existing?.id ? { id: existing.id } : {}),
      slot_order: patch.slot_order,
      type: patch.type,
      value: patch.value || null,
      is_enabled: patch.is_enabled,
    });
    load();
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: typeTokens.family }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px', paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ padding: 8, marginLeft: -8, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex' }}>
          <ChevronLeft style={{ width: 24, height: 24, color: theme.text }} />
        </button>
        <h1 style={{ fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text }}>My links</h1>
      </div>

      <div style={{ padding: '8px 20px 40px', maxWidth: 480, margin: '0 auto' }}>
        <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize, marginBottom: 20 }}>
          The six ways people can reach you after you connect. Turn any of them off to hide it.
        </p>
        <ContactGrid methods={methods} mode="edit" onSlotClick={setEditSlot} />
      </div>

      {editSlot !== null && (
        <EditLinkSheet
          slotOrder={editSlot}
          existing={existing}
          onSave={handleSave}
          onClose={() => setEditSlot(null)}
        />
      )}
    </div>
  );
}
