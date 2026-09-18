'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchVenues } from '@/lib/data';
import { useStore } from '@/lib/store';
import { requestLocation } from '@/lib/geolocation';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { haversineMeters, DEFAULT_RADIUS_METERS } from '@/lib/geo';
import { theme } from '@/lib/theme';
import type { Venue } from '@/lib/types';
import { MapPinOff, MapPin, RefreshCw, Eye } from 'lucide-react';
import VenuePeekModal from '@/components/home/VenuePeekModal';

export default function NearbyBanner() {
  const { currentLocation, locationDenied, setSelectedLocation } = useStore();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [peekVenue, setPeekVenue] = useState<Venue | null>(null);

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
      if (distance <= radius) inRangeList.push(venue);
      else nearbyList.push(venue);
    }
    return { inRange: inRangeList, nearby: nearbyList };
  }, [venues, currentLocation, hasRealLocation]);

  const handleCheckIn = (venue: Venue) => {
    // Same Venue -> store Location conversion MapTab.tsx uses for its own
    // "Check In Here" button — CheckedInHero's geofence math depends on this
    // exact shape (latitude/longitude/radius, not lat/lng/geofence_radius_meters).
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
  };

  const cardStyle: React.CSSProperties = {
    flexShrink: 0,
    width: '220px',
    borderRadius: '16px',
    overflow: 'hidden',
    backgroundColor: theme.surface,
    border: `1px solid ${theme.divider}`,
  };

  const renderCard = (venue: Venue, action: 'checkin' | 'peek') => (
    <div key={venue.id} style={cardStyle}>
      <div style={{
        height: '110px',
        backgroundImage: venue.banner_image ? `url(${venue.banner_image})` : undefined,
        background: venue.banner_image
          ? undefined
          : `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />
      <div style={{ padding: '12px 14px 14px' }}>
        <h3 style={{
          color: theme.text, fontSize: '15px', fontWeight: 700, marginBottom: '4px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}>{venue.name}</h3>
        {venue.description && (
          <p style={{
            color: theme.muted, fontSize: '12px', marginBottom: '10px',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', fontFamily: 'Montserrat, system-ui, sans-serif',
          }}>{venue.description}</p>
        )}
        {action === 'checkin' ? (
          <button
            onClick={() => handleCheckIn(venue)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              width: '100%', backgroundColor: theme.accent, color: theme.onAccent, border: 'none',
              borderRadius: '12px', padding: '8px 0', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'Montserrat, system-ui, sans-serif',
            }}
          >
            <MapPin style={{ width: '14px', height: '14px' }} />
            Check In
          </button>
        ) : (
          <button
            onClick={() => setPeekVenue(venue)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              width: '100%', backgroundColor: theme.surface2, color: theme.accent,
              border: `1px solid ${theme.divider}`, borderRadius: '12px', padding: '8px 0',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Montserrat, system-ui, sans-serif',
            }}
          >
            <Eye style={{ width: '14px', height: '14px' }} />
            Peek
          </button>
        )}
      </div>
    </div>
  );

  const headerRow = (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px', marginBottom: '12px',
    }}>
      <p style={{
        color: hasRealLocation ? theme.text : theme.muted,
        fontSize: '13px', fontWeight: 700,
        fontFamily: 'Montserrat, system-ui, sans-serif',
      }}>
        {hasRealLocation ? 'Location detected' : 'Location not detected'}
      </p>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        aria-label="Refresh location"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '28px', height: '28px', borderRadius: '9999px', border: 'none',
          backgroundColor: theme.surface2, cursor: refreshing ? 'default' : 'pointer',
        }}
      >
        <RefreshCw style={{
          width: '14px', height: '14px', color: theme.text,
          animation: refreshing ? 'spin 1s linear infinite' : undefined,
        }} />
      </button>
    </div>
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

  if (!hasRealLocation) {
    return (
      <div style={{ padding: '20px 0 4px' }}>
        {pullIndicator}
        {headerRow}
        <div style={{ padding: '32px 24px', textAlign: 'center' }}>
          <MapPinOff style={{ width: '32px', height: '32px', color: theme.muted, margin: '0 auto 12px' }} />
          <p style={{ color: theme.muted, fontSize: '14px', marginBottom: '16px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
            {locationDenied ? "Couldn't get your location. Try again or enter it manually." : 'Turn on location to see nearby venues.'}
          </p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              backgroundColor: theme.accent, color: theme.onAccent, border: 'none',
              borderRadius: '12px', padding: '10px 24px', fontSize: '14px', fontWeight: 700,
              cursor: refreshing ? 'default' : 'pointer', marginBottom: '12px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
            }}
          >
            {refreshing ? 'Enabling…' : 'Enable Location'}
          </button>
          <div>
            <button
              onClick={() => setShowManualEntry((v) => !v)}
              style={{
                background: 'none', border: 'none', color: theme.muted, fontSize: '12px',
                textDecoration: 'underline', cursor: 'pointer',
                fontFamily: 'Montserrat, system-ui, sans-serif',
              }}
            >
              or enter it manually
            </button>
          </div>
          {showManualEntry && (
            <div style={{ marginTop: '16px', textAlign: 'left' }}>
              <p style={{ color: theme.muted, fontSize: '12px', marginBottom: '8px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
                Pick a venue to use as your location:
              </p>
              {venues.filter((v) => v.lat != null && v.lng != null).map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    useStore.getState().setCurrentLocation({ lat: v.lat as number, lng: v.lng as number });
                    useStore.getState().setLocationDenied(false);
                    setShowManualEntry(false);
                  }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', backgroundColor: theme.surface,
                    border: `1px solid ${theme.divider}`, borderRadius: '10px', padding: '10px 14px',
                    marginBottom: '6px', color: theme.text, fontSize: '13px', cursor: 'pointer',
                    fontFamily: 'Montserrat, system-ui, sans-serif',
                  }}
                >
                  {v.name}{v.city ? ` — ${v.city}` : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 0 4px' }}>
      {pullIndicator}
      {headerRow}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
          <span className="spinner" />
        </div>
      )}

      {!loading && inRange.length === 0 && nearby.length === 0 && (
        <p style={{ color: theme.muted, fontSize: '14px', padding: '0 20px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          {loadError ? "Couldn't load venues. Tap refresh to try again." : 'No locations nearby yet'}
        </p>
      )}

      {!loading && inRange.length > 0 && (
        <>
          <p style={{
            color: theme.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.5px', margin: '0 0 8px', padding: '0 20px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}>You&apos;re here — check in</p>
          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', padding: '0 20px 8px' }}>
            {inRange.map((v) => renderCard(v, 'checkin'))}
          </div>
        </>
      )}

      {!loading && nearby.length > 0 && (
        <>
          <p style={{
            color: theme.muted, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.5px', margin: '16px 0 8px', padding: '0 20px',
            fontFamily: 'Montserrat, system-ui, sans-serif',
          }}>Nearby — peek in</p>
          <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', padding: '0 20px 8px' }}>
            {nearby.map((v) => renderCard(v, 'peek'))}
          </div>
        </>
      )}

      {peekVenue && <VenuePeekModal venue={peekVenue} onClose={() => setPeekVenue(null)} />}
    </div>
  );
}
