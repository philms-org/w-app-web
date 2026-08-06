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
  Banner,
  LocationManager,
  AttendanceStats,
  TagBreakdownEntry,
  ConnectionsFormedStats,
  EngagementStats,
} from './types';

// Central Supabase data service. Mirrors WAPData.swift in the iOS app —
// same tables, same columns, same method shapes.

// ---- Profile ----

export async function fetchProfile(id: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select().eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function upsertProfile(profile: Partial<Profile> & { id: string }): Promise<void> {
  const { error } = await supabase.from('profiles').upsert(profile);
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
    .select('*, profiles(*)')
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
    .select('*, profiles(*)')
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
    .select('*, profiles(*)')
    .eq('location_id', locationId)
    .is('checked_out_at', null);
  if (error) throw error;
  return data ?? [];
}

export async function checkIn(locationId: string): Promise<void> {
  const uid = await getCurrentUserId();
  if (!uid) return;
  const { error } = await supabase
    .from('location_checkins')
    .insert({ user_id: uid, location_id: locationId, mode: 'live' });
  if (error) throw error;
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
    .select('profiles(*)')
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

// ---- Verification Tags ----

export async function fetchVerificationTags(locationId: string): Promise<VerificationTag[]> {
  const { data, error } = await supabase
    .from('verification_tags')
    .select('*, profiles(*)')
    .eq('location_id', locationId);
  if (error) throw error;
  return data ?? [];
}

export async function assignVerificationTag(
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

export async function removeVerificationTag(tagId: string): Promise<void> {
  const { error } = await supabase.from('verification_tags').delete().eq('id', tagId);
  if (error) throw error;
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
        .select('user_id, profiles(*)')
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
    .select('*, profiles(*)')
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
    .select('user_id, profiles(*)')
    .eq('conversation_id', conversationId);
  if (error) throw error;
  return (data ?? []).map((r: any) => r.profiles).filter(Boolean);
}

export async function fetchAllProfiles(): Promise<Profile[]> {
  const uid = await getCurrentUserId();
  if (!uid) return [];
  const { data, error } = await supabase.from('profiles').select().neq('id', uid).limit(200);
  if (error) throw error;
  return data ?? [];
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
    .select('user_id, checked_in_at')
    .eq('location_id', locationId);
  if (error) throw error;

  const rows = data ?? [];
  const totalCheckins = rows.length;
  const uniqueAttendees = new Set(rows.map((r) => r.user_id)).size;

  const hourCounts = new Array(24).fill(0);
  for (const row of rows) {
    if (!row.checked_in_at) continue;
    hourCounts[new Date(row.checked_in_at).getHours()] += 1;
  }
  const checkinsByHour = hourCounts.map((count, hour) => ({
    hour: HOUR_LABEL_FORMATTER.format(new Date(2000, 0, 1, hour)),
    count,
  }));

  return { totalCheckins, uniqueAttendees, checkinsByHour };
}

export async function fetchTagBreakdown(locationId: string): Promise<TagBreakdownEntry[]> {
  const { data, error } = await supabase
    .from('verification_tags')
    .select('tag')
    .eq('location_id', locationId);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { tag: string }[]) {
    counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
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

// groupsCreated/groupMessagesSent are hardcoded to 0: conversations and
// conversation_participants carry no location_id, so there's currently no
// way to attribute a group (or its messages) to the venue it was created
// from. Returning 0 here is a known gap, not a real count — see report.
export async function fetchEngagementStats(locationId: string): Promise<EngagementStats> {
  const { count: feedPosts, error } = await supabase
    .from('feed_posts')
    .select('*', { count: 'exact', head: true })
    .eq('location_id', locationId);
  if (error) throw error;

  return { feedPosts: feedPosts ?? 0, groupsCreated: 0, groupMessagesSent: 0 };
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
