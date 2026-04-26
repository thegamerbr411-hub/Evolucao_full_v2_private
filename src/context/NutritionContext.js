import React, { createContext, useMemo, useState } from 'react';

// Função provisória para feedback de nutrição
function getNutritionFeedback() {
  return {
    status: 'ok',
    message: 'fallback ativo',
  };
}
// Função provisória para targets de macros
function getDailyMacroTargets() {
  return {
    calories: 2000,
    protein: 150,
    carbs: 200,
    fat: 70,
  };
}

const defaultValue = {
  water: 0,
  addWaterIntake: () => ({ ok: false }),
};

export const NutritionContext = createContext(defaultValue);

export const NutritionProvider = ({ children }) => {
  const [water, setWater] = useState(0);

  const addWaterIntake = (amount = 0) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value < 0) {
      return { ok: false, error: 'invalid_amount' };
    }
    setWater((prev) => prev + value);
    return { ok: true };
  };

  const value = useMemo(
    () => ({ water, addWaterIntake, getDailyMacroTargets, getNutritionFeedback }),
    [water]
  );

  return (
    <NutritionContext.Provider value={value}>
      {children}
    </NutritionContext.Provider>
  );
};
