'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Megaphone, Trash2 } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import {
  fetchMyVenue,
  fetchMyVenues,
  fetchVenue,
  fetchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '@/lib/data';
import { theme, radius, type as typeTokens } from '@/lib/theme';
import { Button, GlassPanel, SectionHeader } from '@/components/ui/primitives';
import type { Venue, VenueAnnouncement } from '@/lib/types';
import VenueSwitcher from '@/components/shared/VenueSwitcher';

const MAX_LENGTH = 200;
const font = typeTokens.family;

const DURATIONS: { key: string; label: string; hours: number | null }[] = [
  { key: 'none', label: 'Until I turn it off', hours: null },
  { key: '2', label: '2 hours', hours: 2 },
  { key: '6', label: '6 hours', hours: 6 },
  { key: '24', label: '24 hours', hours: 24 },
];

function isLive(a: VenueAnnouncement): boolean {
  return a.is_active && (!a.expires_at || new Date(a.expires_at).getTime() > Date.now());
}

function statusLabel(a: VenueAnnouncement): string {
  if (!a.is_active) return 'Hidden';
  if (a.expires_at && new Date(a.expires_at).getTime() <= Date.now()) return 'Expired';
  if (a.expires_at) {
    return `Live until ${new Date(a.expires_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
  }
  return 'Live';
}

export default function VenueAnnouncementsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: theme.muted, fontFamily: font }}>Loading...</p>
        </div>
      }
    >
      <VenueAnnouncementsPageInner />
    </Suspense>
  );
}

// Organizer tool, same shape as Manage Banners (app/main/venue/carousel):
// ?locationId= wins (admin panel links), otherwise the organizer's own
// venues with a switcher. Only venue managers get past the gate, and RLS
// (migration 0029) enforces the same rule on every write.
function VenueAnnouncementsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramLocationId = searchParams.get('locationId');

  const [myVenues, setMyVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(paramLocationId);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);
  const [announcements, setAnnouncements] = useState<VenueAnnouncement[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [body, setBody] = useState('');
  const [duration, setDuration] = useState('none');
  const [posting, setPosting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { canManage } = useIsOrganizer(venue?.id);

  useEffect(() => {
    if (paramLocationId) {
      setVenueLoading(true);
      fetchVenue(paramLocationId)
        .then(setVenue)
        .catch(() => setVenue(null))
        .finally(() => setVenueLoading(false));
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

  const load = useCallback((locationId: string) => {
    setListLoading(true);
    fetchAnnouncements(locationId)
      .then(setAnnouncements)
      .catch((err) => {
        console.error('Failed to load announcements:', err);
        setError("Couldn't load announcements. Reload the page to try again.");
      })
      .finally(() => setListLoading(false));
  }, []);

  useEffect(() => {
    if (venue) load(venue.id);
  }, [venue, load]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!venue || !body.trim() || posting) return;
    setPosting(true);
    setError(null);
    const hours = DURATIONS.find((d) => d.key === duration)?.hours ?? null;
    const expiresAt = hours ? new Date(Date.now() + hours * 3600e3).toISOString() : null;
    try {
      const created = await createAnnouncement(venue.id, body, expiresAt);
      setAnnouncements((prev) => [created, ...prev]);
      setBody('');
      setDuration('none');
    } catch (err) {
      console.error('Failed to post announcement:', err);
      setError("Couldn't post that announcement. Check your connection and try again.");
    } finally {
      setPosting(false);
    }
  };

  const handleToggle = async (a: VenueAnnouncement) => {
    setBusyId(a.id);
    setError(null);
    try {
      await updateAnnouncement(a.id, { is_active: !a.is_active });
      setAnnouncements((prev) => prev.map((x) => (x.id === a.id ? { ...x, is_active: !a.is_active } : x)));
    } catch (err) {
      console.error('Failed to update announcement:', err);
      setError("Couldn't update that announcement. Try again.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      await deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((x) => x.id !== id));
      setConfirmDeleteId(null);
    } catch (err) {
      console.error('Failed to delete announcement:', err);
      setError("Couldn't delete that announcement. Try again.");
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
          You&apos;re not authorized to post announcements for this venue.
        </p>
        <Link href="/main" style={{ color: theme.accent, fontFamily: font, fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>
          Back to app
        </Link>
      </div>
    );
  }

  const live = announcements.find(isLive) ?? null;
  const remaining = MAX_LENGTH - body.length;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, fontFamily: font }}>
      <div style={{
        padding: 16, paddingTop: 'max(16px, env(safe-area-inset-top))',
        display: 'flex', alignItems: 'center', borderBottom: `1px solid ${theme.divider}`,
      }}>
        <button
          onClick={() => router.push('/main')}
          aria-label="Back"
          style={{ width: 44, height: 44, marginLeft: -10, backgroundColor: 'transparent', border: 'none', borderRadius: radius.pill, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ChevronLeft style={{ width: 24, height: 24, color: theme.accent }} />
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: 20, fontWeight: 600, color: theme.text, margin: 0 }}>
          Announcements
        </h1>
        <div style={{ width: 44 }} />
      </div>

      <VenueSwitcher venues={myVenues} selectedId={selectedVenueId} onSelect={setSelectedVenueId} />

      <div style={{ padding: '20px 16px 48px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560, margin: '0 auto' }}>
        <p style={{ margin: 0, color: theme.muted, fontSize: typeTokens.body.fontSize }}>
          The newest live announcement shows at the top of Home for everyone checked in at {venue.name}.
        </p>

        <GlassPanel>
          <form onSubmit={handlePost} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label htmlFor="announcement-body" style={{ fontSize: typeTokens.label.fontSize, fontWeight: 600, color: theme.text }}>
              New announcement
            </label>
            <textarea
              id="announcement-body"
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_LENGTH))}
              placeholder="Happy hour until 9 — 2-for-1 on cocktails"
              rows={3}
              style={{
                fontFamily: font, fontSize: 16, color: theme.text, background: theme.surface2,
                border: `1px solid ${theme.divider}`, borderRadius: radius.control, padding: '12px 14px',
                resize: 'vertical', outline: 'none', width: '100%', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label htmlFor="announcement-duration" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: typeTokens.caption.fontSize, color: theme.muted }}>
                Show for
                <select
                  id="announcement-duration"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  style={{
                    fontFamily: font, fontSize: 14, color: theme.text, background: theme.surface2,
                    border: `1px solid ${theme.divider}`, borderRadius: radius.control, padding: '0 10px', minHeight: 44,
                  }}
                >
                  {DURATIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
                </select>
              </label>
              <span style={{ fontSize: typeTokens.caption.fontSize, color: remaining < 20 ? theme.accent2 : theme.muted, fontVariantNumeric: 'tabular-nums' }}>
                {remaining} left
              </span>
            </div>
            {live && body.trim() && (
              <p style={{ margin: 0, fontSize: typeTokens.caption.fontSize, color: theme.muted }}>
                Posting replaces &ldquo;{live.body.length > 40 ? `${live.body.slice(0, 40)}…` : live.body}&rdquo; at the top of Home.
              </p>
            )}
            <Button type="submit" fullWidth disabled={!body.trim() || posting} style={{ minHeight: 48 }}>
              {posting ? 'Posting…' : 'Post announcement'}
            </Button>
          </form>
        </GlassPanel>

        {error && (
          <p role="alert" style={{ margin: 0, color: theme.accent2, fontSize: typeTokens.caption.fontSize }}>{error}</p>
        )}

        <SectionHeader>Recent</SectionHeader>

        {listLoading ? (
          <p style={{ color: theme.muted, margin: 0 }}>Loading announcements…</p>
        ) : announcements.length === 0 ? (
          <div style={{ textAlign: 'center', color: theme.muted, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0' }}>
            <Megaphone size={28} />
            <p style={{ margin: 0 }}>No announcements yet. Your first one will show at the top of Home.</p>
          </div>
        ) : (
          <GlassPanel style={{ padding: '4px 16px' }}>
            {announcements.map((a, i) => {
              const isCurrent = live?.id === a.id;
              const expired = !!a.expires_at && new Date(a.expires_at).getTime() <= Date.now();
              return (
                <div key={a.id} style={{ padding: '12px 0', borderBottom: i < announcements.length - 1 ? `1px solid ${theme.divider}` : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                      padding: '3px 8px', borderRadius: radius.pill,
                      background: isCurrent ? theme.accent : theme.glassFill,
                      color: isCurrent ? theme.onAccent : theme.muted,
                      border: isCurrent ? 'none' : `1px solid ${theme.glassBorder}`,
                    }}>
                      {isCurrent ? 'On Home now' : statusLabel(a)}
                    </span>
                    <span style={{ fontSize: typeTokens.caption.fontSize, color: theme.muted }}>
                      {new Date(a.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: theme.text, fontSize: typeTokens.body.fontSize, wordBreak: 'break-word' }}>{a.body}</p>
                  {confirmDeleteId === a.id ? (
                    <div role="group" aria-label="Delete this announcement?" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: typeTokens.caption.fontSize, color: theme.text }}>Delete this announcement?</span>
                      <Button variant="ghost" onClick={() => handleDelete(a.id)} disabled={busyId === a.id} style={{ color: theme.accent2, minHeight: 44 }}>
                        {busyId === a.id ? 'Deleting…' : 'Delete'}
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmDeleteId(null)} disabled={busyId === a.id} style={{ minHeight: 44 }}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                      {!expired && (
                        <Button
                          variant="secondary"
                          onClick={() => handleToggle(a)}
                          disabled={busyId === a.id}
                          style={{ padding: '0 14px', minHeight: 44, fontSize: 13 }}
                        >
                          {a.is_active ? 'Hide' : 'Show again'}
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(a.id)}
                        aria-label="Delete announcement"
                        style={{ marginLeft: 'auto', width: 44, height: 44, border: 'none', background: 'none', color: theme.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </GlassPanel>
        )}
      </div>
    </div>
  );
}
