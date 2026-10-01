import { supabase } from './supabase';

// Room activity meter (migration 0033).
//
// The server decides what counts: likes, comments, posts, check-ins and team
// joins are recorded by database triggers, carousel taps and hotspot visits
// by record_meter_event(). This module is the client half: it reads the
// level, and it announces "I just contributed" so the meter can play the
// stars-fly-into-the-meter effect from the thing the person touched.

export type MeterKind = 'checkin' | 'post' | 'team' | 'comment' | 'like' | 'carousel' | 'hotspot';

// Mirrors _meter_rule() in the migration. Used for the effect and the
// optimistic bar only; the server's numbers are the truth.
export const METER_POINTS: Record<MeterKind, number> = {
  checkin: 5,
  post: 3,
  team: 3,
  comment: 2,
  like: 1,
  carousel: 1,
  hotspot: 4,
};

// Points in the rolling hour that fill the meter completely.
export const ROOM_METER_TARGET = 120;

export function roomMeterFill(points: number): number {
  return Math.max(0, Math.min(1, points / ROOM_METER_TARGET));
}

export async function fetchRoomMeter(locationId: string): Promise<{ points: number; pulses: number }> {
  const { data, error } = await supabase.rpc('room_meter', { p_location_id: locationId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { points?: number; pulses?: number } | null;
  return { points: row?.points ?? 0, pulses: row?.pulses ?? 0 };
}

// Client-recorded kinds only. The server ignores people who aren't checked
// in and rate-limits everyone else, so this is safe to call freely.
export async function recordMeterEvent(locationId: string, kind: 'carousel' | 'hotspot'): Promise<void> {
  const { error } = await supabase.rpc('record_meter_event', { p_location_id: locationId, p_kind: kind });
  if (error) console.error('Failed to record meter event:', error);
}

// ------------------------------------------------------------- effect bus

const EVENT = 'w-meter-contribution';

export interface MeterContribution {
  kind: MeterKind;
  // Where the stars start: the element the person touched. Missing means the
  // stars rise from the bottom of the screen.
  origin: { x: number; y: number } | null;
}

// Call right after a person does something that counts. `el` is the button
// or input they used. Safe to call when no meter is mounted.
export function contribute(kind: MeterKind, el?: Element | null): void {
  if (typeof window === 'undefined') return;
  let origin: MeterContribution['origin'] = null;
  if (el) {
    const r = el.getBoundingClientRect();
    origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  window.dispatchEvent(new CustomEvent<MeterContribution>(EVENT, { detail: { kind, origin } }));
}

export function onContribution(handler: (c: MeterContribution) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<MeterContribution>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

// --------------------------------------------------- client-side helpers

const lastSent = new Map<string, number>();

// Carousel taps: the server allows one per minute per person, so don't play
// an effect (or call the server) more often than that.
export function contributeCarousel(locationId: string, el?: Element | null): void {
  const key = `carousel:${locationId}`;
  const now = Date.now();
  if (now - (lastSent.get(key) ?? 0) < 60_000) return;
  lastSent.set(key, now);
  contribute('carousel', el);
  void recordMeterEvent(locationId, 'carousel');
}

// Hook for the hotspots work: call when someone enters a hotspot. One per
// five minutes per person counts; extra calls are ignored by the server.
export function reportHotspotVisit(locationId: string, el?: Element | null): void {
  const key = `hotspot:${locationId}`;
  const now = Date.now();
  if (now - (lastSent.get(key) ?? 0) < 300_000) return;
  lastSent.set(key, now);
  contribute('hotspot', el);
  void recordMeterEvent(locationId, 'hotspot');
}
