'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { checkIn, checkOut, fetchPresence, fetchAttendeeHistory } from '@/lib/data';
import { theme } from '@/lib/theme';
import { Users, MapPin, AlertCircle } from 'lucide-react';
import HeroCarousel from '@/components/HeroCarousel';
import AttendeeStrip from '@/components/shared/AttendeeStrip';
import InlineMessageComposer from '@/components/shared/InlineMessageComposer';
import type { Profile } from '@/lib/types';

// Straight-line (haversine) distance in meters between two lat/lng points.
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Shows the checked-in venue (reusing HeroCarousel unchanged for the photo
// banner) plus a "Connections" card built from AttendeeStrip. Carries the
// real checkIn/checkOut/fetchPresence calls forward from MainFeedTab, but
// adds a real geofence gate in front of checkIn: only actually check in when
// the user's live location is within the venue's radius.
export default function CheckedInHero() {
  const { selectedLocation, setSelectedLocation, currentLocation } = useStore();
  const [presenceProfiles, setPresenceProfiles] = useState<Profile[]>([]);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);

  const distanceMeters = useMemo(() => {
    if (!selectedLocation || !currentLocation) return null;
    return haversineMeters(
      currentLocation.lat,
      currentLocation.lng,
      selectedLocation.latitude,
      selectedLocation.longitude
    );
  }, [selectedLocation, currentLocation]);

  const withinGeofence = distanceMeters !== null && distanceMeters <= (selectedLocation?.radius ?? 0);

  useEffect(() => {
    if (!selectedLocation) return;

    setCheckedIn(false);
    setSelectedAttendeeId(null);

    if (withinGeofence) {
      checkIn(selectedLocation.id)
        .then(() => setCheckedIn(true))
        .catch((err) => console.error('Check-in failed:', err));
    }

    fetchPresence(selectedLocation.id)
      .then((rows) => {
        const profiles = rows.map((row) => row.profiles).filter((p): p is Profile => !!p);
        setPresenceProfiles(profiles);
      })
      .catch((err) => console.error('Failed to load presence:', err));

    // Historical attendees are folded into the same Connections strip
    // ("people who were/are there") alongside anyone currently present.
    fetchAttendeeHistory(selectedLocation.id)
      .then((history) => {
        setPresenceProfiles((current) => {
          const seen = new Set(current.map((p) => p.id));
          const merged = [...current];
          for (const profile of history) {
            if (!seen.has(profile.id)) {
              seen.add(profile.id);
              merged.push(profile);
            }
          }
          return merged;
        });
      })
      .catch((err) => console.error('Failed to load attendee history:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocation, withinGeofence]);

  const handleBack = () => {
    if (selectedLocation && checkedIn) {
      checkOut(selectedLocation.id).catch((err) => console.error('Check-out failed:', err));
    }
    setSelectedLocation(null);
  };

  if (!selectedLocation) return null;

  const selectedAttendee = presenceProfiles.find((p) => p.id === selectedAttendeeId) ?? null;
  const bannerImages = selectedLocation.banner_image ? [selectedLocation.banner_image] : [];

  return (
    <div>
      <HeroCarousel images={bannerImages} title={selectedLocation.name} onBack={handleBack} />

      <div style={{ padding: '16px 20px 0' }}>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users style={{ width: '18px', height: '18px', color: theme.accent }} />
            <span style={{ color: theme.text, fontWeight: 500, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              {selectedLocation.count} {selectedLocation.count === 1 ? 'person' : 'people'} here
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin style={{ width: '18px', height: '18px', color: theme.accent }} />
            <span style={{ color: theme.text, fontWeight: 500, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              {selectedLocation.radius}m radius
            </span>
          </div>
        </div>

        {!withinGeofence && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            backgroundColor: theme.surface2,
            border: `1px solid ${theme.divider}`,
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '16px'
          }}>
            <AlertCircle style={{ width: '18px', height: '18px', color: theme.warm1, flexShrink: 0, marginTop: '1px' }} />
            <p style={{ color: theme.text, fontSize: '13px', lineHeight: 1.4, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              You&apos;re not at this location yet — get closer to check in.
            </p>
          </div>
        )}

        <div style={{
          backgroundColor: theme.surface,
          borderRadius: '16px',
          border: `1px solid ${theme.divider}`,
          padding: '16px',
          marginBottom: '20px'
        }}>
          <p style={{
            color: theme.muted,
            fontSize: '11px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '12px',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>Connections</p>

          {presenceProfiles.length === 0 ? (
            <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              No one to connect with here yet
            </p>
          ) : (
            <AttendeeStrip
              attendees={presenceProfiles}
              selectedId={selectedAttendeeId}
              onSelect={setSelectedAttendeeId}
            />
          )}

          {selectedAttendee && (
            <div style={{ marginTop: '14px' }}>
              <InlineMessageComposer
                recipient={selectedAttendee}
                onSent={() => setSelectedAttendeeId(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
