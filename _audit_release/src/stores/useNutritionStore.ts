import { create } from 'zustand';

export type NutritionLog = {
  id: string;
  date: string;
  loggedAt: string;
  foodId?: string;
  foodKey: string;
  label: string;
  quantity: number;
  quality?: any;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type HistoryEntry = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  trained: boolean;
  status: string;
  insight: string;
  macroInsight: string;
  waterMl: number;
};

export type Plan = {
  caloriesPerDay: number;
  waterLitersPerDay: number;
  trainingSplit: string;
  strategy: string;
  macroOverrides?: Record<string, any>;
  weeklyTrainingAdjustment?: string;
  lastAutoAdjustmentAt?: string;
};

type NutritionStore = {
  nutritionLogs: NutritionLog[];
  history: HistoryEntry[];
  plan: Plan | null;

  addNutritionLog: (log: NutritionLog) => void;
  removeNutritionLog: (id: string) => void;
  setNutritionLogs: (logs: NutritionLog[]) => void;
  addHistoryEntry: (entry: HistoryEntry) => void;
  updateHistoryEntry: (date: string, partial: Partial<HistoryEntry>) => void;
  setHistory: (history: HistoryEntry[]) => void;
  setPlan: (plan: Plan) => void;
  updatePlan: (partial: Partial<Plan>) => void;
};

export const useNutritionStore = create<NutritionStore>((set) => ({
  nutritionLogs: [],
  history: [],
  plan: null,

  addNutritionLog: (log) =>
    set((state) => ({
      nutritionLogs: [log, ...state.nutritionLogs],
    })),
  removeNutritionLog: (id) =>
    set((state) => ({
      nutritionLogs: state.nutritionLogs.filter((log) => log.id !== id),
    })),
  setNutritionLogs: (logs) => set({ nutritionLogs: logs }),
  addHistoryEntry: (entry) =>
    set((state) => {
      const withoutToday = state.history.filter((item) => item.date !== entry.date);
      return {
        history: [entry, ...withoutToday].slice(0, 30),
      };
    }),
  updateHistoryEntry: (date, partial) =>
    set((state) => {
      const existing = state.history.find((item) => item.date === date);
      if (!existing) {
        set((s) => ({
          history: [{ ...partial, date } as HistoryEntry, ...s.history].slice(0, 30),
        }));
        return state;
      }

      return {
        history: state.history.map((item) =>
          item.date === date ? { ...item, ...partial } : item
        ),
      };
    }),
  setHistory: (history) => set({ history }),
  setPlan: (plan) => set({ plan }),
  updatePlan: (partial) =>
    set((state) => ({
      plan: state.plan ? { ...state.plan, ...partial } : null,
    })),
}));
