import { supabase } from './supabase';
import { getCurrentUserId } from './auth';
import type {
  Profile,
  Venue,
  FeedItem,
  Presence,
  ContactMethod,
  Reward,
  Conversation,
  Message,
  VerificationTag,
  VerificationTagType,
  TagIconKind,
  Banner,
  LocationManager,
  VenueMember,
  JoinRequest,
  ChatParticipant,
  AttendanceStats,
  TagBreakdownEntry,
  ConnectionsFormedStats,
  ContactMethodBreakdownEntry,
  EngagementStats,
  VenueZone,
  ActivityMenuItem,
  Badge,
  ZoneAnalytics,
  CrossVenueMovementEntry,
  Connection,
  MyConnection,
  FriendActivityEntry,
  LocationRequest,
} from './types';

// Central Supabase data service. Mirrors WAPData.swift in the iOS app —
// same tables, same columns, same method shapes.

// ---- Profile ----

// Other people are read through the `profiles_public` view (migration 0026):
// display fields only, city gated by city_visible, age instead of birth date.
// The base `profiles` table is readable only by its owner (and master
// admins). Embeds alias the view back to `profiles` so result shapes match.
const PUBLIC_PROFILE = 'profiles_public';

// Full row. Only works for your own id (or any id for a master admin); for
// anyone else use fetchPublicProfile.
export async function fetchProfile(id: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select().eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function fetchPublicProfile(id: string): Promise<Profile> {
  const { data, error } = await supabase.from(PUBLIC_PROFILE).select().eq('id', id).single();
  if (error) throw error;
  return data as Profile;
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }): Promise<void> {
  const { error } = await supabase.from('profiles').upsert(profile);
  if (error) throw error;
}

// Use this instead of upsertProfile for a row that's already known to exist
// (anything after registration). Postgres validates NOT NULL constraints
// against the row upsert() would insert even when the conflict resolves to
// an UPDATE, so a partial patch that omits a NOT NULL column like
// display_name fails upsert() outright — update() has no such insert branch.
export async function updateProfile(profile: Partial<Profile> & { id: string }): Promise<void> {
  const { id, ...patch } = profile;
  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error) throw error;
}

// ---- Venues ----

export async function fetchVenues(): Promise<Venue[]> {
  const { data, error } = await supabase.from('locations').select().order('name');
  if (error) throw error;
  return data ?? [];
}

export async function fetchVenue(id: string): Promise<Venue> {
  const { data, error } = await supabase.from('locations').select().eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function fetchMyVenue(): Promise<Venue | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('locations')
    .select()
    .eq('owner_id', uid)
    .eq('is_event', false)
    .limit(1);
  if (error) throw error;
  return data?.[0] ?? null;
}

// Every venue the current user can manage: venues they own outright, plus
// venues where they've been added as a co-owner via location_managers.
// Master admins should use fetchVenues() instead (all venues, no filter).
export async function fetchMyVenues(): Promise<Venue[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];

  const [ownedResult, managedResult] = await Promise.all([
    supabase.from('locations').select().eq('owner_id', uid).eq('is_event', false),
    supabase.from('location_managers').select('locations(*)').eq('user_id', uid),
  ]);
  if (ownedResult.error) throw ownedResult.error;
  if (managedResult.error) throw managedResult.error;

  const owned = ownedResult.data ?? [];
  const managed = ((managedResult.data ?? []) as unknown as { locations: Venue }[])
    .map((row) => row.locations)
    .filter((v): v is Venue => !!v && !v.is_event);

  const seen = new Set<string>();
  const merged: Venue[] = [];
  for (const venue of [...owned, ...managed]) {
    if (seen.has(venue.id)) continue;
    seen.add(venue.id);
    merged.push(venue);
  }
  return merged;
}

// ---- Location Managers (co-owners) ----

export async function fetchLocationManagers(locationId: string): Promise<LocationManager[]> {
  const { data, error } = await supabase
    .from('location_managers')
    .select(`*, profiles:${PUBLIC_PROFILE}!user_id(*)`)
    .eq('location_id', locationId);
  if (error) throw error;
  return data ?? [];
}

export async function addLocationManager(locationId: string, userId: string): Promise<void> {
  const uid = await getCurrentUserId();
  const { error } = await supabase
    .from('location_managers')
    .insert({ location_id: locationId, user_id: userId, added_by: uid });
  if (error) throw error;
}

export async function removeLocationManager(id: string): Promise<void> {
  const { error } = await supabase.from('location_managers').delete().eq('id', id);
  if (error) throw error;
}

export async function updateVenue(venue: Venue): Promise<void> {
  const { error } = await supabase
    .from('locations')
    .update({
      address: venue.address ?? '',
      description: venue.description ?? '',
      whatsapp: venue.whatsapp ?? '',
      default_message: venue.default_message ?? '',
    })
    .eq('id', venue.id);
  if (error) throw error;
}

