// Zustand Stores - Core State Management
// Each store is independent and can be used with selectors for optimal performance

export { useUserStore } from './useUserStore';
export type { User, Profile } from './useUserStore';

export { useWorkoutStore } from './useWorkoutStore';
export type { WorkoutLog, ExerciseTarget, WorkoutData } from './useWorkoutStore';

export { useNutritionStore } from './useNutritionStore';
export type { NutritionLog, HistoryEntry, Plan } from './useNutritionStore';

export { useAppStore } from './useAppStore';
export type { Monetization } from './useAppStore';

export { useCoachStore } from './useCoachStore';
export type { CoachSuggestion, Mission } from './useCoachStore';

export { useGamificationStore } from './useGamificationStore';
export type { GamificationData } from './useGamificationStore';

export { useAuthStore } from './useAuthStore';
export type { AuthState } from './useAuthStore';

export { useMonetizationStore } from './useMonetizationStore';
export type { MonetizationState } from './useMonetizationStore';

export { useChallengesStore } from './useChallengesStore';
export type { ChallengeState } from './useChallengesStore';

// Usage Example:
// import { useUserStore, useWorkoutStore } from '@/stores';
// 
// function MyComponent() {
//   const user = useUserStore((state) => state.user);
//   const todayWorkout = useWorkoutStore((state) => state.workout);
//   return <div>{user?.id} - {todayWorkout?.exercises?.length} exercises</div>;
// }
