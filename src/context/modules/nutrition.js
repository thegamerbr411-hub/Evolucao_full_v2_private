import { getMacroTargetsUseCase } from '../../domains/nutrition/useCases/getMacroTargets';
import { searchNutritionDatabase, getCanonicalFoodData as getCanonicalFoodDataFromDb } from '../../data/nutritionDatabase';

export function sumNutritionTotals(items = []) {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + Number(item.calories || 0),
      protein: acc.protein + Number(item.protein || 0),
      carbs: acc.carbs + Number(item.carbs || 0),
      fats: acc.fats + Number(item.fats || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
}

export function getNutritionMacroTargets(plan = {}, profile = {}) {
  const calories = Number(plan?.calories || plan?.kcal || 0);
  const weight = Number(profile?.currentWeight || profile?.weight || 70);
  const goal = String(profile?.goal || plan?.goal || '').trim();
  const overrides = plan?.overrides && typeof plan.overrides === 'object' ? plan.overrides : {};

  const targets = getMacroTargetsUseCase({ calories, weight, goal, overrides });
  if (!targets || targets.error) {
    return { calories: 0, protein: 0, carbs: 0, fats: 0 };
  }

  return targets;
}

export function searchFoodCatalogByName(query = '') {
  return searchNutritionDatabase(query);
}

export function getCanonicalFoodData(input = '') {
  return getCanonicalFoodDataFromDb(input);
}

export function estimateNutritionFromTextInput(text = '') {
  const options = searchFoodCatalogByName(text);
  if (!options.length) {
    return {
      ok: false,
      message: 'Nao consegui identificar alimentos no texto.',
    };
  }

  const chosen = options.slice(0, 3).map((item) => ({
    label: item.label,
    quantity: 1,
    calories: Number(item.calories || 0),
    protein: Number(item.protein || 0),
    carbs: Number(item.carbs || 0),
    fats: Number(item.fats || 0),
  }));

  const totals = sumNutritionTotals(chosen);
  return {
    ok: true,
    items: chosen,
    totals,
    message: 'Estimativa gerada com base no catalogo local.',
  };
}

export function evaluateMealQuality(totals = {}) {
  const protein = Number(totals?.protein || 0);
  if (protein >= 30) {
    return { score: 90, badge: 'Excelente', emoji: '[OK]' };
  }
  if (protein >= 20) {
    return { score: 75, badge: 'Boa', emoji: '[BOM]' };
  }
  return { score: 55, badge: 'Pode melhorar', emoji: '[ATENCAO]' };
}

export function buildMacroInsight(totals = {}, targets = {}) {
  const proteinGap = Number(targets?.protein || 0) - Number(totals?.protein || 0);
  if (proteinGap <= 0) {
    return 'Meta de proteina atingida.';
  }
  return `Faltam ${Math.round(proteinGap)}g de proteina para bater a meta.`;
}

export function classifyMacro(value = 0, target = 0) {
  const safeTarget = Number(target || 0);
  if (!safeTarget) {
    return 'neutro';
  }
  const ratio = Number(value || 0) / safeTarget;
  if (ratio >= 0.9) return 'acima';
  if (ratio >= 0.75) return 'ok';
  return 'abaixo';
}

export function getLatestDateKeysFromLogs(logs = [], limit = 7) {
  const unique = Array.from(new Set(logs.map((entry) => String(entry?.date || '')).filter(Boolean)));
  return unique.sort((a, b) => String(b).localeCompare(String(a))).slice(0, Math.max(1, Number(limit || 7)));
}
