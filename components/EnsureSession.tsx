'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, MapPinOff } from 'lucide-react';
import { useStore } from '@/lib/store';
import { signInAnonymously } from '@/lib/auth';
import { requestLocation, locationSettingsInstructions } from '@/lib/geolocation';
import { theme, elevation } from '@/lib/theme';
import Captcha, { captchaEnabled } from '@/components/ui/Captcha';

// Mounted on the public landing page ("/"). Every visitor — not just
// returning authenticated ones — gets bounced straight into the app: an
// already-authenticated session goes in as-is, everyone else gets a fresh
// anonymous Supabase session first. Crawlers (no JS) never run this, so they
// still see the server-rendered marketing content in app/page.tsx untouched.
//
// Supersedes LandingLocationGate, and carries over its location step for
// first-time visitors: the same "Share Your Location" ask, a short
// "Location shared" confirmation (CONFIRM_MS) so granting permission visibly
// did something, and concrete platform-specific steps when the browser has
// location blocked for the site. The anonymous session bootstraps in
// parallel; the redirect to /main waits for both.

// If the invisible widget hasn't resolved a token within this window,
// bootstrap without one rather than stranding the visitor on the landing
// page — Supabase's own anonymous-sign-in rate limiting is the backstop.
const CAPTCHA_FALLBACK_MS = 3500;
const CONFIRM_MS = 1800;
const ASKED_KEY = 'w_app_location_permission_asked';
// Same fallback center /main and lib/geolocation use when location is off.
const FALLBACK_LOCATION = { lat: 40.7128, lng: -74.0060 };

type LocationPhase = 'pending' | 'asking' | 'confirmed' | 'blocked' | 'done';

const font = 'Montserrat, system-ui, sans-serif';

