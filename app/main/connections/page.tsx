'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { fetchMyConnections, removeConnection, fetchContactMethods } from '@/lib/data';
import type { MyConnection, ContactMethod } from '@/lib/types';
import { theme, type as typeTokens, radius } from '@/lib/theme';
import ContactGrid from '@/components/connect/ContactGrid';

export default function ConnectionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<MyConnection[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [linksFor, setLinksFor] = useState<{ id: string; name: string } | null>(null);
  const [sheetMethods, setSheetMethods] = useState<ContactMethod[]>([]);

  const load = useCallback(() => {
    fetchMyConnections()
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (otherUserId: string) => {
    setBusyId(otherUserId);
    try {
      await removeConnection(otherUserId);
      setConfirmId(null);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const openLinks = (otherId: string, name: string) => {
    setLinksFor({ id: otherId, name });
    setSheetMethods([]);
    fetchContactMethods(otherId).then(setSheetMethods).catch(() => setSheetMethods([]));
  };

  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: theme.bg, color: theme.text, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 16px 12px' }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ background: 'none', border: 'none', color: theme.text, cursor: 'pointer', padding: 0, display: 'flex' }}>
          <ChevronLeft style={{ width: '24px', height: '24px' }} />
        </button>
        <h1 style={{ fontSize: '18px', fontWeight: 700 }}>My Connections</h1>
      </div>

      {rows === null ? (
        <p style={{ color: theme.muted, fontSize: '13px', padding: '24px 20px' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: theme.muted, fontSize: '14px', padding: '24px 20px', lineHeight: 1.5 }}>
          You haven&apos;t connected with anyone yet. Show your code from the home screen, or scan someone else&apos;s.
        </p>
      ) : (
        <div style={{ padding: '4px 12px 40px' }}>
          {rows.map((r) => (
            <div
              key={r.other_user_id}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px', borderBottom: `1px solid ${theme.divider}`,
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '9999px', backgroundColor: theme.surface2, flexShrink: 0, overflow: 'hidden' }}>
                {r.avatar_url && <img src={r.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.display_name ?? 'Someone'}
                </div>
                <div style={{ color: theme.muted, fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.place_label
                    ? `Connected near ${r.place_label}${fmtDate(r.scanned_at) ? ` · ${fmtDate(r.scanned_at)}` : ''}`
                    : fmtDate(r.scanned_at)
                      ? `Connected · ${fmtDate(r.scanned_at)}`
                      : 'Connected'}
                </div>
              </div>
              {confirmId === r.other_user_id ? (
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    onClick={() => remove(r.other_user_id)}
                    disabled={busyId === r.other_user_id}
                    style={{ background: theme.accent2, color: 'white', border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {busyId === r.other_user_id ? '…' : 'Remove'}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    style={{ background: theme.surface2, color: theme.text, border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button
                    onClick={() => openLinks(r.other_user_id, r.display_name ?? 'Someone')}
                    style={{ background: 'none', border: 'none', color: theme.accent, fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Links
                  </button>
                  <button
                    onClick={() => setConfirmId(r.other_user_id)}
                    style={{ background: 'none', border: `1px solid ${theme.divider}`, color: theme.muted, borderRadius: '8px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {linksFor && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', zIndex: 60 }}
          onClick={() => setLinksFor(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', backgroundColor: theme.bg, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet,
              padding: '20px 20px max(20px, env(safe-area-inset-bottom))', fontFamily: typeTokens.family,
            }}
          >
            <h3 style={{ fontSize: typeTokens.heading.fontSize, fontWeight: 700, color: theme.text, marginBottom: 12 }}>
              {linksFor.name}&apos;s links
            </h3>
            {sheetMethods.some((m) => m.is_enabled && (m.value ?? '').trim() !== '') ? (
              <ContactGrid methods={sheetMethods} mode="readonly" />
            ) : (
              <p style={{ color: theme.muted, fontSize: typeTokens.body.fontSize }}>No shared links yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
