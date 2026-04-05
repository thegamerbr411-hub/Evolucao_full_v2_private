import { useMemo } from 'react';
import { useApp } from '../context/AppContext';

export function useNutrition() {
  const app = useApp();

  return useMemo(
    () => ({
      estimateNutritionFromText: app.estimateNutritionFromText,
      estimateNutritionFromPhotoHint: app.estimateNutritionFromPhotoHint,
      searchFoodCatalog: app.searchFoodCatalog,
      addFoodLogEntry: app.addFoodLogEntry,
      addFoodLogEntriesBatch: app.addFoodLogEntriesBatch,
      removeFoodLogEntry: app.removeFoodLogEntry,
      getTodayFoodLog: app.getTodayFoodLog,
      getDailyMacroTargets: app.getDailyMacroTargets,
      getWeeklyMacroSummary: app.getWeeklyMacroSummary,
      getNutritionFeedback: app.getNutritionFeedback,
      evaluateMealQuality: app.evaluateMealQuality,
      saveNutritionEntry: app.saveNutritionEntry,
      nutritionLogs: app.nutritionLogs,
      history: app.history,
      plan: app.plan,
    }),
    [app]
  );
}
