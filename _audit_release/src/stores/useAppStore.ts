import { create } from 'zustand';
import { getLocal, setLocal } from '../storage/mmkv';
import * as SecureStore from 'expo-secure-store';

const APP_STORE_KEY = 'app.store.v1';
const APP_STORE_SECURE_KEY = 'app.store.secure.v1';

export type Monetization = {
  isProActive: boolean;
  isPro: boolean;
  proExpiry?: number;
};

type AppStore = {
  isLoading: boolean;
  isHydrated: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  monetization: Monetization;
  hasCompletedQuestionnaire: boolean;
  userRoutines: any[];

  setLoading: (value: boolean) => void;
  setHydrated: (value: boolean) => void;
  setOnline: (value: boolean) => void;
  setSyncing: (value: boolean) => void;
  setMonetization: (data: Monetization) => void;
  setHasCompletedQuestionnaire: (value: boolean) => void;
  setUserRoutines: (routines: any[]) => void;
  updateUserRoutines: (updater: (routines: any[]) => any[]) => void;
  hydrateAppStore: () => Promise<void>;
};

const persistAppState = (state: Pick<AppStore, 'hasCompletedQuestionnaire' | 'userRoutines'>) => {
  const payload = {
    hasCompletedQuestionnaire: Boolean(state.hasCompletedQuestionnaire),
    userRoutines: Array.isArray(state.userRoutines) ? state.userRoutines : [],
  };

  setLocal(APP_STORE_KEY, payload);
  SecureStore.setItemAsync(APP_STORE_SECURE_KEY, JSON.stringify(payload)).catch(() => {
    // best effort: MMKV já cobre caminho principal
  });
};

const initialPersistedState = getLocal(APP_STORE_KEY) || {};

export const useAppStore = create<AppStore>((set) => ({
  isLoading: false,
  isHydrated: false,
  isOnline: true,
  isSyncing: false,
  monetization: {
    isProActive: false,
    isPro: false,
  },
  hasCompletedQuestionnaire: Boolean(initialPersistedState.hasCompletedQuestionnaire),
  userRoutines: Array.isArray(initialPersistedState.userRoutines) ? initialPersistedState.userRoutines : [],

  setLoading: (value) => set({ isLoading: value }),
  setHydrated: (value) => set({ isHydrated: value }),
  setOnline: (value) => set({ isOnline: value }),
  setSyncing: (value) => set({ isSyncing: value }),
  setMonetization: (data) => set({ monetization: data }),
  setHasCompletedQuestionnaire: (value) =>
    set((state) => {
      const next = { hasCompletedQuestionnaire: value };
      persistAppState({ ...state, ...next });
      return next;
    }),
  setUserRoutines: (routines) =>
    set((state) => {
      const safeRoutines = Array.isArray(routines) ? routines : [];
      const next = { userRoutines: safeRoutines };
      persistAppState({ ...state, ...next });
      return next;
    }),
  updateUserRoutines: (updater) =>
    set((state) => {
      const current = Array.isArray(state.userRoutines) ? state.userRoutines : [];
      const updated = updater(current);
      const next = {
        userRoutines: Array.isArray(updated) ? updated : current,
      };
      persistAppState({ ...state, ...next });
      return next;
    }),
  hydrateAppStore: async () => {
    try {
      const secureRaw = await SecureStore.getItemAsync(APP_STORE_SECURE_KEY);
      if (secureRaw) {
        const parsed = JSON.parse(secureRaw);
        const next = {
          hasCompletedQuestionnaire: Boolean(parsed?.hasCompletedQuestionnaire),
          userRoutines: Array.isArray(parsed?.userRoutines) ? parsed.userRoutines : [],
        };
        setLocal(APP_STORE_KEY, next);
        set({ ...next, isHydrated: true });
        return;
      }
    } catch {
      // fallback abaixo
    }

    set({ isHydrated: true });
  },
}));
