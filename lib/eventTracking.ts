import { supabase } from './supabase';
import { getCurrentUserId } from './auth';

// Organizer event tracking (migration 0046): daily presence, role at the
// event, staff flags and per-slide carousel reach. Attendee writes go through
// RPCs that re-check the rules server-side, so these helpers are safe to call
// freely; the throttles below only save round trips.

export type EventRole = 'developer' | 'designer' | 'business' | 'other';
export const EVENT_ROLES: { value: EventRole; label: string; hint: string }[] = [
  { value: 'developer', label: 'Developer', hint: 'I build: code, data, hardware' },
  { value: 'designer', label: 'Designer', hint: 'I shape it: UX, UI, brand' },
  { value: 'business', label: 'Business', hint: 'I sell it: market, money, pitch' },
  { value: 'other', label: 'Something else', hint: 'Mentor, student, just curious' },
];

export type StaffKind = 'organizer' | 'mentor' | 'judge' | 'volunteer' | 'sponsor' | 'test';
export const STAFF_KINDS: { value: StaffKind; label: string }[] = [
  { value: 'organizer', label: 'Organizer' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'judge', label: 'Judge' },
  { value: 'volunteer', label: 'Volunteer' },
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'test', label: 'Test account' },
];

// ------------------------------------------------------------------ roles

// Whether this venue asks for a role, and the role I already picked here.
export async function fetchEventRolePrompt(
  locationId: string,
): Promise<{ ask: boolean; role: EventRole | null }> {
  const uid = await getCurrentUserId();
  if (!uid) return { ask: false, role: null };
  const [venue, mine] = await Promise.all([
    supabase.from('locations').select('ask_event_role').eq('id', locationId).maybeSingle(),
    supabase.from('event_roles').select('role').eq('location_id', locationId).eq('user_id', uid).maybeSingle(),
  ]);
  if (venue.error) throw venue.error;
  if (mine.error) throw mine.error;
  return {
    ask: !!(venue.data as { ask_event_role?: boolean } | null)?.ask_event_role,
    role: ((mine.data as { role?: EventRole } | null)?.role) ?? null,
  };
}

export async function setEventRole(locationId: string, role: EventRole): Promise<void> {
  const { error } = await supabase.rpc('set_event_role', { p_location_id: locationId, p_role: role });
  if (error) throw error;
}

// --------------------------------------------------------- daily presence

const PRESENCE_EVERY_MS = 10 * 60 * 1000;
const lastPresence = new Map<string, number>();

// Call with each GPS fix taken while checked in at the venue. The server
// ignores fixes outside the geofence and keeps one row per person per day.
export function reportEventPresence(
  locationId: string,
  fix: { lat: number; lng: number; accuracy?: number | null },
): void {
  const now = Date.now();
  if (now - (lastPresence.get(locationId) ?? 0) < PRESENCE_EVERY_MS) return;
  lastPresence.set(locationId, now);
  let tz: string | null = null;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    tz = null;
  }
  supabase
    .rpc('record_event_presence', {
      p_location_id: locationId,
      p_lat: fix.lat,
      p_lng: fix.lng,
      p_accuracy: fix.accuracy ?? null,
      p_tz: tz,
    })
    .then(({ error }) => {
      if (error) {
        lastPresence.delete(locationId);
        console.error('Failed to record event presence:', error);
      }
    });
}

// ------------------------------------------------------ carousel slide reach

const sentSlides = new Set<string>();

// One view and one tap per slide per person per day count on the server;
// this skips repeats within the session.
export function reportSlideEvent(bannerId: string, kind: 'view' | 'tap'): void {
  const key = `${bannerId}:${kind}:${new Date().toDateString()}`;
  if (sentSlides.has(key)) return;
  sentSlides.add(key);
  supabase.rpc('record_slide_event', { p_banner_id: bannerId, p_kind: kind }).then(({ error }) => {
    if (error) {
      sentSlides.delete(key);
      console.error('Failed to record slide event:', error);
    }
  });
}

// ------------------------------------------------------------------ staff

export interface EventStaffRow {
  user_id: string;
  kind: StaffKind;
}

export async function fetchEventStaff(locationId: string): Promise<EventStaffRow[]> {
  const { data, error } = await supabase
    .from('event_staff')
    .select('user_id, kind')
    .eq('location_id', locationId);
  if (error) throw error;
  return (data ?? []) as EventStaffRow[];
}

export async function setEventStaff(locationId: string, userId: string, kind: StaffKind): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  const { error } = await supabase
    .from('event_staff')
    .upsert({ location_id: locationId, user_id: userId, kind, added_by: uid }, { onConflict: 'location_id,user_id' });
  if (error) throw error;
}

export async function removeEventStaff(locationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('event_staff')
    .delete()
    .eq('location_id', locationId)
    .eq('user_id', userId);
  if (error) throw error;
}

// --------------------------------------------------------------- settings

export async function fetchEventSettings(
  locationId: string,
): Promise<{ event_date: string | null; event_end_date: string | null; ask_event_role: boolean }> {
  const { data, error } = await supabase
    .from('locations')
    .select('event_date, event_end_date, ask_event_role')
    .eq('id', locationId)
    .single();
  if (error) throw error;
  return data as { event_date: string | null; event_end_date: string | null; ask_event_role: boolean };
}

export async function updateEventSettings(
  locationId: string,
  fields: { event_date: string | null; event_end_date: string | null; ask_event_role: boolean },
): Promise<void> {
  const { error } = await supabase.from('locations').update(fields).eq('id', locationId);
  if (error) throw error;
}

// --------------------------------------------------------------- summary

export interface EventTrackingSummary {
  dates_set: boolean;
  ask_event_role: boolean;
  staff: number;
  attendees: number;
  presence_days: { day: string; people: number }[];
  roles: Partial<Record<EventRole, number>>;
  slides: { banner_id: string; image_url: string; is_active: boolean; viewers: number; tappers: number }[];
}

export async function fetchEventTrackingSummary(locationId: string): Promise<EventTrackingSummary> {
  const { data, error } = await supabase.rpc('event_tracking_summary', { p_location_id: locationId });
  if (error) throw error;
  return data as EventTrackingSummary;
}
