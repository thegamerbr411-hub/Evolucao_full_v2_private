import { useMemo } from 'react';
import { useApp } from '../context/AppContext';

export function useWorkout() {
  const app = useApp();

  return useMemo(
    () => ({
      getTodayWorkout: app.getTodayWorkout,
      getSmartWorkoutRecommendation: app.getSmartWorkoutRecommendation,
      getRecommendedWorkoutV4: app.getRecommendedWorkoutV4,
      prepareTodayWorkoutTargets: app.prepareTodayWorkoutTargets,
      saveWorkoutSet: app.saveWorkoutSet,
      saveFreeWorkoutSet: app.saveFreeWorkoutSet,
      removeTodayWorkoutSet: app.removeTodayWorkoutSet,
      getExerciseProgress: app.getExerciseProgress,
      getExerciseSetProgress: app.getExerciseSetProgress,
      getExerciseProgressionSuggestion: app.getExerciseProgressionSuggestion,
      getExerciseCatalog: app.getExerciseCatalog,
      getExercisesByMuscleGroup: app.getExercisesByMuscleGroup,
      getFreeWorkoutSuggestions: app.getFreeWorkoutSuggestions,
      getWorkoutGamification: app.getWorkoutGamification,
      getExerciseHistorySnapshot: app.getExerciseHistorySnapshot,
      getTodayWorkoutSummary: app.getTodayWorkoutSummary,
      getWorkoutDelta: app.getWorkoutDelta,
      workoutLogs: app.workoutLogs,
      gamification: app.gamification,
      exerciseTargets: app.exerciseTargets,
    }),
    [app]
  );
}
