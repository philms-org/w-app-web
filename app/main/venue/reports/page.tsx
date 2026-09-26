'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import {
  fetchMyVenue,
  fetchMyVenues,
  fetchVenue,
  fetchVenueReports,
  resolveVenueReport,
  deleteVenuePost,
  deletePostComment,
} from '@/lib/data';
import { theme, radius, type as typeTokens } from '@/lib/theme';
import { GlassPanel, SectionHeader } from '@/components/ui/primitives';
import VenueSwitcher from '@/components/shared/VenueSwitcher';
import type { Venue, VenueReport } from '@/lib/types';

const font = typeTokens.family;
const REASON_LABEL: Record<VenueReport['reason'], string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  inappropriate: 'Inappropriate',
  other: 'Something else',
};

export default function VenueReportsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: theme.muted, fontFamily: font }}>Loading...</p>
        </div>
      }
    >
      <VenueReportsPageInner />
    </Suspense>
  );
}

// Organizer moderation for the venue feed: reports people filed on posts and
// comments at this venue. Remove the content (and close the report) or keep
// it and dismiss. Venue managers only; RLS + the resolve RPC (migration
// 0030) enforce the same rule server-side.
function VenueReportsPageInner() {
  const router = useRouter();
  const paramLocationId = useSearchParams().get('locationId');

  const [myVenues, setMyVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(paramLocationId);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);
  const [status, setStatus] = useState<'open' | 'resolved'>('open');
  const [reports, setReports] = useState<VenueReport[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { canManage } = useIsOrganizer(venue?.id);

  useEffect(() => {
    if (paramLocationId) {
      setVenueLoading(true);
      fetchVenue(paramLocationId).then(setVenue).catch(() => setVenue(null)).finally(() => setVenueLoading(false));
      return;
    }
    setVenueLoading(true);
    fetchMyVenues()
      .then((venues) => {
        setMyVenues(venues);
        setSelectedVenueId((current) => current ?? venues[0]?.id ?? null);
        if (venues.length === 0) setVenue(null);
      })
      .catch(() => fetchMyVenue().then(setVenue).catch(() => setVenue(null)))
      .finally(() => setVenueLoading(false));
  }, [paramLocationId]);

  useEffect(() => {
    if (paramLocationId || !selectedVenueId) return;
    fetchVenue(selectedVenueId).then(setVenue).catch(() => setVenue(null));
  }, [selectedVenueId, paramLocationId]);

  const load = useCallback(() => {
    if (!venue) return;
    setReports(null);
    fetchVenueReports(venue.id, status)
      .then(setReports)
      .catch((err) => {
        console.error('Failed to load reports:', err);
        setReports([]);
        setError("Couldn't load reports. Reload the page to try again.");
      });
  }, [venue, status]);

  useEffect(() => { load(); }, [load]);

  const act = async (r: VenueReport, removeContent: boolean) => {
    setBusyId(r.id);
    setError(null);
    try {
      if (removeContent && r.target_body != null) {
        if (r.target_type === 'post') await deleteVenuePost(r.target_id);
        else await deletePostComment(r.target_id);
      }
      await resolveVenueReport(r.id);
      setReports((prev) => (prev ?? []).filter((x) => x.id !== r.id));
    } catch (err) {
      console.error('Failed to act on report:', err);
      setError("Couldn't update that report. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  if (venueLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: theme.muted, fontFamily: font }}>Loading...</p>
      </div>
    );
  }

  if (!venue || !canManage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <p style={{ color: theme.text, fontFamily: font, fontSize: 16, textAlign: 'center' }}>
          You&apos;re not authorized to review this venue&apos;s reports.
        </p>
        <Link href="/main" style={{ color: theme.accent, fontFamily: font, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          Back to app
        </Link>
      </div>
    );
  }

  const tab = (key: 'open' | 'resolved', label: string) => (
    <button
      type="button"
      onClick={() => setStatus(key)}
      aria-pressed={status === key}
      style={{
        flex: 1, minHeight: 44, border: 'none', borderRadius: 10, fontFamily: font, fontWeight: 600, fontSize: 14, cursor: 'pointer',
        background: status === key ? theme.accent : 'transparent', color: status === key ? theme.onAccent : theme.muted,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: font }}>
      <div style={{ padding: 16, paddingTop: 'max(16px, env(safe-area-inset-top))', display: 'flex', alignItems: 'center', borderBottom: `1px solid ${theme.divider}` }}>
        <button
          onClick={() => router.push('/main')}
          aria-label="Back"
          style={{ width: 44, height: 44, marginLeft: -10, backgroundColor: 'transparent', border: 'none', borderRadius: radius.pill, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft style={{ width: 24, height: 24, color: theme.accent }} />
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: 600, color: theme.text, margin: 0 }}>Reports</h1>
        <div style={{ width: 44 }} />
      </div>

      <VenueSwitcher venues={myVenues} selectedId={selectedVenueId} onSelect={setSelectedVenueId} />

      <div style={{ padding: '20px 16px 48px', maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, color: theme.muted, fontSize: typeTokens.body.fontSize }}>
          Posts and comments people at {venue.name} flagged for you to review.
        </p>

        <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 12, background: theme.glassFill, border: `1px solid ${theme.glassBorder}` }}>
          {tab('open', 'Needs review')}
          {tab('resolved', 'Resolved')}
        </div>

        {error && <p role="alert" style={{ margin: 0, color: theme.accent2, fontSize: typeTokens.caption.fontSize }}>{error}</p>}

        {reports === null ? (
          <p style={{ margin: 0, color: theme.muted }}>Loading reports…</p>
        ) : reports.length === 0 ? (
          <div style={{ textAlign: 'center', color: theme.muted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0' }}>
            <ShieldCheck size={28} />
            <p style={{ margin: 0 }}>{status === 'open' ? 'Nothing to review right now.' : 'No resolved reports yet.'}</p>
          </div>
        ) : (
          <>
            <SectionHeader>{status === 'open' ? `${reports.length} to review` : 'Resolved'}</SectionHeader>
            {reports.map((r) => {
              const gone = r.target_body == null;
              return (
                <GlassPanel key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                      padding: '3px 8px', borderRadius: radius.pill, background: theme.glassFill, border: `1px solid ${theme.glassBorder}`, color: theme.text,
                    }}>
                      {REASON_LABEL[r.reason]}
                    </span>
                    <span style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted }}>
                      {r.target_type === 'post' ? 'Post' : 'Comment'} · {new Date(r.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  {gone ? (
                    <p style={{ margin: 0, color: theme.muted, fontStyle: 'italic' }}>This {r.target_type} has already been deleted.</p>
                  ) : (
                    <blockquote style={{ margin: 0, paddingLeft: 12, borderLeft: `2px solid ${theme.glassBorder}` }}>
                      <p style={{ margin: 0, color: theme.text, wordBreak: 'break-word' }}>{r.target_body}</p>
                      {r.target_author && (
                        <p style={{ margin: '4px 0 0', fontSize: typeTokens.caption.fontSize, color: theme.muted }}>by {r.target_author}</p>
                      )}
                    </blockquote>
                  )}
                  {r.details && (
                    <p style={{ margin: 0, fontSize: typeTokens.caption.fontSize, color: theme.muted }}>
                      Reporter&apos;s note: {r.details}
                    </p>
                  )}
                  {status === 'open' && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {!gone && (
                        <button
                          type="button"
                          onClick={() => act(r, true)}
                          disabled={busyId === r.id}
                          style={{
                            minHeight: 44, padding: '0 16px', borderRadius: radius.control, border: 'none', cursor: 'pointer',
                            background: theme.accent, color: theme.onAccent, fontFamily: font, fontWeight: 700, fontSize: 14,
                          }}
                        >
                          Remove {r.target_type}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => act(r, false)}
                        disabled={busyId === r.id}
                        style={{
                          minHeight: 44, padding: '0 16px', borderRadius: radius.control, cursor: 'pointer',
                          background: theme.glassFill, border: `1px solid ${theme.glassBorder}`, color: theme.text,
                          fontFamily: font, fontWeight: 600, fontSize: 14,
                        }}
                      >
                        {gone ? 'Close report' : 'Keep it, dismiss report'}
                      </button>
                    </div>
                  )}
                </GlassPanel>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
