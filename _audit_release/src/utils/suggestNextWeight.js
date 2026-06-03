import { WORKOUT_SET_LIMITS, parseWorkoutNumeric } from '../services/workoutInputValidation.js';

export function suggestNextWeight(lastWeight) {
  const parsed = parseWorkoutNumeric(lastWeight);
  if (!Number.isFinite(parsed) || parsed < WORKOUT_SET_LIMITS.weightMin || parsed > WORKOUT_SET_LIMITS.weightMax) {
    return 10;
  }
  return Math.round((parsed + Math.max(2.5, parsed * 0.05)) * 2) / 2;
}
