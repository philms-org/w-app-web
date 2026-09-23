'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/store';
import {
  checkIn,
  checkOut,
  fetchPresence,
  fetchAttendeeHistory,
  fetchVerificationTags,
  startConversation,
  fetchBanners,
} from '@/lib/data';
import { supabase } from '@/lib/supabase';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { useZoneTracking } from '@/lib/hooks/useZoneTracking';
import { useTableSubscription } from '@/lib/hooks/useTableSubscription';
import { theme } from '@/lib/theme';
import { STORAGE_KEYS } from '@/lib/constants';
import { Users, MapPin, AlertCircle } from 'lucide-react';
import HeroCarousel from '@/components/HeroCarousel';
import ActivityMeterCard from '@/components/home/ActivityMeterCard';
import VenueFeed from '@/components/home/VenueFeed';
import InlineMessageComposer from '@/components/shared/InlineMessageComposer';
import CreateGroupModal from '@/components/organizer/CreateGroupModal';
import OrganizerWelcomeModal from '@/components/organizer/OrganizerWelcomeModal';
import TagBadge from '@/components/shared/TagBadge';
import TitleRosterCard from '@/components/venue/TitleRosterCard';
import type { Profile, VerificationTag, Banner } from '@/lib/types';
import { haversineMeters } from '@/lib/geo';

