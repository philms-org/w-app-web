'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { fetchMyConnections, removeConnection } from '@/lib/data';
import type { MyConnection } from '@/lib/types';
import { theme } from '@/lib/theme';

export default function ConnectionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<MyConnection[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
                <button
                  onClick={() => setConfirmId(r.other_user_id)}
                  style={{ background: 'none', border: `1px solid ${theme.divider}`, color: theme.muted, borderRadius: '8px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer', flexShrink: 0 }}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
