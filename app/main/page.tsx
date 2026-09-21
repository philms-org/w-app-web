'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { requestLocation } from '@/lib/geolocation';
import TabBar from '@/components/TabBar';
import AppHeader from '@/components/AppHeader';
import HomeTab from '@/components/tabs/HomeTab';
import MapTab from '@/components/tabs/MapTab';
import MessagesTab from '@/components/tabs/MessagesTab';
import ProfileTab from '@/components/tabs/ProfileTab';
import HistoryTab from '@/components/tabs/HistoryTab';
import ProfileSetupPrompt from '@/components/onboarding/ProfileSetupPrompt';
import { theme, elevation } from '@/lib/theme';
import { MapPin } from 'lucide-react';

export default function MainPage() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, activeTab, setActiveTab, unreadCount, currentLocation, setCurrentLocation, setLocationDenied } = useStore();
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationPermissionAsked, setLocationPermissionAsked] = useState(false);

  useEffect(() => {
    // Wait for the persisted store to rehydrate before deciding — otherwise
    // this races the default isAuthenticated:false against the real value
    // and can bounce a logged-in user back to login on a fresh page load.
    if (!hasHydrated) return;

    // No session at all (e.g. a direct deep link before EnsureSession has run)
    // — bootstrap one on the landing page rather than sending a first-time
    // visitor to a login form they don't need.
    if (!isAuthenticated) {
      router.push('/');
      return;
    }

    // Show the location prompt whenever we don't already have a location for
    // this session. `currentLocation` isn't persisted across page loads (see
    // lib/store.ts partialize), so this re-prompts on every fresh session —
    // it used to also require `w_app_location_permission_asked` to be unset,
    // but that flag is set permanently by the landing page's own location
    // gate (components/LandingLocationGate.tsx) on the very first visit,
    // which silently disabled this prompt for every session after that.
    if (!currentLocation && !locationPermissionAsked) {
      setShowLocationPrompt(true);
    }
  }, [hasHydrated, isAuthenticated, router, currentLocation, locationPermissionAsked]);

  const handleAllowLocation = () => {
    setLocationPermissionAsked(true);
    localStorage.setItem('w_app_location_permission_asked', 'true');
    setShowLocationPrompt(false);
    requestLocation();
  };

  const handleDenyLocation = () => {
    setLocationPermissionAsked(true);
    localStorage.setItem('w_app_location_permission_asked', 'true');
    setCurrentLocation({ lat: 40.7128, lng: -74.0060 });
    setLocationDenied(true);
    setShowLocationPrompt(false);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'map':
        return <MapTab />;
      case 'home':
        return <HomeTab />;
      case 'messages':
        return <MessagesTab />;
      case 'profile':
        return <ProfileTab />;
      case 'history':
        return <HistoryTab />;
      default:
        return <HomeTab />;
    }
  };

  if (!hasHydrated || !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-w-back-gray">
      {activeTab === 'home' && <AppHeader />}

      {/* Main content */}
      <div className="pb-16">
        {renderTab()}
      </div>
      
      {/* Tab bar */}
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        unreadCount={unreadCount}
      />

      <ProfileSetupPrompt />

      {/* Location Permission Prompt */}
      {showLocationPrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <div style={{
            backgroundColor: theme.surface,
            borderRadius: '20px',
            padding: '32px 24px',
            width: '100%',
            maxWidth: '400px',
            boxShadow: elevation.glass,
            textAlign: 'center'
          }}>
            {/* Location Icon */}
            <div style={{
              width: '80px',
              height: '80px',
              backgroundColor: theme.surface2,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <MapPin style={{
                width: '40px',
                height: '40px',
                color: theme.accent
              }} />
            </div>

            <h2 style={{
              fontWeight: '700',
              fontSize: '24px',
              marginBottom: '12px',
              color: theme.text,
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>
              Share Your Location
            </h2>

            <p style={{
              color: theme.muted,
              fontSize: '16px',
              lineHeight: '1.5',
              marginBottom: '32px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>
              The W App works best when we know your location — it&apos;s how we show you nearby people and places. While you&apos;re checked in to a venue that has defined areas, we also match your location to those areas (like &ldquo;Main Bar&rdquo;) so the organizer can see which areas are busy. They see totals for their venue only — never your name or your exact location — and this stops the moment you check out.
            </p>

            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <button
                onClick={handleAllowLocation}
                style={{
                  width: '100%',
                  backgroundColor: theme.accent,
                  color: theme.onAccent,
                  padding: '16px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  fontWeight: '600',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = theme.accent2}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = theme.accent}
              >
                Allow Location Access
              </button>

              <button
                onClick={handleDenyLocation}
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  color: theme.muted,
                  padding: '16px 24px',
                  borderRadius: '12px',
                  border: `1px solid ${theme.divider}`,
                  fontWeight: '500',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = theme.surface2;
                  e.currentTarget.style.borderColor = theme.divider;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = theme.divider;
                }}
              >
                Maybe Later
              </button>
            </div>

            <p style={{
              color: theme.muted,
              fontSize: '12px',
              marginTop: '16px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>
              Manage location access in your browser or device settings ·{' '}
              <a href="/privacy" style={{ color: theme.accent, textDecoration: 'underline' }}>
                Learn more
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
