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
