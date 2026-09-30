import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeHotspotProgress, localDay, hotspotMeterFill } from './hotspotProgress.ts';

const hs = (location_id: string, created_at = '2026-01-01T00:00:00Z') => ({
  id: `h-${location_id}`, event_id: 'ev', location_id, note: null, sort_order: 0, created_at, place: null,
});
// `local` has no zone suffix → parsed as local time, like a real device clock.
const ci = (location_id: string, local: string) => ({
  location_id, checked_in_at: new Date(local).toISOString(),
});
const reward = (id: string, min_hotspots: number | null, is_active = true) => ({
  id, location_id: 'ev', name: id, is_active, display_order: 0, min_hotspots,
});

const hotspots = [hs('a'), hs('b'), hs('c'), hs('d'), hs('e')];
const dated = { event_date: '2026-10-03', event_end_date: '2026-10-04' };

test('counts distinct hotspots inside the event window only', () => {
  const p = computeHotspotProgress({
    hotspots, window: dated, rewards: [],
    checkins: [
      ci('a', '2026-10-03T10:00:00'), ci('b', '2026-10-04T12:00:00'),
      ci('c', '2026-10-02T12:00:00'), ci('d', '2026-10-05T09:00:00'),
    ],
  });
  assert.deepEqual([...p.visited].sort(), ['a', 'b']);
  assert.equal(p.count, 2);
  assert.equal(p.total, 5);
});

test('late-night local check-in on the last day counts (local day, not UTC)', () => {
  const late = ci('a', '2026-10-04T23:30:00');
  assert.equal(localDay(late.checked_in_at), '2026-10-04');
  const p = computeHotspotProgress({ hotspots, window: dated, rewards: [], checkins: [late] });
  assert.equal(p.count, 1);
});

test('end date defaults to start date', () => {
  const p = computeHotspotProgress({
    hotspots, window: { event_date: '2026-10-03' }, rewards: [],
    checkins: [ci('a', '2026-10-03T10:00:00'), ci('b', '2026-10-04T10:00:00')],
  });
  assert.equal(p.count, 1);
});

test('duplicate check-ins at one hotspot count once', () => {
  const p = computeHotspotProgress({
    hotspots, window: dated, rewards: [],
    checkins: [ci('a', '2026-10-03T10:00:00'), ci('a', '2026-10-03T15:00:00')],
  });
  assert.equal(p.count, 1);
});

test('check-ins at places that are not hotspots are ignored', () => {
  const p = computeHotspotProgress({
    hotspots, window: dated, rewards: [], checkins: [ci('zzz', '2026-10-03T10:00:00')],
  });
  assert.equal(p.count, 0);
});

test('undated trail counts check-ins at/after the hotspot was added', () => {
  const trail = [hs('a', '2026-05-01T00:00:00Z'), hs('b', '2026-05-01T00:00:00Z')];
  const p = computeHotspotProgress({
    hotspots: trail, window: {}, rewards: [],
    checkins: [
      { location_id: 'a', checked_in_at: '2026-04-30T23:59:59Z' },
      { location_id: 'b', checked_in_at: '2026-05-02T10:00:00Z' },
    ],
  });
  assert.deepEqual([...p.visited], ['b']);
});

test('target is the smallest unreached active reward; unlocked lists reached ones', () => {
  const p = computeHotspotProgress({
    hotspots, window: dated,
    rewards: [reward('big', 5), reward('small', 2), reward('off', 1, false), reward('plain', null)],
    checkins: [ci('a', '2026-10-03T10:00:00'), ci('b', '2026-10-03T11:00:00'), ci('c', '2026-10-03T12:00:00')],
  });
  assert.equal(p.count, 3);
  assert.equal(p.target, 5);
  assert.equal(p.nextReward?.id, 'big');
  assert.deepEqual(p.unlocked.map((r) => r.id), ['small']);
});

test('no hotspot rewards → target is the number of hotspots', () => {
  const p = computeHotspotProgress({ hotspots, window: dated, rewards: [], checkins: [] });
  assert.equal(p.target, 5);
  assert.equal(p.nextReward, null);
  assert.equal(hotspotMeterFill(p), 0);
});

test('reward target above hotspot count stays locked and target shows it', () => {
  const p = computeHotspotProgress({
    hotspots, window: dated, rewards: [reward('impossible', 7)],
    checkins: hotspots.map((h) => ci(h.location_id, '2026-10-03T10:00:00')),
  });
  assert.equal(p.count, 5);
  assert.equal(p.target, 7);
  assert.deepEqual(p.unlocked, []);
  assert.ok(Math.abs(hotspotMeterFill(p) - 5 / 7) < 1e-9);
});

test('all rewards reached → target falls back to hotspot total', () => {
  const p = computeHotspotProgress({
    hotspots, window: dated, rewards: [reward('r', 2)],
    checkins: [ci('a', '2026-10-03T10:00:00'), ci('b', '2026-10-03T10:00:00'), ci('c', '2026-10-03T10:00:00')],
  });
  assert.equal(p.target, 5);
  assert.equal(p.nextReward, null);
  assert.deepEqual(p.unlocked.map((r) => r.id), ['r']);
});