export default function EnsureSession() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, setUser, setToken } = useStore();
  const [captchaMounted, setCaptchaMounted] = useState(false);
  const [locationPhase, setLocationPhase] = useState<LocationPhase>('pending');
  const [sessionReady, setSessionReady] = useState(false);
  // The onVerify handler below is rendered outside the effect, so it reaches
  // the current effect run's bootstrap function through this ref rather than
  // a stale closure.
  const bootstrapRef = useRef<((captchaToken?: string) => void) | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True once THIS mount created the guest session. Setting the user flips
  // isAuthenticated, which must not trigger the returning-visitor redirect
  // below; that guest's redirect waits for the location step instead.
  const bootstrappedHereRef = useRef(false);

  // First visit only: ask for location here, before /main. Returning
  // visitors (flag already set) skip straight through; /main re-asks per
  // session on its own if it has no location.
  useEffect(() => {
    if (!hasHydrated || isAuthenticated) return;
    let asked = false;
    try { asked = !!localStorage.getItem(ASKED_KEY); } catch { asked = true; }
    setLocationPhase(asked ? 'done' : 'asking');
  }, [hasHydrated, isAuthenticated]);

  useEffect(() => () => {
    if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    if (isAuthenticated) {
      if (!bootstrappedHereRef.current) router.replace('/main');
      return;
    }

    let cancelled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    // Guards against double-firing if onVerify and the fallback timer race.
    let started = false;

    // A real signed-in visitor never reaches here (isAuthenticated already
    // returned above), so this never replaces an existing session.
    const bootstrap = (captchaToken?: string) => {
      if (started || cancelled) return;
      started = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);

      signInAnonymously(captchaToken)
        .then(({ user, session }) => {
          if (cancelled) return;
          if (!user || !session) {
            throw new Error('signInAnonymously resolved without a user/session');
          }
          bootstrappedHereRef.current = true;
          setToken(session.access_token);
          setUser({
            id: user.id,
            name: '',
            email: '',
            phone: '',
            gender: '',
            birth: '',
            isAnonymous: true,
            setupComplete: false,
          });
          setSessionReady(true);
        })
        .catch((err) => {
          // Anonymous sign-ins not enabled on this environment yet, or a
          // network failure — stay on the marketing page instead of a dead end.
          console.error('Anonymous session bootstrap failed:', err);
        });
    };

    bootstrapRef.current = bootstrap;

    if (captchaEnabled) {
      // Wait for a real token: mount the widget and only bootstrap once
      // onVerify fires, so the default (no signup wall) path actually
      // carries captcha protection. The fallback timer below is the
      // fail-open path if the widget never resolves in time.
      setCaptchaMounted(true);
      fallbackTimer = setTimeout(() => bootstrap(undefined), CAPTCHA_FALLBACK_MS);
    } else {
      // No site key configured — unchanged behavior, no token to wait for.
      bootstrap(undefined);
    }

    return () => {
      cancelled = true;
      bootstrapRef.current = null;
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [hasHydrated, isAuthenticated, router, setUser, setToken]);

  // New guest: go in once the session exists AND the location step is over.
  useEffect(() => {
    if (sessionReady && locationPhase === 'done') router.replace('/main');
  }, [sessionReady, locationPhase, router]);

  const finishLocation = useCallback(() => setLocationPhase('done'), []);

  const handleAllow = async () => {
    try { localStorage.setItem(ASKED_KEY, 'true'); } catch { /* private mode */ }
    await requestLocation();
    const { currentLocation, locationDenied, locationPermissionBlocked } = useStore.getState();
    if (locationPermissionBlocked) {
      // Retrying can't work until the user changes the site's permission in
      // their browser, so say exactly where that setting is.
      setLocationPhase('blocked');
      return;
    }
    if (locationDenied || !currentLocation) {
      finishLocation();
      return;
    }
    // Confirm the grant. Without this, clicking Allow and granting the
    // browser prompt produced no visible change at all.
    setLocationPhase('confirmed');
    confirmTimerRef.current = setTimeout(finishLocation, CONFIRM_MS);
  };

  const handleDeny = () => {
    try { localStorage.setItem(ASKED_KEY, 'true'); } catch { /* private mode */ }
    useStore.getState().setCurrentLocation(FALLBACK_LOCATION);
    useStore.getState().setLocationDenied(true);
    finishLocation();
  };

  const captchaWidget = captchaEnabled && captchaMounted ? (
    <Captcha
      size="invisible"
      onVerify={(token) => {
        bootstrapRef.current?.(token);
      }}
    />
  ) : null;

  if (locationPhase === 'confirmed') {
    return (
      <>
        {captchaWidget}
        <div role="status" style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          zIndex: 9999, backgroundColor: theme.surface, color: theme.text,
          borderRadius: 999, padding: '12px 20px', display: 'flex', alignItems: 'center',
          gap: 8, boxShadow: elevation.glass, fontFamily: font, fontSize: 14, fontWeight: 600,
        }}>
          <MapPin style={{ width: 16, height: 16, color: theme.accent }} />
          Location shared
        </div>
      </>
    );
  }

  if (locationPhase === 'asking' || locationPhase === 'blocked') {
    const blocked = locationPhase === 'blocked';
    return (
      <>
        {captchaWidget}
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="ensure-session-location-title" style={{
            backgroundColor: theme.surface, borderRadius: 20, padding: '32px 24px',
            width: '100%', maxWidth: 400, boxShadow: elevation.glass, textAlign: 'center',
          }}>
            <div style={{
              width: 80, height: 80, backgroundColor: theme.surface2, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
            }}>
              {blocked
                ? <MapPinOff style={{ width: 40, height: 40, color: theme.muted }} />
                : <MapPin style={{ width: 40, height: 40, color: theme.accent }} />}
            </div>

            <h2 id="ensure-session-location-title" style={{
              fontWeight: 700, fontSize: 24, marginBottom: 12, color: theme.text, fontFamily: font,
            }}>
              {blocked ? 'Location is blocked' : 'Share Your Location'}
            </h2>

            {blocked ? (
              <p style={{ color: theme.muted, fontSize: 16, lineHeight: 1.5, marginBottom: 32, fontFamily: font }}>
                Your browser has location turned off for this site. {locationSettingsInstructions()}
              </p>
            ) : (
              <p style={{ color: theme.muted, fontSize: 16, lineHeight: 1.5, marginBottom: 32, fontFamily: font }}>
                The W App works best when we know your location — it&apos;s how we show you nearby
                people and places. While you&apos;re checked in to a venue that has defined areas, we
                also match your location to those areas (like &ldquo;Main Bar&rdquo;) so the organizer
                can see which areas are busy. They see totals for their venue only — never your name or
                your exact location — and this stops the moment you check out.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!blocked && (
                <button
                  onClick={handleAllow}
                  style={{
                    width: '100%', backgroundColor: theme.accent, color: theme.onAccent,
                    padding: '16px 24px', borderRadius: 12, border: 'none', fontWeight: 600,
                    fontSize: 16, cursor: 'pointer', fontFamily: font,
                  }}
                >
                  Allow Location Access
                </button>
              )}
              <button
                onClick={blocked ? finishLocation : handleDeny}
                style={{
                  width: '100%', backgroundColor: blocked ? theme.accent : 'transparent',
                  color: blocked ? theme.onAccent : theme.muted,
                  padding: '16px 24px', borderRadius: 12,
                  border: blocked ? 'none' : `1px solid ${theme.divider}`,
                  fontWeight: blocked ? 600 : 500, fontSize: 16, cursor: 'pointer', fontFamily: font,
                }}
              >
                {blocked ? 'Continue without location' : 'Maybe Later'}
              </button>
            </div>

            <p style={{ color: theme.muted, fontSize: 12, marginTop: 16, fontFamily: font }}>
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

  return captchaWidget;
}
