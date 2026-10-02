'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store';

// What the app thinks your location is, for diagnosing "location isn't
// working" reports. Hidden unless the URL has ?debugloc (e.g. /main?debugloc),
// so guests never see it.
export default function LocationDebug() {
  const [enabled, setEnabled] = useState(false);
  const { currentLocation, locationDenied, locationPermissionBlocked } = useStore();
  const [permission, setPermission] = useState('unknown');

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('debugloc')) return;
    setEnabled(true);
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((s) => {
        setPermission(s.state);
        s.addEventListener('change', () => setPermission(s.state));
      })
      .catch(() => setPermission('unsupported'));
  }, []);

  if (!enabled) return null;

  const fix = currentLocation
    ? `${currentLocation.lat.toFixed(5)}, ${currentLocation.lng.toFixed(5)}` +
      (currentLocation.accuracy != null ? ` ±${Math.round(currentLocation.accuracy)} m` : ' (accuracy unknown)')
    : 'none';

  return (
    <div style={{
      position: 'fixed', top: 'env(safe-area-inset-top)', left: 8, right: 8, zIndex: 20000,
      backgroundColor: 'rgba(0,0,0,0.85)', color: '#7CFC9A', borderRadius: 8, padding: '6px 10px',
      fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, lineHeight: 1.5, pointerEvents: 'none',
    }}>
      <div>fix: {fix}</div>
      <div>permission: {permission} · denied: {String(locationDenied)} · blocked: {String(locationPermissionBlocked)}</div>
    </div>
  );
}
