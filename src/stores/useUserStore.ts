import { create } from 'zustand';
import { getLocal, setLocal } from '../storage/mmkv';

const USER_STORE_KEY = 'user.store.v1';

export type User = {
  id: string | null;
  role: 'user' | 'admin';
};

export type Profile = {
  goal: string;
  level: string;
  currentWeight: number;
  targetWeight: number;
  height: number;
  trainingDaysPerWeek: number;
  timezone?: string;
  energyLevel?: string;
  currentPain?: string;
};

type UserStore = {
  user: User | null;
  profile: Profile | null;
  isHydrated: boolean;

  setUser: (user: User) => void;
  setProfile: (profile: Profile) => void;
  updateProfile: (partial: Partial<Profile>) => void;
  logout: () => void;
  setHydrated: (value: boolean) => void;
};

const persistUserState = (state: Pick<UserStore, 'user' | 'profile'>) => {
  setLocal(USER_STORE_KEY, { user: state.user, profile: state.profile });
};

const initialPersistedState = getLocal(USER_STORE_KEY) || {};

export const useUserStore = create<UserStore>((set) => ({
  user: initialPersistedState.user || null,
  profile: initialPersistedState.profile || null,
  isHydrated: false,

  setUser: (user) =>
    set((state) => {
      persistUserState({ ...state, user });
      return { user };
    }),
  setProfile: (profile) =>
    set((state) => {
      persistUserState({ ...state, profile });
      return { profile };
    }),
  updateProfile: (partial) =>
    set((state) => {
      const profile = state.profile ? { ...state.profile, ...partial } : null;
      persistUserState({ ...state, profile });
      return { profile };
    }),
  logout: () => {
    setLocal(USER_STORE_KEY, { user: null, profile: null });
    set({ user: null, profile: null });
  },
  setHydrated: (value) => set({ isHydrated: value }),
}));
