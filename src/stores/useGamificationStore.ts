import { create } from 'zustand';
import { getLocal, setLocal } from '../storage/mmkv';

const GAMIFICATION_STORE_KEY = 'gamification.store.v1';

export type GamificationData = {
  xp: number;
  streakDays: number;
  lastWorkoutDate?: string;
  lastWorkoutXpDate?: string;
  completedMissions?: Record<string, string[]>;
};

type GamificationStore = {
  gamification: GamificationData;

  setGamification: (data: GamificationData) => void;
  updateGamification: (partial: Partial<GamificationData>) => void;
  addXp: (amount: number) => void;
  updateStreak: (days: number) => void;
  addMissionCompletion: (missionId: string, date: string) => void;
};

const persistGamification = (data: GamificationData) => {
  setLocal(GAMIFICATION_STORE_KEY, data);
};

const initialGamification: GamificationData = getLocal(GAMIFICATION_STORE_KEY) || { xp: 0, streakDays: 0 };

export const useGamificationStore = create<GamificationStore>((set) => ({
  gamification: initialGamification,

  setGamification: (data) => {
    persistGamification(data);
    set({ gamification: data });
  },
  updateGamification: (partial) =>
    set((state) => {
      const gamification = { ...state.gamification, ...partial };
      persistGamification(gamification);
      return { gamification };
    }),
  addXp: (amount) =>
    set((state) => {
      const gamification = { ...state.gamification, xp: state.gamification.xp + amount };
      persistGamification(gamification);
      return { gamification };
    }),
  updateStreak: (days) =>
    set((state) => {
      const gamification = { ...state.gamification, streakDays: days };
      persistGamification(gamification);
      return { gamification };
    }),
  addMissionCompletion: (missionId, date) =>
    set((state) => {
      const current = state.gamification.completedMissions || {};
      const dayMissions = current[date] || [];
      if (dayMissions.includes(missionId)) {
        return state;
      }

      const gamification = {
        ...state.gamification,
        completedMissions: {
          ...current,
          [date]: [...dayMissions, missionId],
        },
      };
      persistGamification(gamification);
      return { gamification };
    }),
}));
