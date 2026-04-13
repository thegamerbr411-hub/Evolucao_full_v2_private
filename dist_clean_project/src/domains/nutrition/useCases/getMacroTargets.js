import { calculateDailyMacros } from '../nutritionService.js';
import { DomainError } from '../../../core/errors/DomainError.js';
import { logError } from '../../../core/logger.js';

function round(value) {
  return Math.round(Number(value || 0));
}

export function getMacroTargetsUseCase(input = {}) {
  try {
    const calories = Number(input.calories || 0);
    const weight = Number(input.weight ?? 70);
    const goal = String(input.goal || '');
    const overrides = input.overrides && typeof input.overrides === 'object' ? input.overrides : {};

    const baseMacros = calculateDailyMacros({ weight, goal });
    const proteinTarget = round(baseMacros.protein);
    const fatsTarget = calories > 0 ? round((calories * 0.27) / 9) : round(baseMacros.fat);
    const carbsTarget = calories > 0
      ? round(Math.max(0, (calories - proteinTarget * 4 - fatsTarget * 9) / 4))
      : round(baseMacros.carbs);

    return {
      protein: overrides.protein != null ? Number(overrides.protein) : proteinTarget,
      carbs: overrides.carbs != null ? Number(overrides.carbs) : carbsTarget,
      fats: overrides.fats != null ? Number(overrides.fats) : fatsTarget,
      calories,
    };
  } catch (error) {
    if (error instanceof DomainError) {
      logError(error, { useCase: 'getMacroTargetsUseCase', screen: 'AppContext', action: 'getNutritionMacroTargets' });
      return { error: error.code };
    }

    logError(error, { useCase: 'getMacroTargetsUseCase', screen: 'AppContext', action: 'getNutritionMacroTargets' });
    return { error: 'UNKNOWN_ERROR' };
  }
}
