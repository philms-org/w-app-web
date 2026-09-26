// Realistic mock rows for the P7 review capture harness (capture.mjs).
// Everything here is fictional. Row shapes mirror lib/types.ts; embedded
// relations (profiles, locations, conversations, ...) are pre-attached so the
// generic PostgREST mock can return a row regardless of the `select=` shape.

export const ME = 'u-me-0000';
export const VENUE = 'loc-velvet-0001';
const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toISOString();
const daysAgo = (d) => hoursAgo(d * 24);
const dob = (age) => `${new Date().getFullYear() - age}-03-14`;

const img = (kind, seed) => `https://mockproj.supabase.co/storage/v1/object/public/mock/${kind}/${seed}.svg`;

const person = (id, display_name, extra = {}) => ({
  id,
  display_name,
  email: `${display_name.split(' ')[0].toLowerCase()}@example.com`,
  phone: '+44 7700 900000',
  avatar_url: img('avatar', id),
  city_visible: true,
  is_verified: false,
  share_checkins_with_friends: true,
  ...extra,
});

export const profiles = [
  person(ME, 'Alex Morgan', {
    city: 'London', nationality: 'British', is_verified: true, date_of_birth: dob(29),
    role: 'Product designer', affiliation: 'Studio North', profession: 'Designer', profession_visible: true,
    fave_drink: 'Negroni', fave_drink_visible: true, friday_night: 'Live music', friday_night_visible: true,
    socialising_id: 1, networking_id: 2, is_master_admin: true, height: 178, relationship: 'Single',
  }),
  person('u-2', 'Sofia Reyes', { city: 'Madrid', nationality: 'Spanish', is_verified: true, date_of_birth: dob(27), dating_id: 1, socialising_id: 1, role: 'Architect' }),
  person('u-3', 'James Okafor', { city: 'London', nationality: 'Nigerian', date_of_birth: dob(31), networking_id: 2, role: 'Founder', affiliation: 'Loop Labs' }),
  person('u-4', 'Mei Tanaka', { city: 'Tokyo', nationality: 'Japanese', is_verified: true, date_of_birth: dob(26), socialising_id: 1 }),
  person('u-5', 'Lucas Martin', { city: 'Paris', nationality: 'French', date_of_birth: dob(33), dating_id: 1, networking_id: 2 }),
  person('u-6', 'Priya Shah', { city: 'London', nationality: 'Indian', date_of_birth: dob(28), networking_id: 2, role: 'VC associate' }),
  person('u-7', 'Noah Fischer', { city: 'Berlin', nationality: 'German', date_of_birth: dob(30), socialising_id: 1, avatar_url: null }),
  person('u-8', 'Chloé Dubois', { city: 'Lyon', nationality: 'French', is_verified: true, date_of_birth: dob(25), dating_id: 1 }),
];
const P = Object.fromEntries(profiles.map((p) => [p.id, p]));

export const locations = [
  {
    id: VENUE, name: 'Velvet Room', address: '14 Greek St', city: 'London', lat: 51.5136, lng: -0.1319,
    geofence_radius_meters: 150, is_event: false, description: 'Cocktail bar & live jazz, Soho',
    banner_image: img('banner', 'velvet'), owner_id: ME, chat_join_mode: 'request',
  },
  {
    id: 'loc-2', name: 'Rooftop 88', address: '88 Shoreditch High St', city: 'London', lat: 51.5246, lng: -0.0776,
    geofence_radius_meters: 120, is_event: false, description: 'Rooftop terrace', banner_image: img('banner', 'rooftop'), owner_id: 'u-3',
  },
  {
    id: 'loc-3', name: 'Founders Friday', address: 'The Ministry, Borough', city: 'London', lat: 51.4985, lng: -0.0967,
    geofence_radius_meters: 200, is_event: true, event_date: daysAgo(-2), event_status: 'upcoming',
    description: 'Monthly founders mixer', banner_image: img('banner', 'founders'), owner_id: 'u-6',
  },
];
const L = Object.fromEntries(locations.map((l) => [l.id, l]));

const checkin = (id, user_id, location_id, h, out = null) => ({
  id, user_id, location_id, mode: 'live', checked_in_at: hoursAgo(h), checked_out_at: out,
  profiles: P[user_id], locations: L[location_id],
});

