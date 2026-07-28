'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import TabBar from '@/components/TabBar';
import MainFeedTab from '@/components/tabs/MainFeedTab';
import MapTab from '@/components/tabs/MapTab';
import MessagesTab from '@/components/tabs/MessagesTab';
import ProfileTab from '@/components/tabs/ProfileTab';
import HistoryTab from '@/components/tabs/HistoryTab';
import { theme } from '@/lib/theme';
import { MapPin } from 'lucide-react';

export default function MainPage() {
  const router = useRouter();
  const { isAuthenticated, activeTab, setActiveTab, unreadCount, currentLocation, setCurrentLocation } = useStore();
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationPermissionAsked, setLocationPermissionAsked] = useState(false);
  
  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    // Show location prompt if not asked before and no current location
    const hasAskedPermission = localStorage.getItem('w_app_location_permission_asked');
    if (!hasAskedPermission && !currentLocation && !locationPermissionAsked) {
      setShowLocationPrompt(true);
    }
  }, [isAuthenticated, router, currentLocation, locationPermissionAsked]);

  const handleAllowLocation = () => {
    setLocationPermissionAsked(true);
    localStorage.setItem('w_app_location_permission_asked', 'true');
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setShowLocationPrompt(false);
        },
        (error) => {
          console.error('Location error:', error);
          // Use default location (New York City) if permission denied
          setCurrentLocation({ lat: 40.7128, lng: -74.0060 });
          setShowLocationPrompt(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    } else {
      // Geolocation not supported, use default location
      setCurrentLocation({ lat: 40.7128, lng: -74.0060 });
      setShowLocationPrompt(false);
    }
  };

  const handleDenyLocation = () => {
    setLocationPermissionAsked(true);
    localStorage.setItem('w_app_location_permission_asked', 'true');
    // Use default location (New York City)
    setCurrentLocation({ lat: 40.7128, lng: -74.0060 });
    setShowLocationPrompt(false);
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'map':
        return <MapTab />;
      case 'feed':
        return <MainFeedTab />;
      case 'messages':
        return <MessagesTab />;
      case 'profile':
        return <ProfileTab />;
      case 'history':
        return <HistoryTab />;
      default:
        return <MainFeedTab />;
    }
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-w-back-gray">
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
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '32px 24px',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            textAlign: 'center'
          }}>
            {/* Location Icon */}
            <div style={{
              width: '80px',
              height: '80px',
              backgroundColor: '#E0F7FA',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px'
            }}>
              <MapPin style={{ 
                width: '40px', 
                height: '40px', 
                color: '#17BFD9' 
              }} />
            </div>

            <h2 style={{
              fontWeight: '700',
              fontSize: '24px',
              marginBottom: '12px',
              color: '#1F2937',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>
              Share Your Location
            </h2>

            <p style={{
              color: '#6B7280',
              fontSize: '16px',
              lineHeight: '1.5',
              marginBottom: '32px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>
              The W App works best when we know your location. This helps us show you nearby people and places to connect.
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
                  backgroundColor: '#17BFD9',
                  color: 'white',
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
                  color: '#6B7280',
                  padding: '16px 24px',
                  borderRadius: '12px',
                  border: '1px solid #E5E7EB',
                  fontWeight: '500',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#F9FAFB';
                  e.currentTarget.style.borderColor = '#D1D5DB';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = '#E5E7EB';
                }}
              >
                Maybe Later
              </button>
            </div>

            <p style={{
              color: '#9CA3AF',
              fontSize: '12px',
              marginTop: '16px',
              fontFamily: 'Montserrat, system-ui, sans-serif'
            }}>
              You can change this in settings anytime
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