// Shows the checked-in venue (reusing HeroCarousel unchanged for the photo
// banner) plus a "Connections" card built from VenueFeed (posts + presence,
// see docs/superpowers/specs/2026-09-23-venue-event-feed-design.md). Carries the
// real checkIn/checkOut/fetchPresence calls forward from MainFeedTab, but
// adds a real geofence gate in front of checkIn: only actually check in when
// the user's live location is within the venue's radius.
export default function CheckedInHero() {
  const { selectedLocation, setSelectedLocation, currentLocation, user } = useStore();
  const [presenceProfiles, setPresenceProfiles] = useState<Profile[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [selectedAttendeeId, setSelectedAttendeeId] = useState<string | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [tags, setTags] = useState<VerificationTag[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showOrganizerWelcome, setShowOrganizerWelcome] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [venueHasZones, setVenueHasZones] = useState(false);

  const { canManage } = useIsOrganizer(selectedLocation?.id);

  useZoneTracking(checkedIn ? selectedLocation?.id ?? null : null);

  // The "location is used for area analytics" indicator below must only show
  // at venues that actually have zones — for a zone-less venue nothing is
  // ever recorded (useZoneTracking bails on the same check), so the notice
  // would be false. Same venue_zones head-count query useZoneTracking uses.
  useEffect(() => {
    setVenueHasZones(false);
    const locationId = checkedIn ? selectedLocation?.id ?? null : null;
    if (!locationId) {
      setVenueHasZones(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('venue_zones')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .then(({ count }) => {
        if (!cancelled) setVenueHasZones(!!count);
      });
    return () => { cancelled = true; };
  }, [checkedIn, selectedLocation?.id]);

  // First-run instructions for organizers only, shown once per browser/device.
  useEffect(() => {
    if (canManage && !localStorage.getItem(STORAGE_KEYS.ORGANIZER_WELCOME_SEEN)) {
      setShowOrganizerWelcome(true);
    }
  }, [canManage]);

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

  const tagsByUserId = useMemo(() => {
    const map = new Map<string, VerificationTag[]>();
    for (const t of tags) {
      const existing = map.get(t.user_id);
      if (existing) existing.push(t);
      else map.set(t.user_id, [t]);
    }
    return map;
  }, [tags]);

  // Current presence + historical attendees for the Connections strip.
  // Same logic that used to live inline in the effect below — extracted so
  // the realtime subscription can re-run exactly the same load.
  const loadPresence = useCallback(() => {
    if (!selectedLocation) return;
    const locationId = selectedLocation.id;

    fetchPresence(locationId)
      .then((rows) => {
        const profiles = rows.map((row) => row.profiles).filter((p): p is Profile => !!p);
        setPresenceProfiles(profiles);
      })
      .catch((err) => console.error('Failed to load presence:', err));

    fetchAttendeeHistory(locationId)
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
  }, [selectedLocation]);

  // Live presence: any check-in / check-out row for this venue re-runs the
  // same load. Listen for '*' because a check-out is an UPDATE
  // (checked_out_at set), not an INSERT.
  useTableSubscription({
    table: 'location_checkins',
    filter: selectedLocation ? `location_id=eq.${selectedLocation.id}` : undefined,
    onEvent: loadPresence,
    enabled: !!selectedLocation,
  });

  const loadTags = (locationId: string) => {
    fetchVerificationTags(locationId)
      .then(setTags)
      .catch((err) => console.error('Failed to load verification tags:', err));
  };

  // This effect re-runs whenever `withinGeofence` flips, and in dev React
  // StrictMode double-invokes it on mount — without this guard that fires the
  // non-idempotent checkIn() write two or more times per venue entry. Track
  // which location we've already attempted so it happens once; cleared on
  // check-out (handleBack) and when the location changes below.
  const checkInAttemptedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedLocation) return;

    if (checkInAttemptedFor.current !== selectedLocation.id) {
      setCheckedIn(false);
    }
    setSelectedAttendeeId(null);

    if (withinGeofence && checkInAttemptedFor.current !== selectedLocation.id) {
      checkInAttemptedFor.current = selectedLocation.id;
      checkIn(selectedLocation.id)
        .then(() => setCheckedIn(true))
        .catch((err) => {
          checkInAttemptedFor.current = null;
          console.error('Check-in failed:', err);
        });
    }

    loadPresence();

    loadTags(selectedLocation.id);

    fetchBanners(selectedLocation.id)
      .then(setBanners)
      .catch((err) => console.error('Failed to load banners:', err));

  }, [selectedLocation, withinGeofence, loadPresence]);

  const handleBack = () => {
    if (selectedLocation && checkedIn) {
      checkOut(selectedLocation.id).catch((err) => console.error('Check-out failed:', err));
    }
    checkInAttemptedFor.current = null;
    setSelectedLocation(null);
  };

  if (!selectedLocation) return null;

  const selectedAttendee = presenceProfiles.find((p) => p.id === selectedAttendeeId) ?? null;
  const selectedAttendeeTags = selectedAttendee ? tagsByUserId.get(selectedAttendee.id) ?? [] : [];
  const bannerImages = banners.length > 0
    ? banners.map((b) => b.image_url)
    : selectedLocation.banner_image
      ? [selectedLocation.banner_image]
      : [];
  const bannerLinks = banners.length > 0 ? banners.map((b) => b.link ?? null) : undefined;

  const handleSendBroadcast = () => {
    if (!broadcastText.trim() || presenceProfiles.length === 0) return;
    setBroadcastSending(true);
    setBroadcastError(null);
    startConversation(
      presenceProfiles.map((p) => p.id),
      `${selectedLocation.name} — Live`,
      true,
      broadcastText.trim()
    )
      .then(() => {
        setBroadcastText('');
        setBroadcastSent(true);
        setTimeout(() => {
          setShowBroadcast(false);
          setBroadcastSent(false);
        }, 1200);
      })
      .catch((err) => {
        console.error('Failed to send broadcast:', err);
        setBroadcastError("Couldn't send message — try again");
      })
      .finally(() => setBroadcastSending(false));
  };

  return (
    <div>
      <HeroCarousel images={bannerImages} links={bannerLinks} title={selectedLocation.name} onBack={handleBack} />

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

        {checkedIn && venueHasZones && (
          <Link
            href="/privacy"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: theme.muted,
              fontSize: '12px',
              textDecoration: 'none',
              marginBottom: '16px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
            }}
          >
            <MapPin style={{ width: '12px', height: '12px' }} />
            Location is used for this venue&apos;s area analytics while you&apos;re checked in — Learn more
          </Link>
        )}

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

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          <Link
            href={`/main/venue/chat?locationId=${selectedLocation.id}`}
            style={{
              backgroundColor: theme.surface,
              color: theme.text,
              border: `1px solid ${theme.divider}`,
              borderRadius: '9999px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'Montserrat, system-ui, sans-serif',
              textDecoration: 'none',
            }}
          >
            💬 Venue Chat
          </Link>
          {canManage && (
            <>
              <Link
                href={`/main/venue/members?locationId=${selectedLocation.id}`}
                style={{
                  backgroundColor: theme.surface,
                  color: theme.text,
                  border: `1px solid ${theme.divider}`,
                  borderRadius: '9999px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  textDecoration: 'none',
                }}
              >
                Members
              </Link>
              <Link
                href={`/main/venue/rewards?locationId=${selectedLocation.id}`}
                style={{
                  backgroundColor: theme.surface,
                  color: theme.text,
                  border: `1px solid ${theme.divider}`,
                  borderRadius: '9999px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  textDecoration: 'none',
                }}
              >
                Rewards
              </Link>
              <Link
                href={`/main/venue/zones?locationId=${selectedLocation.id}`}
                style={{
                  backgroundColor: theme.surface,
                  color: theme.text,
                  border: `1px solid ${theme.divider}`,
                  borderRadius: '9999px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  textDecoration: 'none',
                }}
              >
                Zones
              </Link>
              <Link
                href={`/main/venue/activities?locationId=${selectedLocation.id}`}
                style={{
                  backgroundColor: theme.surface,
                  color: theme.text,
                  border: `1px solid ${theme.divider}`,
                  borderRadius: '9999px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  textDecoration: 'none',
                }}
              >
                Activities
              </Link>
              <Link
                href={`/main/venue/titles?locationId=${selectedLocation.id}`}
                style={{
                  backgroundColor: theme.surface,
                  color: theme.text,
                  border: `1px solid ${theme.divider}`,
                  borderRadius: '9999px',
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  textDecoration: 'none',
                }}
              >
                Titles
              </Link>
            </>
          )}
        </div>

        {checkedIn && <ActivityMeterCard locationId={selectedLocation.id} />}

        {selectedLocation && <TitleRosterCard locationId={selectedLocation.id} />}

        <div style={{
          backgroundColor: theme.surface,
          borderRadius: '16px',
          border: `1px solid ${theme.divider}`,
          padding: '16px',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{
              color: theme.muted,
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Connections</p>

            {canManage && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setShowBroadcast(true)}
                  disabled={presenceProfiles.length === 0}
                  style={{
                    backgroundColor: theme.surface2,
                    color: theme.text,
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: presenceProfiles.length === 0 ? 'default' : 'pointer',
                    opacity: presenceProfiles.length === 0 ? 0.5 : 1,
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}
                >
                  Message Everyone Live
                </button>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  style={{
                    backgroundColor: theme.surface2,
                    color: theme.text,
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '6px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}
                >
                  + Create Group
                </button>
              </div>
            )}
          </div>

          {showBroadcast && canManage && (
            <div style={{
              backgroundColor: theme.surface2,
              borderRadius: '12px',
              padding: '12px',
              marginBottom: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <p style={{ color: theme.muted, fontSize: '12px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                Sends to all {presenceProfiles.length} {presenceProfiles.length === 1 ? 'person' : 'people'} currently checked in.
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  placeholder="Message to everyone live…"
                  style={{
                    flex: 1,
                    backgroundColor: theme.pill,
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '10px 16px',
                    fontSize: '14px',
                    color: theme.text,
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}
                />
                <button
                  onClick={handleSendBroadcast}
                  disabled={broadcastSending || !broadcastText.trim()}
                  style={{
                    backgroundColor: theme.accent,
                    color: theme.onAccent,
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: broadcastSending || !broadcastText.trim() ? 'default' : 'pointer',
                    opacity: broadcastSending || !broadcastText.trim() ? 0.6 : 1,
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}
                >
                  {broadcastSent ? 'Sent ✓' : 'Send'}
                </button>
              </div>
              {broadcastError && (
                <p style={{ color: theme.accent2, fontSize: '12px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>{broadcastError}</p>
              )}
            </div>
          )}

          <VenueFeed
            locationId={selectedLocation.id}
            presenceProfiles={presenceProfiles}
            myUserId={user?.id}
            myAvatarUrl={user?.image}
            onReply={(profile) => setSelectedAttendeeId(profile.id)}
          />

          {selectedAttendee && (
            <div style={{ marginTop: '14px' }}>
              <InlineMessageComposer
                recipient={selectedAttendee}
                onSent={() => setSelectedAttendeeId(null)}
              />
            </div>
          )}

          {selectedAttendee && (
            <div
              style={{
                marginTop: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ color: theme.text, fontSize: '14px', fontWeight: 600, fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                {selectedAttendee.display_name ?? 'Someone'}
              </span>
              {selectedAttendeeTags.map((t) => (
                <TagBadge key={t.id} tag={t} size="md" />
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateGroup && (
        <CreateGroupModal
          attendees={presenceProfiles}
          onClose={() => setShowCreateGroup(false)}
        />
      )}

      {showOrganizerWelcome && (
        <OrganizerWelcomeModal onClose={() => setShowOrganizerWelcome(false)} />
      )}
    </div>
  );
}
