import { create } from 'zustand';
import { getLocal, setLocal } from '../storage/mmkv';

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

export type HydrationState = {
  dayKey: string;
  waterGoalMl: number;
  consumedMl: number;
  weightKg: number;
  trainedToday: boolean;
  trainingHours: number;
  updatedAt: string;
};

type HydrationInput = {
  weightKg: number;
  trainedToday?: boolean;
  trainingHours?: number;
};

type NutritionStore = {
  nutritionLogs: NutritionLog[];
  history: HistoryEntry[];
  plan: Plan | null;
  hydration: HydrationState | null;

  addNutritionLog: (log: NutritionLog) => void;
  removeNutritionLog: (id: string) => void;
  setNutritionLogs: (logs: NutritionLog[]) => void;
  addHistoryEntry: (entry: HistoryEntry) => void;
  updateHistoryEntry: (date: string, partial: Partial<HistoryEntry>) => void;
  setHistory: (history: HistoryEntry[]) => void;
  setPlan: (plan: Plan) => void;
  updatePlan: (partial: Partial<Plan>) => void;
  hydrateHydrationState: () => void;
  refreshHydrationForToday: (input: HydrationInput) => HydrationState;
  addHydrationIntake: (amountMl: number) => void;
  setHydrationConsumed: (consumedMl: number) => void;
};

const NUTRITION_STATE_KEY = 'nutrition.store.v2';

const getTodayKey = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));

const calculateHydrationGoalMl = ({
  weightKg,
  trainedToday = false,
  trainingHours = 0,
}: HydrationInput): number => {
  const safeWeight = clamp(Number(weightKg || 0), 0, 400);
  const safeHours = clamp(Number(trainingHours || 0), 0, 8);
  let waterGoal = safeWeight * 35;

  if (trainedToday) {
    waterGoal += safeHours * 700;
  }

  return Math.round(clamp(waterGoal, 1200, 9000));
};

const persistNutritionState = (state: Pick<NutritionStore, 'nutritionLogs' | 'history' | 'plan' | 'hydration'>) => {
  setLocal(NUTRITION_STATE_KEY, {
    nutritionLogs: state.nutritionLogs,
    history: state.history,
    plan: state.plan,
    hydration: state.hydration,
  });
};

const initialPersistedState = getLocal(NUTRITION_STATE_KEY) || {};

export const useNutritionStore = create<NutritionStore>((set) => ({
  nutritionLogs: Array.isArray(initialPersistedState.nutritionLogs) ? initialPersistedState.nutritionLogs : [],
  history: Array.isArray(initialPersistedState.history) ? initialPersistedState.history : [],
  plan: initialPersistedState.plan || null,
  hydration: initialPersistedState.hydration || null,

  addNutritionLog: (log) =>
    set((state) => {
      const next = {
        ...state,
        nutritionLogs: [log, ...state.nutritionLogs],
      };
      persistNutritionState(next);
      return next;
    }),
  removeNutritionLog: (id) =>
    set((state) => {
      const next = {
        ...state,
        nutritionLogs: state.nutritionLogs.filter((log) => log.id !== id),
      };
      persistNutritionState(next);
      return next;
    }),
  setNutritionLogs: (logs) =>
    set((state) => {
      const next = { ...state, nutritionLogs: logs };
      persistNutritionState(next);
      return next;
    }),
  addHistoryEntry: (entry) =>
    set((state) => {
      const withoutToday = state.history.filter((item) => item.date !== entry.date);
      const next = {
        ...state,
        history: [entry, ...withoutToday].slice(0, 30),
      };
      persistNutritionState(next);
      return next;
    }),
  updateHistoryEntry: (date, partial) =>
    set((state) => {
      const existing = state.history.find((item) => item.date === date);
      if (!existing) {
        const next = {
          ...state,
          history: [{ ...partial, date } as HistoryEntry, ...state.history].slice(0, 30),
        };
        persistNutritionState(next);
        return next;
      }

      const next = {
        ...state,
        history: state.history.map((item) =>
          item.date === date ? { ...item, ...partial } : item
        ),
      };
      persistNutritionState(next);
      return next;
    }),
  setHistory: (history) =>
    set((state) => {
      const next = { ...state, history };
      persistNutritionState(next);
      return next;
    }),
  setPlan: (plan) =>
    set((state) => {
      const next = { ...state, plan };
      persistNutritionState(next);
      return next;
    }),
  updatePlan: (partial) =>
    set((state) => {
      const next = {
        ...state,
        plan: state.plan ? { ...state.plan, ...partial } : null,
      };
      persistNutritionState(next);
      return next;
    }),
  hydrateHydrationState: () =>
    set((state) => {
      const persisted = getLocal(NUTRITION_STATE_KEY) || {};
      if (!persisted.hydration) {
        return state;
      }
      return { ...state, hydration: persisted.hydration };
    }),
  refreshHydrationForToday: (input) => {
    const today = getTodayKey();
    const goalMl = calculateHydrationGoalMl(input);

    let computed: HydrationState = {
      dayKey: today,
      waterGoalMl: goalMl,
      consumedMl: 0,
      weightKg: Number(input.weightKg || 0),
      trainedToday: Boolean(input.trainedToday),
      trainingHours: Number(input.trainingHours || 0),
      updatedAt: new Date().toISOString(),
    };

    set((state) => {
      const previous = state.hydration;
      const consumedMl = previous?.dayKey === today ? Number(previous.consumedMl || 0) : 0;
      computed = {
        ...computed,
        consumedMl,
      };

      const nextPlan = state.plan
        ? {
            ...state.plan,
            waterLitersPerDay: Number((computed.waterGoalMl / 1000).toFixed(2)),
          }
        : state.plan;

      const next = {
        ...state,
        hydration: computed,
        plan: nextPlan,
      };
      persistNutritionState(next);
      return next;
    });

    return computed;
  },
  addHydrationIntake: (amountMl) =>
    set((state) => {
      if (!state.hydration) {
        return state;
      }

      const nextHydration: HydrationState = {
        ...state.hydration,
        consumedMl: clamp(Math.round((state.hydration.consumedMl || 0) + Number(amountMl || 0)), 0, 15000),
        updatedAt: new Date().toISOString(),
      };

      const next = {
        ...state,
        hydration: nextHydration,
      };
      persistNutritionState(next);
      return next;
    }),
  setHydrationConsumed: (consumedMl) =>
    set((state) => {
      if (!state.hydration) {
        return state;
      }
      const next = {
        ...state,
        hydration: {
          ...state.hydration,
          consumedMl: clamp(Math.round(Number(consumedMl || 0)), 0, 15000),
          updatedAt: new Date().toISOString(),
        },
      };
      persistNutritionState(next);
      return next;
    }),
}));
