'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { STORAGE_KEYS } from '@/lib/constants';
import { isValidConnectToken } from '@/lib/connect';

// Someone scanned a connect code with their phone camera while signed out:
// /c/<token> stashed the token. Once they're signed in and land on /main,
// send them back to /c/<token> to finish connecting. The stash is cleared
// first so a bad or expired token can't loop.
export function usePendingConnect(): void {
  const router = useRouter();
  const { isAuthenticated, hasHydrated } = useStore();

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;
    let token: string | null = null;
    try {
      token = localStorage.getItem(STORAGE_KEYS.PENDING_CONNECT);
      if (token) localStorage.removeItem(STORAGE_KEYS.PENDING_CONNECT);
    } catch {
      return;
    }
    if (isValidConnectToken(token)) router.replace(`/c/${token}`);
  }, [hasHydrated, isAuthenticated, router]);
}
