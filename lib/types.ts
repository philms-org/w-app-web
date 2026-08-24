// Mirrors the Postgres schema in the shared Supabase project (see WAPModels.swift
// in the iOS app for the canonical field list). Field names are snake_case to
// match the raw rows Supabase returns — no camelCase mapping layer.

export interface Profile {
  id: string;
  display_name: string;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  affiliation?: string | null;
  industry?: string | null;
  role?: string | null;
  city?: string | null;
  fave_drink?: string | null;
  friday_night?: string | null;
  profession?: string | null;
  city_visible?: boolean | null;
  fave_drink_visible?: boolean | null;
  friday_night_visible?: boolean | null;
  profession_visible?: boolean | null;
  is_verified?: boolean | null;
  height?: number | null;
  nationality?: string | null;
  relationship?: string | null;
  dating_id?: number | null;
  socialising_id?: number | null;
  networking_id?: number | null;
  is_master_admin?: boolean | null;
}

export interface Venue {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  geofence_radius_meters?: number | null;
  is_event?: boolean | null;
  event_date?: string | null;
  event_end_date?: string | null;
  event_status?: string | null;
  description?: string | null;
  banner_image?: string | null;
  whatsapp?: string | null;
  default_message?: string | null;
  owner_id?: string | null;
  // Founder decision layered on the owner-benefits plan: per-venue,
  // organizer-configurable venue-chat join model (default 'request').
  chat_join_mode?: 'auto' | 'request';
}

export interface FeedItem {
  id: string;
  location_id: string;
  user_id: string;
  content: string;
  zone_tag?: string | null;
  created_at: string;
  profiles?: Profile;
}

export interface Presence {
  id: string;
  location_id: string;
  user_id: string;
  mode: string;
  checked_in_at?: string | null;
  checked_out_at?: string | null;
  profiles?: Profile;
}

export interface ContactMethod {
  id: string;
  user_id: string;
  slot_order: number;
  type: string;
  value?: string | null;
  is_enabled: boolean;
}

export interface Reward {
  id: string;
  location_id: string;
  name: string;
  icon_type?: string | null;
  deal_text?: string | null;
  instructions?: string | null;
  qr_path?: string | null;
  is_active: boolean;
  display_order: number;
  feature_name?: string | null;
}

export interface Conversation {
  id: string;
  is_group: boolean;
  name?: string | null;
  location_id?: string | null;
  last_message?: string | null;
  last_message_at?: string | null;
  my_status: string;
  other_profile?: Profile | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
}

// ---- Venue Chat (Phase 2) ----
// The persistent per-venue group chat riding on top of Conversation +
// conversation_participants.role (from w-app-ios migration 018, already
// live in the shared backend, never consumed by any UI before this).

export interface JoinRequest {
  id: string;
  conversation_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'denied';
  attempt_count: number;
  created_at: string;
  profiles?: Profile;
}

export interface ChatParticipant {
  conversation_id: string;
  user_id: string;
  role: 'admin' | 'member';
  status: string;
  profiles?: Profile;
}

export interface VerificationTag {
  id: string;
  user_id: string;
  location_id: string;
  tag: string;
  icon?: string | null;
  assigned_by: string;
  assigned_at: string;
  profiles?: Profile;
}

export interface LocationManager {
  id: string;
  location_id: string;
  user_id: string;
  added_by?: string | null;
  added_at: string;
  profiles?: Profile;
}

// ---- Venue Members roster ----
// One row per person who has ever checked in "live" at a venue (deduped
// from location_checkins, same opt-out rule as fetchAttendeeHistory).
// checkinCount doubles as the attendance-tier input for Phase 4 rewards
// (rewards.min_checkins).
export interface VenueMember {
  profile: Profile;
  checkinCount: number;
  firstCheckinAt: string | null;
  lastCheckinAt: string | null;
  tags: VerificationTag[];
}

export interface Banner {
  id: string;
  location_id: string;
  image_url: string;
  link?: string | null;
  display_order: number;
  is_active: boolean;
}

// ---- Organizer report ----

export interface AttendanceStats {
  totalCheckins: number;
  uniqueAttendees: number;
  checkinsByHour: { hour: string; count: number }[];
}

export interface TagBreakdownEntry {
  tag: string;
  count: number;
}

export interface ConnectionsFormedStats {
  scans: number;
  peeksAccepted: number;
}

export interface EngagementStats {
  feedPosts: number;
  groupsCreated: number;
  groupMessagesSent: number;
}
