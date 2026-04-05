import { assert } from '../../core/utils/assert.js';

export function calculateDailyMacros({ weight, goal } = {}) {
  const safeWeight = Number(weight);
  assert(safeWeight > 0, 'WEIGHT_REQUIRED', 'weight is required');

  const normalizedGoal = String(goal || '').toLowerCase();
  const proteinFactor = normalizedGoal === 'ganhar_massa' ? 2.1 : normalizedGoal === 'emagrecer' ? 2 : 2;
  const fatFactor = normalizedGoal === 'emagrecer' ? 0.75 : 0.8;
  const carbsFactor = normalizedGoal === 'ganhar_massa' ? 3.2 : 3;

  const protein = Math.round(safeWeight * proteinFactor);
  const fat = Math.round(safeWeight * fatFactor);
  const carbs = Math.round(safeWeight * carbsFactor);

  return { protein, fat, carbs };
}
