'use client';

import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { requestLocation } from '@/lib/geolocation';

// While the browser has location blocked, retry whenever the user comes back
// to the tab (e.g. from the Settings app) or the permission changes, so
// fixing it in Settings just works — no "now refresh this page" step.
// Skips the retry while the Permissions API still reports "denied", so it
// never nags; where that API is missing a retry is harmless (a blocked
// request fails instantly without a prompt).
export function useLocationRecovery() {
  const blocked = useStore((s) => s.locationPermissionBlocked);

  useEffect(() => {
    if (!blocked || typeof navigator === 'undefined' || !navigator.geolocation) return;
    let status: PermissionStatus | null = null;
    let cancelled = false;

    const retry = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const s = await navigator.permissions?.query({ name: 'geolocation' });
        if (s?.state === 'denied') return;
      } catch { /* no Permissions API for geolocation: just try */ }
      requestLocation();
    };

    document.addEventListener('visibilitychange', retry);
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((s) => {
        if (cancelled) return;
        status = s;
        s.addEventListener('change', retry);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', retry);
      status?.removeEventListener('change', retry);
    };
  }, [blocked]);
}
