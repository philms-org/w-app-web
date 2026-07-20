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
