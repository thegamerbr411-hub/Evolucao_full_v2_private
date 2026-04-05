import { useMemo } from 'react';
import { useNutritionDomain } from '../context/AppContext';

export function useInsights() {
  const nutrition = useNutritionDomain();

  return useMemo(
    () => ({
      getTopFoods: nutrition.getTopFoods,
      getPerformanceRecoveryInsight: nutrition.getPerformanceRecoveryInsight,
    }),
    [nutrition]
  );
}
