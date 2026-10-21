import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWithinGeofence, findClosestVenueInRange, venueCoordsProblem, MAX_ACCURACY_ALLOWANCE_METERS } from './geo.ts';

test('exact distance inside radius is in range without accuracy', () => {
  assert.equal(isWithinGeofence(40, 50), true);
  assert.equal(isWithinGeofence(60, 50), false);
});

test('GPS accuracy margin extends the fence', () => {
  // 120m away, 50m fence, phone says ±100m → could be inside.
  assert.equal(isWithinGeofence(120, 50, 100), true);
  assert.equal(isWithinGeofence(200, 50, 100), false);
});

test('accuracy allowance is capped so a junk fix cannot check in from across town', () => {
  assert.equal(isWithinGeofence(50 + MAX_ACCURACY_ALLOWANCE_METERS + 1, 50, 5000), false);
  assert.equal(isWithinGeofence(50 + MAX_ACCURACY_ALLOWANCE_METERS, 50, 5000), true);
});

test('findClosestVenueInRange honors accuracy', () => {
  const venues = [{ id: 'a', lat: 36.1019, lng: -80.2389, geofence_radius_meters: 50 }];
  // ~111m north of the venue.
  const loc = { lat: 36.1029, lng: -80.2389 };
  assert.equal(findClosestVenueInRange(venues, loc), null);
  assert.equal(findClosestVenueInRange(venues, { ...loc, accuracy: 80 })?.id, 'a');
});

test('venueCoordsProblem accepts real coordinates', () => {
  assert.equal(venueCoordsProblem(36.1019, -80.2389), null);
  assert.equal(venueCoordsProblem(40.7328, -74.0021), null);
  assert.equal(venueCoordsProblem(51.5074, -0.1278), null);
  assert.equal(venueCoordsProblem(35.6762, 139.6503), null);
});

test('venueCoordsProblem rejects out-of-range values', () => {
  assert.match(venueCoordsProblem(95, -80.2)!, /Latitude/);
  assert.match(venueCoordsProblem(36.1, -190)!, /Longitude/);
});

test('venueCoordsProblem catches whole-number coordinates (dropped decimals)', () => {
  assert.match(venueCoordsProblem(36, -80)!, /decimal/);
});

test('venueCoordsProblem catches a US address whose longitude is missing its minus sign', () => {
  const addr = 'is located at 486 N. Patterson Ave, Suite 271, Winston-Salem, NC 27101';
  // The prod Winston-Salem bug: lat 36, lng 80.
  assert.ok(venueCoordsProblem(36, 80, addr));
  assert.match(venueCoordsProblem(36.1019, 80.2389, addr)!, /minus/);
  // A positive longitude is fine when nothing says the venue is in the US.
  assert.equal(venueCoordsProblem(35.6762, 139.6503, 'Shibuya, Tokyo'), null);
});
