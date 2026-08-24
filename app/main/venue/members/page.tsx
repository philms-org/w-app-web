'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Users } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { fetchMyVenue, fetchMyVenues, fetchVenue, fetchVenueMembers, fetchRewards, highestEarnedTier } from '@/lib/data';
import { theme } from '@/lib/theme';
import type { Venue, VenueMember, Reward } from '@/lib/types';
import VenueSwitcher from '@/components/shared/VenueSwitcher';

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

  const { canManage } = useIsOrganizer(venue?.id);

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

  const filtered = query.trim()
    ? members.filter((m) => (m.profile.display_name ?? '').toLowerCase().includes(query.trim().toLowerCase()))
    : members;

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
            {members.length} {members.length === 1 ? 'member' : 'members'} total
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
            borderRadius: '9999px',
            padding: '10px 16px',
            fontSize: '14px',
            color: theme.bg,
            fontFamily: 'Montserrat, system-ui, sans-serif',
            marginBottom: '16px',
          }}
        />

        {membersLoading ? (
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading members...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {members.length === 0 ? 'No one has checked in here yet.' : 'No members match that search.'}
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
                    <span style={{ color: theme.bg, fontSize: '16px', fontWeight: 700, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
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
                  {(m.tags.length > 0 || highestEarnedTier(tierRewards, m.checkinCount)) && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                      {(() => {
                        const tier = highestEarnedTier(tierRewards, m.checkinCount);
                        return tier ? (
                          <span style={{
                            backgroundColor: `${theme.accent}22`,
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
                      {m.tags.map((t) => (
                        <span key={t.id} style={{
                          backgroundColor: theme.surface2,
                          color: theme.text,
                          fontSize: '11px',
                          borderRadius: '9999px',
                          padding: '2px 10px',
                          fontFamily: 'Montserrat, system-ui, sans-serif',
                        }}>
                          {t.icon ? `${t.icon} ` : ''}{t.tag}
                        </span>
                      ))}
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
      </div>
    </div>
  );
}
