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
  share_checkins_with_friends?: boolean | null;
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

export interface FeedComment {
  id: string;
  feed_post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: Profile;
}

export type FeedReportTargetType = 'post' | 'comment';
export type FeedReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';

export interface FeedReport {
  id: string;
  target_type: FeedReportTargetType;
  target_id: string;
  reporter_id: string;
  reason: FeedReportReason;
  details?: string | null;
  status: 'open' | 'resolved';
  resolved_by?: string | null;
  resolved_at?: string | null;
  created_at: string;
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
  // Phase 4 (attendance-tier badges): nullable — a reward with min_checkins
  // set unlocks once the member's location_checkins count at this venue
  // reaches it. Null means "no tier requirement" (visible to everyone).
  min_checkins?: number | null;
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

export type TagIconKind = 'lucide' | 'image' | 'emoji';

export interface VerificationTagType {
  id: string;
  location_id: string;
  label: string;
  icon: string;
  icon_kind: TagIconKind;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

export interface VerificationTag {
  id: string;
  user_id: string;
  location_id: string;
  tag: string;
  icon?: string | null;
  type_id: string | null;
  type?: VerificationTagType;
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

// ---- Venue zones (organizer analytics) ----

export interface VenueZone {
  id: string;
  location_id: string;
  name: string;
  center_lat: number;
  center_lng: number;
  created_by?: string | null;
  created_at: string;
}

export interface ActivityMenuItem {
  id: string;
  location_id: string;
  label: string;
  sort_order: number;
  created_by: string | null;
  created_at: string;
}

export interface AttendeeActivityPick {
  user_id: string;
  location_id: string;
  item_id: string;
  picked_at: string;
}

// ---- Badges ----

export interface Badge {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  criteria_kind: string;
  criteria_threshold: number;
  sort_order: number;
}

export interface UserBadge {
  user_id: string;
  badge_id: string;
  earned_at: string;
}

// ---- Organizer report ----

export interface AttendanceStats {
  totalCheckins: number;
  uniqueAttendees: number;
  checkinsByHour: { hour: string; count: number }[];
  avgDwellMinutes: number;
}

export interface TagBreakdownEntry {
  tag: string;
  count: number;
}

export interface ConnectionsFormedStats {
  scans: number;
  peeksAccepted: number;
}

export interface ContactMethodBreakdownEntry {
  contact_method_type: string;
  count: number;
}

export interface EngagementStats {
  feedPosts: number;
  groupsCreated: number;
  groupMessagesSent: number;
  dmMessagesApprox: number;
}

export interface ZoneAnalytics {
  occupancy: { zone_name: string; count: number }[];
  avgDwellMinutes: { zone_name: string; minutes: number }[];
  transitions: { from_zone: string; to_zone: string; count: number; unique_people: number }[];
}

export interface CrossVenueMovementEntry {
  location_id: string;
  venue_name: string;
  attendee_count: number;
  percentage: number;
}

// ---- Connections graph ----
// `connections` is the EVENT log ("A scanned B, near here"); `friendships`
// (UNIQUE (user_id, friend_id), source qr_scan|peek_invite|message) is the
// relationship STATE. Both tables predate this repo (iOS era) — see
// supabase/migrations/0019_connections_write_path.sql.

export interface Connection {
  id: string;
  scanner_id: string;
  scannee_id: string;
  location_id: string | null;
  scanned_at: string;
  contact_method_type: string | null;
  scan_lat: number | null;
  scan_lng: number | null;
  place_label: string | null;
}

// One row for the /main/connections list: the OTHER person plus where/when the
// connection was made (null place/date if the friendship has no connections row,
// e.g. source = 'message').
export interface MyConnection {
  other_user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  place_label: string | null;
  scanned_at: string | null;
}

// One friend's most recent venue check-in, for the home friends feed.
// Only ever populated for friends who set share_checkins_with_friends = true.
export interface FriendActivityEntry {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  location_id: string;
  venue_name: string;
  checked_in_at: string;
  is_active: boolean;
}

// ---- Location requests (map "Add a location" -> admin approval queue) ----
// See supabase/migrations/0020_location_requests.sql.
export interface LocationRequest {
  id: string;
  submitted_by: string;
  name: string;
  description: string | null;
  lat: number;
  lng: number;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  profiles?: { display_name: string } | null;
}
