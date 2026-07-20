// API Configuration
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://app.wingme.app/v03/';
export const APP_URL = 'https://wingme.app/';
export const DELETE_ACCOUNT_URL = 'https://app.wingme.app/delete_account';

// Google Maps Configuration
export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

// Firebase Configuration (for future use)
export const FIREBASE_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Looking For Options
export const LOOKING_FOR_OPTIONS = {
  socializing: {
    title: 'Socializing',
    options: [
      { id: 0, emoji: '🚫', label: 'None' },
      { id: 1, emoji: '🌎', label: 'Community' },
      { id: 2, emoji: '👩🏻‍🤝‍👩🏾', label: 'Close friends' },
      { id: 3, emoji: '✈️', label: 'Travel' },
    ],
  },
  business: {
    title: 'Business',
    options: [
      { id: 0, emoji: '🚫', label: 'None' },
      { id: 1, emoji: '🤝', label: 'Opportunities' },
      { id: 2, emoji: '👩🏻‍🏫', label: 'Mentorship' },
      { id: 3, emoji: '🧠', label: 'Personal Growth' },
    ],
  },
  love: {
    title: 'Love',
    options: [
      { id: 0, emoji: '🚫', label: 'None' },
      { id: 1, emoji: '❤️', label: 'Open to love' },
      { id: 2, emoji: '🔓', label: 'Taken' },
      { id: 3, emoji: '🪩', label: 'Fun' },
    ],
  },
};

// Relationship Status Options
export const RELATIONSHIP_OPTIONS = [
  { id: '1', label: 'Single' },
  { id: '2', label: 'Dating' },
  { id: '3', label: 'In a Relationship' },
  { id: '4', label: 'Married' },
  { id: '5', label: 'Other' },
];

// Navigation Items
export const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'map', label: 'Map', icon: 'map' },
  { id: 'location', label: 'My Location', icon: 'pin' },
  { id: 'messages', label: 'Messages', icon: 'message' },
  { id: 'profile', label: 'Profile', icon: 'user' },
];

// Default Location Settings
export const DEFAULT_LOCATION = {
  lat: 40.7128,
  lng: -74.0060,
  zoom: 13,
};

// Local Storage Keys
export const STORAGE_KEYS = {
  TOKEN: 'wing_me_token',
  USER_ID: 'wing_me_user_id',
  LOCATION_ID: 'wing_me_location_id',
  LOCATION_NAME: 'wing_me_location_name',
  SETUP_COMPLETE: 'wing_me_setup_complete',
  LAST_DATE: 'wing_me_last_date',
  LAST_LOCATION_ALERT: 'wing_me_last_location_alert',
  LAST_LOCATION_NOTIFICATION: 'wing_me_last_location_notification',
};
