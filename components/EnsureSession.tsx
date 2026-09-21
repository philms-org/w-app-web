'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { signInAnonymously } from '@/lib/auth';
import Captcha, { captchaEnabled } from '@/components/ui/Captcha';

// Mounted on the public landing page ("/"). Every visitor — not just
// returning authenticated ones — gets bounced straight into the app: an
// already-authenticated session goes in as-is, everyone else gets a fresh
// anonymous Supabase session first. Crawlers (no JS) never run this, so they
// still see the server-rendered marketing content in app/page.tsx untouched.
//
// Supersedes LandingLocationGate: this component makes anonymous sign-in the
// default path for every visitor (not just the narrow geofence-match case
// LandingLocationGate handled), so it carries the same invisible Turnstile
// captcha protection that component used for its own signInAnonymously call.

// If the invisible widget hasn't resolved a token within this window,
// bootstrap without one rather than stranding the visitor on the landing
// page — Supabase's own anonymous-sign-in rate limiting is the backstop.
// Unlike LandingLocationGate (which only called signInAnonymously after a
// user clicked "Allow Location", giving the widget time to solve in the
// background first), EnsureSession has no such natural delay, so this
// timer stands in for one.
const CAPTCHA_FALLBACK_MS = 3500;

export default function EnsureSession() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, setUser, setToken } = useStore();
  const [captchaMounted, setCaptchaMounted] = useState(false);
  // The onVerify handler below is rendered outside the effect, so it reaches
  // the current effect run's bootstrap function through this ref rather than
  // a stale closure.
  const bootstrapRef = useRef<((captchaToken?: string) => void) | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (isAuthenticated) {
      router.replace('/main');
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
          router.replace('/main');
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

  const captchaWidget = captchaEnabled && captchaMounted ? (
    <Captcha
      size="invisible"
      onVerify={(token) => {
        bootstrapRef.current?.(token);
      }}
    />
  ) : null;

  return captchaWidget;
}
