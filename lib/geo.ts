// Straight-line (haversine) distance in meters between two lat/lng points.
// Shared by NearbyBanner (in-range/nearby split) and CheckedInHero (geofence gate).
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const DEFAULT_RADIUS_METERS = 50;

// Venue row -> the store's selectedLocation shape. CheckedInHero's geofence
// math depends on this exact shape (latitude/longitude/radius).
export function venueToLocation(venue: {
  id: string; name: string; description?: string | null;
  lat?: number | null; lng?: number | null;
  geofence_radius_meters?: number | null; banner_image?: string | null;
}) {
  return {
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
  };
}

// Indoors a phone's fix is routinely 50–300m off, so judging "at the venue" on
// the raw point leaves people standing in the room outside a 50m fence. We
// give them the benefit of the reported error, capped so a wildly coarse fix
// (IP/cell-tower, 1km+) can't check someone in from across town.
export const MAX_ACCURACY_ALLOWANCE_METERS = 150;

export function isWithinGeofence(distanceMeters: number, radiusMeters: number, accuracyMeters?: number | null): boolean {
  const allowance = Math.min(Math.max(accuracyMeters ?? 0, 0), MAX_ACCURACY_ALLOWANCE_METERS);
  return distanceMeters - allowance <= radiusMeters;
}

// "City, NC 27101" / "..., USA" — enough to know a venue is meant to be in the US.
const US_ADDRESS = /\b[A-Z]{2}\s+\d{5}(-\d{4})?\b|\bUSA?\b|United States/;

// Sanity check for hand-entered venue coordinates. Returns a message for the
// admin form, or null if they look plausible. Exists because a Winston-Salem
// venue went live as lat 36, lng 80 (western China) and nobody could check in.
export function venueCoordsProblem(lat: number, lng: number, address?: string | null): string | null {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'Latitude must be between -90 and 90.';
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return 'Longitude must be between -180 and 180.';
  if (Number.isInteger(lat) && Number.isInteger(lng)) {
    return 'Coordinates need decimals (e.g. 36.1019, -80.2389) — whole numbers are off by miles.';
  }
  if (lng > 0 && address && US_ADDRESS.test(address)) {
    return 'US venues have a negative longitude — it looks like the minus sign is missing.';
  }
  return null;
}

interface VenueLike {
  lat?: number | null;
  lng?: number | null;
  geofence_radius_meters?: number | null;
}

// Nearest venue whose geofence actually contains `loc` (allowing for the
// fix's reported accuracy), or null if none does. Shared by NearbyBanner
// (in-range/nearby split) and LandingLocationGate (pre-signup "are you at an
// active venue right now?" check).
export function findClosestVenueInRange<T extends VenueLike>(
  venues: T[],
  loc: { lat: number; lng: number; accuracy?: number | null }
): T | null {
  let closest: T | null = null;
  let closestDistance = Infinity;
  for (const venue of venues) {
    if (venue.lat == null || venue.lng == null) continue;
    const distance = haversineMeters(loc.lat, loc.lng, venue.lat, venue.lng);
    const radius = venue.geofence_radius_meters ?? DEFAULT_RADIUS_METERS;
    if (isWithinGeofence(distance, radius, loc.accuracy) && distance < closestDistance) {
      closest = venue;
      closestDistance = distance;
    }
  }
  return closest;
}
