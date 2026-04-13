import { create } from 'zustand';

export type Monetization = {
  isProActive: boolean;
  isPro: boolean;
  proExpiry?: number;
};

type AppStore = {
  isLoading: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  monetization: Monetization;
  hasCompletedQuestionnaire: boolean;
  userRoutines: any[];

  setLoading: (value: boolean) => void;
  setOnline: (value: boolean) => void;
  setSyncing: (value: boolean) => void;
  setMonetization: (data: Monetization) => void;
  setHasCompletedQuestionnaire: (value: boolean) => void;
  setUserRoutines: (routines: any[]) => void;
  updateUserRoutines: (updater: (routines: any[]) => any[]) => void;
};

export const useAppStore = create<AppStore>((set) => ({
  isLoading: false,
  isOnline: true,
  isSyncing: false,
  monetization: {
    isProActive: false,
    isPro: false,
  },
  hasCompletedQuestionnaire: false,
  userRoutines: [],

  setLoading: (value) => set({ isLoading: value }),
  setOnline: (value) => set({ isOnline: value }),
  setSyncing: (value) => set({ isSyncing: value }),
  setMonetization: (data) => set({ monetization: data }),
  setHasCompletedQuestionnaire: (value) => set({ hasCompletedQuestionnaire: value }),
  setUserRoutines: (routines) => set({ userRoutines: routines }),
  updateUserRoutines: (updater) =>
    set((state) => ({
      userRoutines: updater(state.userRoutines),
    })),
}));
