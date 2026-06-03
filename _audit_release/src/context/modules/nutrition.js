import { getMacroTargetsUseCase } from '../../domains/nutrition/useCases/getMacroTargets';
import { searchNutritionDatabase, getCanonicalFoodData as getCanonicalFoodDataFromDb } from '../../data/nutritionDatabase.js';
import { getLocal } from '../../storage/mmkv';

const ADMIN_LOCAL_FOODS_KEY = 'admin.local.foods.v1';

function normalizeText(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getAdminLocalFoods() {
  const raw = getLocal(ADMIN_LOCAL_FOODS_KEY);
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item) => ({
      id: String(item?.id || `local-${Math.random().toString(16).slice(2)}`),
      label: String(item?.nome || '').trim(),
      aliases: Array.isArray(item?.aliases) ? item.aliases : [],
      calories: Number(item?.kcal || 0),
      protein: Number(item?.prot || 0),
      carbs: Number(item?.carbo || 0),
      fats: Number(item?.gord || 0),
    }))
    .filter((item) => item.label);
}

function parseNutritionLabel(text = '') {
  const safe = normalizeText(text);
  if (!safe) {
    return null;
  }

  const read = (pattern) => {
    const match = safe.match(pattern);
    if (!match?.[1]) {
      return null;
    }
    const value = Number(String(match[1]).replace(',', '.'));
    return Number.isFinite(value) ? value : null;
  };

  const calories = read(/(?:kcal|calorias?)\s*[:=]?\s*(\d+[\.,]?\d*)/i);
  const protein = read(/(?:proteina|proteinas)\s*[:=]?\s*(\d+[\.,]?\d*)/i);
  const carbs = read(/(?:carboidratos?|carbo)\s*[:=]?\s*(\d+[\.,]?\d*)/i);
  const fats = read(/(?:gorduras?|lipidios?)\s*[:=]?\s*(\d+[\.,]?\d*)/i);

  if ([calories, protein, carbs, fats].every((value) => value == null)) {
    return null;
  }

  return {
    calories: Number(calories || 0),
    protein: Number(protein || 0),
    carbs: Number(carbs || 0),
    fats: Number(fats || 0),
  };
}

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
  const base = searchNutritionDatabase(query);
  const localFoods = getAdminLocalFoods();
  const normalizedQuery = normalizeText(query);
  const localMatched = !normalizedQuery
    ? localFoods
    : localFoods.filter((item) => {
      const nameHit = normalizeText(item.label).includes(normalizedQuery);
      const aliasHit = (item.aliases || []).some((alias) => normalizeText(alias).includes(normalizedQuery));
      return nameHit || aliasHit;
    });

  return [...localMatched, ...base];
}

export function getCanonicalFoodData(input = '') {
  const dbMatch = getCanonicalFoodDataFromDb(input);
  if (dbMatch) {
    return dbMatch;
  }

  const localFoods = getAdminLocalFoods();
  const normalized = normalizeText(input);
  return localFoods.find((item) => {
    if (normalizeText(item.label) === normalized) {
      return true;
    }
    return (item.aliases || []).some((alias) => normalizeText(alias) === normalized);
  }) || null;
}

export function estimateNutritionFromTextInput(text = '') {
  const parsedLabel = parseNutritionLabel(text);
  if (parsedLabel) {
    return {
      ok: true,
      items: [{ label: 'Tabela nutricional informada', quantity: 1, ...parsedLabel }],
      totals: parsedLabel,
      message: 'Estimativa gerada a partir da tabela nutricional enviada.',
    };
  }

  const tokens = String(text || '')
    .split(/[;,\n]|\be\b|\+|\//i)
    .map((item) => item.trim())
    .filter(Boolean);

  const candidates = tokens.length ? tokens : [String(text || '').trim()];
  const chosen = [];

  candidates.forEach((token) => {
    const options = searchFoodCatalogByName(token);
    const first = options[0];
    if (!first) {
      return;
    }
    const exists = chosen.some((item) => normalizeText(item.label) === normalizeText(first.label));
    if (exists) {
      return;
    }
    chosen.push({
      label: first.label,
      quantity: 1,
      calories: Number(first.calories || 0),
      protein: Number(first.protein || 0),
      carbs: Number(first.carbs || 0),
      fats: Number(first.fats || 0),
    });
  });

  if (!chosen.length) {
    return {
      ok: false,
      message: 'Nao consegui identificar alimentos no texto.',
    };
  }

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
