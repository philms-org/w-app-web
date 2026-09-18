'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { requestLocation } from '@/lib/geolocation';
import { supabase } from '@/lib/supabase';
import { signInAnonymously } from '@/lib/auth';
import { fetchVenues } from '@/lib/data';
import { findClosestVenueInRange, DEFAULT_RADIUS_METERS } from '@/lib/geo';
import { theme, elevation } from '@/lib/theme';
import type { Venue } from '@/lib/types';
import { MapPin } from 'lucide-react';
import FeedBlurBackdrop from '@/components/shared/FeedBlurBackdrop';
import Captcha, { captchaEnabled } from '@/components/ui/Captcha';

const PREVIEW_MS = 2000;
const ASKED_KEY = 'w_app_location_permission_asked';

type Phase = 'idle' | 'asking' | 'previewing';

// Mounted on the public landing page ("/"), alongside <AuthedRedirect>.
// Requests location before signup (moved from /main's post-signup prompt —
// identical copy/Allow/Deny behavior) so a visitor standing inside an active
// venue's geofence gets a brief preview + "Join" CTA before the existing,
// unchanged mandatory /auth/register wall. Everyone else — denied, no fix,
// nothing in range, or any failure along the way — sees no change at all:
// plain marketing page, exactly like today.
export default function LandingLocationGate() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, setSelectedLocation } = useStore();
  const [phase, setPhase] = useState<Phase>('idle');
  const [matchedVenue, setMatchedVenue] = useState<Venue | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Resolves silently in the background once 'asking' mounts, so a token is
  // ready by the time the visitor clicks Allow — no added friction. Read via
  // ref (not state) so handleAllow always sees the latest value at call time.
  const captchaTokenRef = useRef('');

  const [captchaMounted, setCaptchaMounted] = useState(false);

  useEffect(() => {
    if (!hasHydrated || isAuthenticated) return;
    const alreadyAsked = localStorage.getItem(ASKED_KEY);
    if (!alreadyAsked) {
      setPhase('asking');
      // Mounted for the rest of this visit (outlives the 'asking' → 'idle'
      // flip handleAllow does on click) so the ref already holds a token by
      // the time handleAllow reads it.
      setCaptchaMounted(true);
    }
  }, [hasHydrated, isAuthenticated]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const proceedToVenue = (venue: Venue) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Same Venue -> store Location shape NearbyBanner.handleCheckIn produces
    // — CheckedInHero's geofence effect depends on this exact field set.
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
    router.push('/auth/register');
  };

  const handleAllow = async () => {
    localStorage.setItem(ASKED_KEY, 'true');
    setPhase('idle');
    await requestLocation();

    const { currentLocation, locationDenied } = useStore.getState();
    if (locationDenied || !currentLocation) return;

    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) await signInAnonymously(captchaTokenRef.current || undefined);
      const venues = await fetchVenues();
      const venue = findClosestVenueInRange(venues, currentLocation);
      if (!venue) return;
      setMatchedVenue(venue);
      setPhase('previewing');
      timerRef.current = setTimeout(() => proceedToVenue(venue), PREVIEW_MS);
    } catch (err) {
      // Anonymous sign-ins not enabled on this environment yet, or a
      // network failure — fail open, stay on the plain marketing page.
      console.error('Landing location-activity check failed:', err);
    }
  };

  const handleDeny = () => {
    localStorage.setItem(ASKED_KEY, 'true');
    useStore.getState().setCurrentLocation({ lat: 40.7128, lng: -74.0060 });
    useStore.getState().setLocationDenied(true);
    setPhase('idle');
  };

  const captchaWidget = captchaEnabled && captchaMounted ? (
    <Captcha
      size="invisible"
      onVerify={(token) => {
        captchaTokenRef.current = token;
      }}
      onExpire={() => {
        captchaTokenRef.current = '';
      }}
    />
  ) : null;

  if (phase === 'idle') return captchaWidget;

  if (phase === 'previewing' && matchedVenue) {
    return (
      <>
      {captchaWidget}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}>
        <div style={{
          backgroundColor: theme.bg, borderRadius: 20, width: '100%', maxWidth: 420,
          boxShadow: elevation.glass, overflow: 'hidden', textAlign: 'center',
        }}>
          <div style={{
            height: 160,
            backgroundImage: matchedVenue.banner_image ? `url(${matchedVenue.banner_image})` : undefined,
            background: matchedVenue.banner_image
              ? undefined
              : `linear-gradient(135deg, ${theme.gradientStart} 0%, ${theme.gradientEnd} 100%)`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }} />
          <div style={{ padding: '20px 24px 24px' }}>
            <p style={{
              color: theme.muted, fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.06em', margin: '0 0 6px', fontFamily: 'Montserrat, system-ui, sans-serif',
            }}>
              You&apos;re here right now
            </p>
            <h2 style={{
              color: theme.text, fontSize: 22, fontWeight: 800, margin: '0 0 16px',
              fontFamily: 'Montserrat, system-ui, sans-serif',
            }}>
              {matchedVenue.name}
            </h2>

            <div style={{
              position: 'relative', height: 130, borderRadius: 14, overflow: 'hidden',
              backgroundColor: theme.surface, border: `1px solid ${theme.divider}`, marginBottom: 20,
            }}>
              <FeedBlurBackdrop />
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', padding: '0 20px',
              }}>
                <p style={{
                  color: theme.text, fontSize: 12, fontWeight: 600,
                  textShadow: '0 1px 4px rgba(0,0,0,0.6)', margin: 0,
                  fontFamily: 'Montserrat, system-ui, sans-serif',
                }}>
                  Join to see what&apos;s happening here
                </p>
              </div>
            </div>

            <button
              onClick={() => proceedToVenue(matchedVenue)}
              style={{
                width: '100%', backgroundColor: theme.accent, color: theme.onAccent,
                padding: '15px 24px', borderRadius: 12, border: 'none', fontWeight: 700,
                fontSize: 16, cursor: 'pointer', fontFamily: 'Montserrat, system-ui, sans-serif',
              }}
            >
              Join {matchedVenue.name}
            </button>
          </div>
        </div>
      </div>
      </>
    );
  }

  // 'asking' — the same modal copy/behavior app/main/page.tsx used to show
  // post-signup, moved here so it runs before the signup wall instead.
  return (
    <>
    {captchaWidget}
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      <div style={{
        backgroundColor: theme.surface, borderRadius: '20px', padding: '32px 24px',
        width: '100%', maxWidth: '400px', boxShadow: elevation.glass, textAlign: 'center',
      }}>
        <div style={{
          width: '80px', height: '80px', backgroundColor: theme.surface2, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
        }}>
          <MapPin style={{ width: '40px', height: '40px', color: theme.accent }} />
        </div>

        <h2 style={{
          fontWeight: '700', fontSize: '24px', marginBottom: '12px', color: theme.text,
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}>
          Share Your Location
        </h2>

        <p style={{
          color: theme.muted, fontSize: '16px', lineHeight: '1.5', marginBottom: '32px',
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}>
          The W App works best when we know your location — it&apos;s how we show you nearby
          people and places. While you&apos;re checked in to a venue that has defined areas, we
          also match your location to those areas (like &ldquo;Main Bar&rdquo;) so the organizer
          can see which areas are busy. They see totals for their venue only — never your name or
          your exact location — and this stops the moment you check out.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button
            onClick={handleAllow}
            style={{
              width: '100%', backgroundColor: theme.accent, color: theme.onAccent,
              padding: '16px 24px', borderRadius: '12px', border: 'none', fontWeight: '600',
              fontSize: '16px', cursor: 'pointer', fontFamily: 'Montserrat, system-ui, sans-serif',
            }}
          >
            Allow Location Access
          </button>

          <button
            onClick={handleDeny}
            style={{
              width: '100%', backgroundColor: 'transparent', color: theme.muted,
              padding: '16px 24px', borderRadius: '12px', border: `1px solid ${theme.divider}`,
              fontWeight: '500', fontSize: '16px', cursor: 'pointer',
              fontFamily: 'Montserrat, system-ui, sans-serif',
            }}
          >
            Maybe Later
          </button>
        </div>

        <p style={{
          color: theme.muted, fontSize: '12px', marginTop: '16px',
          fontFamily: 'Montserrat, system-ui, sans-serif',
        }}>
          Manage location access in your browser or device settings ·{' '}
          <a href="/privacy" style={{ color: theme.accent, textDecoration: 'underline' }}>
            Learn more
          </a>
        </p>
      </div>
    </div>
    </>
  );
}
