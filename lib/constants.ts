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
      { id: 1, emoji: '❤️', label: 'Open' },
      { id: 2, emoji: '🙅', label: 'Not interested' },
      { id: 3, emoji: '🔒', label: 'Taken' },
    ],
  },
};

// Default Location Settings
export const DEFAULT_LOCATION = {
  lat: 40.7128,
  lng: -74.0060,
  zoom: 13,
};

// Local Storage Keys
export const STORAGE_KEYS = {
  TOKEN: 'w_app_token',
  USER_ID: 'w_app_user_id',
  LOCATION_ID: 'w_app_location_id',
  LOCATION_NAME: 'w_app_location_name',
  SETUP_COMPLETE: 'w_app_setup_complete',
  LAST_DATE: 'w_app_last_date',
  LAST_LOCATION_ALERT: 'w_app_last_location_alert',
  LAST_LOCATION_NOTIFICATION: 'w_app_last_location_notification',
  ORGANIZER_WELCOME_SEEN: 'w_app_organizer_welcome_seen',
};
