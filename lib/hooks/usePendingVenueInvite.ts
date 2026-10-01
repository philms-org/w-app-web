'use client';

import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { STORAGE_KEYS } from '@/lib/constants';
import { fetchVenue, redeemVenueInvite } from '@/lib/data';
import { DEFAULT_RADIUS_METERS } from '@/lib/geo';

// Redeems an invite token stashed by /join/<token> once the user is signed
// in, then opens that venue on Home so its feed shows before they arrive.
// Returns an error message to show if the link was bad or switched off.
export function usePendingVenueInvite(): [string | null, () => void] {
  const { isAuthenticated, hasHydrated, setSelectedLocation, setActiveTab } = useStore();
  const [error, setError] = useState<string | null>(null);
  const running = useRef(false);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || running.current) return;
    let token: string | null = null;
    try {
      token = localStorage.getItem(STORAGE_KEYS.PENDING_VENUE_INVITE);
    } catch {
      return;
    }
    if (!token) return;
    running.current = true;

    redeemVenueInvite(token)
      .then((locationId) => fetchVenue(locationId))
      .then((venue) => {
        // Same Venue -> store Location shape LandingLocationGate / NearbyBanner use.
        setSelectedLocation({
          id: venue.id,
          name: venue.name,
          description: venue.description ?? '',
          latitude: venue.lat as number,
          longitude: venue.lng as number,
          radius: venue.geofence_radius_meters ?? DEFAULT_RADIUS_METERS,
          count: 0,
          category: 'venue',
          isHot: false,
          banner_image: venue.banner_image ?? null,
        });
        setActiveTab('home');
      })
      .catch((err) => {
        console.error('Failed to redeem venue invite:', err);
        const msg = (err as { message?: string })?.message ?? '';
        setError(/invalid|no longer active/.test(msg)
          ? 'That invite link is no longer active.'
          : "Couldn't open your invite link. Try opening it again.");
      })
      .finally(() => {
        running.current = false;
        try {
          localStorage.removeItem(STORAGE_KEYS.PENDING_VENUE_INVITE);
        } catch { /* ignore */ }
      });
  }, [hasHydrated, isAuthenticated, setSelectedLocation, setActiveTab]);

  return [error, () => setError(null)];
}
