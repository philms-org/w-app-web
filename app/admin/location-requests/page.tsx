'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { fetchLocationRequests, approveLocationRequest, rejectLocationRequest } from '@/lib/data';
import type { LocationRequest } from '@/lib/types';
import { theme } from '@/lib/theme';

export default function LocationRequestsPage() {
  const [requests, setRequests] = useState<LocationRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(() => {
    fetchLocationRequests('pending')
      .then(setRequests)
      .catch((err) => {
        console.error('Failed to load location requests:', err);
        setError("Couldn't load requests.");
        setRequests([]);
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await approveLocationRequest(id);
      load();
    } catch (err) {
      console.error('Failed to approve request:', err);
      setError("Couldn't approve — try again.");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await rejectLocationRequest(id, rejectReason.trim() || undefined);
      setRejectingId(null);
      setRejectReason('');
      load();
    } catch (err) {
      console.error('Failed to reject request:', err);
      setError("Couldn't reject — try again.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <div style={{
        backgroundColor: theme.bg,
        padding: '16px 20px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        borderBottom: `1px solid ${theme.divider}`,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <Link href="/admin" style={{ color: theme.text, display: 'flex' }}>
          <ChevronLeft style={{ width: '24px', height: '24px' }} />
        </Link>
        <h1 style={{
          fontSize: '20px',
          fontWeight: 600,
          color: theme.text,
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}>Location Requests</h1>
      </div>

      <div style={{ padding: '20px' }}>
        {error && (
          <p style={{ color: theme.accent2, fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {error}
          </p>
        )}

        {requests === null ? (
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading…</p>
        ) : requests.length === 0 ? (
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>No pending requests.</p>
        ) : (
          requests.map((r) => (
            <div
              key={r.id}
              style={{
                backgroundColor: theme.surface,
                border: `1px solid ${theme.divider}`,
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px',
              }}
            >
              <h3 style={{ color: theme.text, fontSize: '16px', fontWeight: 700, marginBottom: '4px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                {r.name}
              </h3>
              {r.description && (
                <p style={{ color: theme.muted, fontSize: '13px', marginBottom: '8px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                  {r.description}
                </p>
              )}
              <p style={{ color: theme.muted, fontSize: '12px', marginBottom: '12px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                Requested by {r.profiles?.display_name ?? 'someone'} · {new Date(r.created_at).toLocaleDateString()} · {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
              </p>

              {rejectingId === r.id ? (
                <div>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Reason (optional)"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      backgroundColor: theme.surface2,
                      border: `1px solid ${theme.divider}`,
                      borderRadius: '8px',
                      color: theme.text,
                      fontSize: '13px',
                      marginBottom: '10px',
                      fontFamily: 'Montserrat, system-ui, sans-serif',
                      boxSizing: 'border-box',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => reject(r.id)}
                      disabled={busyId === r.id}
                      style={{ background: theme.accent2, color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {busyId === r.id ? '…' : 'Confirm Reject'}
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectReason(''); }}
                      style={{ background: theme.surface2, color: theme.text, border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => approve(r.id)}
                    disabled={busyId === r.id}
                    style={{ background: theme.accent, color: 'white', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    {busyId === r.id ? '…' : 'Approve'}
                  </button>
                  <button
                    onClick={() => setRejectingId(r.id)}
                    disabled={busyId === r.id}
                    style={{ background: 'none', border: `1px solid ${theme.divider}`, color: theme.muted, borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
