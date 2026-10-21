'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { STORAGE_KEYS } from '@/lib/constants';
import { theme, type as typeTokens } from '@/lib/theme';
import { Button } from '@/components/ui/primitives';

// Invite link an organizer sends attendees (/join/<token>, migration 0035).
// Stashes the token and sends the visitor through sign-up / log-in; /main
// redeems it (usePendingVenueInvite) and opens the venue with its feed.
// Stored rather than passed along so it survives email confirmation and the
// profile-setup detour.
export default function JoinVenuePage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const { isAuthenticated, hasHydrated } = useStore();

  useEffect(() => {
    if (!token) return;
    try {
      localStorage.setItem(STORAGE_KEYS.PENDING_VENUE_INVITE, token);
    } catch {
      /* private mode: nothing to carry the token through sign-up */
    }
  }, [token]);

  useEffect(() => {
    if (hasHydrated && isAuthenticated) router.replace('/main');
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated || isAuthenticated) return null;

  return (
    <div
      style={{
        minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 16, fontFamily: typeTokens.family,
      }}
    >
      <div style={{ width: '100%', maxWidth: 400, textAlign: 'center' }}>
        <h1 style={{ color: theme.text, fontSize: 24, fontWeight: 800, margin: '0 0 8px' }}>
          You&apos;re invited
        </h1>
        <p style={{ color: theme.muted, fontSize: 15, lineHeight: 1.5, margin: '0 0 24px' }}>
          Create an account to join the event feed and meet people before you arrive.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Button fullWidth onClick={() => router.push('/auth/register')}>
            Sign up
          </Button>
          <Button fullWidth variant="secondary" onClick={() => router.push('/auth/login')}>
            I already have an account
          </Button>
        </div>
      </div>
    </div>
  );
}
