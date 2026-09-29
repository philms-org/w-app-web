'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { fetchProfile } from '@/lib/data';
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
  const { isAuthenticated, hasHydrated, activeTab, setActiveTab, unreadCount, currentLocation, setCurrentLocation, setLocationDenied, setUser, setToken } = useStore();
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [locationPermissionAsked, setLocationPermissionAsked] = useState(false);

  useEffect(() => {
    // Wait for the persisted store to rehydrate before deciding — otherwise
    // this races the default isAuthenticated:false against the real value
    // and can bounce a logged-in user back to login on a fresh page load.
    if (!hasHydrated) return;

    let cancelled = false;

    (async () => {
      // Magic-link returns land here (signInWithMagicLink redirects to
      // `${origin}/main`) with no onAuthStateChange listener anywhere in the
      // app to sync the real session Supabase's client just established
      // (via detectSessionInUrl) into this Zustand store — every guard below
      // reads the store, not supabase.auth directly. Reconcile before
      // evaluating the redirect decision so neither failure mode below can
      // slip through:
      //   (a) same-browser tab: the store still holds a stale anonymous
      //       identity from before the magic link was clicked.
      //   (b) fresh browser/device: the store has no persisted state at all.
      // getSession() can reject (storage access blocked in a private window,
      // a corrupt persisted session, a failed token refresh). Treat that as
      // "nothing to reconcile" and fall through to the store-based guard
      // below instead of leaving an unhandled rejection and a blank page.
      let session: Session | null = null;
      try {
        ({ data: { session } } = await supabase.auth.getSession());
      } catch (err) {
        console.error('Failed to read auth session on /main:', err);
      }
      if (cancelled) return;

      const storeUser = useStore.getState().user;
      if (session?.user && session.user.id !== storeUser?.id) {
        let profile = null;
        try {
          profile = await fetchProfile(session.user.id);
        } catch {
          // No profiles row yet (e.g. a real user mid-onboarding) — proceed
          // with what the auth session alone tells us.
          profile = null;
        }
        if (cancelled) return;

        setToken(session.access_token);
        setUser({
          id: session.user.id,
          name: profile?.display_name ?? session.user.email ?? '',
          email: session.user.email ?? '',
          phone: profile?.phone ?? '',
          gender: '',
          birth: '',
          image: profile?.avatar_url ?? undefined,
          city: profile?.city ?? undefined,
          profession: profile?.profession ?? undefined,
          isAnonymous: !!session.user.is_anonymous,
          setupComplete: !!profile?.city,
        });
      }

      if (cancelled) return;

      // Evaluate the redirect decision against the freshest state — either
      // what was just synced above, or the store as it already stood if
      // there was nothing to reconcile (the common case).
      if (!useStore.getState().isAuthenticated) {
        // No session at all, real or anonymous (e.g. a direct deep link
        // before EnsureSession has run) — bootstrap one on the landing page
        // rather than sending a first-time visitor to a login form they
        // don't need.
        router.push('/');
        return;
      }

      // Show the location prompt whenever we don't already have a location for
      // this session. `currentLocation` isn't persisted across page loads (see
      // lib/store.ts partialize), so this re-prompts on every fresh session —
      // it used to also require `w_app_location_permission_asked` to be unset,
      // but that flag is set permanently on the very first visit, which
      // silently disabled this prompt for every session after that.
      if (!useStore.getState().currentLocation && !locationPermissionAsked) {
        setShowLocationPrompt(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasHydrated, isAuthenticated, router, currentLocation, locationPermissionAsked, setUser, setToken]);

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
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg }}>
      {activeTab === 'home' && <AppHeader />}

      {/* Main content */}
      {/* Clears the fixed 64px TabBar (+ the home indicator on notched phones). */}
      <div style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom))' }}>
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
