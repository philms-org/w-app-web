// Standalone assertions — this repo has no test runner.
// Run: node scripts/verify-onboarding-data.mjs
import { EMPTY_DATA, STEP_TITLES, profileToData, dataToProfilePatch } from '../components/onboarding/types.ts';

const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

eq(STEP_TITLES.length, 5, 'STEP_TITLES length');
eq(EMPTY_DATA.socialisingId, '0', 'EMPTY_DATA.socialisingId');
eq(EMPTY_DATA.city, '', 'EMPTY_DATA.city');
eq(EMPTY_DATA.cityVisible, true, 'EMPTY_DATA.cityVisible');

// profileToData: null row -> all empties
eq(profileToData(null), EMPTY_DATA, 'profileToData(null)');

// profileToData: numeric ids -> strings, visible nulls -> true
const d = profileToData({
  socialising_id: 2, networking_id: null, dating_id: 0,
  city: 'Lisbon', nationality: null, profession: 'DJ',
  fave_drink: 'Sometimes', friday_night: null, relationship: 'Open',
  city_visible: false, profession_visible: null,
});
eq(d.socialisingId, '2', 'profileToData socialising_id -> "2"');
eq(d.networkingId, '0', 'profileToData null id -> "0"');
eq(d.city, 'Lisbon', 'profileToData city');
eq(d.nationality, '', 'profileToData null text -> ""');
eq(d.cityVisible, false, 'profileToData city_visible false');
eq(d.professionVisible, true, 'profileToData null visible -> true');

// dataToProfilePatch: trims, "" -> null, "0" id -> null
const patch = dataToProfilePatch('u1', {
  ...EMPTY_DATA, socialisingId: '3', city: '  Berlin  ', profession: '',
  favouriteDrink: 'No', cityVisible: false,
});
eq(patch.id, 'u1', 'patch.id');
eq(patch.socialising_id, 3, 'patch socialising_id 3');
eq(patch.networking_id, null, 'patch "0" id -> null');
eq(patch.city, 'Berlin', 'patch trims city');
eq(patch.profession, null, 'patch "" -> null');
eq(patch.fave_drink, 'No', 'patch fave_drink');
eq(patch.city_visible, false, 'patch city_visible');

if (!process.exitCode) console.log('OK: onboarding data helpers verified');
