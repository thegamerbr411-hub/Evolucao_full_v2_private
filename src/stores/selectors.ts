import { useAppStore } from './useAppStore';
import { useCoachStore } from './useCoachStore';
import { useNutritionStore } from './useNutritionStore';
import { useUserStore } from './useUserStore';
import { useWorkoutStore } from './useWorkoutStore';

export const selectUser = (state: ReturnType<typeof useUserStore.getState>) => state.user;
export const selectProfile = (state: ReturnType<typeof useUserStore.getState>) => state.profile;
export const selectIsHydrated = (state: ReturnType<typeof useUserStore.getState>) => state.isHydrated;

export const selectWorkout = (state: ReturnType<typeof useWorkoutStore.getState>) => state.workout;
export const selectWorkoutLogs = (state: ReturnType<typeof useWorkoutStore.getState>) => state.workoutLogs;

export const selectNutritionPlan = (state: ReturnType<typeof useNutritionStore.getState>) => state.plan;
export const selectHydration = (state: ReturnType<typeof useNutritionStore.getState>) => state.hydration;

export const selectAppFlags = (state: ReturnType<typeof useAppStore.getState>) => ({
  isLoading: state.isLoading,
  isOnline: state.isOnline,
  isSyncing: state.isSyncing,
  hasCompletedQuestionnaire: state.hasCompletedQuestionnaire,
});

export const selectCoachState = (state: ReturnType<typeof useCoachStore.getState>) => ({
  message: state.message,
  suggestions: state.suggestions,
  missions: state.missions,
});