export const location_checkins = [
  checkin('c-me', ME, VENUE, 0.5),
  checkin('c-2', 'u-2', VENUE, 0.8), checkin('c-3', 'u-3', VENUE, 1.2), checkin('c-4', 'u-4', VENUE, 0.3),
  checkin('c-5', 'u-5', VENUE, 2), checkin('c-6', 'u-6', VENUE, 1.5), checkin('c-7', 'u-7', VENUE, 0.6),
  checkin('c-h1', ME, 'loc-2', 72, hoursAgo(69)), checkin('c-h2', ME, 'loc-3', 240, hoursAgo(236)),
  checkin('c-h3', 'u-8', VENUE, 48, hoursAgo(45)),
];

const post = (id, author_id, body, h, likes = []) => ({
  id, location_id: VENUE, author_id, body, created_at: hoursAgo(h), author: P[author_id],
  post_likes: likes.map((user_id) => ({ user_id })),
});
export const venue_posts = [
  post('vp-1', 'u-2', 'The trio just started their second set, grab a seat by the piano 🎷', 0.1, [ME, 'u-3', 'u-4']),
  post('vp-2', 'u-3', 'Anyone here working on climate tech? Would love to swap notes.', 0.4, ['u-6']),
  post('vp-3', 'u-4', 'First time at Velvet Room. What should I order?', 0.7, []),
];
export const post_likes = venue_posts.flatMap((p) => p.post_likes.map((l) => ({ post_id: p.id, ...l })));

export const friendships = ['u-2', 'u-3', 'u-4', 'u-6'].map((friend_id, i) => ({
  id: `f-${i}`, user_id: ME, friend_id, source: 'qr_scan', created_at: daysAgo(i + 1), profiles: P[friend_id],
}));

export const banners = [
  { id: 'b-1', location_id: VENUE, image_url: img('banner', 'velvet'), link: 'https://example.com/menu', display_order: 0, is_active: true },
  { id: 'b-2', location_id: VENUE, image_url: img('banner', 'jazz'), link: null, display_order: 1, is_active: true },
];

export const verification_tag_types = [
  { id: 'tt-1', location_id: VENUE, label: 'Regular', icon: 'star', icon_kind: 'lucide', sort_order: 0, created_by: ME, created_at: daysAgo(30) },
  { id: 'tt-2', location_id: VENUE, label: 'Staff', icon: 'shield', icon_kind: 'lucide', sort_order: 1, created_by: ME, created_at: daysAgo(30) },
  { id: 'tt-3', location_id: VENUE, label: 'Musician', icon: '🎷', icon_kind: 'emoji', sort_order: 2, created_by: ME, created_at: daysAgo(12) },
];
const TT = Object.fromEntries(verification_tag_types.map((t) => [t.id, t]));
export const verification_tags = [
  { id: 'vt-1', user_id: 'u-2', location_id: VENUE, tag: 'Regular', icon: 'star', type_id: 'tt-1', assigned_by: ME, assigned_at: daysAgo(5) },
  { id: 'vt-2', user_id: 'u-5', location_id: VENUE, tag: 'Musician', icon: '🎷', type_id: 'tt-3', assigned_by: ME, assigned_at: daysAgo(2) },
  { id: 'vt-3', user_id: 'u-6', location_id: VENUE, tag: 'Staff', icon: 'shield', type_id: 'tt-2', assigned_by: ME, assigned_at: daysAgo(20) },
].map((t) => ({ ...t, verification_tag_types: TT[t.type_id], profiles: P[t.user_id] }));

export const location_managers = [
  { id: 'lm-1', location_id: VENUE, user_id: 'u-6', added_by: ME, added_at: daysAgo(20), profiles: P['u-6'], locations: L[VENUE] },
];

