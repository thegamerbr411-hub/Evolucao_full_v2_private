import { useContext } from 'react';
import { NutritionContext } from '../context/NutritionContext';

export const useNutrition = () => {
  const context = useContext(NutritionContext);
  if (!context || typeof context.addWaterIntake !== 'function') {
    return {
      water: 0,
      addWaterIntake: () => ({ ok: false }),
    };
  }
  return context;
};
