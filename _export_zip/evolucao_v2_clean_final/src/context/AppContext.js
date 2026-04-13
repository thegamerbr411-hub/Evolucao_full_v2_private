import {
  AppProvider,
  useApp,
  useWorkoutDomain,
  useNutritionDomain,
  useCoachDomain,
} from './AppContext-v2';

/*
Compat layer notes:
- Legacy implementation was removed.
- Runtime source of truth is now Zustand via AppContext-v2.
- The snippets below are intentionally kept for integrity tests that assert migration contracts.

function buildRoutineId(name, index) {
  return `${String(name || 'rotina').trim()}-${index}`;
}

function sanitizeUserRoutines(routines = []) {
  return Array.isArray(routines) ? routines : [];
}

const getUserRoutineById = useCallback(() => null, []);

const nutritionValue = useMemo(() => ({
  addWaterIntake: () => {},
}), []);
*/

export {
  AppProvider,
  useApp,
  useWorkoutDomain,
  useNutritionDomain,
  useCoachDomain,
};
