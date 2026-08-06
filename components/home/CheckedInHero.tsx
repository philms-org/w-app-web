'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import {
  checkIn,
  checkOut,
  fetchPresence,
  fetchAttendeeHistory,
  fetchVerificationTags,
  assignVerificationTag,
  removeVerificationTag,
  startConversation,
} from '@/lib/data';
import { useIsOrganizer } from '@/lib/hooks/useIsOrganizer';
import { theme } from '@/lib/theme';
import { STORAGE_KEYS } from '@/lib/constants';
import { Users, MapPin, AlertCircle } from 'lucide-react';
import HeroCarousel from '@/components/HeroCarousel';
import AttendeeStrip from '@/components/shared/AttendeeStrip';
import InlineMessageComposer from '@/components/shared/InlineMessageComposer';
import CreateGroupModal from '@/components/organizer/CreateGroupModal';
import OrganizerWelcomeModal from '@/components/organizer/OrganizerWelcomeModal';
import type { Profile, VerificationTag } from '@/lib/types';

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
  const [tags, setTags] = useState<VerificationTag[]>([]);
  const [tagText, setTagText] = useState('');
  const [tagIcon, setTagIcon] = useState('');
  const [tagSaving, setTagSaving] = useState(false);
  const [tagError, setTagError] = useState<string | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showOrganizerWelcome, setShowOrganizerWelcome] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [broadcastSent, setBroadcastSent] = useState(false);

  const { canManage } = useIsOrganizer(selectedLocation?.id);

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

  const loadTags = (locationId: string) => {
    fetchVerificationTags(locationId)
      .then(setTags)
      .catch((err) => console.error('Failed to load verification tags:', err));
  };

  useEffect(() => {
    if (!selectedLocation) return;

    setCheckedIn(false);
    setSelectedAttendeeId(null);
    setTagText('');
    setTagError(null);

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

    loadTags(selectedLocation.id);
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
  const selectedAttendeeTags = selectedAttendee ? tagsByUserId.get(selectedAttendee.id) ?? [] : [];
  const bannerImages = selectedLocation.banner_image ? [selectedLocation.banner_image] : [];

  const handleAssignTag = () => {
    if (!selectedAttendee || !tagText.trim()) return;
    setTagSaving(true);
    setTagError(null);
    assignVerificationTag(selectedAttendee.id, selectedLocation.id, tagText.trim(), tagIcon.trim() || null)
      .then(() => {
        setTagText('');
        setTagIcon('');
        loadTags(selectedLocation.id);
      })
      .catch((err) => {
        console.error('Failed to assign tag:', err);
        setTagError("Couldn't assign tag — try again");
      })
      .finally(() => setTagSaving(false));
  };

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

  const handleRemoveTag = (tagId: string) => {
    setTagSaving(true);
    setTagError(null);
    removeVerificationTag(tagId)
      .then(() => loadTags(selectedLocation.id))
      .catch((err) => {
        console.error('Failed to remove tag:', err);
        setTagError("Couldn't remove tag — try again");
      })
      .finally(() => setTagSaving(false));
  };

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
                    color: theme.bg,
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}
                />
                <button
                  onClick={handleSendBroadcast}
                  disabled={broadcastSending || !broadcastText.trim()}
                  style={{
                    backgroundColor: theme.accent,
                    color: 'white',
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

          {presenceProfiles.length === 0 ? (
            <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
              No one to connect with here yet
            </p>
          ) : (
            <AttendeeStrip
              attendees={presenceProfiles}
              selectedId={selectedAttendeeId}
              onSelect={setSelectedAttendeeId}
              tagsByUserId={tagsByUserId}
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

          {selectedAttendee && canManage && (
            <div style={{ marginTop: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={tagIcon}
                  onChange={(e) => setTagIcon(e.target.value)}
                  placeholder="🎧"
                  maxLength={4}
                  style={{
                    width: '48px',
                    flexShrink: 0,
                    backgroundColor: theme.pill,
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '10px 0',
                    fontSize: '16px',
                    textAlign: 'center',
                    color: theme.bg,
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}
                />
                <input
                  type="text"
                  value={tagText}
                  onChange={(e) => setTagText(e.target.value)}
                  placeholder={`Tag ${selectedAttendee.display_name ?? 'them'} (e.g. DJ, Host)...`}
                  style={{
                    flex: 1,
                    backgroundColor: theme.pill,
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '10px 16px',
                    fontSize: '14px',
                    color: theme.bg,
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}
                />
                <button
                  onClick={handleAssignTag}
                  disabled={tagSaving || !tagText.trim()}
                  style={{
                    backgroundColor: theme.accent,
                    color: 'white',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '10px 20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: tagSaving || !tagText.trim() ? 'default' : 'pointer',
                    opacity: tagSaving || !tagText.trim() ? 0.6 : 1,
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}
                >
                  Assign tag
                </button>
              </div>

              {selectedAttendeeTags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                  {selectedAttendeeTags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleRemoveTag(t.id)}
                      disabled={tagSaving}
                      style={{
                        backgroundColor: theme.surface2,
                        color: theme.text,
                        border: 'none',
                        borderRadius: '9999px',
                        padding: '6px 12px',
                        fontSize: '12px',
                        cursor: tagSaving ? 'default' : 'pointer',
                        opacity: tagSaving ? 0.6 : 1,
                        fontFamily: 'Montserrat, system-ui, sans-serif'
                      }}
                    >
                      Remove {t.icon ? `${t.icon} ` : ''}&ldquo;{t.tag}&rdquo;
                    </button>
                  ))}
                </div>
              )}

              {tagError && (
                <p style={{ color: theme.accent2, fontSize: '12px', marginTop: '6px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                  {tagError}
                </p>
              )}
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
