import { create } from 'zustand';

// Global "view someone's profile" sheet. Any avatar can call openProfile(id);
// <ProfileSheet /> (mounted once in app/layout.tsx) renders it.
interface ProfileSheetState {
  userId: string | null;
  // Optional action for the sheet's Message button, so surfaces that already
  // have a message composer (AttendeeStrip) keep that flow reachable.
  onMessage: (() => void) | null;
  open: (userId: string, opts?: { onMessage?: () => void }) => void;
  close: () => void;
}

export const useProfileSheet = create<ProfileSheetState>((set) => ({
  userId: null,
  onMessage: null,
  open: (userId, opts) => set({ userId, onMessage: opts?.onMessage ?? null }),
  close: () => set({ userId: null, onMessage: null }),
}));

export const openProfile = (userId: string, opts?: { onMessage?: () => void }) =>
  useProfileSheet.getState().open(userId, opts);
