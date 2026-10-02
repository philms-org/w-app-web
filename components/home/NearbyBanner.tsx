'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchVenues } from '@/lib/data';
import { useStore } from '@/lib/store';
import { requestLocation } from '@/lib/geolocation';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { haversineMeters, isWithinGeofence, DEFAULT_RADIUS_METERS, venueToLocation } from '@/lib/geo';
import { theme } from '@/lib/theme';
import type { Venue } from '@/lib/types';
import { MapPinPlus, Plus, RefreshCw, Search, Eye } from 'lucide-react';
import VenuePeekModal from '@/components/home/VenuePeekModal';
import LocationFixSheet from '@/components/shared/LocationFixSheet';
import HotspotBadge from '@/components/hotspots/HotspotBadge';
import { useActiveHotspotPlaces } from '@/lib/hooks/useActiveHotspotPlaces';

const FONT = 'Montserrat, system-ui, sans-serif';
// Teal outline from the founder's Home mock (2026-09-30) — the location card's
// signature edge in both the "venues detected" and "not recognized" states.
const CARD_EDGE = '#4FD1C5';
// How many of the nearest out-of-range venues to list under the in-range ones.
const NEARBY_LIMIT = 5;

// Top-of-Home location card. Two states, per the founder's mock:
//   - venues detected: a stacked menu of venue pills (tap to check in, or
//     peek at nearby ones), with an add-location pin in the corner
//   - not recognized / location off: "We don't recognize where you are —
//     add this location/event or search", over a faded map
export default function NearbyBanner({ checkedInVenueId = null }: {
  // The venue you're still checked in at (back keeps you checked in), so its
  // hotspots get marked on the pills even when it isn't a dated event.
  checkedInVenueId?: string | null;
} = {}) {
  const { currentLocation, locationDenied, locationPermissionBlocked, selectedLocation, setSelectedLocation } = useStore();
  // Flame / check marker on pills for places that are hotspots right now.
  const activeHotspots = useActiveHotspotPlaces(selectedLocation?.id ?? checkedInVenueId);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [peekVenue, setPeekVenue] = useState<Venue | null>(null);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [showLocationFix, setShowLocationFix] = useState(false);
  const comingSoonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A denied/timed-out/unsupported geolocation request still writes a
  // hardcoded fallback coordinate to the store (see lib/geolocation.ts), so
  // `currentLocation` alone can't tell us whether we have a real fix.
  const hasRealLocation = !!currentLocation && !locationDenied;

  const loadVenues = () => {
    setLoading(true);
    setLoadError(false);
    fetchVenues()
      .then(setVenues)
      .catch((err) => {
        console.error('Failed to load nearby venues:', err);
        setLoadError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadVenues();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadVenues();
    requestLocation().finally(() => setRefreshing(false));
  };

  const { pullDistance } = usePullToRefresh(handleRefresh);

  const { inRange, nearby } = useMemo(() => {
    const withCoords = venues.filter((v) => v.lat != null && v.lng != null);
    if (!hasRealLocation || !currentLocation) return { inRange: [] as Venue[], nearby: withCoords };

    const withDistance = withCoords
      .map((v) => ({
        venue: v,
        distance: haversineMeters(currentLocation.lat, currentLocation.lng, v.lat as number, v.lng as number),
      }))
      .sort((a, b) => a.distance - b.distance);

    const inRangeList: Venue[] = [];
    const nearbyList: Venue[] = [];
    for (const { venue, distance } of withDistance) {
      const radius = venue.geofence_radius_meters ?? DEFAULT_RADIUS_METERS;
      if (isWithinGeofence(distance, radius, currentLocation.accuracy)) inRangeList.push(venue);
      else nearbyList.push(venue);
    }
    return { inRange: inRangeList, nearby: nearbyList };
  }, [venues, currentLocation, hasRealLocation]);

  const handleCheckIn = (venue: Venue) => {
    // Same Venue -> store Location conversion MapTab.tsx uses for its own
    // "Check In Here" button — CheckedInHero's geofence math depends on this
    // exact shape (latitude/longitude/radius, not lat/lng/geofence_radius_meters).
    setSelectedLocation(venueToLocation(venue));
  };

  // Without a real fix, picking a venue sets it as your location (the old
  // "enter it manually" path); with one, it opens the peek preview.
  const handleSearchPick = (venue: Venue) => {
    if (!hasRealLocation) {
      useStore.getState().setCurrentLocation({ lat: venue.lat as number, lng: venue.lng as number });
      useStore.getState().setLocationDenied(false);
    } else {
      setPeekVenue(venue);
    }
    setShowSearch(false);
    setQuery('');
  };

  // Adding a location isn't available yet on the live app (the request
  // flow's table, migration 0020, isn't on prod), so + says so for now.
  const openAddLocation = () => {
    setShowComingSoon(true);
    if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current);
    comingSoonTimer.current = setTimeout(() => setShowComingSoon(false), 3000);
  };
  useEffect(() => () => {
    if (comingSoonTimer.current) clearTimeout(comingSoonTimer.current);
  }, []);

  const comingSoonNote = showComingSoon && (
    <p role="status" style={{
      margin: '30px auto 0', width: 'fit-content', padding: '8px 14px', borderRadius: 9999,
      backgroundColor: theme.surface2, color: theme.text, fontSize: 13, fontWeight: 600, fontFamily: FONT,
    }}>
      Adding locations is coming soon
    </p>
  );

  const circleButton = (size: number): React.CSSProperties => ({
    width: size, height: size, borderRadius: 9999, border: 'none', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  });

  const refreshButton = (color: string, bg: string) => (
    <button
      onClick={handleRefresh}
      disabled={refreshing}
      aria-label="Refresh location"
      style={{ ...circleButton(44), backgroundColor: bg, cursor: refreshing ? 'default' : 'pointer' }}
    >
      <RefreshCw style={{
        width: 16, height: 16, color,
        animation: refreshing ? 'spin 1s linear infinite' : undefined,
      }} />
    </button>
  );

  const pullIndicator = pullDistance > 0 && (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: `${pullDistance}px`, overflow: 'hidden', transition: 'height 0.15s ease',
    }}>
      <RefreshCw style={{
        width: '18px', height: '18px', color: theme.accent,
        transform: `rotate(${pullDistance * 3}deg)`,
      }} />
    </div>
  );

  const venuePill = (venue: Venue, action: 'checkin' | 'peek') => {
    const hotspot = activeHotspots.get(venue.id);
    const hotspotLabel = hotspot
      ? `, hotspot for ${hotspot.eventName}${hotspot.stamped ? ', stamped' : ''}`
      : '';
    return (
    <button
      key={venue.id}
      onClick={() => (action === 'checkin' ? handleCheckIn(venue) : setPeekVenue(venue))}
      aria-label={`${action === 'checkin' ? 'Check in at' : 'Peek at'} ${venue.name}${hotspotLabel}`}
      style={{
        position: 'relative', flexShrink: 0, width: '100%', minHeight: 48, borderRadius: 9999,
        border: '1.5px solid rgba(0,0,0,0.55)', overflow: 'hidden', cursor: 'pointer',
        backgroundImage: venue.banner_image
          ? `linear-gradient(rgba(0,0,0,0.25), rgba(0,0,0,0.25)), url(${venue.banner_image})`
          : `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 44px',
        color: '#fff', fontFamily: FONT, fontSize: 15, fontWeight: 700,
        textShadow: '0 1px 3px rgba(0,0,0,0.8)',
        opacity: action === 'peek' ? 0.85 : 1,
      }}
    >
      {action === 'peek' && <Eye aria-hidden style={{ width: 14, height: 14, flexShrink: 0 }} />}
      {hotspot && <HotspotBadge stamped={hotspot.stamped} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{venue.name}</span>
    </button>
    );
  };

  // ---------------------------------------------------------- venues detected
  if (hasRealLocation && !loading && inRange.length > 0) {
    return (
      <div style={{ padding: '16px 16px 0' }}>
        {pullIndicator}
        <section
          aria-label="Locations detected"
          style={{
            position: 'relative', border: `2px solid ${CARD_EDGE}`, borderRadius: 24,
            padding: 8, backgroundColor: theme.surface,
          }}
        >
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 176, overflowY: 'auto',
            paddingBottom: 4,
          }}>
            {inRange.map((v) => venuePill(v, 'checkin'))}
            {nearby.slice(0, NEARBY_LIMIT).map((v) => venuePill(v, 'peek'))}
          </div>
          <button
            onClick={openAddLocation}
            aria-label="Add a location"
            style={{
              ...circleButton(44), position: 'absolute', right: -6, bottom: -10, borderRadius: 12,
              backgroundColor: theme.accent, border: `2px solid ${theme.bg}`,
            }}
          >
            <MapPinPlus style={{ width: 20, height: 20, color: theme.onAccent }} />
          </button>
        </section>
        {comingSoonNote}
        {peekVenue && <VenuePeekModal venue={peekVenue} onClose={() => setPeekVenue(null)} />}
      </div>
    );
  }

  // ------------------------------------------- not recognized / location off
  const searchable = (hasRealLocation ? nearby : venues.filter((v) => v.lat != null && v.lng != null))
    .filter((v) => v.name.toLowerCase().includes(query.trim().toLowerCase()));

  const eyebrow = locationPermissionBlocked
    ? 'Location is blocked for this site'
    : !hasRealLocation
      ? "Location's off"
      : loading
        ? 'Finding venues near you…'
        : "We don't recognize where you are";

  return (
    <div style={{ padding: '16px 16px 0' }}>
      {pullIndicator}
      <section
        aria-label="Your location"
        style={{
          position: 'relative', border: `2px solid ${CARD_EDGE}`, borderRadius: 24,
          padding: '14px 14px 34px', textAlign: 'center', color: '#15161A', fontFamily: FONT,
          // Faded street-map texture, echoing the mock's map backdrop.
          backgroundColor: '#EEF1F3',
          backgroundImage: [
            'linear-gradient(90deg, transparent 47%, rgba(255,255,255,0.9) 47%, rgba(255,255,255,0.9) 53%, transparent 53%)',
            'linear-gradient(0deg, transparent 47%, rgba(255,255,255,0.9) 47%, rgba(255,255,255,0.9) 53%, transparent 53%)',
            'linear-gradient(30deg, transparent 49%, rgba(220,210,170,0.6) 49%, rgba(220,210,170,0.6) 51%, transparent 51%)',
          ].join(', '),
          backgroundSize: '64px 64px, 64px 64px, 160px 160px',
        }}
      >
        <div style={{ position: 'absolute', top: 6, right: 6 }}>
          {refreshButton('#15161A', 'rgba(255,255,255,0.7)')}
        </div>

        <p style={{ fontSize: 13, fontWeight: 600, margin: '0 40px 4px' }}>{eyebrow}</p>
        <p style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.3, margin: '0 24px' }}>
          Add this location/event or{' '}
          <button
            onClick={() => setShowSearch((s) => !s)}
            aria-expanded={showSearch}
            style={{
              background: 'none', border: 'none', padding: '10px 4px', margin: '-10px -4px',
              font: 'inherit', color: 'inherit', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            search <Search aria-hidden style={{ width: 18, height: 18 }} />
          </button>
        </p>

        {locationPermissionBlocked && (
          <button
            onClick={() => setShowLocationFix(true)}
            style={{
              marginTop: 10, minHeight: 36, padding: '8px 16px', borderRadius: 999, border: 'none',
              backgroundColor: '#15161A', color: '#fff', fontSize: 13, fontWeight: 700,
              fontFamily: FONT, cursor: 'pointer',
            }}
          >
            Show me how to turn it on
          </button>
        )}

        {showSearch && (
          <div style={{ marginTop: 12, textAlign: 'left' }}>
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Venue or event name"
              aria-label="Search venues"
              style={{
                width: '100%', minHeight: 44, borderRadius: 12, border: '1px solid #C9CDD3',
                padding: '0 14px', fontSize: 16, fontFamily: FONT, color: '#15161A', backgroundColor: '#fff',
              }}
            />
            <div style={{ maxHeight: 200, overflowY: 'auto', marginTop: 8 }}>
              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}><span className="spinner" /></div>
              ) : searchable.length === 0 ? (
                <p style={{ fontSize: 13, color: '#4A4D55', padding: '8px 4px' }}>
                  {loadError
                    ? "Couldn't load venues. Tap refresh to try again."
                    : query.trim()
                      ? 'No venues match that name.'
                      : 'No venues to show yet.'}
                </p>
              ) : (
                searchable.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => handleSearchPick(v)}
                    style={{
                      display: 'block', width: '100%', minHeight: 44, textAlign: 'left',
                      backgroundColor: '#fff', border: '1px solid #DADDE2', borderRadius: 10,
                      padding: '10px 14px', marginBottom: 6, color: '#15161A', fontSize: 14,
                      cursor: 'pointer', fontFamily: FONT,
                    }}
                  >
                    {v.name}{v.city ? ` — ${v.city}` : ''}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <button
          onClick={openAddLocation}
          aria-label="Add this location or event"
          style={{
            ...circleButton(52), position: 'absolute', left: '50%', bottom: -22, transform: 'translateX(-50%)',
            backgroundColor: '#000', border: `3px solid ${theme.bg}`,
          }}
        >
          <Plus style={{ width: 26, height: 26, color: '#fff' }} strokeWidth={3} />
        </button>
      </section>
      {comingSoonNote}
      {peekVenue && <VenuePeekModal venue={peekVenue} onClose={() => setPeekVenue(null)} />}
      {showLocationFix && <LocationFixSheet onClose={() => setShowLocationFix(false)} />}
    </div>
  );
}
