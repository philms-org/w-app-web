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

interface VenueLike {
  lat?: number | null;
  lng?: number | null;
  geofence_radius_meters?: number | null;
}

// Nearest venue whose geofence actually contains `loc`, or null if none does.
// Shared by NearbyBanner (in-range/nearby split) and LandingLocationGate
// (pre-signup "are you at an active venue right now?" check).
export function findClosestVenueInRange<T extends VenueLike>(
  venues: T[],
  loc: { lat: number; lng: number }
): T | null {
  let closest: T | null = null;
  let closestDistance = Infinity;
  for (const venue of venues) {
    if (venue.lat == null || venue.lng == null) continue;
    const distance = haversineMeters(loc.lat, loc.lng, venue.lat, venue.lng);
    const radius = venue.geofence_radius_meters ?? DEFAULT_RADIUS_METERS;
    if (distance <= radius && distance < closestDistance) {
      closest = venue;
      closestDistance = distance;
    }
  }
  return closest;
}
