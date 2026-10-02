import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import type { EventHotspot, HotspotCheckin, HotspotTrailPause, Venue } from './types';

// event_hotspots has two FKs to locations, so embeds name the constraint.
const HOTSPOT_SELECT =
  'id, event_id, location_id, note, sort_order, created_at, place:locations!event_hotspots_location_id_fkey(*)';

export async function fetchEventHotspots(eventId: string): Promise<EventHotspot[]> {
  const { data, error } = await supabase
    .from('event_hotspots')
    .select(HOTSPOT_SELECT)
    .eq('event_id', eventId)
    .order('sort_order')
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as unknown as EventHotspot[];
}

export async function fetchHotspotParents(locationId: string): Promise<Venue[]> {
  const { data, error } = await supabase
    .from('event_hotspots')
    .select('event:locations!event_hotspots_event_id_fkey(*)')
    .eq('location_id', locationId);
  if (error) throw error;
  return ((data ?? []) as unknown as Array<{ event: Venue | null }>)
    .map((r) => r.event)
    .filter((e): e is Venue => !!e);
}

// Hotspots of events running on `todayLocal` ('YYYY-MM-DD'), plus every
// hotspot of `includeEventId` (the event you're checked in at) regardless of date.
export async function fetchActiveHotspots(
  todayLocal: string,
  includeEventId?: string | null
): Promise<Array<EventHotspot & { event: Venue }>> {
  const { data, error } = await supabase
    .from('event_hotspots')
    .select(`${HOTSPOT_SELECT}, event:locations!event_hotspots_event_id_fkey(*)`)
    .order('sort_order');
  if (error) throw error;
  const rows = (data ?? []) as unknown as Array<EventHotspot & { event: Venue | null }>;
  return rows.filter((r): r is EventHotspot & { event: Venue } => {
    if (!r.event || !r.place) return false;
    if (includeEventId && r.event_id === includeEventId) return true;
    const start = r.event.event_date?.slice(0, 10);
    if (!start) return false;
    const end = (r.event.event_end_date ?? r.event.event_date)!.slice(0, 10);
    return todayLocal >= start && todayLocal <= end;
  });
}

export async function fetchMyCheckinsAt(locationIds: string[]): Promise<HotspotCheckin[]> {
  if (locationIds.length === 0) return [];
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('location_checkins')
    .select('location_id, checked_in_at')
    .eq('user_id', uid)
    .in('location_id', locationIds);
  if (error) throw error;
  return (data ?? []) as HotspotCheckin[];
}

export async function addHotspot(eventId: string, locationId: string, note?: string | null): Promise<void> {
  const uid = await getCurrentUserId();
  const { data: last, error: lastError } = await supabase
    .from('event_hotspots')
    .select('sort_order')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: false })
    .limit(1);
  if (lastError) throw lastError;
  const next = last?.[0]?.sort_order != null ? last[0].sort_order + 1 : 0;
  const { error } = await supabase.from('event_hotspots').insert({
    event_id: eventId,
    location_id: locationId,
    note: note?.trim() || null,
    sort_order: next,
    created_by: uid,
  });
  if (error) throw error;
}

export async function createHotspotPlace(
  eventId: string,
  p: { name: string; lat: number; lng: number; radius?: number; note?: string | null }
): Promise<string> {
  const { data, error } = await supabase.rpc('create_hotspot_place', {
    p_event_id: eventId,
    p_name: p.name,
    p_lat: p.lat,
    p_lng: p.lng,
    p_radius: p.radius ?? 75,
    p_note: p.note ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function updateHotspot(
  id: string,
  fields: Partial<Pick<EventHotspot, 'note' | 'sort_order'>>
): Promise<void> {
  const { error } = await supabase.from('event_hotspots').update(fields).eq('id', id);
  if (error) throw error;
}

export async function removeHotspot(id: string): Promise<void> {
  const { error } = await supabase.from('event_hotspots').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchHotspotVisitCounts(eventId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.rpc('hotspot_visit_counts', { p_event_id: eventId });
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ location_id: string; visitors: number }>) {
    out[row.location_id] = Number(row.visitors);
  }
  return out;
}

// ---- Trail off switch (0038) ----

export async function fetchTrailPauses(eventIds: string[]): Promise<HotspotTrailPause[]> {
  if (eventIds.length === 0) return [];
  const { data, error } = await supabase
    .from('hotspot_trail_pauses')
    .select('event_id, started_at, ended_at')
    .in('event_id', eventIds);
  if (error) throw error;
  return (data ?? []) as HotspotTrailPause[];
}

// The database sets the times (guard trigger), so these just open/close a pause.
export async function pauseTrail(eventId: string): Promise<void> {
  const { error } = await supabase.from('hotspot_trail_pauses').insert({ event_id: eventId });
  // 23505 = an open pause already exists (double tap): already paused.
  if (error && error.code !== '23505') throw error;
}

export async function resumeTrail(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('hotspot_trail_pauses')
    .update({ ended_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .is('ended_at', null);
  if (error) throw error;
}
