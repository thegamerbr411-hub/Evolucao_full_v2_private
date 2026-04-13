import { create } from 'zustand';

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

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  profile: null,
  isHydrated: false,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  updateProfile: (partial) =>
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...partial } : null,
    })),
  logout: () => set({ user: null, profile: null }),
  setHydrated: (value) => set({ isHydrated: value }),
}));
