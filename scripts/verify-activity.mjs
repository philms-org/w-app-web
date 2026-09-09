// Run: node scripts/verify-activity.mjs
import { ACTIVITY_TARGET, meterFill } from '../lib/activity.ts';

const fail = (m) => { console.error('FAIL:', m); process.exitCode = 1; };
const eq = (a, b, m) => { if (a !== b) fail(`${m}: expected ${b}, got ${a}`); };

eq(ACTIVITY_TARGET, 3, 'ACTIVITY_TARGET');
eq(meterFill(0, 3), 0, '0/3');
eq(meterFill(2, 3), 2 / 3, '2/3');
eq(meterFill(3, 3), 1, '3/3');
eq(meterFill(5, 3), 1, 'clamps over target');
eq(meterFill(-1, 3), 0, 'clamps below 0');
eq(meterFill(1, 0), 0, 'target 0 -> 0');

if (!process.exitCode) console.log('OK: activity helpers verified');
