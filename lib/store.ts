import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  gender: string;
  birth: string;
  image?: string;
  height?: string;
  relationship?: string;
  datingId?: string;
  socialisingId?: string;
  networkingId?: string;
  nationality?: string;
  city?: string;
  drink?: string;
  activity?: string;
  profession?: string;
  setupComplete?: boolean;
}

interface Location {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  radius: number;
  count: number;
  category?: string;
  isHot?: boolean;
}

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  date: string;
  type: 'send' | 'receive';
}

interface AppState {
  // User State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  
  // Location State
  currentLocation: { lat: number; lng: number } | null;
  selectedLocation: Location | null;
  nearbyLocations: Location[];
  inLocation: boolean;
  
  // Messages State
  messages: Message[];
  unreadCount: number;
  activeChat: string | null;
  
  // UI State
  activeTab: string;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
  setCurrentLocation: (location: { lat: number; lng: number } | null) => void;
  setSelectedLocation: (location: Location | null) => void;
  setNearbyLocations: (locations: Location[]) => void;
  setInLocation: (inLocation: boolean) => void;
  addMessage: (message: Message) => void;
  setActiveChat: (chatId: string | null) => void;
  setActiveTab: (tab: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial State
      user: null,
      token: null,
      isAuthenticated: false,
      currentLocation: null,
      selectedLocation: null,
      nearbyLocations: [],
      inLocation: false,
      messages: [],
      unreadCount: 0,
      activeChat: null,
      activeTab: 'feed',
      isLoading: false,
      error: null,
      
      // Actions
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      
      setToken: (token) => set({ token, isAuthenticated: !!token }),
      
      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false,
        selectedLocation: null,
        inLocation: false,
        messages: [],
        activeChat: null,
      }),
      
      setCurrentLocation: (location) => set({ currentLocation: location }),
      
      setSelectedLocation: (location) => set({ selectedLocation: location }),
      
      setNearbyLocations: (locations) => set({ nearbyLocations: locations }),
      
      setInLocation: (inLocation) => set({ inLocation }),
      
      addMessage: (message) => set((state) => ({
        messages: [...state.messages, message],
      })),
      
      setActiveChat: (chatId) => set({ activeChat: chatId }),
      
      setActiveTab: (tab) => set({ activeTab: tab }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),
    }),
    {
      name: 'w-app-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