export async function createVenue(fields: {
  name: string;
  address?: string;
  city?: string;
  lat: number;
  lng: number;
  geofence_radius_meters: number;
  description?: string;
  ownerId?: string | null;
}): Promise<Venue> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from('locations')
    .insert({
      name: fields.name,
      address: fields.address ?? null,
      city: fields.city ?? null,
      lat: fields.lat,
      lng: fields.lng,
      geofence_radius_meters: fields.geofence_radius_meters,
      description: fields.description ?? null,
      is_event: false,
      owner_id: fields.ownerId ?? uid ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createEvent(
  name: string,
  description: string,
  startDate: string,
  endDate: string
): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  const { error } = await supabase.from('locations').insert({
    name,
    description,
    event_date: startDate,
    event_end_date: endDate,
    is_event: true,
    owner_id: uid,
    lat: 0,
    lng: 0,
  });
  if (error) throw error;
}

export async function fetchEvents(): Promise<Venue[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('locations')
    .select()
    .eq('is_event', true)
    .eq('owner_id', uid)
    .order('event_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateEvent(venue: Venue): Promise<void> {
  const { error } = await supabase
    .from('locations')
    .update({
      name: venue.name,
      description: venue.description ?? '',
      event_date: venue.event_date ?? '',
      event_end_date: venue.event_end_date ?? '',
      event_status: venue.event_status ?? 'Active',
    })
    .eq('id', venue.id);
  if (error) throw error;
}

// ---- Check-in History ----

export async function fetchLastVisited(limit = 50): Promise<Venue[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('location_checkins')
    .select('checked_in_at, locations(*)')
    .eq('user_id', uid)
    .order('checked_in_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const seen = new Set<string>();
  const result: Venue[] = [];
  for (const row of (data ?? []) as unknown as { locations: Venue }[]) {
    const venue = row.locations;
    if (!venue || seen.has(venue.id)) continue;
    seen.add(venue.id);
    result.push(venue);
  }
  return result;
}

// ---- Feed ----

export async function fetchFeed(locationId: string): Promise<FeedItem[]> {
  const { data, error } = await supabase
    .from('feed_posts')
    .select(`*, profiles:${PUBLIC_PROFILE}!user_id(*)`)
    .eq('location_id', locationId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function postToFeed(locationId: string, text: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  const { error } = await supabase
    .from('feed_posts')
    .insert({ location_id: locationId, user_id: uid, content: text });
  if (error) throw error;
}

// ---- Presence (who's here) ----

export async function fetchPresence(locationId: string): Promise<Presence[]> {
  const { data, error } = await supabase
    .from('location_checkins')
    .select(`*, profiles:${PUBLIC_PROFILE}!user_id(*)`)
    .eq('location_id', locationId)
    .is('checked_out_at', null);
  if (error) throw error;
  return data ?? [];
}

export async function checkIn(locationId: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  const { data: existing, error: existingError } = await supabase
    .from('location_checkins')
    .select('id')
    .eq('user_id', uid)
    .eq('location_id', locationId)
    .is('checked_out_at', null)
    .limit(1);
  if (existingError) throw existingError;
  if (!existing || existing.length === 0) {
    const { error } = await supabase
      .from('location_checkins')
      .insert({ user_id: uid, location_id: locationId, mode: 'live' });
    // 23505 = unique_violation on uniq_active_checkin_per_user_location. The
    // select-then-insert above is a TOCTOU race: a concurrent checkIn() (a
    // StrictMode double-invoke, rapid venue re-entry) can pass the same
    // "no active row" check and insert first. Either way the desired
    // post-state — one open check-in — is reached, so treat it as success.
    if (error && error.code !== '23505') throw error;
  }

  // Founder decision: chat_join_mode is organizer-configurable per venue
  // ('auto' | 'request', default 'request'). In 'auto' mode, checking in
  // immediately seeds the member into the venue's chat — best-effort, since
  // a hiccup here (or the venue chat not existing yet) should never block
  // the check-in itself.
  try {
    await autoJoinVenueChatIfEnabled(locationId, uid);
  } catch (err) {
    console.error('Auto-join venue chat failed:', err);
  }

  // Best-effort: refresh earned badges after a successful check-in.
  recomputeMyBadges().catch(() => {});
}

async function autoJoinVenueChatIfEnabled(locationId: string, uid: string): Promise<void> {
  const { data: location, error: locationError } = await supabase
    .from('locations')
    .select('chat_join_mode')
    .eq('id', locationId)
    .single();
  if (locationError) throw locationError;
  if (location?.chat_join_mode !== 'auto') return;

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('location_id', locationId)
    .eq('is_group', true)
    .maybeSingle();
  if (convError) throw convError;
  if (!conversation) return; // No venue chat created yet — nothing to auto-join.

  const { error: joinError } = await supabase
    .from('conversation_participants')
    .upsert(
      { conversation_id: conversation.id, user_id: uid, role: 'member', status: 'accepted' },
      { onConflict: 'conversation_id,user_id', ignoreDuplicates: true }
    );
  if (joinError) throw joinError;
}

export async function checkOut(locationId: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('location_checkins')
    .update({ checked_out_at: now })
    .eq('user_id', uid)
    .eq('location_id', locationId)
    .is('checked_out_at', null);
  if (error) throw error;
}

// ---- Contact Methods ----

export async function fetchContactMethods(userId: string): Promise<ContactMethod[]> {
  const { data, error } = await supabase
    .from('contact_methods')
    .select()
    .eq('user_id', userId)
    .order('slot_order');
  if (error) throw error;
  return data ?? [];
}

export async function upsertContactMethod(method: Partial<ContactMethod> & { user_id: string }): Promise<void> {
  const { error } = await supabase.from('contact_methods').upsert(method);
  if (error) throw error;
}

// ---- Rewards ----

// Member-facing: active rewards only, in display order.
export async function fetchRewards(locationId: string): Promise<Reward[]> {
  const { data, error } = await supabase
    .from('rewards')
    .select()
    .eq('location_id', locationId)
    .eq('is_active', true)
    .order('display_order');
  if (error) throw error;
  return data ?? [];
}

// Organizer-facing (Phase 3 CRUD): every reward for the venue, active or
// not, in display order. Writes are gated by the rewards_write RLS policy
// (0009, is_venue_manager) — mirrors fetchBanners(locationId, activeOnly).
export async function fetchAllRewards(locationId: string): Promise<Reward[]> {
  const { data, error } = await supabase
    .from('rewards')
    .select()
    .eq('location_id', locationId)
    .order('display_order');
  if (error) throw error;
  return data ?? [];
}

// ---- Attendance-tier badges (Phase 4) ----
// A reward with min_checkins set is unlocked once the member's
// location_checkins count at this venue reaches it — reuses the same
// mode='live' counting fetchVenueMembers already relies on, no new table.

export async function fetchMyCheckinCount(locationId: string): Promise<number> {
  const uid = await getCurrentUserId();
  if (!uid) return 0;
  const { count, error } = await supabase
    .from('location_checkins')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .eq('user_id', uid)
    .eq('mode', 'live');
  if (error) throw error;
  return count ?? 0;
}

// Highest-threshold reward a member with `checkinCount` visits has earned
// at this venue, given the venue's active tiered rewards (min_checkins set).
// Used by the Members roster to show each member's current tier badge.
export function highestEarnedTier(rewards: Reward[], checkinCount: number): Reward | null {
  const tiers = rewards
    .filter((r): r is Reward & { min_checkins: number } => r.is_active && r.min_checkins != null)
    .sort((a, b) => b.min_checkins - a.min_checkins);
  return tiers.find((r) => checkinCount >= r.min_checkins) ?? null;
}

export async function createReward(
  locationId: string,
  fields: { name: string; deal_text?: string | null; instructions?: string | null; icon_type?: string | null }
): Promise<Reward> {
  const uid = await getCurrentUserId();
  const { data: existing, error: existingError } = await supabase
    .from('rewards')
    .select('display_order')
    .eq('location_id', locationId)
    .order('display_order', { ascending: false })
    .limit(1);
  if (existingError) throw existingError;
  const nextOrder = existing?.[0]?.display_order != null ? existing[0].display_order + 1 : 0;

  const { data, error } = await supabase
    .from('rewards')
    .insert({
      location_id: locationId,
      name: fields.name,
      deal_text: fields.deal_text ?? null,
      instructions: fields.instructions ?? null,
      icon_type: fields.icon_type ?? null,
      display_order: nextOrder,
      is_active: true,
      created_by: uid ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateReward(
  id: string,
  fields: Partial<Pick<Reward, 'name' | 'deal_text' | 'instructions' | 'icon_type' | 'display_order' | 'is_active' | 'min_checkins'>>
): Promise<void> {
  const { error } = await supabase.from('rewards').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteReward(id: string): Promise<void> {
  const { error } = await supabase.from('rewards').delete().eq('id', id);
  if (error) throw error;
}

// ---- Venue zones (organizer analytics) ----

export async function fetchVenueZones(locationId: string): Promise<VenueZone[]> {
  const { data, error } = await supabase
    .from('venue_zones')
    .select('*')
    .eq('location_id', locationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as VenueZone[];
}

export async function createVenueZone(
  locationId: string,
  fields: { name: string; center_lat: number; center_lng: number }
): Promise<void> {
  const { error } = await supabase
    .from('venue_zones')
    .insert({ location_id: locationId, ...fields });
  if (error) throw error;
}

export async function updateVenueZone(
  id: string,
  fields: Partial<Pick<VenueZone, 'name' | 'center_lat' | 'center_lng'>>
): Promise<void> {
  const { error } = await supabase.from('venue_zones').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteVenueZone(id: string): Promise<void> {
  const { error } = await supabase.from('venue_zones').delete().eq('id', id);
  if (error) throw error;
}

// ---- Activity menu (per-venue "activity words") ----

export async function fetchActivityMenu(locationId: string): Promise<ActivityMenuItem[]> {
  const { data, error } = await supabase
    .from('activity_menu_items')
    .select()
    .eq('location_id', locationId)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as ActivityMenuItem[];
}

export async function createActivityMenuItem(
  locationId: string,
  label: string,
  sortOrder: number,
): Promise<ActivityMenuItem> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from('activity_menu_items')
    .insert({ location_id: locationId, label, sort_order: sortOrder, created_by: uid })
    .select()
    .single();
  if (error) throw error;
  return data as ActivityMenuItem;
}

export async function updateActivityMenuItem(
  id: string,
  fields: Partial<Pick<ActivityMenuItem, 'label' | 'sort_order'>>,
): Promise<void> {
  const { error } = await supabase.from('activity_menu_items').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteActivityMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from('activity_menu_items').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchMyActivityPicks(locationId: string): Promise<string[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('attendee_activity_picks')
    .select('item_id')
    .eq('user_id', uid)
    .eq('location_id', locationId);
  if (error) throw error;
  return (data ?? []).map((r) => (r as { item_id: string }).item_id);
}

export async function setMyActivityPicks(locationId: string, itemIds: string[]): Promise<void> {
  const { error } = await supabase.rpc('set_activity_picks', {
    p_location_id: locationId,
    p_item_ids: itemIds,
  });
  if (error) throw error;
}

// ---- Badges ----

export async function fetchBadges(): Promise<Badge[]> {
  const { data, error } = await supabase.from('badges').select().order('sort_order');
  if (error) throw error;
  return (data ?? []) as Badge[];
}

export async function fetchMyBadgeIds(): Promise<string[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data, error } = await supabase.from('user_badges').select('badge_id').eq('user_id', uid);
  if (error) throw error;
  return (data ?? []).map((r) => (r as { badge_id: string }).badge_id);
}

export async function recomputeMyBadges(): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  const { error } = await supabase.rpc('recompute_user_badges', { p_user_id: uid });
  if (error) throw error;
}

export async function fetchMyActivityWords(): Promise<string[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data: picks, error: picksError } = await supabase
    .from('attendee_activity_picks')
    .select('item_id')
    .eq('user_id', uid);
  if (picksError) throw picksError;
  const itemIds = [...new Set((picks ?? []).map((r) => (r as { item_id: string }).item_id))];
  if (itemIds.length === 0) return [];
  const { data: items, error: itemsError } = await supabase
    .from('activity_menu_items')
    .select('label')
    .in('id', itemIds);
  if (itemsError) throw itemsError;
  const seen = new Set<string>();
  for (const row of (items ?? []) as { label: string | null }[]) {
    const label = row.label?.trim();
    if (label) seen.add(label);
  }
  return [...seen].slice(0, 12);
}

export async function hasFeatureAccess(featureName: string): Promise<boolean> {
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { data, error } = await supabase
    .from('user_feature_access')
    .select('user_id')
    .eq('user_id', uid)
    .eq('feature_name', featureName);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

// ---- Attendee History ----

export async function fetchAttendeeHistory(locationId: string): Promise<Profile[]> {
  const { data: rows, error } = await supabase
    .from('location_checkins')
    .select(`profiles:${PUBLIC_PROFILE}!user_id(*)`)
    .eq('location_id', locationId)
    .eq('mode', 'live');
  if (error) throw error;

  const { data: optOuts, error: optOutError } = await supabase
    .from('attendee_history_opt_outs')
    .select('user_id')
    .eq('location_id', locationId);
  if (optOutError) throw optOutError;

  const optedOutIds = new Set((optOuts ?? []).map((r: { user_id: string }) => r.user_id));
  const seen = new Set<string>();
  const result: Profile[] = [];
  for (const row of rows ?? []) {
    const profile = (row as unknown as { profiles: Profile }).profiles;
    if (!profile || optedOutIds.has(profile.id) || seen.has(profile.id)) continue;
    seen.add(profile.id);
    result.push(profile);
  }
  return result;
}

export async function isOptedOutOfAttendeeHistory(locationId: string): Promise<boolean> {
  const uid = await getCurrentUserId();
  if (!uid) return false;
  const { data, error } = await supabase
    .from('attendee_history_opt_outs')
    .select('user_id')
    .eq('location_id', locationId)
    .eq('user_id', uid);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function setAttendeeHistoryOptOut(locationId: string, hidden: boolean): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  if (hidden) {
    const { error } = await supabase
      .from('attendee_history_opt_outs')
      .upsert({ user_id: uid, location_id: locationId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('attendee_history_opt_outs')
      .delete()
      .eq('user_id', uid)
      .eq('location_id', locationId);
    if (error) throw error;
  }
}

// ---- Venue Members roster ----
// One row per unique person who has ever checked in "live" at this venue,
// with a running check-in count (feeds Phase 4's attendance-tier rewards),
// first/last visit, and their verification tags. Read-only, organizer-gated
// at the UI layer only (like fetchBanners/fetchAttendeeHistory) — the
// underlying data has no extra RLS beyond what those already expose.
export async function fetchVenueMembers(locationId: string): Promise<VenueMember[]> {
  const { data: rows, error } = await supabase
    .from('location_checkins')
    .select(`user_id, checked_in_at, profiles:${PUBLIC_PROFILE}!user_id(*)`)
    .eq('location_id', locationId)
    .eq('mode', 'live')
    .order('checked_in_at', { ascending: true });
  if (error) throw error;

  const { data: optOuts, error: optOutError } = await supabase
    .from('attendee_history_opt_outs')
    .select('user_id')
    .eq('location_id', locationId);
  if (optOutError) throw optOutError;
  const optedOutIds = new Set((optOuts ?? []).map((r: { user_id: string }) => r.user_id));

  const { data: tagRows, error: tagError } = await supabase
    .from('verification_tags')
    .select('*, verification_tag_types(*)')
    .eq('location_id', locationId);
  if (tagError) throw tagError;
  const tagsByUser = new Map<string, VerificationTag[]>();
  for (const t of (tagRows ?? []) as (VerificationTag & {
    verification_tag_types: VerificationTagType | null;
  })[]) {
    const list = tagsByUser.get(t.user_id) ?? [];
    const { verification_tag_types, ...rest } = t;
    list.push({ ...rest, type: verification_tag_types ?? undefined } as VerificationTag);
    tagsByUser.set(t.user_id, list);
  }

  const byUser = new Map<string, VenueMember>();
  for (const row of (rows ?? []) as unknown as { user_id: string; checked_in_at: string; profiles: Profile }[]) {
    const profile = row.profiles;
    if (!profile || optedOutIds.has(row.user_id)) continue;
    const existing = byUser.get(row.user_id);
    if (existing) {
      existing.checkinCount += 1;
      existing.lastCheckinAt = row.checked_in_at;
    } else {
      byUser.set(row.user_id, {
        profile,
        checkinCount: 1,
        firstCheckinAt: row.checked_in_at,
        lastCheckinAt: row.checked_in_at,
        tags: tagsByUser.get(row.user_id) ?? [],
      });
    }
  }
  // Rows arrive oldest-first, so the last time we see a user_id is their
  // most recent visit — sort the roster most-visits-first for the UI.
  return Array.from(byUser.values()).sort((a, b) => b.checkinCount - a.checkinCount);
}

// ---- Verification Tags ----

export async function fetchVerificationTags(locationId: string): Promise<VerificationTag[]> {
  const { data, error } = await supabase
    .from('verification_tags')
    .select('*, verification_tag_types(*)')
    .eq('location_id', locationId);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const { verification_tag_types, ...rest } = r as VerificationTag & {
      verification_tag_types: VerificationTagType | null;
    };
    return { ...rest, type: verification_tag_types ?? undefined } as VerificationTag;
  });
}

export async function assignVerificationTagFreeform(
  userId: string,
  locationId: string,
  tag: string,
  icon?: string | null
): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  const { error } = await supabase
    .from('verification_tags')
    .insert({ user_id: userId, location_id: locationId, tag, icon: icon ?? null, assigned_by: uid });
  if (error) throw error;
}

export async function assignVerificationTag(
  userId: string,
  locationId: string,
  typeId: string,
): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  const { data: type, error: typeError } = await supabase
    .from('verification_tag_types')
    .select('label, icon')
    .eq('id', typeId)
    .single();
  if (typeError) throw typeError;
  const { error } = await supabase.from('verification_tags').insert({
    user_id: userId,
    location_id: locationId,
    type_id: typeId,
    tag: (type as { label: string }).label,        // snapshot for the fallback path
    icon: (type as { icon: string }).icon,
    assigned_by: uid,
  });
  if (error) throw error;
}

const TAG_ICON_MAX_BYTES = 512 * 1024;
// SVG is deliberately excluded: the `tag-icons` bucket is public, so a stored
// SVG opened at its URL would execute script in the storage origin.
const TAG_ICON_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export async function uploadTagIcon(file: File, locationId: string): Promise<string> {
  const ext = TAG_ICON_TYPES[file.type];
  if (!ext) throw new Error('Icon must be a PNG, JPG, or WebP.');
  if (file.size > TAG_ICON_MAX_BYTES) throw new Error('Icon must be 512 KB or smaller.');
  const path = `${locationId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('tag-icons')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export function tagIconPublicUrl(path: string): string {
  return supabase.storage.from('tag-icons').getPublicUrl(path).data.publicUrl;
}

export async function fetchVenueTitleRoster(
  locationId: string,
): Promise<{ type: VerificationTagType; people: Profile[] }[]> {
  const { data, error } = await supabase
    .from('verification_tags')
    .select(`type_id, user_id, verification_tag_types(*), profiles:${PUBLIC_PROFILE}!user_id(*)`)
    .eq('location_id', locationId)
    .not('type_id', 'is', null);
  if (error) throw error;

  // Respect attendee-history opt-outs, exactly like fetchVenueMembers.
  const { data: optOuts, error: optOutError } = await supabase
    .from('attendee_history_opt_outs')
    .select('user_id')
    .eq('location_id', locationId);
  if (optOutError) throw optOutError;
  const optedOutIds = new Set((optOuts ?? []).map((r: { user_id: string }) => r.user_id));

  const groups = new Map<string, { type: VerificationTagType; people: Profile[] }>();
  for (const row of (data ?? []) as unknown as {
    type_id: string;
    user_id: string;
    verification_tag_types: VerificationTagType | null;
    profiles: Profile | null;
  }[]) {
    if (optedOutIds.has(row.user_id)) continue;
    const type = row.verification_tag_types;
    const person = row.profiles;
    if (!type || !person) continue;
    const g = groups.get(row.type_id) ?? { type, people: [] };
    if (!g.people.some((p) => p.id === person.id)) g.people.push(person);
    groups.set(row.type_id, g);
  }
  return [...groups.values()]
    .sort((a, b) => a.type.sort_order - b.type.sort_order)
    .map((g) => ({
      type: g.type,
      people: g.people.sort((a, b) =>
        (a.display_name ?? '').localeCompare(b.display_name ?? '')),
    }));
}

export async function removeVerificationTag(tagId: string): Promise<void> {
  const { error } = await supabase.from('verification_tags').delete().eq('id', tagId);
  if (error) throw error;
}

// ---- Verification Tag Catalog (per-venue title types) ----

export async function fetchVerificationTagTypes(locationId: string): Promise<VerificationTagType[]> {
  const { data, error } = await supabase
    .from('verification_tag_types')
    .select('*')
    .eq('location_id', locationId)
    .order('sort_order');
  if (error) throw error;
  return (data ?? []) as VerificationTagType[];
}

export async function createVerificationTagType(
  locationId: string,
  fields: { label: string; icon: string; icon_kind: TagIconKind; sort_order: number },
): Promise<VerificationTagType> {
  const uid = await getCurrentUserId();
  const { data, error } = await supabase
    .from('verification_tag_types')
    .insert({ location_id: locationId, created_by: uid, ...fields })
    .select()
    .single();
  if (error) throw error;
  return data as VerificationTagType;
}

export async function updateVerificationTagType(
  id: string,
  fields: Partial<Pick<VerificationTagType, 'label' | 'icon' | 'icon_kind' | 'sort_order'>>,
): Promise<void> {
  const { error } = await supabase.from('verification_tag_types').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteVerificationTagType(id: string): Promise<void> {
  const { error } = await supabase.from('verification_tag_types').delete().eq('id', id);
  if (error) throw error;
}

const DEFAULT_TAG_TYPES: { label: string; icon: string; sort_order: number }[] = [
  { label: 'Mentor', icon: 'brain', sort_order: 10 },
  { label: 'Judge', icon: 'gavel', sort_order: 20 },
  { label: 'Speaker', icon: 'mic', sort_order: 30 },
  { label: 'Organizer', icon: 'star', sort_order: 40 },
  { label: 'Sponsor', icon: 'gem', sort_order: 50 },
  { label: 'Host', icon: 'crown', sort_order: 60 },
  { label: 'Volunteer', icon: 'heart-handshake', sort_order: 70 },
];

export async function seedDefaultVerificationTagTypes(locationId: string): Promise<void> {
  const uid = await getCurrentUserId();
  const rows = DEFAULT_TAG_TYPES.map((t) => ({
    location_id: locationId,
    created_by: uid,
    icon_kind: 'lucide' as const,
    ...t,
  }));
  // The unique index is on the expression (location_id, lower(label)), which
  // supabase-js `onConflict` cannot target. Insert row-by-row and swallow the
  // 23505 unique-violation so a re-run is a safe no-op.
  for (const row of rows) {
    const { error } = await supabase.from('verification_tag_types').insert(row);
    if (error && error.code !== '23505') throw error;
  }
}

// ---- Avatar Storage ----

export async function uploadAvatar(file: File, userId: string): Promise<string> {
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}

// ---- Banners ----

export async function fetchBanners(locationId: string, activeOnly = true): Promise<Banner[]> {
  let query = supabase.from('banners').select().eq('location_id', locationId);
  if (activeOnly) query = query.eq('is_active', true);
  const { data, error } = await query.order('display_order');
  if (error) throw error;
  return data ?? [];
}

export async function createBanner(locationId: string, imageUrl: string, link: string | null): Promise<void> {
  const { data: existing, error: existingError } = await supabase
    .from('banners')
    .select('display_order')
    .eq('location_id', locationId)
    .order('display_order', { ascending: false })
    .limit(1);
  if (existingError) throw existingError;

  const nextOrder = existing?.[0]?.display_order != null ? existing[0].display_order + 1 : 0;

  const { error } = await supabase.from('banners').insert({
    location_id: locationId,
    image_url: imageUrl,
    link,
    display_order: nextOrder,
    is_active: true,
  });
  if (error) throw error;
}

export async function updateBanner(
  id: string,
  fields: Partial<Pick<Banner, 'link' | 'display_order' | 'is_active'>>
): Promise<void> {
  const { error } = await supabase.from('banners').update(fields).eq('id', id);
  if (error) throw error;
}

export async function deleteBanner(id: string): Promise<void> {
  const { error } = await supabase.from('banners').delete().eq('id', id);
  if (error) throw error;
}

// ---- Banner Image Storage ----

export async function uploadBannerImage(file: File, locationId: string): Promise<string> {
  const path = `${locationId}/${Date.now()}.jpg`;
  const { error } = await supabase.storage
    .from('banners')
    .upload(path, file, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('banners').getPublicUrl(path);
  return data.publicUrl;
}

// ---- Messaging ----

export async function fetchConversations(): Promise<Conversation[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];

  const { data: rows, error } = await supabase
    .from('conversation_participants')
    .select('conversation_id, status, conversations(id, is_group, name)')
    .eq('user_id', uid);
  if (error) throw error;

  const result: Conversation[] = [];
  for (const row of (rows ?? []) as any[]) {
    const conversationId: string = row.conversation_id;
    const conv = row.conversations as { id: string; is_group: boolean; name: string | null };

    const { data: recent, error: recentError } = await supabase
      .from('messages')
      .select()
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (recentError) throw recentError;

    let otherProfile: Profile | null = null;
    if (!conv.is_group) {
      const { data: others, error: othersError } = await supabase
        .from('conversation_participants')
        .select(`user_id, profiles:${PUBLIC_PROFILE}!user_id(*)`)
        .eq('conversation_id', conversationId)
        .neq('user_id', uid)
        .limit(1);
      if (othersError) throw othersError;
      otherProfile = (others?.[0] as any)?.profiles ?? null;
    }

    result.push({
      id: conversationId,
      is_group: conv.is_group,
      name: conv.name,
      last_message: recent?.[0]?.content ?? null,
      last_message_at: recent?.[0]?.created_at ?? null,
      my_status: row.status,
      other_profile: otherProfile,
    });
  }
  return result;
}

export async function fetchMessages(conversationId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(`*, profiles:${PUBLIC_PROFILE}!sender_id(*)`)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchConversationStatus(conversationId: string): Promise<string> {
  const uid = await getCurrentUserId();
  if (!uid) return 'accepted';
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('status')
    .eq('conversation_id', conversationId)
    .eq('user_id', uid)
    .single();
  if (error) throw error;
  return data.status;
}

export async function sendMessage(conversationId: string, content: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  const { error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: uid, content });
  if (error) throw error;
}

export async function startConversation(
  recipientIds: string[],
  name: string | null,
  isGroup: boolean,
  firstMessage: string
): Promise<Conversation> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');

  const { data: created, error: createError } = await supabase
    .from('conversations')
    .insert({ is_group: isGroup, name, created_by: uid })
    .select()
    .single();
  if (createError) throw createError;

  let alreadyFriends = new Set<string>();
  if (!isGroup) {
    const { data: friendRows, error: friendError } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', uid)
      .in('friend_id', recipientIds);
    if (friendError) throw friendError;
    alreadyFriends = new Set((friendRows ?? []).map((r: { friend_id: string }) => r.friend_id));
  }

  const participants = [{ conversation_id: created.id, user_id: uid, status: 'accepted' }];
  for (const recipientId of recipientIds) {
    const status = isGroup ? 'accepted' : alreadyFriends.has(recipientId) ? 'accepted' : 'pending';
    participants.push({ conversation_id: created.id, user_id: recipientId, status });
  }
  const { error: participantsError } = await supabase
    .from('conversation_participants')
    .insert(participants);
  if (participantsError) throw participantsError;

  await sendMessage(created.id, firstMessage);

  return {
    id: created.id,
    is_group: created.is_group,
    name: created.name,
    last_message: firstMessage,
    last_message_at: null,
    my_status: 'accepted',
    other_profile: null,
  };
}

export async function respondToConversationRequest(conversationId: string, accept: boolean): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  const { error } = await supabase
    .from('conversation_participants')
    .update({ status: accept ? 'accepted' : 'rejected' })
    .eq('conversation_id', conversationId)
    .eq('user_id', uid);
  if (error) throw error;
}

export async function fetchGroupMembers(conversationId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select(`user_id, profiles:${PUBLIC_PROFILE}!user_id(*)`)
    .eq('conversation_id', conversationId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.profiles).filter(Boolean);
}

// ---- Venue Chat (Phase 2) ----
// Persistent per-venue group chat: one conversation per location
// (conversations.location_id + is_group = true), reusing fetchMessages/
// sendMessage/ChatView unchanged for the actual message thread. Complements
// — does not replace — CreateGroupModal's ad-hoc snapshot groups.

export async function fetchVenueConversation(locationId: string): Promise<Conversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, is_group, name, location_id')
    .eq('location_id', locationId)
    .eq('is_group', true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    is_group: data.is_group,
    name: data.name,
    location_id: data.location_id,
    last_message: null,
    last_message_at: null,
    my_status: 'accepted',
    other_profile: null,
  };
}

// Organizer-only (enforced by the conversations_insert_own RLS policy from
// 0008 — requires is_venue_manager(location_id, auth.uid()) whenever
// location_id is set). Seeds every current venue manager (owner_id +
// location_managers) as chat admin at creation time, so co-owners get
// venue-chat admin the same moment the chat is created — see
// is_venue_chat_manager() in 0008 for how *later-added* co-owners get the
// same admin powers dynamically, without needing a row here.
export async function createVenueConversation(venue: Venue): Promise<Conversation> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');

  const { data: created, error: createError } = await supabase
    .from('conversations')
    .insert({ is_group: true, name: `${venue.name} Chat`, created_by: uid, location_id: venue.id })
    .select()
    .single();
  if (createError) throw createError;

  const managers = await fetchLocationManagers(venue.id);
  const adminIds = new Set<string>([uid]);
  if (venue.owner_id) adminIds.add(venue.owner_id);
  for (const m of managers) adminIds.add(m.user_id);

  const { error: participantsError } = await supabase
    .from('conversation_participants')
    .upsert(
      Array.from(adminIds).map((userId) => ({
        conversation_id: created.id,
        user_id: userId,
        role: 'admin',
        status: 'accepted',
      })),
      { onConflict: 'conversation_id,user_id' }
    );
  if (participantsError) throw participantsError;

  return {
    id: created.id,
    is_group: created.is_group,
    name: created.name,
    location_id: created.location_id,
    last_message: null,
    last_message_at: null,
    my_status: 'accepted',
    other_profile: null,
  };
}

export async function fetchOrCreateVenueConversation(venue: Venue): Promise<Conversation> {
  const existing = await fetchVenueConversation(venue.id);
  if (existing) return existing;
  try {
    return await createVenueConversation(venue);
  } catch (err) {
    // Another organizer/tab may have created it a moment earlier — the
    // uniq_venue_group_conversation partial unique index (0008) would raise
    // a conflict here; fall back to reading whatever now exists.
    const raceWinner = await fetchVenueConversation(venue.id);
    if (raceWinner) return raceWinner;
    throw err;
  }
}

// A co-owner (or the primary owner) may not have an explicit admin
// conversation_participants row yet — is_venue_chat_manager (0008) already
// grants them admin RLS powers dynamically, but the actual chat UI (role
// badges, "who's an admin") reads from real rows, so this backfills one the
// first time they open the venue chat. Only ever INSERTs a brand-new row,
// or DELETEs+re-INSERTs their own stale 'member' row — never an UPDATE, so
// 018's last-admin/role-change guard trigger (which requires an *existing*
// admin to perform the change) never gets in the way of this self-service
// upgrade.
export async function ensureVenueChatAdmin(conversationId: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  const { data: existing, error } = await supabase
    .from('conversation_participants')
    .select('role')
    .eq('conversation_id', conversationId)
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;

  if (!existing) {
    const { error: insertError } = await supabase
      .from('conversation_participants')
      .insert({ conversation_id: conversationId, user_id: uid, role: 'admin', status: 'accepted' });
    if (insertError) throw insertError;
    return;
  }
  if (existing.role !== 'admin') {
    const { error: deleteError } = await supabase
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', uid);
    if (deleteError) throw deleteError;
    const { error: insertError } = await supabase
      .from('conversation_participants')
      .insert({ conversation_id: conversationId, user_id: uid, role: 'admin', status: 'accepted' });
    if (insertError) throw insertError;
  }
}

export async function fetchMyParticipation(
  conversationId: string
): Promise<{ status: string; role: 'admin' | 'member' } | null> {
  const uid = await getCurrentUserId();
  if (!uid) return null;
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('status, role')
    .eq('conversation_id', conversationId)
    .eq('user_id', uid)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function fetchChatParticipants(conversationId: string): Promise<ChatParticipant[]> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select(`conversation_id, user_id, role, status, profiles:${PUBLIC_PROFILE}!user_id(*)`)
    .eq('conversation_id', conversationId);
  if (error) throw error;
  return ((data ?? []) as unknown as ChatParticipant[]).sort((a, b) => {
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
    return (a.profiles?.display_name ?? '').localeCompare(b.profiles?.display_name ?? '');
  });
}

export async function removeChatParticipant(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('conversation_participants')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function setChatJoinMode(locationId: string, mode: 'auto' | 'request'): Promise<void> {
  const { error } = await supabase.from('locations').update({ chat_join_mode: mode }).eq('id', locationId);
  if (error) throw error;
}

// 'request' mode: 3-attempt cap per (conversation, user), enforced by
// join_requests_attempt_cap_trigger (018) — a 4th attempt raises a Postgres
// exception that surfaces here as a thrown error.
export async function requestToJoinVenueChat(conversationId: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  const { error } = await supabase.from('join_requests').insert({ conversation_id: conversationId, user_id: uid });
  if (error) throw error;
}

export async function fetchMyJoinRequests(conversationId: string): Promise<JoinRequest[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('join_requests')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_id', uid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPendingJoinRequests(conversationId: string): Promise<JoinRequest[]> {
  const { data, error } = await supabase
    .from('join_requests')
    .select(`*, profiles:${PUBLIC_PROFILE}!user_id(*)`)
    .eq('conversation_id', conversationId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as JoinRequest[];
}

export async function approveJoinRequest(request: JoinRequest): Promise<void> {
  const { error: updateError } = await supabase
    .from('join_requests')
    .update({ status: 'approved' })
    .eq('id', request.id);
  if (updateError) throw updateError;

  const { error: insertError } = await supabase
    .from('conversation_participants')
    .upsert(
      { conversation_id: request.conversation_id, user_id: request.user_id, role: 'member', status: 'accepted' },
      { onConflict: 'conversation_id,user_id' }
    );
  if (insertError) throw insertError;
}

export async function denyJoinRequest(requestId: string): Promise<void> {
  const { error } = await supabase.from('join_requests').update({ status: 'denied' }).eq('id', requestId);
  if (error) throw error;
}

export async function fetchAllProfiles(): Promise<Profile[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  // Public directory (name search for pickers) — the view carries no PII.
  const { data, error } = await supabase
    .from(PUBLIC_PROFILE)
    .select('id, display_name, avatar_url, affiliation')
    .neq('id', uid)
    .order('display_name', { ascending: true })
    .limit(200);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

// Staff admin console only. Reads the base table, which RLS opens to master
// admins (profiles_select_master_admin, migration 0026); anyone else gets
// just their own row back. Carries email + is_master_admin for the
// "grant master admin" search and list.
export async function fetchAllProfilesForAdmin(): Promise<Profile[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, affiliation, email, is_master_admin')
    .neq('id', uid)
    .order('display_name', { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Profile[];
}

// ---- Organizer Report ----
// All-time totals for now — there's no fixed "event window" concept in the
// schema yet (locations don't have a report-scoped start/end for regular
// venues, only for is_event rows), so a date-range filter would be
// arbitrary. Simplest honest choice until that concept exists.

const HOUR_LABEL_FORMATTER = new Intl.DateTimeFormat('en-US', { hour: 'numeric' });

export async function fetchAttendanceStats(locationId: string): Promise<AttendanceStats> {
  const { data, error } = await supabase
    .from('location_checkins')
    .select('user_id, checked_in_at, checked_out_at')
    .eq('location_id', locationId);
  if (error) throw error;

  const rows = data ?? [];
  const totalCheckins = rows.length;
  const uniqueAttendees = new Set(rows.map((r) => r.user_id)).size;

  const hourCounts = new Array(24).fill(0);
  const dwellMinutes: number[] = [];
  for (const row of rows) {
    if (!row.checked_in_at) continue;
    hourCounts[new Date(row.checked_in_at).getHours()] += 1;
    if (row.checked_out_at) {
      const minutes = (new Date(row.checked_out_at).getTime() - new Date(row.checked_in_at).getTime()) / 60000;
      if (minutes > 0) dwellMinutes.push(minutes);
    }
  }
  const checkinsByHour = hourCounts.map((count, hour) => ({
    hour: HOUR_LABEL_FORMATTER.format(new Date(2000, 0, 1, hour)),
    count,
  }));
  const avgDwellMinutes =
    dwellMinutes.length > 0 ? Math.round((dwellMinutes.reduce((a, b) => a + b, 0) / dwellMinutes.length) * 10) / 10 : 0;

  return { totalCheckins, uniqueAttendees, checkinsByHour, avgDwellMinutes };
}

export async function fetchTagBreakdown(locationId: string): Promise<TagBreakdownEntry[]> {
  const { data, error } = await supabase
    .from('verification_tags')
    .select('tag, verification_tag_types(label)')
    .eq('location_id', locationId);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as unknown as {
    tag: string;
    verification_tag_types: { label: string } | null;
  }[]) {
    const label = row.verification_tag_types?.label ?? row.tag;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

// Deliberately does NOT join to `friendships` — whether every scan/peek
// always produces a friendships row was never confirmed, so that join
// risks silently wrong numbers. These two counts are directly observable
// instead: QR-scan events and accepted peek invites, both scoped to venue.
export async function fetchConnectionsFormed(locationId: string): Promise<ConnectionsFormedStats> {
  const { count: scans, error: scansError } = await supabase
    .from('connections')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId);
  if (scansError) throw scansError;

  const { count: peeksAccepted, error: peeksError } = await supabase
    .from('peek_invites')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId)
    .not('accepted_at', 'is', null);
  if (peeksError) throw peeksError;

  return { scans: scans ?? 0, peeksAccepted: peeksAccepted ?? 0 };
}

// Breaks down connections by the contact method the scanner tapped after
// scanning someone's code (whatsapp/instagram/linkedin/phone/etc.). Only
// captured by the iOS app's UserLinksVC — rows scanned but never tapped
// through (or scanned via a client that predates this) have a null
// contact_method_type and are excluded here.
export async function fetchContactMethodBreakdown(locationId: string): Promise<ContactMethodBreakdownEntry[]> {
  const { data, error } = await supabase
    .from('connections')
    .select('contact_method_type')
    .eq('location_id', locationId)
    .not('contact_method_type', 'is', null);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { contact_method_type: string }[]) {
    counts.set(row.contact_method_type, (counts.get(row.contact_method_type) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([contact_method_type, count]) => ({ contact_method_type, count }))
    .sort((a, b) => b.count - a.count);
}

// groupsCreated/groupMessagesSent are exact counts scoped via
// conversations.location_id (only ever set on a venue's own group chat).
// dmMessagesApprox is an approximation: DMs carry no location_id, so it
// counts messages in DM conversations between two users who have both
// checked in to this venue at some point — not an exact "started here"
// count. See fetch_message_stats in supabase/migrations/0013_analytics_functions.sql.
export async function fetchEngagementStats(locationId: string): Promise<EngagementStats> {
  const { count: feedPosts, error } = await supabase
    .from('feed_posts')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId);
  if (error) throw error;

  const { data: messageStats, error: statsError } = await supabase.rpc('fetch_message_stats', {
    p_location_id: locationId,
  });
  if (statsError) throw statsError;

  return {
    feedPosts: feedPosts ?? 0,
    groupsCreated: messageStats?.groupsCreated ?? 0,
    groupMessagesSent: messageStats?.groupMessagesSent ?? 0,
    dmMessagesApprox: messageStats?.dmMessagesApprox ?? 0,
  };
}

export async function fetchZoneAnalytics(locationId: string): Promise<ZoneAnalytics> {
  const { data, error } = await supabase.rpc('fetch_zone_analytics', { p_location_id: locationId });
  if (error) throw error;
  return (data ?? { occupancy: [], avgDwellMinutes: [], transitions: [] }) as ZoneAnalytics;
}

export async function fetchCrossVenueMovement(locationId: string): Promise<CrossVenueMovementEntry[]> {
  const { data, error } = await supabase.rpc('fetch_cross_venue_movement', { p_location_id: locationId });
  if (error) throw error;
  return (data ?? []) as CrossVenueMovementEntry[];
}

// ---- Governance (master admin only, enforced server-side by the RPCs) ----

export async function setMasterAdmin(targetUserId: string, value: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_master_admin', { target_user_id: targetUserId, value });
  if (error) throw error;
}

export async function assignVenueOwner(targetLocationId: string, newOwnerId: string | null): Promise<void> {
  const { error } = await supabase.rpc('assign_venue_owner', {
    target_location_id: targetLocationId,
    new_owner_id: newOwnerId,
  });
  if (error) throw error;
}

// ---- Connections graph ----

// Mints a 90s single-use token for the current user; the QR in ConnectSheet
// encodes this. Re-called every 60s while the sheet is open.
export async function mintConnectToken(): Promise<string> {
  const { data, error } = await supabase.rpc('mint_connect_token');
  if (error) throw error;
  return data as string;
}

// Creates a connection from a scanned token. lat/lng are best-effort — omit
// them if the browser denied or failed geolocation; the connection is still
// made, just without a geotag. Idempotent per (scanner, scannee). Returns the
// connection id, which recordContactMethodChoice() then needs.
export async function recordQrScan(token: string, lat?: number, lng?: number): Promise<string> {
  const { data, error } = await supabase.rpc('record_qr_scan', {
    p_token: token,
    p_lat: lat ?? null,
    p_lng: lng ?? null,
  });
  if (error) throw error;
  // Best-effort: refresh earned badges after a successful QR connect.
  recomputeMyBadges().catch(() => {});
  return data as string;
}

// Removes both friendship rows for the pair. `connections` event rows are
// retained on purpose (permanent geotag; already aggregated into past reports).
export async function removeConnection(otherUserId: string): Promise<void> {
  const { error } = await supabase.rpc('remove_connection', { p_other_user_id: otherUserId });
  if (error) throw error;
}

// Exact because record_qr_scan writes both directions, so every friendship of
// mine has a row with user_id = me.
export async function fetchMyConnectionCount(): Promise<number> {
  const uid = await getCurrentUserId();
  if (!uid) return 0;
  const { count, error } = await supabase
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', uid);
  if (error) throw error;
  return count ?? 0;
}

// One connection row by id. Readable via connections_select_participant when
// the caller is the scanner or scannee. Returns null if not found / not theirs.
export async function fetchConnection(connectionId: string): Promise<Connection | null> {
  const { data, error } = await supabase
    .from('connections')
    .select('id, scanner_id, scannee_id, location_id, scanned_at, contact_method_type, place_label')
    .eq('id', connectionId)
    .maybeSingle();
  if (error) throw error;
  return (data as Connection) ?? null;
}

// The /main/connections list: every person I'm connected to, plus where/when.
// Two reads + a client join (no RPC): my friend ids, then my connection rows
// for place/date, then profiles for names.
export async function fetchMyConnections(): Promise<MyConnection[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];

  const { data: friendRows, error: friendErr } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', uid);
  if (friendErr) throw friendErr;

  const friendIds = (friendRows ?? []).map((r: { friend_id: string }) => r.friend_id);
  if (friendIds.length === 0) return [];

  const { data: connRows, error: connErr } = await supabase
    .from('connections')
    .select('scanner_id, scannee_id, place_label, scanned_at')
    .or(`scanner_id.eq.${uid},scannee_id.eq.${uid}`)
    .order('scanned_at', { ascending: false });
  if (connErr) throw connErr;

  // other_user_id -> most recent connection meta (rows are already newest-first).
  const metaByOther = new Map<string, { place_label: string | null; scanned_at: string }>();
  for (const c of (connRows ?? []) as { scanner_id: string; scannee_id: string; place_label: string | null; scanned_at: string }[]) {
    const other = c.scanner_id === uid ? c.scannee_id : c.scanner_id;
    if (!metaByOther.has(other)) metaByOther.set(other, { place_label: c.place_label, scanned_at: c.scanned_at });
  }

  const { data: profs, error: profErr } = await supabase
    .from(PUBLIC_PROFILE)
    .select('id, display_name, avatar_url')
    .in('id', friendIds);
  if (profErr) throw profErr;

  const profById = new Map(
    (profs ?? []).map((p: { id: string; display_name: string | null; avatar_url: string | null }) => [p.id, p])
  );

  return friendIds.map((id) => {
    const meta = metaByOther.get(id);
    const p = profById.get(id);
    return {
      other_user_id: id,
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      place_label: meta?.place_label ?? null,
      scanned_at: meta?.scanned_at ?? null,
    };
  });
}

// Wraps the SECURITY DEFINER RPC from migration 0015, which only ever updates
// contact_method_type and only on the caller's own connection row.
export async function recordContactMethodChoice(connectionId: string, type: string): Promise<void> {
  const { error } = await supabase.rpc('record_contact_method_choice', {
    p_connection_id: connectionId,
    p_type: type,
  });
  if (error) throw error;
}

// Recent check-ins by people I'm connected to.
//
// PRIVACY: location_checkins' SELECT policy is `true` (any authenticated user
// can read any check-in), so RLS provides NO protection here. The
// share_checkins_with_friends filter below is the only thing gating this data,
// and that column defaults to false. Do not remove it, and do not widen it to
// a join that could return rows for opted-out users.
export async function fetchFriendsActivity(limit = 20): Promise<FriendActivityEntry[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];

  // record_qr_scan writes both directions, so every friend of mine has a row
  // with user_id = me. A single-direction read is correct and index-friendly.
  const { data: friendRows, error: friendError } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', uid);
  if (friendError) throw friendError;

  const friendIds = (friendRows ?? []).map((r: { friend_id: string }) => r.friend_id);
  if (friendIds.length === 0) return [];

  // Restrict to friends who opted in BEFORE reading any check-in.
  // `Profile` uses display_name — there is no `name` column on profiles.
  const { data: sharers, error: sharerError } = await supabase
    .from(PUBLIC_PROFILE)
    .select('id, display_name, avatar_url')
    .in('id', friendIds)
    .eq('share_checkins_with_friends', true);
  if (sharerError) throw sharerError;

  const sharerIds = (sharers ?? []).map((p: { id: string }) => p.id);
  if (sharerIds.length === 0) return [];

  const profileById = new Map(
    (sharers ?? []).map((p: { id: string; display_name: string | null; avatar_url: string | null }) => [p.id, p])
  );

  // Recency window: without one, an opted-in friend's check-in from months
  // ago is indistinguishable from last night's in the UI. 7 days matches
  // what "recent activity" plausibly means for a feed like this.
  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: checkins, error: checkinError } = await supabase
    .from('location_checkins')
    .select('user_id, location_id, checked_in_at, checked_out_at, locations(name)')
    .in('user_id', sharerIds)
    .gte('checked_in_at', sinceIso)
    .order('checked_in_at', { ascending: false });
  if (checkinError) throw checkinError;

  type CheckinRow = {
    user_id: string;
    location_id: string;
    checked_in_at: string;
    checked_out_at: string | null;
    locations: { name: string } | null;
  };

  // Dedupe to each friend's single most recent check-in (rows arrive
  // newest-first, so the first occurrence per user_id wins) — otherwise one
  // frequently-checking-in friend can fill the whole feed and this stops
  // being "one entry per friend" as the interface's own comment promises.
  const seen = new Set<string>();
  const entries: FriendActivityEntry[] = [];
  for (const row of (checkins ?? []) as unknown as CheckinRow[]) {
    if (seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    const profile = profileById.get(row.user_id);
    entries.push({
      user_id: row.user_id,
      name: profile?.display_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      location_id: row.location_id,
      venue_name: row.locations?.name ?? 'A venue',
      checked_in_at: row.checked_in_at,
      is_active: row.checked_out_at === null,
    });
    if (entries.length >= limit) break;
  }
  return entries;
}

// Opt in/out of letting connections see your venue check-ins in their feed.
// Defaults to false in the database; this is the only place the app turns it on.
export async function setShareCheckinsWithFriends(value: boolean): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) throw new Error('Not signed in');
  await updateProfile({ id: uid, share_checkins_with_friends: value });
}

// ---- Location requests ----

// Creates a request for the current user and (server-side, same transaction)
// posts a "pending approval" message from the system sender. Returns the
// request id.
export async function requestLocation(
  name: string,
  description: string,
  lat: number,
  lng: number
): Promise<string> {
  const { data, error } = await supabase.rpc('request_location', {
    p_name: name,
    p_description: description || null,
    p_lat: lat,
    p_lng: lng,
  });
  if (error) throw error;
  return data as string;
}

// Master-admin-only by RLS (location_requests_select_admin) -- a non-admin
// calling this only ever gets back their own requests
// (location_requests_select_own), never an error.
export async function fetchLocationRequests(
  status?: 'pending' | 'approved' | 'rejected'
): Promise<LocationRequest[]> {
  let query = supabase
    .from('location_requests')
    .select(`*, profiles:${PUBLIC_PROFILE}!submitted_by(display_name)`)
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as LocationRequest[];
}

// Master-admin-only (enforced inside the RPC). Creates the real locations
// row (owner = the original requester) and returns its id.
export async function approveLocationRequest(requestId: string): Promise<string> {
  const { data, error } = await supabase.rpc('approve_location_request', {
    p_request_id: requestId,
  });
  if (error) throw error;
  return data as string;
}

// Master-admin-only (enforced inside the RPC).
export async function rejectLocationRequest(requestId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('reject_location_request', {
    p_request_id: requestId,
    p_reason: reason || null,
  });
  if (error) throw error;
}
