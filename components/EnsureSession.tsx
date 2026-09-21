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
export default function EnsureSession() {
  const router = useRouter();
  const { isAuthenticated, hasHydrated, setUser, setToken } = useStore();
  // Read via ref (not state) so the effect always sees the latest value at
  // call time without a stale closure. Unlike LandingLocationGate (which
  // waited for a user click before calling signInAnonymously, giving the
  // invisible widget time to resolve), this call fires immediately on mount,
  // so the token is usually still empty on this first bootstrap — the call
  // goes through uncaptcha'd here and Supabase's own anonymous-sign-in rate
  // limiting is the backstop. Left in place per product decision (see task
  // brief) so it's ready for any later retry/backoff path.
  const captchaTokenRef = useRef('');
  const [captchaMounted, setCaptchaMounted] = useState(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (isAuthenticated) {
      router.replace('/main');
      return;
    }

    // A real signed-in visitor never reaches here (isAuthenticated already
    // returned above), so this never replaces an existing session.
    setCaptchaMounted(true);

    let cancelled = false;
    signInAnonymously(captchaTokenRef.current || undefined)
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
    return () => { cancelled = true; };
  }, [hasHydrated, isAuthenticated, router, setUser, setToken]);

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

  return captchaWidget;
}
