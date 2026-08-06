'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import {
  fetchMyVenue,
  fetchMyVenues,
  fetchVenue,
  fetchAttendanceStats,
  fetchTagBreakdown,
  fetchConnectionsFormed,
  fetchEngagementStats,
} from '@/lib/data';
import { theme } from '@/lib/theme';
import VenueSwitcher from '@/components/shared/VenueSwitcher';
import type {
  Venue,
  AttendanceStats,
  TagBreakdownEntry,
  ConnectionsFormedStats,
  EngagementStats,
} from '@/lib/types';

export default function VenueReportPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading...</p>
        </div>
      }
    >
      <VenueReportPageInner />
    </Suspense>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: theme.surface,
        borderRadius: '16px',
        border: `1px solid ${theme.divider}`,
        padding: '16px',
        marginBottom: '16px',
      }}
    >
      <h2
        style={{
          fontSize: '14px',
          fontWeight: 700,
          color: theme.accent,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '12px',
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{ flex: 1, minWidth: '120px' }}>
      <div
        style={{
          fontSize: '24px',
          fontWeight: 700,
          color: theme.text,
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: '12px',
          color: theme.muted,
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}
      >
        {label}
      </div>
    </div>
  );
}

function VenueReportPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramLocationId = searchParams.get('locationId');

  const [myVenues, setMyVenues] = useState<Venue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(paramLocationId);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [venueLoading, setVenueLoading] = useState(true);

  const [attendance, setAttendance] = useState<AttendanceStats | null>(null);
  const [tags, setTags] = useState<TagBreakdownEntry[]>([]);
  const [connections, setConnections] = useState<ConnectionsFormedStats | null>(null);
  const [engagement, setEngagement] = useState<EngagementStats | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    setReportLoading(true);
    setError(null);
    Promise.all([
      fetchAttendanceStats(venue.id),
      fetchTagBreakdown(venue.id),
      fetchConnectionsFormed(venue.id),
      fetchEngagementStats(venue.id),
    ])
      .then(([attendanceStats, tagBreakdown, connectionsFormed, engagementStats]) => {
        setAttendance(attendanceStats);
        setTags(tagBreakdown);
        setConnections(connectionsFormed);
        setEngagement(engagementStats);
      })
      .catch((err) => {
        console.error('Failed to load venue report:', err);
        setError("Couldn't load report — try again");
      })
      .finally(() => setReportLoading(false));
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
          You&apos;re not authorized to view this venue&apos;s report.
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

  const maxHourCount = attendance ? Math.max(1, ...attendance.checkinsByHour.map((h) => h.count)) : 1;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      <div
        style={{
          backgroundColor: theme.bg,
          padding: '16px',
          paddingTop: 'max(16px, env(safe-area-inset-top))',
          display: 'flex',
          alignItems: 'center',
          borderBottom: `1px solid ${theme.divider}`,
        }}
      >
        <button
          onClick={() => router.push('/main')}
          style={{
            padding: '8px',
            marginLeft: '-8px',
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
          }}
        >
          <ChevronLeft style={{ width: '24px', height: '24px', color: theme.accent }} />
        </button>
        <h1
          style={{
            flex: 1,
            textAlign: 'center',
            fontSize: '20px',
            fontWeight: 600,
            color: theme.text,
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}
        >
          {venue.name} Report
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

        {reportLoading ? (
          <p style={{ color: theme.muted, fontFamily: 'Montserrat, system-ui, sans-serif' }}>Loading report...</p>
        ) : (
          <>
            <SectionCard title="Attendance & Peak Times">
              <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <StatTile label="Total check-ins" value={attendance?.totalCheckins ?? 0} />
                <StatTile label="Unique attendees" value={attendance?.uniqueAttendees ?? 0} />
              </div>

              <p
                style={{
                  fontSize: '11px',
                  color: theme.muted,
                  marginBottom: '8px',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                }}
              >
                Check-ins by hour of day
              </p>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '2px',
                  height: '90px',
                }}
              >
                {(attendance?.checkinsByHour ?? []).map((h, i) => (
                  <div
                    key={i}
                    title={`${h.hour}: ${h.count}`}
                    style={{
                      flex: 1,
                      height: `${Math.max(2, (h.count / maxHourCount) * 100)}%`,
                      backgroundColor: h.count > 0 ? theme.accent : theme.surface2,
                      borderRadius: '2px 2px 0 0',
                    }}
                  />
                ))}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '4px',
                  fontSize: '9px',
                  color: theme.muted,
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                }}
              >
                <span>12am</span>
                <span>12pm</span>
                <span>11pm</span>
              </div>
            </SectionCard>

            <SectionCard title="Tag / Role Breakdown">
              {tags.length === 0 ? (
                <p style={{ color: theme.muted, fontSize: '13px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                  No tags assigned yet.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {tags.map((t) => (
                    <div
                      key={t.tag}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '14px',
                        color: theme.text,
                        fontFamily: 'Montserrat, system-ui, sans-serif',
                      }}
                    >
                      <span>{t.tag}</span>
                      <span style={{ color: theme.muted }}>{t.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Connections Formed">
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <StatTile label="QR connections made" value={connections?.scans ?? 0} />
                <StatTile label="Peek invites accepted" value={connections?.peeksAccepted ?? 0} />
              </div>
            </SectionCard>

            <SectionCard title="Engagement">
              <div style={{ display: 'flex', gap: '20px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <StatTile label="Feed posts" value={engagement?.feedPosts ?? 0} />
              </div>
              <p
                style={{
                  fontSize: '12px',
                  color: theme.muted,
                  fontStyle: 'italic',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                }}
              >
                Group messaging isn&apos;t yet scoped per-venue — groups created here can&apos;t currently be
                attributed to this venue in the data.
              </p>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}
