'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchVenues } from '@/lib/data';
import { useStore } from '@/lib/store';
import { theme } from '@/lib/theme';
import type { Venue } from '@/lib/types';
import { MapPinOff, Eye } from 'lucide-react';

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

function handlePeek(venue: Venue) {
  // Phase 3: wire to a real peekLocation() API call. For now this is a
  // display-only stub — "Peek" lets you remotely preview a venue before
  // checking in, but that backend support doesn't exist yet.
  console.log('Peek stub — would remotely preview venue', venue.id, venue.name);
}

export default function NearbyBanner() {
  const { currentLocation } = useStore();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVenues()
      .then(setVenues)
      .catch((err) => console.error('Failed to load nearby venues:', err))
      .finally(() => setLoading(false));
  }, []);

  const sorted = useMemo(() => {
    if (!currentLocation) return venues;
    return [...venues]
      .filter((v) => v.lat != null && v.lng != null)
      .sort((a, b) => {
        const da = haversineMeters(currentLocation.lat, currentLocation.lng, a.lat as number, a.lng as number);
        const db = haversineMeters(currentLocation.lat, currentLocation.lng, b.lat as number, b.lng as number);
        return da - db;
      });
  }, [venues, currentLocation]);

  if (!currentLocation) {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <MapPinOff style={{ width: '32px', height: '32px', color: theme.muted, margin: '0 auto 12px' }} />
        <p style={{ color: theme.muted, fontSize: '14px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          Can&apos;t detect your location
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 0 4px' }}>
      <p style={{
        color: theme.muted,
        fontSize: '11px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '12px',
        padding: '0 20px',
        fontFamily: 'Montserrat, system-ui, sans-serif'
      }}>Nearby locations</p>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px' }}>
          <span className="spinner" />
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <p style={{ color: theme.muted, fontSize: '14px', padding: '0 20px', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
          No locations nearby yet
        </p>
      )}

      {!loading && sorted.length > 0 && (
        <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', padding: '0 20px 8px' }}>
          {sorted.map((venue) => (
            <div
              key={venue.id}
              style={{
                flexShrink: 0,
                width: '220px',
                borderRadius: '16px',
                overflow: 'hidden',
                backgroundColor: theme.surface,
                border: `1px solid ${theme.divider}`
              }}
            >
              <div style={{
                height: '110px',
                backgroundImage: venue.banner_image ? `url(${venue.banner_image})` : undefined,
                background: venue.banner_image
                  ? undefined
                  : `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }} />
              <div style={{ padding: '12px 14px 14px' }}>
                <h3 style={{
                  color: theme.text,
                  fontSize: '15px',
                  fontWeight: 700,
                  marginBottom: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontFamily: 'Montserrat, system-ui, sans-serif'
                }}>{venue.name}</h3>
                {venue.description && (
                  <p style={{
                    color: theme.muted,
                    fontSize: '12px',
                    marginBottom: '10px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}>{venue.description}</p>
                )}
                <button
                  onClick={() => handlePeek(venue)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    width: '100%',
                    backgroundColor: theme.surface2,
                    color: theme.accent,
                    border: `1px solid ${theme.divider}`,
                    borderRadius: '9999px',
                    padding: '8px 0',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'Montserrat, system-ui, sans-serif'
                  }}
                >
                  <Eye style={{ width: '14px', height: '14px' }} />
                  Peek
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