export const conversations = [
  { id: 'cv-venue', is_group: true, name: 'Velvet Room', location_id: VENUE, created_at: daysAgo(30) },
  { id: 'cv-2', is_group: false, name: null, location_id: null, created_at: daysAgo(1) },
  { id: 'cv-3', is_group: false, name: null, location_id: null, created_at: daysAgo(3) },
  { id: 'cv-4', is_group: true, name: 'Climate founders', location_id: null, created_at: daysAgo(4) },
];
const CV = Object.fromEntries(conversations.map((c) => [c.id, c]));
const part = (conversation_id, user_id, status = 'accepted', role = 'member') => ({
  conversation_id, user_id, status, role, conversations: CV[conversation_id], profiles: P[user_id],
});
export const conversation_participants = [
  part('cv-venue', ME, 'accepted', 'admin'), part('cv-venue', 'u-2'), part('cv-venue', 'u-3'), part('cv-venue', 'u-6', 'accepted', 'admin'),
  part('cv-2', ME), part('cv-2', 'u-2'),
  part('cv-3', ME, 'pending'), part('cv-3', 'u-5'),
  part('cv-4', ME), part('cv-4', 'u-3'), part('cv-4', 'u-6'),
];
const msg = (id, conversation_id, sender_id, content, h) => ({ id, conversation_id, sender_id, content, created_at: hoursAgo(h), profiles: P[sender_id] });
export const messages = [
  msg('m-1', 'cv-venue', 'u-6', 'Happy hour extended to 9pm tonight 🍸', 0.2),
  msg('m-2', 'cv-2', 'u-2', 'Great meeting you! Same time next week?', 0.5),
  msg('m-3', 'cv-3', 'u-5', 'Hey, saw you at Rooftop 88 — fancy a chat?', 26),
  msg('m-4', 'cv-4', 'u-3', 'Deck is in the shared folder', 50),
];

export const join_requests = [
  { id: 'jr-1', conversation_id: 'cv-venue', user_id: 'u-4', status: 'pending', attempt_count: 1, created_at: hoursAgo(0.3), profiles: P['u-4'] },
  { id: 'jr-2', conversation_id: 'cv-venue', user_id: 'u-7', status: 'pending', attempt_count: 1, created_at: hoursAgo(0.6), profiles: P['u-7'] },
];

export const rewards = [
  { id: 'r-1', location_id: VENUE, name: 'Welcome drink', icon_type: 'drink', deal_text: 'Free house cocktail', instructions: 'Show this at the bar', is_active: true, display_order: 0, min_checkins: null },
  { id: 'r-2', location_id: VENUE, name: 'Regular', icon_type: 'star', deal_text: '10% off all night', instructions: 'Unlocks at 5 visits', is_active: true, display_order: 1, min_checkins: 5 },
  { id: 'r-3', location_id: VENUE, name: 'VIP', icon_type: 'crown', deal_text: 'Skip the queue + reserved booth', instructions: 'Unlocks at 15 visits', is_active: true, display_order: 2, min_checkins: 15 },
];

export const venue_zones = [
  { id: 'z-1', location_id: VENUE, name: 'Main Bar', center_lat: 51.51362, center_lng: -0.13195, created_by: ME, created_at: daysAgo(10) },
  { id: 'z-2', location_id: VENUE, name: 'Piano Lounge', center_lat: 51.51355, center_lng: -0.13180, created_by: ME, created_at: daysAgo(10) },
  { id: 'z-3', location_id: VENUE, name: 'Courtyard', center_lat: 51.51370, center_lng: -0.13170, created_by: ME, created_at: daysAgo(8) },
];

export const activity_menu_items = ['Dancing', 'Live music', 'Networking', 'Cocktails', 'Meeting friends'].map((label, i) => ({
  id: `am-${i}`, location_id: VENUE, label, sort_order: i, created_by: ME, created_at: daysAgo(9),
}));
export const attendee_activity_picks = [
  { user_id: ME, location_id: VENUE, item_id: 'am-1', picked_at: hoursAgo(0.4) },
  { user_id: ME, location_id: VENUE, item_id: 'am-3', picked_at: hoursAgo(0.4) },
];

export const badges = [
  { id: 'bd-1', key: 'first_checkin', name: 'First Check-in', description: 'Checked in for the first time', icon: '📍', criteria_kind: 'checkins', criteria_threshold: 1, sort_order: 0 },
  { id: 'bd-2', key: 'social_butterfly', name: 'Social Butterfly', description: 'Made 5 connections', icon: '🦋', criteria_kind: 'connections', criteria_threshold: 5, sort_order: 1 },
  { id: 'bd-3', key: 'night_owl', name: 'Night Owl', description: 'Checked in after midnight', icon: '🦉', criteria_kind: 'late', criteria_threshold: 1, sort_order: 2 },
  { id: 'bd-4', key: 'explorer', name: 'Explorer', description: 'Visited 10 venues', icon: '🧭', criteria_kind: 'venues', criteria_threshold: 10, sort_order: 3 },
];
export const user_badges = [
  { user_id: ME, badge_id: 'bd-1', earned_at: daysAgo(20) },
  { user_id: ME, badge_id: 'bd-3', earned_at: daysAgo(4) },
];

