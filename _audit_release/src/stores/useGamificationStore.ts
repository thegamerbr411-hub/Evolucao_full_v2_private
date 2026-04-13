import { create } from 'zustand';

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

export const useGamificationStore = create<GamificationStore>((set) => ({
  gamification: {
    xp: 0,
    streakDays: 0,
  },

  setGamification: (data) => set({ gamification: data }),
  updateGamification: (partial) =>
    set((state) => ({
      gamification: { ...state.gamification, ...partial },
    })),
  addXp: (amount) =>
    set((state) => ({
      gamification: {
        ...state.gamification,
        xp: state.gamification.xp + amount,
      },
    })),
  updateStreak: (days) =>
    set((state) => ({
      gamification: {
        ...state.gamification,
        streakDays: days,
      },
    })),
  addMissionCompletion: (missionId, date) =>
    set((state) => {
      const current = state.gamification.completedMissions || {};
      const dayMissions = current[date] || [];
      if (dayMissions.includes(missionId)) {
        return state;
      }

      return {
        gamification: {
          ...state.gamification,
          completedMissions: {
            ...current,
            [date]: [...dayMissions, missionId],
          },
        },
      };
    }),
}));
