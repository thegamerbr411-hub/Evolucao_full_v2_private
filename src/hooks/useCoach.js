import { useMemo } from 'react';
import { useApp } from '../context/AppContext';

export function useCoach() {
  const app = useApp();

  return useMemo(
    () => ({
      buildDailyCoachState: app.buildDailyCoachState,
      buildCoachMessage: app.buildCoachMessage,
      getAutoCoachSuggestions: app.getAutoCoachSuggestions,
      applyMacroOverride: app.applyMacroOverride,
      getDailyMissions: app.getDailyMissions,
      completeMission: app.completeMission,
      getPerformanceScore: app.getPerformanceScore,
      getNutritionFeedback: app.getNutritionFeedback,
      getSmartWorkoutRecommendation: app.getSmartWorkoutRecommendation,
      addWaterIntake: app.addWaterIntake,
      history: app.history,
      nutritionLogs: app.nutritionLogs,
      workoutLogs: app.workoutLogs,
    }),
    [app]
  );
}
