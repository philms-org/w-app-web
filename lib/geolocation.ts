import { useStore } from '@/lib/store';

// Same fallback center app/main/page.tsx's modal has always used when
// geolocation is denied/unsupported — kept identical so behavior doesn't change.
const FALLBACK_LOCATION = { lat: 40.7128, lng: -74.0060 };

// Fetches a fresh position and writes it to the store. Used by the first-run
// permission modal AND by every manual-refresh entry point (header button,
// pull-to-refresh, "Enable Location" retry) added in this round — there is
// exactly one place that calls navigator.geolocation now.
export function requestLocation(): Promise<void> {
  const { setCurrentLocation, setLocationDenied } = useStore.getState();

  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      setCurrentLocation(FALLBACK_LOCATION);
      setLocationDenied(true);
      resolve();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocationDenied(false);
        resolve();
      },
      (error) => {
        console.error('Location error:', error);
        setCurrentLocation(FALLBACK_LOCATION);
        setLocationDenied(true);
        resolve();
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0, // manual refresh must not return a stale cached fix
      }
    );
  });
}
