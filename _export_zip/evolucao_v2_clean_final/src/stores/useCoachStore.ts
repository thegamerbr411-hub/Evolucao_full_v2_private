import { create } from 'zustand';

export type CoachSuggestion = {
  id: string;
  icon: string;
  title: string;
  reason: string;
  action: string;
  payload?: any;
};

export type Mission = {
  id: string;
  icon: string;
  title: string;
  description: string;
  xpReward: number;
  completed: boolean;
  type: string;
};

type CoachStore = {
  message: string | null;
  suggestions: CoachSuggestion[];
  missions: Mission[];
  completedToday: Set<string>;
  loadSuggestion?: {
    weight: number;
    message: string;
  };

  setMessage: (msg: string | null) => void;
  setSuggestions: (suggestions: CoachSuggestion[]) => void;
  setMissions: (missions: Mission[]) => void;
  addCompletedMission: (missionId: string) => void;
  clearCompleted: () => void;
  setLoadSuggestion?: (data: any) => void;
};

export const useCoachStore = create<CoachStore>((set) => ({
  message: null,
  suggestions: [],
  missions: [],
  completedToday: new Set(),

  setMessage: (msg) => set({ message: msg }),
  setSuggestions: (suggestions) => set({ suggestions }),
  setMissions: (missions) => set({ missions }),
  addCompletedMission: (missionId) =>
    set((state) => {
      const next = new Set(state.completedToday);
      next.add(missionId);
      return { completedToday: next };
    }),
  clearCompleted: () => set({ completedToday: new Set() }),
}));
