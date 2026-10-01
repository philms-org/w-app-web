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
import { Users, MapPin, AlertCircle, CheckCircle2, MessageCircle, Settings } from 'lucide-react';
import HeroCarousel from '@/components/HeroCarousel';
import VenueFeed from '@/components/home/VenueFeed';
import TeamsView from '@/components/teams/TeamsView';
import AnnouncementPill from '@/components/home/AnnouncementPill';
import RoomMeter from '@/components/home/RoomMeter';
import { contribute, contributeCarousel } from '@/lib/meter';
import InlineMessageComposer from '@/components/shared/InlineMessageComposer';
import CreateGroupModal from '@/components/organizer/CreateGroupModal';
import OrganizerWelcomeModal from '@/components/organizer/OrganizerWelcomeModal';
import TagBadge from '@/components/shared/TagBadge';
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
  // People checked in right now. presenceProfiles also holds past attendees,
  // and selectedLocation.count is a 0 placeholder from the venue pickers.
  const [hereNowCount, setHereNowCount] = useState(0);
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
  const [roomView, setRoomView] = useState<'people' | 'teams'>('people');
  const [showOrganizerSheet, setShowOrganizerSheet] = useState(false);

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
        setHereNowCount(new Set(rows.map((row) => row.user_id)).size);
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
        .then(() => {
          setCheckedIn(true);
          // Give the meter a moment to mount, then celebrate the check-in.
          setTimeout(() => contribute('checkin', null), 900);
        })
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
      <HeroCarousel
        images={bannerImages}
        links={bannerLinks}
        title={selectedLocation.name}
        onBack={handleBack}
        onEngage={(el) => checkedIn && contributeCarousel(selectedLocation.id, el)}
      />

      {/* Venue screen per the approved feed mockup (v4): carousel, one status
          bar, then the pills and feed get the rest of the screen. Organizer
          tools live in a bottom sheet behind the button on the right. */}
      <div style={{ padding: '8px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', minHeight: '44px' }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: theme.green, flexShrink: 0 }} />
          <span style={{ color: theme.text, fontWeight: 600, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {hereNowCount} here now
          </span>
          {checkedIn && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: theme.muted, fontSize: '13px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              <CheckCircle2 aria-hidden style={{ width: '16px', height: '16px', color: theme.green }} />
              Checked in
            </span>
          )}
          {canManage && (
            <button
              type="button"
              onClick={() => setShowOrganizerSheet(true)}
              aria-label="Organizer tools"
              style={{
                marginLeft: 'auto',
                width: '44px',
                height: '44px',
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                border: `1px solid ${theme.divider}`,
                backgroundColor: theme.surface,
                color: theme.text,
                cursor: 'pointer',
              }}
            >
              <Settings aria-hidden style={{ width: '20px', height: '20px' }} />
            </button>
          )}
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

        <div style={{ marginBottom: '20px' }}>
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

          {/* Pinned above the feed and outside its lock: everyone checked in
              sees announcements, even before unlocking who's here. */}
          <AnnouncementPill locationId={selectedLocation.id} venueName={selectedLocation.name} />

          {checkedIn && <RoomMeter locationId={selectedLocation.id} />}

          <div
            role="tablist"
            aria-label="Room view"
            style={{
              display: 'flex', padding: 4, marginBottom: 12, borderRadius: 9999,
              backgroundColor: theme.surface2, border: `1px solid ${theme.divider}`,
            }}
          >
            {(['people', 'teams'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={roomView === v}
                onClick={() => setRoomView(v)}
                style={{
                  flex: 1, minHeight: 44, borderRadius: 9999, border: 'none', cursor: 'pointer',
                  fontSize: 14, fontWeight: 700, fontFamily: 'Montserrat, system-ui, sans-serif',
                  backgroundColor: roomView === v ? theme.text : 'transparent',
                  color: roomView === v ? theme.bg : theme.muted,
                }}
              >
                {v === 'people' ? 'People' : 'Teams'}
              </button>
            ))}
          </div>

          {roomView === 'teams' ? (
            <TeamsView
              locationId={selectedLocation.id}
              myUserId={user?.id}
              roomProfiles={presenceProfiles}
              checkedIn={checkedIn}
            />
          ) : (
            <VenueFeed
              locationId={selectedLocation.id}
              presenceProfiles={presenceProfiles}
              myUserId={user?.id}
              myAvatarUrl={user?.image}
              onReply={(profile) => setSelectedAttendeeId(profile.id)}
              checkedIn={checkedIn}
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

      {showOrganizerSheet && canManage && (
        <div
          role="presentation"
          onClick={() => setShowOrganizerSheet(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, backgroundColor: 'rgba(0,0,0,0.6)' }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Organizer tools"
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              maxWidth: 480, margin: '0 auto',
              backgroundColor: theme.surface,
              borderTop: `1px solid ${theme.divider}`,
              borderRadius: '24px 24px 0 0',
              padding: '10px 16px calc(18px + env(safe-area-inset-bottom, 0px))',
              fontFamily: 'Montserrat, system-ui, sans-serif',
            }}
          >
            <div aria-hidden style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.divider, margin: '0 auto 12px' }} />
            <p style={{ color: theme.text, fontSize: '15px', fontWeight: 800, marginBottom: '12px' }}>
              Organizer tools · {selectedLocation.name}
            </p>
            {[
              {
                label: 'Message everyone live',
                icon: MessageCircle,
                primary: true,
                disabled: presenceProfiles.length === 0,
                onClick: () => { setShowOrganizerSheet(false); setShowBroadcast(true); },
              },
              {
                label: 'Create group',
                icon: Users,
                primary: false,
                disabled: false,
                onClick: () => { setShowOrganizerSheet(false); setShowCreateGroup(true); },
              },
            ].map(({ label, icon: Icon, primary, disabled, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                disabled={disabled}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                  minHeight: '52px', padding: '0 16px', marginBottom: '8px',
                  borderRadius: '14px', fontSize: '15px', fontWeight: 700,
                  fontFamily: 'inherit', cursor: disabled ? 'default' : 'pointer',
                  opacity: disabled ? 0.5 : 1,
                  backgroundColor: primary ? theme.accent : theme.surface2,
                  color: primary ? theme.onAccent : theme.text,
                  border: primary ? 'none' : `1px solid ${theme.divider}`,
                }}
              >
                <Icon aria-hidden style={{ width: '20px', height: '20px' }} />
                {label}
              </button>
            ))}
            {/* Members, announcements, reports, rewards, zones, activities,
                titles and carousel uploads all live in the organizer hub. */}
            <Link
              href="/main/organizer"
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                minHeight: '52px', padding: '0 16px',
                borderRadius: '14px', fontSize: '15px', fontWeight: 700,
                backgroundColor: theme.surface2, color: theme.text,
                border: `1px solid ${theme.divider}`, textDecoration: 'none',
              }}
            >
              <Settings aria-hidden style={{ width: '20px', height: '20px' }} />
              Manage venue
            </Link>
          </div>
        </div>
      )}

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