export const feed_posts = [
  { id: 'fp-1', location_id: 'loc-2', user_id: 'u-3', content: 'Sunset was unreal tonight', zone_tag: null, created_at: hoursAgo(70), profiles: P['u-3'] },
  { id: 'fp-2', location_id: 'loc-2', user_id: 'u-2', content: 'DJ is on fire 🔥', zone_tag: null, created_at: hoursAgo(71), profiles: P['u-2'] },
];

export const location_requests = [
  { id: 'lr-1', requested_by: 'u-5', name: 'Blue Note Bar', address: '3 Hoxton Sq', city: 'London', lat: 51.527, lng: -0.081, status: 'pending', created_at: hoursAgo(5), profiles: P['u-5'] },
  { id: 'lr-2', requested_by: 'u-7', name: 'Kreuzberg Social', address: 'Oranienstr. 12', city: 'Berlin', lat: 52.5, lng: 13.42, status: 'pending', created_at: daysAgo(1), profiles: P['u-7'] },
];

export const contact_methods = [
  { id: 'cm-1', user_id: ME, slot_order: 0, type: 'instagram', value: 'alexmorgan', is_enabled: true },
  { id: 'cm-2', user_id: ME, slot_order: 1, type: 'linkedin', value: 'alex-morgan', is_enabled: true },
  { id: 'cm-3', user_id: ME, slot_order: 2, type: 'whatsapp', value: '+447700900000', is_enabled: false },
];

export const connections = [
  { id: 'cn-1', scanner_id: ME, scannee_id: 'u-2', location_id: VENUE, scanned_at: daysAgo(1), contact_method_type: 'instagram', place_label: 'Velvet Room' },
  { id: 'cn-2', scanner_id: 'u-3', scannee_id: ME, location_id: 'loc-2', scanned_at: daysAgo(3), contact_method_type: 'linkedin', place_label: 'Rooftop 88' },
];

export const tables = {
  profiles, locations, location_checkins, venue_posts, post_likes, friendships, banners,
  verification_tag_types, verification_tags, location_managers, conversations,
  conversation_participants, messages, join_requests, rewards, venue_zones,
  activity_menu_items, attendee_activity_picks, badges, user_badges, feed_posts,
  location_requests, contact_methods, connections,
  attendee_history_opt_outs: [], user_feature_access: [{ user_id: ME, feature_name: 'rewards' }],
  peek_invites: [], avatars: [],
};

const hours = Array.from({ length: 8 }, (_, i) => ({ hour: `${17 + i}:00`, count: [4, 9, 18, 31, 44, 38, 22, 11][i] }));
export const rpc = {
  fetch_zone_analytics: {
    occupancy: [{ zone_name: 'Main Bar', count: 23 }, { zone_name: 'Piano Lounge', count: 14 }, { zone_name: 'Courtyard', count: 7 }],
    avgDwellMinutes: [{ zone_name: 'Main Bar', minutes: 41 }, { zone_name: 'Piano Lounge', minutes: 58 }, { zone_name: 'Courtyard', minutes: 19 }],
    transitions: [{ from_zone: 'Main Bar', to_zone: 'Piano Lounge', count: 12, unique_people: 9 }],
  },
  fetch_cross_venue_movement: [
    { location_id: 'loc-2', venue_name: 'Rooftop 88', attendee_count: 18, percentage: 32 },
    { location_id: 'loc-3', venue_name: 'Founders Friday', attendee_count: 7, percentage: 12 },
  ],
  fetch_message_stats: { group_messages: 214, dm_messages: 530 },
  fetch_my_connections: [
    { other_user_id: 'u-2', display_name: 'Sofia Reyes', avatar_url: P['u-2'].avatar_url, place_label: 'Velvet Room', scanned_at: daysAgo(1) },
    { other_user_id: 'u-3', display_name: 'James Okafor', avatar_url: P['u-3'].avatar_url, place_label: 'Rooftop 88', scanned_at: daysAgo(3) },
  ],
  fetch_friends_activity: [
    { user_id: 'u-2', name: 'Sofia Reyes', avatar_url: P['u-2'].avatar_url, location_id: VENUE, venue_name: 'Velvet Room', checked_in_at: hoursAgo(0.8), is_active: true },
    { user_id: 'u-6', name: 'Priya Shah', avatar_url: P['u-6'].avatar_url, location_id: 'loc-2', venue_name: 'Rooftop 88', checked_in_at: hoursAgo(20), is_active: false },
  ],
  mint_connect_token: 'mock-connect-token-123',
  hourly: hours,
};
