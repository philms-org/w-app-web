'use client';

import { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import L from 'leaflet';

// Custom Wing Me marker icon
const createWingMeIcon = (count: number, isHot: boolean = false) => {
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
    className: 'wing-me-marker',
    iconSize: [48, 56],
    iconAnchor: [24, 56],
    popupAnchor: [0, -56],
  });
};

interface WingMeMapProps {
  locations: any[];
  onLocationSelect: (location: any) => void;
  onMapClick?: (lat: number, lng: number) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
}

export default function WingMeMap({ 
  locations, 
  onLocationSelect,
  onMapClick,
  center = { lat: 40.7128, lng: -74.0060 }, 
  zoom = 13 
}: WingMeMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([center.lat, center.lng], zoom);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);

    // Add custom zoom control
    L.control.zoom({
      position: 'bottomright'
    }).addTo(map);

    // Add Wing Me location markers
    locations.forEach((location) => {
      const marker = L.marker([location.latitude, location.longitude], {
        icon: createWingMeIcon(location.count, location.isHot)
      }).addTo(map);

      // Add popup with location info
      marker.bindPopup(`
        <div style="font-family: Montserrat, system-ui, sans-serif; min-width: 200px;">
          <h3 style="font-weight: 600; margin-bottom: 4px; color: #231E20;">${location.name}</h3>
          <p style="color: #919191; font-size: 14px; margin-bottom: 8px;">${location.description}</p>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="color: #17BFD9; font-weight: 600;">${location.count} ${location.count === 1 ? 'person' : 'people'}</span>
            <span style="color: #919191;">•</span>
            <span style="color: #919191;">${location.radius}m radius</span>
          </div>
          <button 
            onclick="window.wingMeSelectLocation('${location.id}')"
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
            Wing Me Here
          </button>
        </div>
      `);

      // Add click handler
      marker.on('click', () => {
        onLocationSelect(location);
      });
    });

    // Add user location marker (current position)
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

    L.marker([center.lat, center.lng], { icon: userIcon }).addTo(map)
      .bindPopup('Your Location');

    // Add map click handler for adding new locations
    if (onMapClick) {
      map.on('click', (e) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    mapInstanceRef.current = map;

    // Global function for popup buttons
    (window as any).wingMeSelectLocation = (locationId: string) => {
      const location = locations.find(loc => loc.id === locationId);
      if (location) {
        onLocationSelect(location);
      }
    };

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [locations, center, zoom, onLocationSelect]);

  // Update map when center changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([center.lat, center.lng], zoom);
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
      
      {/* App Download Banner */}
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
            }}>Download the Wing Me app for full features, messaging, and real-time updates</p>
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
      
      {/* Add Leaflet CSS */}
      <style jsx global>{`
        @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
        
        .wing-me-marker {
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
