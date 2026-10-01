'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Popup HTML is built from venue data; escape it so names/descriptions
// can't inject markup or script.
const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Custom location marker icon
const createLocationIcon = (count: number, isHot: boolean = false) => {
  const color = isHot ? '#EC2C91' : '#17BFD9';

  return L.divIcon({
    html: `
      <div style="
        width: 48px;
        height: 48px;
        background-color: ${color};
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        color: white;
        font-weight: bold;
        font-size: 16px;
        font-family: Montserrat, system-ui, sans-serif;
        position: relative;
      ">${count}</div>
      <div style="
        position: absolute;
        top: 44px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 8px solid ${color};
      "></div>
    `,
    className: 'w-marker',
    iconSize: [48, 56],
    iconAnchor: [24, 56],
    popupAnchor: [0, -56],
  });
};

const createHotspotIcon = (stamped: boolean) => {
  const fill = stamped ? '#3ECF6B' : '#FF7A45';
  const glyph = stamped
    ? '<path d="M5 12l5 5L20 7" stroke="#0b1a0f" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    : '<path d="M12 3c1 3 4 4.5 4 8.5a4 4 0 1 1-8 0c0-1.6.8-2.8 1.8-3.8.2 1.5 1 2.3 2 2.6C11.2 8 11 5.5 12 3z" fill="#1a0a02"/>';
  return L.divIcon({
    html: `<div style="width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${fill};border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.4)"><svg width="18" height="18" viewBox="0 0 24 24" style="transform:rotate(45deg)">${glyph}</svg></div>`,
    className: 'w-hotspot-marker',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
  });
};


interface WMapProps {
  locations: any[];
  onLocationSelect: (location: any) => void;
  onMapClick?: (lat: number, lng: number) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
}

export default function WMap({
  locations,
  onLocationSelect,
  onMapClick,
  center = { lat: 40.7128, lng: -74.0060 },
  zoom = 13
}: WMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const [bannerDismissed, setBannerDismissed] = useState(true); // default hidden until we read localStorage

  useEffect(() => {
    setBannerDismissed(localStorage.getItem('w_app_download_banner_dismissed') === 'true');
  }, []);

  const dismissBanner = () => {
    localStorage.setItem('w_app_download_banner_dismissed', 'true');
    setBannerDismissed(true);
  };

  // Create the map once on mount; never recreated on prop changes.
  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      zoomAnimation: false,
    }).setView([center.lat, center.lng], zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    map.on('click', (e) => {
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng);
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = [];
      userMarkerRef.current = null;
    };
  }, []);

  // Rebuild location markers whenever the location list (or its handler) changes.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = locations.map((location) => {
      if (location.hotspot) {
        const hotspotMarker = L.marker([location.latitude, location.longitude], {
          icon: createHotspotIcon(location.hotspot.stamped),
          title: location.name,
          keyboard: true,
        }).addTo(map);
        hotspotMarker.on('click', () => onLocationSelect(location));
        return hotspotMarker;
      }
      const marker = L.marker([location.latitude, location.longitude], {
        icon: createLocationIcon(location.count, location.isHot)
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: Montserrat, system-ui, sans-serif; min-width: 200px;">
          <h3 style="font-weight: 600; margin-bottom: 4px; color: #231E20;">${escapeHtml(location.name)}</h3>
          <p style="color: #6B6B70; font-size: 14px; margin-bottom: 8px;">${escapeHtml(location.description)}</p>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="color: #17BFD9; font-weight: 600;">${escapeHtml(location.count)} ${location.count === 1 ? 'person' : 'people'}</span>
            <span style="color: #6B6B70;">•</span>
            <span style="color: #6B6B70;">${escapeHtml(location.radius)}m radius</span>
          </div>
          <button
            onclick="window.wSelectLocation(${escapeHtml(JSON.stringify(String(location.id)))})"
            style="
              width: 100%;
              background-color: #17BFD9;
              color: white;
              padding: 8px 16px;
              border-radius: 8px;
              border: none;
              font-weight: 600;
              cursor: pointer;
              font-family: Montserrat, system-ui, sans-serif;
            "
          >
            Check In Here
          </button>
        </div>
      `);

      marker.on('click', () => {
        onLocationSelect(location);
      });

      return marker;
    });

    // Global function for popup buttons
    (window as any).wSelectLocation = (locationId: string) => {
      const location = locations.find(loc => loc.id === locationId);
      if (location) {
        onLocationSelect(location);
      }
    };
  }, [locations, onLocationSelect]);

  // Move the user-location marker (and recenter) when center/zoom changes.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    map.setView([center.lat, center.lng], zoom);

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([center.lat, center.lng]);
    } else {
      const userIcon = L.divIcon({
        html: `
          <div style="
            width: 20px;
            height: 20px;
            background-color: #17BFD9;
            border: 4px solid white;
            border-radius: 50%;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          "></div>
        `,
        className: 'user-location-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      userMarkerRef.current = L.marker([center.lat, center.lng], { icon: userIcon }).addTo(map)
        .bindPopup('Your Location');
    }
  }, [center, zoom]);

  return (
    <>
      <div
        ref={mapRef}
        style={{
          height: '100vh',
          width: '100%',
          zIndex: 1
        }}
      />

      {/* App Download Banner (dismissible) */}
      {!bannerDismissed && (
      <div style={{
        position: 'absolute',
        top: '120px',
        left: '16px',
        right: '16px',
        backgroundColor: 'rgba(23, 191, 217, 0.95)',
        borderRadius: '12px',
        padding: '16px',
        zIndex: 1000,
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
        backdropFilter: 'blur(8px)'
      }}>
        <button
          onClick={dismissBanner}
          aria-label="Dismiss download banner"
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'rgba(255,255,255,0.25)',
            color: 'white',
            fontSize: '16px',
            lineHeight: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ×
        </button>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          color: 'white'
        }}>
          <div style={{
            fontSize: '24px'
          }}>📱</div>
          <div style={{ flex: 1 }}>
            <h3 style={{
              fontWeight: '600',
              fontSize: '16px',
              margin: '0 0 4px 0',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Get the Full Experience</h3>
            <p style={{
              fontSize: '14px',
              margin: 0,
              opacity: 0.9,
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>Download The W App for full features, messaging, and real-time updates</p>
          </div>
          <button style={{
            backgroundColor: 'white',
            color: '#17BFD9',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: '600',
            fontSize: '14px',
            cursor: 'pointer',
            fontFamily: 'Montserrat, system-ui, sans-serif'
          }}>
            Download
          </button>
        </div>
      </div>
      )}

      {/* Add Leaflet CSS. intentional: always-light surface — Leaflet popup /
          zoom-control chrome sits on the light OSM map tiles in both themes;
          full tokenization tracked for P7. */}
      <style jsx global>{`
        .w-marker {
          background: none !important;
          border: none !important;
        }

        .user-location-marker {
          background: none !important;
          border: none !important;
        }

        .leaflet-popup-content-wrapper {
          border-radius: 12px !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15) !important;
        }

        .leaflet-popup-tip {
          background: white !important;
        }

        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
        }

        .leaflet-control-zoom a {
          background-color: white !important;
          color: #17BFD9 !important;
          border: none !important;
          font-weight: bold !important;
          font-size: 18px !important;
        }

        .leaflet-control-zoom a:hover {
          background-color: #f3f3f3 !important;
        }
      `}</style>
    </>
  );
}
