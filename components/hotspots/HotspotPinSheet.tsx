'use client';

import { Flame, Navigation, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { haversineMeters } from '@/lib/geo';
import { theme, type as typeTokens } from '@/lib/theme';
import { Stamp, HOTSPOT_ORANGE } from '@/components/hotspots/HotspotsCard';

export type HotspotMapLocation = {
  id: string; name: string; latitude: number; longitude: number; banner_image?: string | null;
  hotspot: { stamped: boolean; eventName: string; note: string | null };
};

// Screen 2: bottom sheet for a tapped hotspot pin.
export default function HotspotPinSheet({
  location, onClose, onCheckIn,
}: { location: HotspotMapLocation; onClose: () => void; onCheckIn: () => void }) {
  const { currentLocation, locationDenied } = useStore();
  const meters = currentLocation && !locationDenied
    ? haversineMeters(currentLocation.lat, currentLocation.lng, location.latitude, location.longitude)
    : null;
  const distance = meters == null ? null : meters < 1000 ? `${Math.round(meters)} m away` : `${(meters / 1000).toFixed(1)} km away`;
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}`;

  return (
    <div role="dialog" aria-label={location.name} style={{
      position: 'fixed', left: 0, right: 0, bottom: 'calc(64px + env(safe-area-inset-bottom))', zIndex: 1200,
      backgroundColor: theme.surface, borderRadius: '20px 20px 0 0', padding: 16,
      borderTop: `1px solid ${theme.glassHighlight}`, fontFamily: typeTokens.family, color: theme.text,
    }}>
      <button onClick={onClose} aria-label="Close" style={{
        position: 'absolute', top: 8, right: 8, width: 44, height: 44, border: 'none', background: 'none',
        color: theme.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><X size={20} /></button>
      <div style={{
        height: 88, borderRadius: 12, marginBottom: 12, display: 'flex', alignItems: 'flex-end', padding: 10,
        backgroundImage: location.banner_image
          ? `linear-gradient(rgba(0,0,0,.2),rgba(0,0,0,.5)), url(${location.banner_image})`
          : `linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd})`,
        backgroundSize: 'cover', backgroundPosition: 'center',
      }}>
        <b style={{ fontSize: 16, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,.8)' }}>{location.name}</b>
      </div>
      <p style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 6px', fontSize: 13 }}>
        <Flame size={16} color={HOTSPOT_ORANGE} aria-hidden /> Hotspot for <b>{location.hotspot.eventName}</b>
      </p>
      {location.hotspot.note && <p style={{ margin: '0 0 8px', fontSize: 14 }}>&ldquo;{location.hotspot.note}&rdquo;</p>}
      <p style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 12px', fontSize: 12, color: theme.muted }}>
        <Stamp on={location.hotspot.stamped} size={20} />
        {location.hotspot.stamped ? 'Stamped' : 'Not stamped yet'}{distance ? ` · ${distance}` : ''}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCheckIn} style={{
          flex: 1, minHeight: 44, borderRadius: 12, border: 'none', backgroundColor: theme.accent, color: theme.onAccent,
          fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: typeTokens.family,
        }}>Check in</button>
        <a href={directions} target="_blank" rel="noopener noreferrer" style={{
          flex: 1, minHeight: 44, borderRadius: 12, border: `1px solid ${theme.glassHighlight}`, color: theme.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontWeight: 600, fontSize: 14, textDecoration: 'none',
        }}><Navigation size={16} aria-hidden /> Directions</a>
      </div>
    </div>
  );
}
