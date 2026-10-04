'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Megaphone, UserX, Users } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { fetchMyVenue, fetchMyVenues, fetchVenue, fetchVenueMembers, fetchRewards, highestEarnedTier, fetchVenueAnnouncerIds, setVenueAnnouncer, fetchLocationManagers, fetchVenueRemovals, removeFromVenue, restoreToVenue, type VenueRemoval } from '@/lib/data';
import { useStore } from '@/lib/store';
import { theme } from '@/lib/theme';
import type { Venue, VenueMember, Reward } from '@/lib/types';
import VenueSwitcher from '@/components/shared/VenueSwitcher';
import TagBadge from '@/components/shared/TagBadge';

export default function VenueMembersPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
        </div>
      }
    >
      <VenueMembersPageInner />
    </Suspense>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function VenueMembersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramLocationId = searchParams.get('locationId');

  const [myVenues, setMyVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(paramLocationId);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);
  const [members, setMembers] = useState<VenueMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [tierRewards, setTierRewards] = useState<Reward[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const { canManage, isMasterAdmin } = useIsOrganizer(venue?.id);
  const { user } = useStore();
  // Governance: only the venue's primary owner or a master admin can grant the
  // announcer role (RLS, migration 0031). Announcers' feed posts become
  // announcements.
  const canGovern = isMasterAdmin || (!!user && venue?.owner_id === user.id);
  const [announcerIds, setAnnouncerIds] = useState<Set<string>>(new Set());
  const [announcerBusy, setAnnouncerBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!venue) return;
    fetchVenueAnnouncerIds(venue.id)
      .then(setAnnouncerIds)
      .catch((err) => console.error('Failed to load announcers:', err));
  }, [venue]);

  const toggleAnnouncer = async (userId: string) => {
    if (!venue) return;
    const on = !announcerIds.has(userId);
    setAnnouncerBusy(userId);
    try {
      await setVenueAnnouncer(venue.id, userId, on);
      setAnnouncerIds((prev) => {
        const next = new Set(prev);
        if (on) next.add(userId); else next.delete(userId);
        return next;
      });
    } catch (err) {
      console.error('Failed to update announcer:', err);
      setError("Couldn't update the announcer role. Try again.");
    } finally {
      setAnnouncerBusy(null);
    }
  };

  // Removing someone (migration 0041): any venue manager can, but never the
  // owner, a co-owner or themselves (the server also refuses master admins).
  const [removals, setRemovals] = useState<VenueRemoval[]>([]);
  const [managerIds, setManagerIds] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState<VenueMember | null>(null);
  const [removeBusy, setRemoveBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!venue) return;
    fetchVenueRemovals(venue.id)
      .then(setRemovals)
      .catch((err) => console.error('Failed to load removed people:', err));
    fetchLocationManagers(venue.id)
      .then((rows) => setManagerIds(new Set(rows.map((r) => r.user_id))))
      .catch((err) => console.error('Failed to load co-owners:', err));
  }, [venue]);

  const canRemove = (userId: string) =>
    !!venue && userId !== venue.owner_id && userId !== user?.id && !managerIds.has(userId);

  const handleRemove = async (m: VenueMember) => {
    if (!venue) return;
    setRemoveBusy(m.profile.id);
    try {
      await removeFromVenue(venue.id, m.profile.id);
      setRemovals((prev) => [{ profile: m.profile, removedAt: new Date().toISOString() }, ...prev]);
      setAnnouncerIds((prev) => {
        const next = new Set(prev);
        next.delete(m.profile.id);
        return next;
      });
      setConfirmRemove(null);
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError("Couldn't remove them. Try again.");
      setConfirmRemove(null);
    } finally {
      setRemoveBusy(null);
    }
  };

  const handleRestore = async (userId: string) => {
    if (!venue) return;
    setRemoveBusy(userId);
    try {
      await restoreToVenue(venue.id, userId);
      setRemovals((prev) => prev.filter((r) => r.profile.id !== userId));
    } catch (err) {
      console.error('Failed to let member back in:', err);
      setError("Couldn't let them back in. Try again.");
    } finally {
      setRemoveBusy(null);
    }
  };

  useEffect(() => {
    if (paramLocationId) {
      setVenueLoading(true);
      fetchVenue(paramLocationId)
        .then(setVenue)
        .catch((err) => {
          console.error('Failed to load venue:', err);
          setVenue(null);
        })
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
      .catch((err) => {
        console.error('Failed to load venues:', err);
        fetchMyVenue().then(setVenue).catch(() => setVenue(null));
      })
      .finally(() => setVenueLoading(false));
  }, [paramLocationId]);

  useEffect(() => {
    if (paramLocationId || !selectedVenueId) return;
    fetchVenue(selectedVenueId)
      .then(setVenue)
      .catch((err) => {
        console.error('Failed to load selected venue:', err);
        setVenue(null);
      });
  }, [selectedVenueId, paramLocationId]);

  useEffect(() => {
    if (!venue) return;
    setMembersLoading(true);
    setError(null);
    Promise.all([fetchVenueMembers(venue.id), fetchRewards(venue.id)])
      .then(([memberRows, rewardRows]) => {
        setMembers(memberRows);
        setTierRewards(rewardRows);
      })
      .catch((err) => {
        console.error('Failed to load venue members:', err);
        setError("Couldn't load members — try again");
      })
      .finally(() => setMembersLoading(false));
  }, [venue]);

  if (venueLoading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
      </div>
    );
  }

  if (!venue || !canManage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px' }}>
        <p style={{ color: theme.text, fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '16px', textAlign: 'center' }}>
          You&apos;re not authorized to view this venue&apos;s members.
        </p>
        <Link
          href="/main"
          style={{ color: theme.accent, fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: '14px', fontWeight: 600, textDecoration: 'none' }}
        >
          Back to app
        </Link>
      </div>
    );
  }

  const removedIds = new Set(removals.map((r) => r.profile.id));
  const activeMembers = members.filter((m) => !removedIds.has(m.profile.id));
  const filtered = query.trim()
    ? activeMembers.filter((m) => (m.profile.display_name ?? '').toLowerCase().includes(query.trim().toLowerCase()))
    : activeMembers;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <div style={{
        backgroundColor: theme.bg,
        padding: '16px',
        paddingTop: 'max(16px, env(safe-area-inset-top))',
        display: 'flex',
        alignItems: 'center',
        borderBottom: `1px solid ${theme.divider}`,
      }}>
        <button
          onClick={() => router.push('/main')}
          style={{ padding: '8px', marginLeft: '-8px', backgroundColor: 'transparent', border: 'none', borderRadius: '50%', cursor: 'pointer' }}
        >
          <ChevronLeft style={{ width: '24px', height: '24px', color: theme.accent }} />
        </button>
        <h1 style={{ flex: 1, textAlign: 'center', fontSize: '20px', fontWeight: 600, color: theme.text, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          Members
        </h1>
        <div style={{ width: '40px' }} />
      </div>

      <VenueSwitcher venues={myVenues} selectedId={selectedVenueId} onSelect={setSelectedVenueId} />

      <div style={{ padding: '20px 20px 40px' }}>
        {error && (
          <p style={{ color: theme.accent2, fontSize: '13px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Users style={{ width: '18px', height: '18px', color: theme.accent }} />
          <span style={{ color: theme.text, fontSize: '14px', fontWeight: 600, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {activeMembers.length} {activeMembers.length === 1 ? 'member' : 'members'} total
          </span>
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members by name…"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            backgroundColor: theme.pill,
            border: 'none',
            borderRadius: '12px',
            padding: '10px 16px',
            fontSize: '14px',
            color: theme.text,
            fontFamily: 'Montserrat, system-ui, sans-serif',
            marginBottom: '16px',
          }}
        />

        {membersLoading ? (
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading members...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {activeMembers.length === 0 ? 'No one has checked in here yet.' : 'No members match that search.'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map((m) => (
              <div
                key={m.profile.id}
                style={{
                  backgroundColor: theme.surface,
                  borderRadius: '14px',
                  border: `1px solid ${theme.divider}`,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  backgroundColor: theme.pill,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}>
                  {m.profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ color: theme.text, fontSize: '16px', fontWeight: 700, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                      {(m.profile.display_name ?? '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    color: theme.text,
                    fontSize: '14px',
                    fontWeight: 600,
                    fontFamily: 'Montserrat, system-ui, sans-serif',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {m.profile.display_name ?? 'Someone'}
                  </p>
                  <p style={{ color: theme.muted, fontSize: '12px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                    First visit {formatDate(m.firstCheckinAt)} · Last visit {formatDate(m.lastCheckinAt)}
                  </p>
                  {canGovern ? (
                    <button
                      type="button"
                      onClick={() => toggleAnnouncer(m.profile.id)}
                      disabled={announcerBusy === m.profile.id}
                      aria-pressed={announcerIds.has(m.profile.id)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, marginTop: 6, padding: '0 12px',
                        borderRadius: 999, cursor: 'pointer', fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: 12, fontWeight: 700,
                        background: announcerIds.has(m.profile.id) ? theme.accent : 'transparent',
                        color: announcerIds.has(m.profile.id) ? theme.onAccent : theme.text,
                        border: announcerIds.has(m.profile.id) ? 'none' : `1px solid ${theme.divider}`,
                      }}
                    >
                      <Megaphone size={13} aria-hidden />
                      {announcerIds.has(m.profile.id) ? 'Announcer' : 'Make announcer'}
                    </button>
                  ) : announcerIds.has(m.profile.id) ? (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: '2px 10px', borderRadius: 999,
                      background: theme.surface2, color: theme.text, fontSize: 11, fontWeight: 600, fontFamily: 'Montserrat, system-ui, sans-serif',
                    }}>
                      <Megaphone size={11} aria-hidden /> Announcer
                    </span>
                  ) : null}
                  {canRemove(m.profile.id) && (
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(m)}
                      disabled={removeBusy === m.profile.id}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, marginTop: 6, marginLeft: canGovern ? 6 : 0, padding: '0 12px',
                        borderRadius: 999, cursor: 'pointer', fontFamily: 'Montserrat, system-ui, sans-serif', fontSize: 12, fontWeight: 700,
                        background: 'transparent', color: theme.accent2, border: `1px solid ${theme.accent2}`,
                      }}
                    >
                      <UserX size={13} aria-hidden />
                      Remove
                    </button>
                  )}
                  {(m.tags.length > 0 || highestEarnedTier(tierRewards, m.checkinCount)) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {(() => {
                        const tier = highestEarnedTier(tierRewards, m.checkinCount);
                        return tier ? (
                          <span style={{
                            backgroundColor: `color-mix(in srgb, ${theme.accent} 13%, transparent)`,
                            color: theme.accent,
                            fontSize: '11px',
                            fontWeight: 600,
                            borderRadius: '9999px',
                            padding: '2px 10px',
                            fontFamily: 'Montserrat, system-ui, sans-serif',
                          }}>
                            🏆 {tier.name}
                          </span>
                        ) : null;
                      })()}
                      {/* TagBadge resolves the catalog icon (lucide / emoji /
                          uploaded image). Printing t.icon as text showed lucide
                          names as words, e.g. "star Regular". */}
                      {m.tags.map((t) => <TagBadge key={t.id} tag={t} />)}
                    </div>
                  )}
                </div>

                <div style={{
                  backgroundColor: theme.surface2,
                  borderRadius: '9999px',
                  padding: '4px 12px',
                  flexShrink: 0,
                  textAlign: 'center',
                }}>
                  <div style={{ color: theme.accent, fontSize: '15px', fontWeight: 700, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                    {m.checkinCount}
                  </div>
                  <div style={{ color: theme.muted, fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                    {m.checkinCount === 1 ? 'visit' : 'visits'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {removals.length > 0 && (
          <div style={{ marginTop: '28px' }}>
            <p style={{ color: theme.text, fontSize: '14px', fontWeight: 600, marginBottom: '10px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              Removed ({removals.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {removals.map((r) => (
                <div
                  key={r.profile.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
                    backgroundColor: theme.surface, border: `1px solid ${theme.divider}`, borderRadius: '12px', padding: '10px 14px',
                  }}
                >
                  <span style={{ color: theme.text, fontSize: '13px', fontFamily: 'Montserrat, system-ui, sans-serif', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.profile.display_name ?? 'Someone'} · {formatDate(r.removedAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRestore(r.profile.id)}
                    disabled={removeBusy === r.profile.id}
                    style={{ minHeight: 36, padding: '0 8px', background: 'transparent', border: 'none', cursor: 'pointer', color: theme.accent, fontSize: '13px', fontWeight: 600, fontFamily: 'Montserrat, system-ui, sans-serif', flexShrink: 0 }}
                  >
                    Let back in
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {confirmRemove && (
        <div
          role="presentation"
          onClick={() => removeBusy === null && setConfirmRemove(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-member-title"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: '480px', backgroundColor: theme.surface, borderRadius: '20px 20px 0 0',
              padding: '20px 20px max(20px, env(safe-area-inset-bottom))', fontFamily: 'Montserrat, system-ui, sans-serif',
            }}
          >
            <h2 id="remove-member-title" style={{ color: theme.text, fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>
              Remove {confirmRemove.profile.display_name ?? 'them'} from this venue?
            </h2>
            <p style={{ color: theme.muted, fontSize: '13px', lineHeight: 1.5, marginBottom: '18px' }}>
              They&apos;ll be checked out, lose access to this venue&apos;s feed and invite link, and can&apos;t check back in.
              Their posts stay up unless you delete them. You can let them back in later.
            </p>
            <button
              type="button"
              onClick={() => handleRemove(confirmRemove)}
              disabled={removeBusy !== null}
              style={{ width: '100%', minHeight: 46, borderRadius: '12px', border: 'none', cursor: 'pointer', background: theme.accent2, color: theme.onAccent, fontSize: '15px', fontWeight: 700, marginBottom: '8px' }}
            >
              {removeBusy ? 'Removing…' : 'Remove'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmRemove(null)}
              disabled={removeBusy !== null}
              style={{ width: '100%', minHeight: 44, borderRadius: '12px', border: 'none', cursor: 'pointer', background: 'transparent', color: theme.text, fontSize: '15px', fontWeight: 600 }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
