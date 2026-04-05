import { useMemo } from 'react';
import { useApp } from '../context/AppContext';

export function useInsights() {
  const app = useApp();

  return useMemo(
    () => ({
      getTopFoods: app.getTopFoods,
      getPerformanceRecoveryInsight: app.getPerformanceRecoveryInsight,
    }),
    [app]
  );
}
