
import React,{createContext,useContext,useEffect,useMemo,useRef,useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sumNutritionTotals } from './modules/nutrition';
import { applyPainAdaptiveWorkout, getNextWeightSuggestion, getRecommendedWorkout, getWeekBounds, getWorkoutDelta } from './modules/workout';
import { buildCoachMessage, buildDailyCoachState, buildWeeklyUrgency } from './modules/coach';
import { getExerciseNamesFromDatabase } from '../data/exerciseDatabase';
import { matchNutritionToken, searchNutritionDatabase } from '../data/nutritionDatabase';

const AppContext=createContext();
const STORAGE_KEY = 'evolucao.profile_plan.v1';

const CALORIE_RANGES = {
  cutting: { min: 1200, max: 2500 },
  bulking: { min: 2000, max: 3500 },
  recomposicao: { min: 1800, max: 2800 },
};

const XP_RULES = {
  completeSet: 5,
  newLoadPR: 20,
  completeWorkout: 50,
  consistencyBonus: 30,
  xpPerLevel: 300,
};

const DEFAULT_MONETIZATION = {
  plan: 'free',
  trialStartedAt: null,
  trialDays: 3,
  proSince: null,
};

const NUTRITION_DB = [
  { key: 'pao', label: 'Pao', calories: 140, protein: 5, carbs: 25, fats: 2 },
  { key: 'pao frances', label: 'Pao frances', calories: 135, protein: 4.5, carbs: 26, fats: 1.8 },
  { key: 'ovo', label: 'Ovo', calories: 78, protein: 6, carbs: 1, fats: 5 },
  { key: 'ovo inteiro', label: 'Ovo inteiro', calories: 78, protein: 6, carbs: 1, fats: 5 },
  { key: 'queijo', label: 'Queijo', calories: 95, protein: 6, carbs: 1, fats: 7 },
  { key: 'queijo mussarela', label: 'Queijo mussarela', calories: 86, protein: 6, carbs: 1, fats: 6 },
  { key: 'frango', label: 'Frango', calories: 165, protein: 31, carbs: 0, fats: 4 },
  { key: 'arroz', label: 'Arroz', calories: 130, protein: 2.5, carbs: 28, fats: 0.3 },
  { key: 'feijao', label: 'Feijao', calories: 77, protein: 5, carbs: 14, fats: 0.5 },
  { key: 'banana', label: 'Banana', calories: 90, protein: 1, carbs: 23, fats: 0.2 },
  { key: 'iogurte', label: 'Iogurte', calories: 120, protein: 8, carbs: 12, fats: 4 },
  { key: 'whey', label: 'Whey', calories: 120, protein: 24, carbs: 4, fats: 2 },
  { key: 'carne', label: 'Carne', calories: 220, protein: 26, carbs: 0, fats: 13 },
  { key: 'batata', label: 'Batata', calories: 86, protein: 2, carbs: 20, fats: 0.1 },
  { key: 'aveia', label: 'Aveia', calories: 110, protein: 4, carbs: 19, fats: 2.5 },
  { key: 'leite', label: 'Leite', calories: 103, protein: 8, carbs: 12, fats: 2.4 },
  { key: 'macarrao', label: 'Macarrao', calories: 158, protein: 5.8, carbs: 31, fats: 0.9 },
  { key: 'atum', label: 'Atum', calories: 132, protein: 28, carbs: 0, fats: 1 },
];

const FOOD_CATALOG = NUTRITION_DB.map((item) => ({
  key: item.key,
  label: item.label,
  calories: item.calories,
  protein: item.protein,
  carbs: item.carbs,
  fats: item.fats,
}));

const FRACTION_WORDS = {
  metade: 0.5,
  meia: 0.5,
  terco: 1 / 3,
  quarto: 0.25,
  uma: 1,
  um: 1,
  duas: 2,
  dois: 2,
  tres: 3,
};

const NUTRITION_SYNONYMS = {
  'muçarela': 'mussarela',
  'mussarela': 'queijo mussarela',
  'muzarela': 'queijo mussarela',
  'queijo muçarela': 'queijo mussarela',
  'queijo mussarela': 'queijo mussarela',
  'pao frances': 'pao frances',
  'paozinho': 'pao frances',
  'pao': 'pao',
  'ovos': 'ovo',
  'ovo inteiro': 'ovo inteiro',
};

const WORKOUT_LIBRARY = {
  fullBody: [
    { name: 'Agachamento Livre', sets: 4, reps: '6-10' },
    { name: 'Supino Reto Barra', sets: 4, reps: '6-10' },
    { name: 'Remada Curvada Barra', sets: 3, reps: '8-12' },
    { name: 'Desenvolvimento Militar Barra', sets: 3, reps: '8-12' },
    { name: 'Levantamento Terra Romeno', sets: 3, reps: '8-12' },
  ],
  upper: [
    { name: 'Supino Reto Barra', sets: 4, reps: '6-10' },
    { name: 'Puxada Frontal Polia', sets: 4, reps: '8-12' },
    { name: 'Desenvolvimento Militar Halter', sets: 3, reps: '8-12' },
    { name: 'Remada Baixa Triangulo', sets: 3, reps: '8-12' },
    { name: 'Rosca Direta Barra', sets: 3, reps: '10-12' },
    { name: 'Triceps Corda Polia', sets: 3, reps: '10-12' },
  ],
  lower: [
    { name: 'Agachamento Livre', sets: 4, reps: '6-10' },
    { name: 'Leg Press', sets: 4, reps: '10-12' },
    { name: 'Stiff', sets: 3, reps: '8-12' },
    { name: 'Cadeira Extensora', sets: 3, reps: '12-15' },
    { name: 'Panturrilha em Pe', sets: 4, reps: '12-20' },
  ],
  push: [
    { name: 'Supino Reto Barra', sets: 4, reps: '6-10' },
    { name: 'Supino Inclinado Halter', sets: 3, reps: '8-12' },
    { name: 'Desenvolvimento Militar Halter', sets: 3, reps: '8-12' },
    { name: 'Elevacao Lateral Halter', sets: 3, reps: '12-15' },
    { name: 'Triceps Testa Barra EZ', sets: 3, reps: '10-12' },
  ],
  pull: [
    { name: 'Puxada Frontal Polia', sets: 4, reps: '8-12' },
    { name: 'Remada Curvada Barra', sets: 4, reps: '8-12' },
    { name: 'Face Pull Polia', sets: 3, reps: '12-15' },
    { name: 'Rosca Direta Barra', sets: 3, reps: '10-12' },
    { name: 'Rosca Martelo Halter', sets: 3, reps: '10-12' },
  ],
  legs: [
    { name: 'Agachamento Livre', sets: 4, reps: '6-10' },
    { name: 'Levantamento Terra Romeno', sets: 4, reps: '8-10' },
    { name: 'Passada', sets: 3, reps: '10-12' },
    { name: 'Cadeira Flexora', sets: 3, reps: '12-15' },
    { name: 'Panturrilha Sentado', sets: 4, reps: '15-20' },
  ],
};

const MUSCLE_SUGGESTION_MAP = {
  peito: ['Triceps Corda Polia', 'Triceps Testa Barra EZ', 'Desenvolvimento Militar Halter'],
  costas: ['Rosca Direta Barra', 'Rosca Martelo Halter', 'Face Pull Polia'],
  perna: ['Cadeira Extensora', 'Cadeira Flexora', 'Panturrilha em Pe'],
  ombro: ['Elevacao Lateral Halter', 'Desenvolvimento Militar Halter', 'Face Pull Polia'],
  triceps: ['Supino Reto Barra', 'Supino Inclinado Halter', 'Desenvolvimento Militar Barra'],
  biceps: ['Puxada Frontal Polia', 'Remada Curvada Barra', 'Rosca Martelo Halter'],
};

function getTodayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNowTimeLabel() {
  const date = new Date();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function normalizeHistoryStatus(insightStatus) {
  if (insightStatus === 'otimo') {
    return 'ok';
  }

  if (insightStatus === 'abaixo_meta' || insightStatus === 'recuperacao_baixa') {
    return 'abaixo';
  }

  return 'acima';
}

function round(value) {
  return Math.round(value);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundToStep(value, step = 2.5) {
  return Math.round(value / step) * step;
}

function isLowerBodyExercise(exerciseName) {
  const lowerKeywords = [
    'Agachamento',
    'Leg Press',
    'Stiff',
    'Passada',
    'Panturrilha',
    'Terra',
    'Extensora',
    'Flexora',
  ];

  return lowerKeywords.some((keyword) => exerciseName.includes(keyword));
}

function getProgressionStep(exerciseName) {
  return isLowerBodyExercise(exerciseName) ? 5 : 2.5;
}

function parseRepRange(repsText) {
  if (!repsText || typeof repsText !== 'string') {
    return { min: 8, max: 12 };
  }

  const parts = repsText.split('-').map((part) => Number(part.trim()));
  if (parts.length === 2 && parts.every((num) => Number.isFinite(num))) {
    return { min: parts[0], max: parts[1] };
  }

  return { min: 8, max: 12 };
}

function getExerciseTemplate(exerciseName) {
  const all = Object.values(WORKOUT_LIBRARY).flat();
  return all.find((exercise) => exercise.name === exerciseName) || null;
}

function getDefaultStartingWeight(exerciseName, level) {
  const lower = isLowerBodyExercise(exerciseName);

  if (level === 'intermediario') {
    return lower ? 30 : 20;
  }

  return lower ? 20 : 10;
}

function buildConfidence(totalLogs, recentLogs) {
  if (totalLogs >= 8 && recentLogs.length >= 3) {
    return 'alta';
  }

  if (totalLogs >= 3) {
    return 'media';
  }

  return 'baixa';
}

function getCaloriesRangeByStrategy(strategy) {
  return CALORIE_RANGES[strategy] || CALORIE_RANGES.recomposicao;
}

function clampCaloriesByStrategy(calories, strategy) {
  const range = getCaloriesRangeByStrategy(strategy);
  return clamp(calories, range.min, range.max);
}

function buildInitialTraining(daysPerWeek, level) {
  if (daysPerWeek <= 3) {
    return 'Full body 3x semana';
  }

  if (daysPerWeek === 4) {
    return 'Superior/Inferior 4x semana';
  }

  if (level === 'iniciante') {
    return 'Push/Pull/Legs + Full body (5x semana)';
  }

  return 'Divisao classica (5x semana)';
}

function getWorkoutDayIndex() {
  const jsDay = new Date().getDay();
  return (jsDay + 6) % 7;
}

function getWorkoutBySplit(split) {
  const dayIndex = getWorkoutDayIndex();

  if (!split || split.includes('Full body')) {
    return WORKOUT_LIBRARY.fullBody;
  }

  if (split.includes('Superior/Inferior')) {
    return dayIndex % 2 === 0 ? WORKOUT_LIBRARY.upper : WORKOUT_LIBRARY.lower;
  }

  if (split.includes('Push/Pull/Legs')) {
    const ppl = [WORKOUT_LIBRARY.push, WORKOUT_LIBRARY.pull, WORKOUT_LIBRARY.legs];
    return ppl[dayIndex % 3];
  }

  const classic = [WORKOUT_LIBRARY.push, WORKOUT_LIBRARY.pull, WORKOUT_LIBRARY.legs, WORKOUT_LIBRARY.upper, WORKOUT_LIBRARY.lower];
  return classic[dayIndex % classic.length];
}

function getLevelFromXp(xp) {
  return Math.max(1, Math.floor(Number(xp || 0) / XP_RULES.xpPerLevel) + 1);
}

function getLevelLabel(level) {
  if (level <= 1) {
    return 'Iniciante';
  }

  if (level === 2) {
    return 'Intermediario';
  }

  return 'Avancado';
}

function getPreviousDateKey(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() - 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateDiffInDays(fromDateKey, toDateKey) {
  const from = new Date(`${fromDateKey}T12:00:00`);
  const to = new Date(`${toDateKey}T12:00:00`);
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

function normalizeText(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function evaluateMealQuality({ protein = 0, calories = 0, carbs = 0, fats = 0 }) {
  const safeProtein = Number(protein || 0);
  const safeCalories = Number(calories || 0);
  const safeCarbs = Number(carbs || 0);
  const safeFats = Number(fats || 0);
  const proteinDensity = safeCalories > 0 ? (safeProtein * 4) / safeCalories : 0;

  if (safeProtein >= 28 && proteinDensity >= 0.3 && safeFats <= 20) {
    return {
      level: 'good',
      badge: 'Boa refeicao',
      emoji: '🟢',
      message: 'Boa refeicao: proteina forte para recuperar e evoluir.',
    };
  }

  if (safeProtein < 18 || proteinDensity < 0.2) {
    return {
      level: 'weak_protein',
      badge: 'Fraca em proteina',
      emoji: '🔴',
      message: 'Fraca em proteina: adicione uma fonte proteica para fechar melhor.',
    };
  }

  if (safeFats > 26 && safeCarbs < 20) {
    return {
      level: 'high_fat',
      badge: 'Ok, mas pesada',
      emoji: '🟡',
      message: 'Ok, mas pesada: ajuste gordura na proxima refeicao.',
    };
  }

  return {
    level: 'ok',
    badge: 'Ok',
    emoji: '🟡',
    message: 'Refeicao ok: da para otimizar um pouco a proteina.',
  };
}

function parseQuantityFromText(text) {
  const normalized = normalizeText(text);
  const fractionMatch = normalized.match(/(\d+)\s*\/\s*(\d+)/);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (denominator > 0) {
      return numerator / denominator;
    }
  }

  const decimalMatch = normalized.match(/(\d+[\.,]?\d*)/);
  if (decimalMatch) {
    return Number(String(decimalMatch[1]).replace(',', '.'));
  }

  const word = Object.keys(FRACTION_WORDS).find((item) => normalized.includes(item));
  if (word) {
    return FRACTION_WORDS[word];
  }

  return 1;
}

function getNutritionMacroTargets(planData, profileData) {
  const calories = Number(planData?.caloriesPerDay || 0);
  const weight = Number(profileData?.currentWeight || 70);
  const goal = profileData?.goal;
  const proteinFactor = goal === 'emagrecer' ? 2 : goal === 'ganhar_massa' ? 1.8 : 1.9;
  const proteinTarget = round(weight * proteinFactor);
  const fatsTarget = round((calories * 0.27) / 9);
  const carbsTarget = round(Math.max(0, (calories - proteinTarget * 4 - fatsTarget * 9) / 4));

  const overrides = planData?.macroOverrides || {};
  return {
    protein: overrides.protein != null ? overrides.protein : proteinTarget,
    carbs: overrides.carbs != null ? overrides.carbs : carbsTarget,
    fats: overrides.fats != null ? overrides.fats : fatsTarget,
    calories,
  };
}

function classifyMacro(consumed, target) {
  if (!target) {
    return 'ok';
  }

  const ratio = Number(consumed || 0) / Number(target);

  if (ratio < 0.8) {
    return 'baixo';
  }

  if (ratio > 1.2) {
    return 'alto';
  }

  return 'ok';
}

function buildMacroInsight({ protein, carbs, fats, targets, trainedToday }) {
  const status = {
    protein: classifyMacro(protein, targets.protein),
    carbs: classifyMacro(carbs, targets.carbs),
    fats: classifyMacro(fats, targets.fats),
  };

  const feedback = [];

  if (status.protein === 'baixo') {
    feedback.push(
      trainedToday
        ? 'Proteina baixa hoje. Isso pode atrapalhar recuperacao muscular do treino.'
        : 'Proteina abaixo da meta. Subir proteina ajuda composicao corporal.'
    );
  }

  if (status.carbs === 'baixo' && trainedToday) {
    feedback.push('Carbo baixo para dia de treino. Energia e performance podem cair.');
  }

  if (status.fats === 'alto') {
    feedback.push('Gordura acima da meta. Ajuste porcoes para equilibrar calorias.');
  }

  if (!feedback.length) {
    feedback.push('Macros do dia estao em faixa aceitavel. Mantenha consistencia.');
  }

  return {
    status,
    message: feedback.join(' '),
  };
}

function estimateNutritionFromTextInput(inputText) {
  let text = normalizeText(inputText || '');
  if (!text.trim()) {
    return {
      ok: false,
      message: 'Digite os alimentos para estimar macros.',
    };
  }

  Object.entries(NUTRITION_SYNONYMS).forEach(([from, to]) => {
    const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedFrom}\\b`, 'g');
    text = text.replace(regex, to);
  });

  const chunks = text
    .split(/[,+;]|\se\s/g)
    .map((item) => item.trim())
    .filter(Boolean);

  const comboItems = [];
  if (text.includes('pao') && text.includes('ovo')) {
    const eggCountMatch = text.match(/(\d+)\s*ovos?/);
    const eggCount = eggCountMatch ? Number(eggCountMatch[1]) : 2;
    const breadIsFrench = text.includes('pao frances');
    const breadKcal = breadIsFrench ? 135 : 140;
    const breadProtein = breadIsFrench ? 4.5 : 5;
    const breadCarbs = breadIsFrench ? 26 : 25;
    const breadFat = breadIsFrench ? 1.8 : 2;

    const totalCalories = round(breadKcal + eggCount * 78);
    const totalProtein = round(breadProtein + eggCount * 6);
    const totalCarbs = round(breadCarbs + eggCount * 1);
    const totalFats = round(breadFat + eggCount * 5);

    comboItems.push({
      label: breadIsFrench ? 'Pao frances com ovos' : 'Pao com ovos',
      quantity: 1,
      calories: totalCalories,
      protein: totalProtein,
      carbs: totalCarbs,
      fats: totalFats,
    });
  }

  const items = [];
  const unknown = [];
  const tokenTotals = { calories: 0, protein: 0, carbs: 0, fats: 0 };
  // Fallback token parser for simple strings like: "pao ovo frango"
  const plainTokens = text
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  plainTokens.forEach((token) => {
    const mapped = matchNutritionToken(token);
    if (!mapped) {
      return;
    }
    tokenTotals.calories += round(mapped.calories || 0);
    tokenTotals.protein += round(mapped.protein || 0);
    tokenTotals.carbs += round(mapped.carbs || 0);
    tokenTotals.fats += round(mapped.fats || 0);
  });

  for (const chunk of chunks) {
    const token = chunk
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean)
      .find((part) => Boolean(matchNutritionToken(part))) || chunk;
    const food = matchNutritionToken(token);
    if (!food) {
      unknown.push(chunk);
      continue;
    }

    const quantity = parseQuantityFromText(chunk);
    items.push({
      label: food.label || token,
      quantity,
      calories: round(Number(food.calories || 0) * quantity),
      protein: round(Number(food.protein || 0) * quantity),
      carbs: round(Number(food.carbs || 0) * quantity),
      fats: round(Number(food.fats || 0) * quantity),
    });
  }

  const allItems = [...comboItems, ...items];

  if (!allItems.length) {
    return {
      ok: false,
      message: 'Nao consegui identificar alimentos conhecidos. Tente termos simples.',
    };
  }

  const reducedTotals = allItems.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: acc.protein + item.protein,
      carbs: acc.carbs + item.carbs,
      fats: acc.fats + item.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  const totals = {
    calories: Math.max(reducedTotals.calories, tokenTotals.calories),
    protein: Math.max(reducedTotals.protein, tokenTotals.protein),
    carbs: Math.max(reducedTotals.carbs, tokenTotals.carbs),
    fats: Math.max(reducedTotals.fats, tokenTotals.fats),
  };

  return {
    ok: true,
    source: 'text',
    totals,
    items: allItems,
    unknown,
    message: unknown.length
      ? 'Estimativa concluida com alguns itens nao reconhecidos.'
      : 'Estimativa concluida com sucesso.',
  };
}

function estimateNutritionFromPhotoHintInput(description, portionFactor = 1) {
  const result = estimateNutritionFromTextInput(description);
  if (!result.ok) {
    return result;
  }

  const conservative = 1.1;
  const multiplier = Number(portionFactor || 1) * conservative;
  const totals = {
    calories: round(result.totals.calories * multiplier),
    protein: round(result.totals.protein * multiplier),
    carbs: round(result.totals.carbs * multiplier),
    fats: round(result.totals.fats * multiplier),
  };

  return {
    ...result,
    source: 'photo_hint',
    totals,
    message: 'Estimativa foto beta aplicada de forma conservadora (+10%).',
  };
}

function inferMuscleGroup(exerciseName = '') {
  const name = String(exerciseName);

  if (
    name.includes('Supino') ||
    name.includes('Crucifixo') ||
    name.includes('Peck')
  ) {
    return 'peito';
  }

  if (
    name.includes('Remada') ||
    name.includes('Puxada') ||
    name.includes('Pull')
  ) {
    return 'costas';
  }

  if (
    name.includes('Agachamento') ||
    name.includes('Leg Press') ||
    name.includes('Passada') ||
    name.includes('Extensora') ||
    name.includes('Flexora') ||
    name.includes('Panturrilha') ||
    name.includes('Stiff') ||
    name.includes('Terra')
  ) {
    return 'perna';
  }

  if (name.includes('Triceps')) {
    return 'triceps';
  }

  if (name.includes('Rosca') || name.includes('Biceps')) {
    return 'biceps';
  }

  if (name.includes('Desenvolvimento') || name.includes('Elevacao')) {
    return 'ombro';
  }

  return null;
}

function getExerciseCatalogFromSources(logs) {
  const localNames = getExerciseNamesFromDatabase();
  const libraryNames = Object.values(WORKOUT_LIBRARY)
    .flat()
    .map((item) => item.name);
  const loggedNames = logs.map((item) => item.exerciseName).filter(Boolean);
  return Array.from(new Set([...localNames, ...libraryNames, ...loggedNames])).sort((a, b) => a.localeCompare(b));
}

function generatePlan(profile) {
  const weight = Number(profile.currentWeight);
  const height = Number(profile.height);
  const days = Number(profile.trainingDaysPerWeek);

  const baseCalories = weight * 30 + height * 4 + days * 80;

  const strategy =
    profile.goal === 'emagrecer'
      ? 'cutting'
      : profile.goal === 'ganhar_massa'
      ? 'bulking'
      : 'recomposicao';

  const calories =
    strategy === 'cutting'
      ? round(baseCalories - 350)
      : strategy === 'bulking'
      ? round(baseCalories + 300)
      : round(baseCalories);

  const waterLiters = (weight * 35 + days * 250) / 1000;

  return {
    caloriesPerDay: clampCaloriesByStrategy(calories, strategy),
    waterLitersPerDay: Number(waterLiters.toFixed(1)),
    trainingSplit: buildInitialTraining(days, profile.level),
    strategy,
  };
}

function buildDailyInsight(planData, consumedCalories, trainedToday) {
  if (!planData) {
    return {
      status: 'sem_plano',
      message: 'Complete o questionario para liberar analise diaria.',
    };
  }

  const target = Number(planData.caloriesPerDay);
  const consumed = Number(consumedCalories);
  const delta = target - consumed;

  if (!consumed || consumed < 500) {
    return {
      status: 'dados_insuficientes',
      message: 'Informe calorias consumidas realistas para gerar recomendacao.',
    };
  }

  if (trainedToday && delta > 500) {
    return {
      status: 'recuperacao_baixa',
      message:
        'Hoje voce treinou e ficou com deficit alto. Aumente proteina e carboidrato no pos-treino para recuperar melhor.',
    };
  }

  if (!trainedToday && delta < -350) {
    return {
      status: 'excesso_sem_treino',
      message:
        'Hoje voce passou bastante das calorias sem treino. Tente equilibrar no proximo dia com refeicoes mais leves.',
    };
  }

  if (Math.abs(delta) <= 250) {
    return {
      status: 'otimo',
      message: 'Excelente. Seu dia ficou bem alinhado com o plano. Mantenha constancia.',
    };
  }

  if (delta > 250) {
    return {
      status: 'abaixo_meta',
      message: 'Voce ficou abaixo da meta calorica. Inclua uma refeicao estrategica para bater o objetivo.',
    };
  }

  return {
    status: 'acima_meta',
    message: 'Voce ficou acima da meta calorica. Ajuste porcoes nas proximas refeicoes do dia.',
  };
}

function buildWeeklyInsight({ summary, analyzedDays, profileData }) {
  if (!analyzedDays) {
    return {
      consistencyScore: 0,
      diagnosis: 'Ainda nao ha dados suficientes para analisar a semana.',
      recommendation: 'Registre pelo menos 3 dias para liberar um diagnostico util.',
    };
  }

  const expectedWeeklyDays = Number(profileData?.trainingDaysPerWeek || 3);
  const expectedInWindow = Math.max(1, round((expectedWeeklyDays / 7) * analyzedDays));
  const trainedRatio = Math.min(summary.trainedDays / expectedInWindow, 1);
  const targetRatio = (analyzedDays - summary.outOfTargetDays) / analyzedDays;
  const consistencyScore = round(trainedRatio * 45 + targetRatio * 55);

  if (consistencyScore >= 80) {
    return {
      consistencyScore,
      diagnosis:
        'Semana consistente. Voce manteve boa aderencia entre treino e nutricao na maior parte dos dias.',
      recommendation:
        'Mantenha a estrategia atual e ajuste apenas detalhes de porcao e horario para continuar evoluindo.',
    };
  }

  if (consistencyScore >= 55) {
    return {
      consistencyScore,
      diagnosis:
        'Semana mediana. Houve consistencia parcial, mas ainda com oscilacoes em treino ou meta calorica.',
      recommendation:
        'Priorize 1 ajuste por vez: bater calorias por 3 dias seguidos e manter frequencia minima de treino.',
    };
  }

  return {
    consistencyScore,
    diagnosis:
      'Semana irregular. Baixa consistencia entre treino e alimentacao pode atrasar seu resultado.',
    recommendation:
      'Simplifique o plano desta semana: foco em treinar nos dias planejados e reduzir desvios caloricos grandes.',
  };
}

function buildTrainingAdjustment({ trainingGap, consistencyScore }) {
  if (trainingGap >= 2) {
    return 'Reduzir intensidade do treino por 1 semana e priorizar execucao e recuperacao.';
  }

  if (consistencyScore >= 80) {
    return 'Manter intensidade e progredir carga levemente nos exercicios principais.';
  }

  return 'Manter intensidade atual e focar em consistencia nos proximos 7 dias.';
}

export const AppProvider=({children})=>{
  const [user,setUser]=useState(null);
  const [profile, setProfile] = useState(null);
  const [plan, setPlan] = useState(null);
  const [history, setHistory] = useState([]);
  const [nutritionLogs, setNutritionLogs] = useState([]);
  const [workoutLogs, setWorkoutLogs] = useState([]);
  const [userRoutines, setUserRoutines] = useState([]);
  const [exerciseTargets, setExerciseTargets] = useState({});
  const [gamification, setGamification] = useState({
    xp: 0,
    lastWorkoutXpDate: null,
    streakDays: 0,
    lastWorkoutDate: null,
    completedMissions: {},
  });
  const [monetization, setMonetization] = useState(DEFAULT_MONETIZATION);
  const [isHydrated, setIsHydrated] = useState(false);
  const localDecisionCacheRef = useRef({
    workoutRecommendation: {},
  });

  const hasCompletedQuestionnaire = useMemo(() => Boolean(profile && plan), [profile, plan]);

  useEffect(() => {
    const loadFromStorage = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return;
        }

        const parsed = JSON.parse(raw);
        if (parsed?.profile && parsed?.plan) {
          setProfile(parsed.profile);
          setPlan(parsed.plan);
        }

        if (Array.isArray(parsed?.history)) {
          setHistory(parsed.history);
        }

        if (Array.isArray(parsed?.nutritionLogs)) {
          setNutritionLogs(parsed.nutritionLogs);
        }

        if (Array.isArray(parsed?.workoutLogs)) {
          setWorkoutLogs(parsed.workoutLogs);
        }

        if (Array.isArray(parsed?.userRoutines)) {
          setUserRoutines(parsed.userRoutines);
        }

        if (parsed?.exerciseTargets && typeof parsed.exerciseTargets === 'object') {
          setExerciseTargets(parsed.exerciseTargets);
        }

        if (parsed?.gamification && typeof parsed.gamification === 'object') {
          setGamification({
            xp: Number(parsed.gamification.xp || 0),
            lastWorkoutXpDate: parsed.gamification.lastWorkoutXpDate || null,
            streakDays: Number(parsed.gamification.streakDays || 0),
            lastWorkoutDate: parsed.gamification.lastWorkoutDate || null,
            completedMissions: (parsed.gamification.completedMissions && typeof parsed.gamification.completedMissions === 'object')
              ? parsed.gamification.completedMissions
              : {},
          });
        }

        if (parsed?.monetization && typeof parsed.monetization === 'object') {
          setMonetization({
            plan: parsed.monetization.plan === 'pro' ? 'pro' : 'free',
            trialStartedAt: parsed.monetization.trialStartedAt || null,
            trialDays: Number(parsed.monetization.trialDays || 3),
            proSince: parsed.monetization.proSince || null,
          });
        }
      } catch (error) {
        // Silently ignore corrupted local data.
      } finally {
        setIsHydrated(true);
      }
    };

    loadFromStorage();
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const persist = async () => {
      try {
        if (profile && plan) {
          await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              profile,
              plan,
              history,
              nutritionLogs,
              workoutLogs,
              userRoutines,
              exerciseTargets,
              gamification,
              monetization,
            })
          );
        } else {
          await AsyncStorage.removeItem(STORAGE_KEY);
        }
      } catch (error) {
        // Ignore storage write errors to avoid breaking UX.
      }
    };

    persist();
  }, [profile, plan, history, nutritionLogs, workoutLogs, userRoutines, exerciseTargets, gamification, monetization, isHydrated]);

  const saveQuestionnaire = (formData) => {
    const normalized = {
      goal: formData.goal,
      level: formData.level,
      currentWeight: Number(formData.currentWeight),
      targetWeight: Number(formData.targetWeight),
      height: Number(formData.height),
      trainingDaysPerWeek: Number(formData.trainingDaysPerWeek),
    };

    setProfile(normalized);
    setPlan(generatePlan(normalized));
  };

  const updateProfileSettings = (partialData = {}) => {
    if (!profile) {
      return { ok: false, message: 'Perfil ainda nao foi definido.' };
    }

    const nextProfile = {
      ...profile,
      ...partialData,
      currentWeight: Number(partialData.currentWeight ?? profile.currentWeight),
      targetWeight: Number(partialData.targetWeight ?? profile.targetWeight),
      trainingDaysPerWeek: Number(partialData.trainingDaysPerWeek ?? profile.trainingDaysPerWeek),
      height: Number(partialData.height ?? profile.height),
    };

    setProfile(nextProfile);

    setPlan((prev) => {
      const regenerated = generatePlan(nextProfile);
      return {
        ...regenerated,
        macroOverrides: prev?.macroOverrides || null,
        weeklyTrainingAdjustment: prev?.weeklyTrainingAdjustment || null,
        lastAutoAdjustmentAt: prev?.lastAutoAdjustmentAt || null,
      };
    });

    return { ok: true, message: 'Perfil atualizado com sucesso.' };
  };

  const resetQuestionnaire = () => {
    setProfile(null);
    setPlan(null);
    setHistory([]);
    setNutritionLogs([]);
    setWorkoutLogs([]);
    setUserRoutines([]);
    setExerciseTargets({});
    setGamification({
      xp: 0,
      lastWorkoutXpDate: null,
      streakDays: 0,
      lastWorkoutDate: null,
      completedMissions: {},
    });
    setMonetization(DEFAULT_MONETIZATION);
  };

  const getSubscriptionStatus = () => {
    const isProPlan = monetization.plan === 'pro';
    const trialStart = monetization.trialStartedAt;
    const trialDays = Number(monetization.trialDays || 3);

    if (isProPlan) {
      return {
        isPro: true,
        source: 'pro',
        trialRemainingDays: 0,
      };
    }

    if (!trialStart) {
      return {
        isPro: false,
        source: 'free',
        trialRemainingDays: 0,
      };
    }

    const startDate = new Date(`${trialStart}T12:00:00`);
    const todayDate = new Date(`${getTodayKey()}T12:00:00`);
    const elapsed = Math.max(0, Math.floor((todayDate - startDate) / (1000 * 60 * 60 * 24)));
    const remaining = Math.max(0, trialDays - elapsed);

    return {
      isPro: remaining > 0,
      source: remaining > 0 ? 'trial' : 'free',
      trialRemainingDays: remaining,
    };
  };

  const hasFeatureAccess = (featureKey) => {
    const freeFeatures = new Set([
      'guided_workout',
      'free_workout',
      'sets_logging',
      'scanner_text',
      'history_basic',
      'xp_levels',
      'day_analysis',
    ]);

    if (freeFeatures.has(featureKey)) {
      return true;
    }

    return getSubscriptionStatus().isPro;
  };

  const startProTrial = () => {
    setMonetization((prev) => {
      if (prev.plan === 'pro' || prev.trialStartedAt) {
        return prev;
      }

      return {
        ...prev,
        trialStartedAt: getTodayKey(),
        trialDays: Number(prev.trialDays || 3),
      };
    });
  };

  const activateProPlan = () => {
    setMonetization((prev) => ({
      ...prev,
      plan: 'pro',
      proSince: getTodayKey(),
    }));
  };

  const saveDailyHistory = ({ consumedCalories, protein, carbs, fats, trainedToday, insight, macroInsight }) => {
    const entryDate = getTodayKey();
    const existingToday = history.find((item) => item.date === entryDate);
    const normalizedEntry = {
      date: entryDate,
      calories: Number(consumedCalories),
      protein: Number(protein || 0),
      carbs: Number(carbs || 0),
      fats: Number(fats || 0),
      trained: Boolean(trainedToday),
      status: normalizeHistoryStatus(insight.status),
      insight: insight.message,
      macroInsight: macroInsight?.message || '',
      waterMl: Number(existingToday?.waterMl || 0),
    };

    setHistory((prev) => {
      const withoutToday = prev.filter((item) => item.date !== entryDate);
      const next = [normalizedEntry, ...withoutToday];
      return next.slice(0, 30);
    });
  };

  const saveNutritionEntry = ({ calories, protein, carbs, fats }) => {
    const entryDate = getTodayKey();

    setHistory((prev) => {
      const existing = prev.find((item) => item.date === entryDate);
      const normalizedEntry = {
        date: entryDate,
        calories: Number(calories || 0),
        protein: Number(protein || 0),
        carbs: Number(carbs || 0),
        fats: Number(fats || 0),
        trained: Boolean(existing?.trained),
        status: existing?.status || 'ok',
        insight: existing?.insight || 'Nutricao registrada pelo scanner.',
        macroInsight: existing?.macroInsight || '',
        waterMl: Number(existing?.waterMl || 0),
      };

      const withoutToday = prev.filter((item) => item.date !== entryDate);
      const next = [normalizedEntry, ...withoutToday];
      return next.slice(0, 30);
    });

    return {
      ok: true,
      message: 'Nutricao salva no historico de hoje.',
    };
  };

  const searchFoodCatalog = (query = '') => {
    const localMatches = searchNutritionDatabase(query);
    if (localMatches.length) {
      return localMatches;
    }

    const normalized = normalizeText(query);
    if (!normalized.trim()) {
      return FOOD_CATALOG.slice(0, 20);
    }

    return FOOD_CATALOG
      .filter((item) => normalizeText(item.label).includes(normalized) || normalizeText(item.key).includes(normalized))
      .slice(0, 20);
  };

  const getTodayFoodLog = () => {
    const todayKey = getTodayKey();
    return nutritionLogs
      .filter((item) => item.date === todayKey)
      .sort((a, b) => String(b.loggedAt || '').localeCompare(String(a.loggedAt || '')));
  };

  const addFoodLogEntry = ({ foodKey, label, quantity = 1, loggedAt }) => {
    const food = FOOD_CATALOG.find((item) => item.key === foodKey) || FOOD_CATALOG.find((item) => normalizeText(item.label) === normalizeText(label || ''));
    if (!food) {
      return { ok: false, message: 'Alimento nao encontrado no catalogo local.' };
    }

    const safeQuantity = Math.max(0.1, Number(quantity || 1));
    const totals = {
      calories: round(food.calories * safeQuantity),
      protein: round(food.protein * safeQuantity),
      carbs: round(food.carbs * safeQuantity),
      fats: round(food.fats * safeQuantity),
    };

    const entryDate = getTodayKey();
    const quality = evaluateMealQuality(totals);
    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date: entryDate,
      loggedAt: loggedAt || getNowTimeLabel(),
      foodKey: food.key,
      label: food.label,
      quantity: safeQuantity,
      quality,
      ...totals,
    };

    let aggregatedForToday = null;
    setNutritionLogs((prev) => {
      const next = [entry, ...prev];
      const todayEntries = next.filter((item) => item.date === entryDate);
      aggregatedForToday = sumNutritionTotals(todayEntries);
      return next;
    });

    if (aggregatedForToday) {
      saveNutritionEntry(aggregatedForToday);
    }

    return {
      ok: true,
      entry,
      quality,
      message: `Alimento registrado. ${quality.emoji} ${quality.badge}.`,
    };
  };

  const addFoodLogEntriesBatch = ({ items = [], loggedAt }) => {
    const entryDate = getTodayKey();
    const safeLoggedAt = loggedAt || getNowTimeLabel();
    let createdEntries = [];
    let aggregatedForToday = null;

    setNutritionLogs((prev) => {
      const nextEntries = [];

      items.forEach((item) => {
        const food = FOOD_CATALOG.find((entry) => entry.key === item.foodKey)
          || FOOD_CATALOG.find((entry) => normalizeText(entry.label) === normalizeText(item.label || ''));

        if (!food) {
          return;
        }

        const safeQuantity = Math.max(0.1, Number(item.quantity || 1));
        const totals = {
          calories: round(food.calories * safeQuantity),
          protein: round(food.protein * safeQuantity),
          carbs: round(food.carbs * safeQuantity),
          fats: round(food.fats * safeQuantity),
        };

        const quality = evaluateMealQuality(totals);
        nextEntries.push({
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          date: entryDate,
          loggedAt: safeLoggedAt,
          foodKey: food.key,
          label: food.label,
          quantity: safeQuantity,
          quality,
          ...totals,
        });
      });

      if (!nextEntries.length) {
        createdEntries = [];
        return prev;
      }

      const next = [...nextEntries, ...prev];
      const todayEntries = next.filter((item) => item.date === entryDate);
      aggregatedForToday = sumNutritionTotals(todayEntries);
      createdEntries = nextEntries;
      return next;
    });

    if (!createdEntries.length) {
      return { ok: false, message: 'Nenhum alimento valido para salvar.' };
    }

    if (aggregatedForToday) {
      saveNutritionEntry(aggregatedForToday);
    }

    const lastQuality = createdEntries[createdEntries.length - 1]?.quality || null;
    return {
      ok: true,
      entries: createdEntries,
      quality: lastQuality,
      message: `Refeicao composta salva com ${createdEntries.length} item(ns).`,
    };
  };

  const removeFoodLogEntry = (entryId) => {
    const target = nutritionLogs.find((item) => item.id === entryId);
    if (!target) {
      return { ok: false, message: 'Registro alimentar nao encontrado.' };
    }

    const entryDate = target.date;
    const remainingLogs = nutritionLogs.filter((item) => item.id !== entryId);
    setNutritionLogs(remainingLogs);

    const remainingToday = remainingLogs.filter((item) => item.date === entryDate);
    const aggregated = sumNutritionTotals(remainingToday);

    const todayKey = getTodayKey();
    if (entryDate === todayKey) {
      saveNutritionEntry(aggregated);
    }

    return { ok: true, message: 'Registro removido com sucesso.' };
  };

  const addWaterIntake = (ml) => {
    const value = Number(ml || 0);
    if (!value || value <= 0) {
      return { ok: false, message: 'Informe um volume de agua valido.' };
    }

    const entryDate = getTodayKey();
    setHistory((prev) => {
      const existing = prev.find((item) => item.date === entryDate);
      const normalizedEntry = {
        date: entryDate,
        calories: Number(existing?.calories || 0),
        protein: Number(existing?.protein || 0),
        carbs: Number(existing?.carbs || 0),
        fats: Number(existing?.fats || 0),
        trained: Boolean(existing?.trained),
        status: existing?.status || 'ok',
        insight: existing?.insight || 'Hidratacao atualizada no dia.',
        macroInsight: existing?.macroInsight || '',
        waterMl: Number(existing?.waterMl || 0) + value,
      };

      const withoutToday = prev.filter((item) => item.date !== entryDate);
      const next = [normalizedEntry, ...withoutToday];
      return next.slice(0, 30);
    });

    return { ok: true, message: `${value}ml de agua adicionados.` };
  };

  const analyzeDay = ({ consumedCalories, protein, carbs = 0, fats = 0, trainedToday }) => {
    const insight = buildDailyInsight(plan, consumedCalories, trainedToday);
    const macroTargets = getNutritionMacroTargets(plan, profile);
    const macroInsight = buildMacroInsight({
      protein: Number(protein || 0),
      carbs: Number(carbs || 0),
      fats: Number(fats || 0),
      targets: macroTargets,
      trainedToday,
    });

    if (insight.status !== 'sem_plano' && insight.status !== 'dados_insuficientes') {
      saveDailyHistory({
        consumedCalories,
        protein,
        carbs,
        fats,
        trainedToday,
        insight,
        macroInsight,
      });
    }

    return {
      ...insight,
      macroInsight,
      macroTargets,
    };
  };

  const getRecentHistory = () => {
    return history.slice(0, 7);
  };

  const getWeeklySummary = () => {
    const last7 = history.slice(0, 7);

    if (!last7.length) {
      return {
        averageCalories: 0,
        trainedDays: 0,
        outOfTargetDays: 0,
      };
    }

    const totalCalories = last7.reduce((acc, item) => acc + Number(item.calories || 0), 0);
    const trainedDays = last7.filter((item) => item.trained).length;
    const outOfTargetDays = last7.filter((item) => item.status !== 'ok').length;

    return {
      averageCalories: round(totalCalories / last7.length),
      trainedDays,
      outOfTargetDays,
    };
  };

  const getWeeklyInsight = () => {
    const summary = getWeeklySummary();
    const analyzedDays = history.slice(0, 7).length;
    return buildWeeklyInsight({
      summary,
      analyzedDays,
      profileData: profile,
    });
  };

  const getWeeklyMacroSummary = () => {
    const last7 = history.slice(0, 7);
    const macroTargets = getNutritionMacroTargets(plan, profile);

    if (!last7.length) {
      return {
        days: [],
        avgProtein: 0,
        avgCarbs: 0,
        avgFats: 0,
        avgCalories: 0,
        trainedDays: 0,
        lowProteinDays: 0,
        lowCarbDays: 0,
        highFatDays: 0,
        trainedWithLowProtein: 0,
        macroTargets,
        insight: '',
        analyzedDays: 0,
      };
    }

    let totalProtein = 0, totalCarbs = 0, totalFats = 0, totalCalories = 0;
    let trainedDays = 0, lowProteinDays = 0, lowCarbDays = 0, highFatDays = 0;
    let trainedWithLowProtein = 0;

    const days = last7.map((item) => {
      const p = Number(item.protein || 0);
      const c = Number(item.carbs || 0);
      const f = Number(item.fats || 0);
      const cal = Number(item.calories || 0);

      totalProtein += p;
      totalCarbs += c;
      totalFats += f;
      totalCalories += cal;

      const proteinStatus = classifyMacro(p, macroTargets.protein);
      const carbStatus = classifyMacro(c, macroTargets.carbs);
      const fatStatus = classifyMacro(f, macroTargets.fats);

      if (item.trained) trainedDays++;
      if (proteinStatus === 'baixo') lowProteinDays++;
      if (carbStatus === 'baixo') lowCarbDays++;
      if (fatStatus === 'alto') highFatDays++;
      if (item.trained && proteinStatus === 'baixo') trainedWithLowProtein++;

      return {
        date: item.date,
        calories: cal,
        protein: p,
        carbs: c,
        fats: f,
        trained: item.trained,
        status: item.status,
        proteinStatus,
        carbStatus,
        fatStatus,
      };
    });

    const n = last7.length;
    const avgProtein = round(totalProtein / n);
    const avgCarbs = round(totalCarbs / n);
    const avgFats = round(totalFats / n);
    const avgCalories = round(totalCalories / n);

    const insightParts = [];

    if (trainedWithLowProtein >= 2) {
      insightParts.push(
        `Voce treinou com proteina insuficiente ${trainedWithLowProtein} vez(es) esta semana — isso pode estar limitando sua recuperacao e ganho de forca.`
      );
    } else if (lowProteinDays >= 3) {
      insightParts.push(
        `Sua proteina esteve baixa em ${lowProteinDays} dos ${n} dias registrados. Aumentar esse macro acelera resultados.`
      );
    }

    if (lowCarbDays >= 3 && trainedDays >= 2) {
      insightParts.push(
        `Carbo baixo em dias de treino reduz energia disponivel e pode comprometer a performance.`
      );
    }

    if (highFatDays >= 3) {
      insightParts.push(
        `Gordura acima do ideal em ${highFatDays} dias pode estar deslocando calorias de proteina e carbo.`
      );
    }

    if (trainedDays === 0 && n >= 3) {
      insightParts.push(
        'Nenhum treino registrado nessa semana. Retome a consistencia para nao perder o progresso.'
      );
    } else if (trainedDays >= 4 && lowProteinDays <= 1) {
      insightParts.push(
        'Excelente: treino consistente e proteina em dia. Suas chances de evolucao estao altas!'
      );
    }

    if (!insightParts.length) {
      insightParts.push(
        'Continue assim! Seus macros e treinos estao dentro do esperado para esta semana.'
      );
    }

    return {
      days,
      avgProtein,
      avgCarbs,
      avgFats,
      avgCalories,
      trainedDays,
      lowProteinDays,
      lowCarbDays,
      highFatDays,
      trainedWithLowProtein,
      macroTargets,
      insight: insightParts.join(' '),
      analyzedDays: n,
    };
  };

  const getAutoAdjustmentSuggestion = () => {
    if (!plan || !profile) {
      return {
        canApply: false,
        message: 'Complete o questionario para liberar ajuste automatico.',
      };
    }

    const last7 = history.slice(0, 7);
    const analyzedDays = last7.length;

    if (analyzedDays < 3) {
      return {
        canApply: false,
        message: 'Registre ao menos 3 dias para gerar ajuste automatico seguro.',
      };
    }

    const summary = getWeeklySummary();
    const weeklyInsight = getWeeklyInsight();
    const expectedWeeklyDays = Number(profile.trainingDaysPerWeek || 3);
    const expectedInWindow = Math.max(1, round((expectedWeeklyDays / 7) * analyzedDays));
    const trainingGap = Math.max(0, expectedInWindow - summary.trainedDays);
    const belowDays = last7.filter((item) => item.status === 'abaixo').length;
    const aboveDays = last7.filter((item) => item.status === 'acima').length;

    let calorieDelta = 0;

    if (profile.goal === 'emagrecer') {
      if (aboveDays >= belowDays + 1) {
        calorieDelta -= 120;
      } else if (belowDays >= aboveDays + 2) {
        calorieDelta += 80;
      }
    } else if (profile.goal === 'ganhar_massa') {
      if (belowDays >= aboveDays + 1) {
        calorieDelta += 120;
      } else if (aboveDays >= belowDays + 2) {
        calorieDelta -= 80;
      }
    } else {
      if (aboveDays - belowDays >= 2) {
        calorieDelta -= 100;
      } else if (belowDays - aboveDays >= 2) {
        calorieDelta += 100;
      }
    }

    if (weeklyInsight.consistencyScore < 50) {
      calorieDelta = round(calorieDelta * 0.5);
    }

    calorieDelta = clamp(calorieDelta, -150, 150);
    const currentCalories = Number(plan.caloriesPerDay);
    const newCalories = clampCaloriesByStrategy(currentCalories + calorieDelta, plan.strategy);

    return {
      canApply: true,
      currentCalories,
      newCalories,
      calorieDelta: newCalories - currentCalories,
      trainingAdjustment: buildTrainingAdjustment({
        trainingGap,
        consistencyScore: weeklyInsight.consistencyScore,
      }),
      message:
        newCalories === currentCalories
          ? 'Plano calorico mantido. Ajuste principal da semana sera na consistencia de execucao.'
          : 'Ajuste calculado com limite seguro para a proxima semana.',
      generatedAt: getTodayKey(),
    };
  };

  const applyAutoPlanAdjustment = () => {
    const suggestion = getAutoAdjustmentSuggestion();

    if (!suggestion.canApply) {
      return suggestion;
    }

    setPlan((prev) => {
      if (!prev) {
        return prev;
      }

      return {
        ...prev,
        caloriesPerDay: suggestion.newCalories,
        weeklyTrainingAdjustment: suggestion.trainingAdjustment,
        lastAutoAdjustmentAt: suggestion.generatedAt,
      };
    });

    return suggestion;
  };

  const getTodayWorkout = () => {
    const base = getWorkoutBySplit(plan?.trainingSplit).map((exercise, index) => ({
      ...exercise,
      id: `${exercise.name}-${index}`,
      targetWeight: Number(exerciseTargets[exercise.name]?.targetWeight || 0),
    }));

    const pain = String(profile?.currentPain || profile?.pain || '');
    const catalog = getExerciseCatalogFromSources(workoutLogs);
    const adaptive = applyPainAdaptiveWorkout(base, pain, catalog);

    if (__DEV__ && adaptive.replacements.length) {
      console.log('match:', 'local');
      console.log('pain_adaptation:', adaptive.replacements.map((item) => `${item.from} -> ${item.to}`).join(' | '));
    }

    return adaptive.exercises;
  };

  const getSmartWorkoutRecommendation = () => {
    const todayKey = getTodayKey();
    const weeklyTarget = Number(profile?.trainingDaysPerWeek || 3);
    const pain = String(profile?.currentPain || profile?.pain || '');
    const cacheKey = `${todayKey}|${weeklyTarget}|${pain}|${workoutLogs.length}`;
    const cached = localDecisionCacheRef.current.workoutRecommendation[cacheKey];

    if (cached) {
      if (__DEV__) {
        console.log('match:', 'local-cache');
        console.log('recommendation:', cached.key, '| confidence:', cached.confidence);
      }
      return cached;
    }

    const result = getRecommendedWorkout({
      workoutLogs,
      weeklyTarget,
      pain,
      library: WORKOUT_LIBRARY,
      catalog: getExerciseCatalogFromSources(workoutLogs),
      todayKey,
    });

    const weeklyUrgency = buildWeeklyUrgency(weeklyTarget, result.trainedThisWeek);
    const recommendation = {
      key: result.key,
      title: result.title,
      confidence: result.confidence >= 0.85 ? 'alta' : result.confidence >= 0.65 ? 'media' : 'baixa',
      confidenceScore: result.confidence,
      source: result.source,
      decisionReasons: result.decisionReasons,
      replacements: result.replacements,
      justification: result.remainingToTarget > 0
        ? `Sugestao local para bater sua meta semanal com seguranca.`
        : `Sugestao local para manter progresso com boa recuperacao.`,
      blockedGroups: [],
      trainedThisWeek: result.trainedThisWeek,
      weeklyTarget,
      remainingToTarget: weeklyUrgency.remainingToTarget,
      isBehindWeek: result.trainedThisWeek < weeklyTarget,
      urgencyMessage: weeklyUrgency.urgencyMessage,
      exercises: result.exercises.map((exercise, index) => ({
        ...exercise,
        id: `smart-${exercise.name}-${index}`,
      })),
      debug: result.debug,
    };

    localDecisionCacheRef.current.workoutRecommendation[cacheKey] = recommendation;
    if (__DEV__) {
      console.log('match:', 'local');
      console.log('source:', recommendation.source, '| confidence:', recommendation.confidenceScore);
      console.log('exercise:', recommendation.exercises[0]?.name || 'none');
    }

    return recommendation;
  };

  const getRecommendedWorkoutV4 = () => {
    return getSmartWorkoutRecommendation();
  };

  const prepareTodayWorkoutTargets = () => {
    const today = getTodayKey();
    const todayWorkout = getWorkoutBySplit(plan?.trainingSplit);

    if (!todayWorkout.length) {
      return;
    }

    setExerciseTargets((prev) => {
      let hasChanged = false;
      const next = { ...prev };

      for (const exercise of todayWorkout) {
        const current = next[exercise.name] || {};

        if (current.lastAutoAppliedDate === today) {
          continue;
        }

        const suggestion = getExerciseProgressionSuggestion(exercise.name);

        if (suggestion.level === 'aumentar' || suggestion.level === 'reduzir') {
          next[exercise.name] = {
            targetWeight: suggestion.suggestedWeight,
            lastAutoAppliedDate: today,
            lastSuggestionLevel: suggestion.level,
          };
          hasChanged = true;
          continue;
        }

        if (!current.targetWeight && suggestion.suggestedWeight > 0) {
          next[exercise.name] = {
            ...current,
            targetWeight: suggestion.suggestedWeight,
          };
          hasChanged = true;
        }
      }

      return hasChanged ? next : prev;
    });
  };

  const saveWorkoutSet = ({ exerciseName, weight, reps, failed, rpe, mode = 'guided' }) => {
    const parsedWeight = Number(weight);
    const parsedReps = Number(reps);
    const parsedRpe = rpe == null || rpe === '' ? null : Number(rpe);

    if (!exerciseName || !parsedWeight || !parsedReps || parsedWeight < 0 || parsedReps <= 0) {
      return { ok: false, message: 'Informe peso e repeticoes validos.' };
    }

    if (parsedRpe != null && (!Number.isFinite(parsedRpe) || parsedRpe < 6 || parsedRpe > 10)) {
      return { ok: false, message: 'RPE deve ficar entre 6 e 10.' };
    }

    const todayKey = getTodayKey();
    const previousLogsForExercise = workoutLogs.filter((item) => item.exerciseName === exerciseName);
    const bestPreviousWeight = previousLogsForExercise
      .filter((item) => !item.failed)
      .reduce((best, item) => Math.max(best, Number(item.weight || 0)), 0);
    const isNewLoadPR = !failed && parsedWeight > bestPreviousWeight;

    let workoutCompletionXp = 0;
    const todayGuidedBefore = workoutLogs.filter(
      (item) => item.date === todayKey && (item.mode || 'guided') !== 'free'
    ).length;
    const plannedGuidedSets = getWorkoutBySplit(plan?.trainingSplit).reduce(
      (acc, item) => acc + Number(item.sets || 0),
      0
    );
    const willCompleteWorkoutToday =
      mode === 'guided' &&
      plannedGuidedSets > 0 &&
      todayGuidedBefore + 1 >= plannedGuidedSets &&
      gamification.lastWorkoutXpDate !== todayKey;

    if (willCompleteWorkoutToday) {
      workoutCompletionXp += XP_RULES.completeWorkout;
    }

    const consistencyBonusXp =
      willCompleteWorkoutToday &&
      gamification.lastWorkoutDate === getPreviousDateKey(todayKey) &&
      (Number(gamification.streakDays || 0) + 1) % 3 === 0
        ? XP_RULES.consistencyBonus
        : 0;

    const xpDelta =
      XP_RULES.completeSet +
      (isNewLoadPR ? XP_RULES.newLoadPR : 0) +
      workoutCompletionXp +
      consistencyBonusXp;

    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      date: todayKey,
      createdAt: new Date().toISOString(),
      exerciseName,
      weight: parsedWeight,
      reps: parsedReps,
      ...(parsedRpe != null ? { rpe: parsedRpe } : {}),
      failed: Boolean(failed),
      mode,
    };

    setWorkoutLogs((prev) => [entry, ...prev]);

    setExerciseTargets((prev) => ({
      ...prev,
      [exerciseName]: {
        ...(prev[exerciseName] || {}),
        targetWeight: parsedWeight,
      },
    }));

    setGamification((prev) => {
      const prevXp = Number(prev?.xp || 0);
      const previousDate = prev?.lastWorkoutDate || null;
      const isConsecutive = previousDate === getPreviousDateKey(todayKey);
      const sameDay = previousDate === todayKey;
      const nextStreak = willCompleteWorkoutToday
        ? sameDay
          ? Number(prev?.streakDays || 1)
          : isConsecutive
          ? Number(prev?.streakDays || 0) + 1
          : 1
        : Number(prev?.streakDays || 0);

      return {
        xp: prevXp + xpDelta,
        lastWorkoutXpDate: willCompleteWorkoutToday ? todayKey : prev?.lastWorkoutXpDate || null,
        streakDays: nextStreak,
        lastWorkoutDate: willCompleteWorkoutToday ? todayKey : previousDate,
      };
    });

    return {
      ok: true,
      xpDelta,
      isNewLoadPR,
      prWeightDelta: isNewLoadPR ? roundToStep(parsedWeight - bestPreviousWeight, 0.5) : 0,
      xpEvents: [
        `+${XP_RULES.completeSet} XP por serie concluida`,
        ...(isNewLoadPR ? [`+${XP_RULES.newLoadPR} XP por nova carga`] : []),
        ...(workoutCompletionXp ? [`+${workoutCompletionXp} XP por treino completo`] : []),
        ...(consistencyBonusXp ? [`+${consistencyBonusXp} XP bonus de consistencia`] : []),
      ],
    };
  };

  const getExerciseSetProgress = (exerciseName, plannedSets = 3) => {
    const today = getTodayKey();
    const todayExerciseLogs = workoutLogs.filter(
      (item) => item.date === today && item.exerciseName === exerciseName
    );
    const completedSets = todayExerciseLogs.length;
    const totalSets = Math.max(1, Number(plannedSets) || 1);
    const nextSet = Math.min(totalSets, completedSets + 1);

    return {
      completedSets,
      totalSets,
      nextSet,
      isDone: completedSets >= totalSets,
    };
  };

  const getExerciseCatalog = () => {
    return getExerciseCatalogFromSources(workoutLogs);
  };

  const getUserRoutines = () => {
    return Array.isArray(userRoutines) ? userRoutines : [];
  };

  const createUserRoutine = ({ name, frequency = 3, exercises = [] }) => {
    const safeName = String(name || '').trim();
    if (!safeName) {
      return { ok: false, message: 'Informe um nome para a rotina.' };
    }

    const cleanedExercises = Array.isArray(exercises)
      ? exercises.map((item) => String(item || '').trim()).filter(Boolean)
      : [];

    if (!cleanedExercises.length) {
      return { ok: false, message: 'Adicione ao menos um exercicio.' };
    }

    const routine = {
      id: `routine-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: safeName,
      frequency: Math.max(1, Number(frequency || 3)),
      exercises: cleanedExercises,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setUserRoutines((prev) => [routine, ...prev]);
    return { ok: true, routine, message: 'Rotina criada com sucesso.' };
  };

  const updateUserRoutine = ({ routineId, name, frequency, exercises }) => {
    let updatedRoutine = null;

    setUserRoutines((prev) =>
      prev.map((item) => {
        if (item.id !== routineId) {
          return item;
        }

        const nextName = String(name || item.name || '').trim();
        const nextFrequency = Math.max(1, Number(frequency || item.frequency || 3));
        const nextExercises = Array.isArray(exercises)
          ? exercises.map((entry) => String(entry || '').trim()).filter(Boolean)
          : item.exercises;

        updatedRoutine = {
          ...item,
          name: nextName,
          frequency: nextFrequency,
          exercises: nextExercises,
          updatedAt: new Date().toISOString(),
        };

        return updatedRoutine;
      })
    );

    if (!updatedRoutine) {
      return { ok: false, message: 'Rotina nao encontrada.' };
    }

    return { ok: true, routine: updatedRoutine, message: 'Rotina atualizada.' };
  };

  const duplicateUserRoutine = (routineId) => {
    const source = userRoutines.find((item) => item.id === routineId);
    if (!source) {
      return { ok: false, message: 'Rotina nao encontrada para duplicar.' };
    }

    return createUserRoutine({
      name: `${source.name} (copia)`,
      frequency: source.frequency,
      exercises: source.exercises,
    });
  };

  const reorderUserRoutineExercises = ({ routineId, fromIndex, toIndex }) => {
    let updatedRoutine = null;

    setUserRoutines((prev) =>
      prev.map((item) => {
        if (item.id !== routineId) {
          return item;
        }

        const list = Array.isArray(item.exercises) ? [...item.exercises] : [];
        if (
          !list.length ||
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= list.length ||
          toIndex >= list.length
        ) {
          return item;
        }

        const [moved] = list.splice(fromIndex, 1);
        list.splice(toIndex, 0, moved);

        updatedRoutine = {
          ...item,
          exercises: list,
          updatedAt: new Date().toISOString(),
        };

        return updatedRoutine;
      })
    );

    if (!updatedRoutine) {
      return { ok: false, message: 'Nao foi possivel reordenar essa rotina.' };
    }

    return { ok: true, routine: updatedRoutine, message: 'Exercicios reordenados.' };
  };

  const deleteUserRoutine = (routineId) => {
    const exists = userRoutines.some((item) => item.id === routineId);
    if (!exists) {
      return { ok: false, message: 'Rotina nao encontrada para remover.' };
    }

    setUserRoutines((prev) => prev.filter((item) => item.id !== routineId));
    return { ok: true, message: 'Rotina removida.' };
  };

  const getWorkoutTemplates = () => {
    const titles = {
      fullBody: 'Full Body',
      upper: 'Upper',
      lower: 'Lower',
      push: 'Push',
      pull: 'Pull',
      legs: 'Legs',
    };

    return Object.entries(WORKOUT_LIBRARY).map(([key, exercises]) => ({
      key,
      name: titles[key] || key,
      exercises: exercises.map((item) => ({
        name: item.name,
        sets: Number(item.sets || 3),
        reps: String(item.reps || '8-12'),
      })),
    }));
  };

  const createRoutineFromTemplate = ({ templateKey, name, frequency }) => {
    const templates = getWorkoutTemplates();
    const template = templates.find((item) => item.key === templateKey);
    if (!template) {
      return { ok: false, message: 'Template nao encontrado.' };
    }

    return createUserRoutine({
      name: name || `Template ${template.name}`,
      frequency: Number(frequency || profile?.trainingDaysPerWeek || 3),
      exercises: template.exercises.map((item) => item.name),
    });
  };

  const saveTodayWorkoutAsRoutine = ({ name, frequency } = {}) => {
    const todayWorkout = getTodayWorkout();
    if (!todayWorkout.length) {
      return { ok: false, message: 'Nao ha treino definido para hoje.' };
    }

    return createUserRoutine({
      name: name || `Treino ${getTodayKey()}`,
      frequency: Number(frequency || profile?.trainingDaysPerWeek || 3),
      exercises: todayWorkout.map((item) => item.name),
    });
  };

  const getExerciseHistorySnapshot = (exerciseName, limit = 6) => {
    const safeLimit = Math.max(1, Number(limit || 6));
    return workoutLogs
      .filter((item) => item.exerciseName === exerciseName)
      .slice(0, safeLimit)
      .reverse()
      .map((item) => ({
        date: item.date,
        weight: Number(item.weight || 0),
        reps: Number(item.reps || 0),
        rpe: item.rpe != null ? Number(item.rpe) : null,
        failed: Boolean(item.failed),
      }));
  };

  const getExercisesByMuscleGroup = (groupKey) => {
    const normalized = String(groupKey || '').toLowerCase();
    const catalog = getExerciseCatalogFromSources(workoutLogs);

    const filters = {
      peito: ['supino', 'crucifixo', 'peck'],
      costas: ['remada', 'puxada', 'pull'],
      perna: ['agachamento', 'leg press', 'stiff', 'panturrilha', 'extensora', 'flexora', 'passada', 'terra'],
      ombro: ['desenvolvimento', 'elevacao'],
      triceps: ['triceps', 'supino'],
      biceps: ['rosca', 'biceps', 'puxada'],
    };

    const keywords = filters[normalized] || [];
    if (!keywords.length) {
      return catalog;
    }

    return catalog.filter((name) => {
      const lowerName = String(name || '').toLowerCase();
      return keywords.some((keyword) => lowerName.includes(keyword));
    });
  };

  const getFreeWorkoutSuggestions = (selectedExercises = []) => {
    const normalized = Array.isArray(selectedExercises) ? selectedExercises : [];
    const used = new Set(normalized);
    const groups = Array.from(
      new Set(normalized.map((name) => inferMuscleGroup(name)).filter(Boolean))
    );
    const catalog = getExerciseCatalogFromSources(workoutLogs);
    const suggestions = [];

    for (const group of groups) {
      const defaults = MUSCLE_SUGGESTION_MAP[group] || [];
      for (const name of defaults) {
        if (!used.has(name) && !suggestions.includes(name)) {
          suggestions.push(name);
        }
      }
    }

    for (const item of catalog) {
      if (suggestions.length >= 5) {
        break;
      }

      if (!used.has(item) && !suggestions.includes(item)) {
        suggestions.push(item);
      }
    }

    return suggestions.slice(0, 5);
  };

  const saveFreeWorkoutSet = ({ exerciseName, weight, reps, failed }) => {
    const result = saveWorkoutSet({ exerciseName, weight, reps, failed, mode: 'free' });

    if (!result.ok) {
      return result;
    }

    setWorkoutLogs((prev) => {
      if (!prev.length) {
        return prev;
      }

      const [latest, ...rest] = prev;
      return [{ ...latest, mode: 'free' }, ...rest];
    });

    return result;
  };

  const removeTodayWorkoutSet = ({ exerciseName, setIndex, mode = 'guided' }) => {
    const today = getTodayKey();
    const normalizedMode = mode || 'guided';
    let removed = false;

    setWorkoutLogs((prev) => {
      const todayExerciseLogs = prev
        .filter(
          (item) =>
            item.date === today &&
            item.exerciseName === exerciseName &&
            (item.mode || 'guided') === normalizedMode
        )
        .sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));

      const selected = todayExerciseLogs[setIndex];
      if (!selected) {
        return prev;
      }

      removed = true;
      return prev.filter((item) => item.id !== selected.id);
    });

    if (!removed) {
      return { ok: false, message: 'Serie nao encontrada para remover.' };
    }

    return { ok: true, message: 'Serie removida com sucesso.' };
  };

  const getExerciseProgress = (exerciseName) => {
    const logs = workoutLogs.filter((item) => item.exerciseName === exerciseName);

    if (!logs.length) {
      return {
        bestWeight: 0,
        totalSets: 0,
        recentAverageReps: 0,
      };
    }

    const successful = logs.filter((item) => !item.failed);
    const recent = successful.slice(0, 5);
    const totalReps = recent.reduce((acc, item) => acc + Number(item.reps || 0), 0);

    return {
      bestWeight: successful.length
        ? Math.max(...successful.map((item) => Number(item.weight || 0)))
        : 0,
      totalSets: logs.length,
      recentAverageReps: recent.length ? round(totalReps / recent.length) : 0,
    };
  };

  const getExerciseProgressionSuggestion = (exerciseName) => {
    const logs = workoutLogs.filter((item) => item.exerciseName === exerciseName);
    const template = getExerciseTemplate(exerciseName);
    const repRange = parseRepRange(template?.reps);
    const step = getProgressionStep(exerciseName);

    const withFallback = (partial) => ({
      confidence: buildConfidence(logs.length, logs.slice(0, 3)),
      reason: partial.message,
      ...partial,
    });

    if (!logs.length) {
      const starter = getDefaultStartingWeight(exerciseName, profile?.level);
      return {
        level: 'sem_dados',
        suggestedWeight: starter,
        delta: 0,
        confidence: 'baixa',
        message: 'Primeiro uso deste exercicio. Carga inicial sugerida com foco em tecnica.',
        reason: 'Sem historico anterior.',
      };
    }

    const recent = logs.slice(0, 6);
    const recentSuccess = recent.filter((item) => !item.failed);
    const last3 = recent.slice(0, 3);
    const last3WithRpe = last3.filter((item) => Number.isFinite(Number(item.rpe)));
    const last3AvgRpe = last3WithRpe.length
      ? Number((last3WithRpe.reduce((acc, item) => acc + Number(item.rpe || 0), 0) / last3WithRpe.length).toFixed(1))
      : null;
    const failInLast3 = last3.filter((item) => item.failed).length;
    const successInLast3 = last3.filter((item) => !item.failed).length;
    const reference = Number((recentSuccess[0] || recent[0]).weight || 0);

    const v4Suggestion = getNextWeightSuggestion({
      exerciseName,
      logs,
      currentWeight: reference,
      repsHit: Number((recentSuccess[0] || recent[0])?.reps || 0),
      targetRepMax: repRange.max,
    });

    if (!reference || reference <= 0) {
      const starter = getDefaultStartingWeight(exerciseName, profile?.level);
      return {
        level: 'sem_dados',
        suggestedWeight: starter,
        delta: 0,
        confidence: 'baixa',
        message: 'Carga anterior invalida. Usando valor inicial seguro.',
        reason: 'Historico sem carga valida.',
      };
    }

    if (last3.length < 3) {
      return withFallback({
        level: 'manter',
        suggestedWeight: roundToStep(reference),
        delta: 0,
        message: 'Mais alguns registros sao necessarios para ajustar com seguranca.',
      });
    }

    if (failInLast3 >= 2 || (last3AvgRpe != null && last3AvgRpe >= 9.5)) {
      const suggested = Math.max(5, roundToStep(v4Suggestion.suggestedWeight || (reference - step)));
      return withFallback({
        level: 'reduzir',
        suggestedWeight: suggested,
        delta: roundToStep(suggested - reference),
        source: v4Suggestion.source,
        confidenceScore: v4Suggestion.confidence,
        message: last3AvgRpe != null && last3AvgRpe >= 9.5
          ? 'RPE medio muito alto. Reduza carga para manter qualidade e recuperar melhor.'
          : 'Houve falhas recentes. Reduza carga para manter tecnica e diminuir risco.',
      });
    }

    if (successInLast3 === 3) {
      const last3AvgReps = round(
        last3.reduce((acc, item) => acc + Number(item.reps || 0), 0) / successInLast3
      );

      if (last3AvgReps >= repRange.max && (last3AvgRpe == null || last3AvgRpe <= 8.5)) {
        const suggested = roundToStep(v4Suggestion.suggestedWeight || (reference + step));
        return withFallback({
          level: 'aumentar',
          suggestedWeight: suggested,
          delta: roundToStep(suggested - reference),
          source: v4Suggestion.source,
          confidenceScore: v4Suggestion.confidence,
          message: `Boa consistencia${last3AvgRpe != null ? ` com RPE medio ${last3AvgRpe}` : ''}. Sugestao de progressao leve para proxima sessao.`,
        });
      }

      if (last3AvgRpe != null && last3AvgRpe > 8.5) {
        return withFallback({
          level: 'manter',
          suggestedWeight: roundToStep(reference),
          delta: 0,
          message: `Carga mantida: RPE medio ${last3AvgRpe} indica alta intensidade no momento.`,
        });
      }
    }

    return withFallback({
      level: 'manter',
      suggestedWeight: roundToStep(v4Suggestion.suggestedWeight || reference),
      delta: 0,
      source: v4Suggestion.source,
      confidenceScore: v4Suggestion.confidence,
      message: 'Mantenha a carga e busque estabilidade de repeticoes antes de subir peso.',
    });
  };

  const getPainAwareExerciseOptions = (painText = '') => {
    const catalog = getExerciseCatalogFromSources(workoutLogs);
    const asExercises = catalog.map((name) => ({ name }));
    const adapted = adaptWorkoutForPain(asExercises, painText);
    return adapted.map((item) => item.name);
  };

  const getTodayWorkoutSummary = () => {
    const today = getTodayKey();
    const todayLogs = workoutLogs.filter((item) => item.date === today);
    const todayGuidedLogs = todayLogs.filter((item) => (item.mode || 'guided') !== 'free');
    const plannedSets = getWorkoutBySplit(plan?.trainingSplit).reduce(
      (acc, item) => acc + Number(item.sets || 0),
      0
    );
    const uniqueExercises = new Set(todayLogs.map((item) => item.exerciseName));

    return {
      totalSets: todayLogs.length,
      totalExercises: uniqueExercises.size,
      guidedSets: todayGuidedLogs.length,
      plannedSets,
      completionRate: plannedSets ? clamp(todayGuidedLogs.length / plannedSets, 0, 1) : 0,
    };
  };

  const getWorkoutGamification = () => {
    const xp = Number(gamification.xp || 0);
    const level = getLevelFromXp(xp);
    const currentLevelBaseXp = (level - 1) * XP_RULES.xpPerLevel;
    const nextLevelXp = level * XP_RULES.xpPerLevel;
    const xpInLevel = xp - currentLevelBaseXp;
    const xpNeeded = nextLevelXp - currentLevelBaseXp;

    return {
      xp,
      level,
      levelLabel: getLevelLabel(level),
      streakDays: Number(gamification.streakDays || 0),
      xpInLevel,
      xpNeeded,
      progress: xpNeeded ? clamp(xpInLevel / xpNeeded, 0, 1) : 0,
    };
  };

  const estimateNutritionFromText = (inputText) => {
    return estimateNutritionFromTextInput(inputText);
  };

  const estimateNutritionFromPhotoHint = ({ description, portionFactor = 1 }) => {
    return estimateNutritionFromPhotoHintInput(description, portionFactor);
  };

  const getDailyMacroTargets = () => {
    return getNutritionMacroTargets(plan, profile);
  };

  const getNutritionFeedback = ({ proteinConsumed, caloriesConsumed, trainedToday } = {}) => {
    const macroTargets = getNutritionMacroTargets(plan, profile);
    const todayTotals = sumNutritionTotals(getTodayFoodLog());
    const todayWorkout = getTodayWorkoutSummary();

    const safeProteinConsumed = Number(
      proteinConsumed != null ? proteinConsumed : Number(todayTotals.protein || 0)
    );
    const safeCaloriesConsumed = Number(
      caloriesConsumed != null ? caloriesConsumed : Number(todayTotals.calories || 0)
    );
    const proteinGoal = Number(macroTargets?.protein || 0);
    const caloriesGoal = Number(macroTargets?.calories || 0);
    const didTrainToday =
      trainedToday != null
        ? Boolean(trainedToday)
        : Number(todayWorkout?.guidedSets || 0) > 0;

    const missingProtein = Math.max(0, Math.round(proteinGoal - safeProteinConsumed));
    const proteinRatio = proteinGoal > 0 ? safeProteinConsumed / proteinGoal : 0;
    const caloriesRatio = caloriesGoal > 0 ? safeCaloriesConsumed / caloriesGoal : 0;

    let suggestion = 'Sugestao: 1 iogurte + 1 ovo';
    if (missingProtein > 45) {
      suggestion = 'Sugestao: 150g frango + 1 whey';
    } else if (missingProtein > 30) {
      suggestion = 'Sugestao: 150g frango + 1 iogurte';
    } else if (missingProtein > 20) {
      suggestion = 'Sugestao: 1 whey + 1 ovo';
    }

    if (missingProtein <= 0) {
      return {
        tone: 'success',
        title: 'Meta de proteina batida hoje 🔥',
        message: didTrainToday
          ? 'Excelente timing para recuperacao muscular apos o treino.'
          : 'Otimo trabalho de consistencia nutricional no dia.',
        suggestion: 'Mantenha refeicoes limpas e hidratacao para fechar o dia forte.',
        missingProtein: 0,
      };
    }

    if (caloriesRatio >= 0.9 && proteinRatio < 0.75) {
      return {
        tone: 'warning',
        title: `Faltam ${missingProtein}g de proteina hoje`,
        message: 'Calorias no teto, mas proteina baixa. Priorize fonte limpa agora para proteger resultado.',
        suggestion,
        missingProtein,
      };
    }

    return {
      tone: didTrainToday ? 'priority' : 'default',
      title: `Faltam ${missingProtein}g de proteina hoje`,
      message: didTrainToday
        ? 'Voce treinou hoje. Priorize proteina agora para acelerar recuperacao e performance.'
        : 'Ainda da para bater a meta com uma refeicao simples e rapida.',
      suggestion,
      missingProtein,
    };
  };

  const getPerformanceScore = () => {
    const last7 = history.slice(0, 7);
    const n = last7.length;
    if (!n) {
      return { score: 0, training: 0, diet: 0, consistency: 0, label: 'Sem dados', maxTraining: 40, maxDiet: 35, maxConsistency: 25 };
    }
    const gamif = getWorkoutGamification();
    const expectedDays = Number(profile?.trainingDaysPerWeek || 3);
    const expectedInWindow = Math.max(1, round((expectedDays / 7) * 7));
    const trainedDays = last7.filter((h) => h.trained).length;
    const trainingScore = Math.round(clamp(trainedDays / expectedInWindow, 0, 1) * 40);
    const macroTargets = getNutritionMacroTargets(plan, profile);
    let dietPoints = 0;
    last7.forEach((h) => {
      const pRatio = macroTargets.protein ? clamp(Number(h.protein || 0) / macroTargets.protein, 0, 1.2) : 0;
      const calRatio = plan?.caloriesPerDay ? clamp(Number(h.calories || 0) / plan.caloriesPerDay, 0, 1.2) : 0;
      dietPoints += (pRatio + calRatio) / 2;
    });
    const dietScore = Math.round(clamp(dietPoints / n, 0, 1) * 35);
    const daysLoggedRatio = clamp(n / 7, 0, 1);
    const streakFactor = clamp(gamif.streakDays / 7, 0, 1);
    const consistencyScore = Math.round(((daysLoggedRatio * 0.6) + (streakFactor * 0.4)) * 25);
    const totalScore = trainingScore + dietScore + consistencyScore;
    let label;
    if (totalScore >= 85) label = 'Elite';
    else if (totalScore >= 70) label = 'Forte';
    else if (totalScore >= 50) label = 'Em evolucao';
    else if (totalScore >= 30) label = 'Iniciando';
    else label = 'Pouco dados';
    return { score: totalScore, training: trainingScore, diet: dietScore, consistency: consistencyScore, label, maxTraining: 40, maxDiet: 35, maxConsistency: 25 };
  };

  const getAutoCoachSuggestions = () => {
    const weeklyMacro = getWeeklyMacroSummary();
    const { avgProtein, avgCarbs, avgFats, trainedDays, lowProteinDays, lowCarbDays, highFatDays, trainedWithLowProtein, macroTargets, analyzedDays } = weeklyMacro;
    if (analyzedDays < 3) {
      return { hasData: false, message: 'Registre ao menos 3 dias para o Auto Coach agir.', suggestions: [] };
    }
    const overrides = plan?.macroOverrides || {};
    const suggestions = [];
    if (lowProteinDays >= 3 || trainedWithLowProtein >= 2) {
      const currentTarget = overrides.protein != null ? overrides.protein : macroTargets.protein;
      const newTarget = Math.round(currentTarget * 1.1);
      suggestions.push({
        id: 'protein_up',
        icon: '💪',
        title: 'Aumentar meta de proteina',
        reason: trainedWithLowProtein >= 2
          ? `Voce treinou ${trainedWithLowProtein}x com proteina insuficiente esta semana. Sua recuperacao e ganho de forca podem estar comprometidos.`
          : `Proteina abaixo da meta em ${lowProteinDays} de ${analyzedDays} dias registrados.`,
        action: `Meta vai de ${Math.round(currentTarget)}g → ${newTarget}g por dia (+${newTarget - Math.round(currentTarget)}g)`,
        payload: { protein: newTarget },
      });
    }
    if (lowCarbDays >= 3 && trainedDays >= 2) {
      const currentTarget = overrides.carbs != null ? overrides.carbs : macroTargets.carbs;
      const newTarget = Math.round(currentTarget * 1.1);
      suggestions.push({
        id: 'carbs_up',
        icon: '⚡',
        title: 'Ajustar carboidrato para treinos',
        reason: `Carbo abaixo do ideal em ${lowCarbDays} dias com ${trainedDays} treinos na semana. Isso reduz energia disponivel para performance.`,
        action: `Meta vai de ${Math.round(currentTarget)}g → ${newTarget}g por dia (+${newTarget - Math.round(currentTarget)}g)`,
        payload: { carbs: newTarget },
      });
    }
    if (highFatDays >= 3) {
      const currentTarget = overrides.fats != null ? overrides.fats : macroTargets.fats;
      const newTarget = Math.round(currentTarget * 0.9);
      suggestions.push({
        id: 'fats_down',
        icon: '🎯',
        title: 'Reduzir gordura',
        reason: `Gordura acima do ideal em ${highFatDays} dias. Pode estar deslocando calorias de proteina e carbo.`,
        action: `Meta vai de ${Math.round(currentTarget)}g → ${newTarget}g por dia (${newTarget - Math.round(currentTarget)}g)`,
        payload: { fats: newTarget },
      });
    }
    if (trainedDays === 0 && analyzedDays >= 3) {
      suggestions.push({
        id: 'training_alert',
        icon: '🏋️',
        title: 'Nenhum treino registrado',
        reason: `Voce nao registrou nenhum treino nos ultimos ${analyzedDays} dias. A consistencia e o fator mais importante para evolucao.`,
        action: 'Acesse Treino PRO ou Treino Livre para iniciar hoje',
        payload: null,
      });
    }
    const applied = plan?.macroOverrides?.lastAppliedAt;
    return { hasData: true, suggestions, applied, weeklyMacro };
  };

  const applyMacroOverride = (payload) => {
    if (!payload) return;
    setPlan((prev) => ({
      ...prev,
      macroOverrides: {
        ...(prev?.macroOverrides || {}),
        ...payload,
        lastAppliedAt: getTodayKey(),
      },
    }));
  };

  const getDailyMissions = () => {
    const todayKey = getTodayKey();
    const completed = gamification.completedMissions?.[todayKey] || [];
    const todayHistory = history.find((h) => h.date === todayKey);
    const macroTargets = getNutritionMacroTargets(plan, profile);
    const todayLogs = workoutLogs.filter((l) => l.date === todayKey);
    const gamif = getWorkoutGamification();
    const missions = [
      {
        id: 'hit_protein_today',
        icon: '🥩',
        title: 'Bater proteina hoje',
        description: `Consumir ${Math.round(macroTargets.protein)}g de proteina`,
        xpReward: 20,
        completed: completed.includes('hit_protein_today'),
        type: 'nutrition',
      },
      {
        id: 'complete_workout_today',
        icon: '🏋️',
        title: 'Completar treino hoje',
        description: 'Registrar ao menos 3 series no treino de hoje',
        xpReward: 30,
        completed: completed.includes('complete_workout_today') || todayLogs.length >= 3,
        type: 'workout',
      },
      {
        id: 'log_day_today',
        icon: '📊',
        title: 'Analisar o dia hoje',
        description: 'Registrar calorias e macros do dia na analise diaria',
        xpReward: 15,
        completed: completed.includes('log_day_today') || Boolean(todayHistory),
        type: 'consistency',
      },
    ];
    if (gamif.streakDays >= 2) {
      missions.push({
        id: 'keep_streak',
        icon: '🔥',
        title: `Manter streak de ${gamif.streakDays + 1} dias`,
        description: 'Treinar hoje para manter o streak ativo',
        xpReward: 25,
        completed: completed.includes('keep_streak') || todayLogs.length >= 1,
        type: 'streak',
      });
    }
    return missions;
  };

  const completeMission = (missionId, xpReward) => {
    const todayKey = getTodayKey();
    setGamification((prev) => {
      const prevCompleted = prev.completedMissions?.[todayKey] || [];
      if (prevCompleted.includes(missionId)) return prev;
      return {
        ...prev,
        xp: Number(prev.xp || 0) + Number(xpReward || 10),
        completedMissions: {
          ...(prev.completedMissions || {}),
          [todayKey]: [...prevCompleted, missionId],
        },
      };
    });
  };

  return(
    <AppContext.Provider
      value={{
        user,
        setUser,
        profile,
        plan,
        history,
        nutritionLogs,
        workoutLogs,
        exerciseTargets,
        gamification,
        monetization,
        hasCompletedQuestionnaire,
        isHydrated,
        saveQuestionnaire,
        updateProfileSettings,
        resetQuestionnaire,
        analyzeDay,
        getRecentHistory,
        getWeeklySummary,
        getWeeklyInsight,
        getAutoAdjustmentSuggestion,
        applyAutoPlanAdjustment,
        getTodayWorkout,
        getSmartWorkoutRecommendation,
        getRecommendedWorkoutV4,
        prepareTodayWorkoutTargets,
        saveWorkoutSet,
        saveFreeWorkoutSet,
        getExerciseProgress,
        getExerciseProgressionSuggestion,
        getPainAwareExerciseOptions,
        getTodayWorkoutSummary,
        getExerciseSetProgress,
        getExerciseCatalog,
        getUserRoutines,
        createUserRoutine,
        updateUserRoutine,
        duplicateUserRoutine,
        reorderUserRoutineExercises,
        deleteUserRoutine,
        getWorkoutTemplates,
        createRoutineFromTemplate,
        saveTodayWorkoutAsRoutine,
        getExercisesByMuscleGroup,
        getFreeWorkoutSuggestions,
        getWorkoutGamification,
        getExerciseHistorySnapshot,
        estimateNutritionFromText,
        estimateNutritionFromPhotoHint,
        getDailyMacroTargets,
        getNutritionFeedback,
        getWeeklyMacroSummary,
        getPerformanceScore,
        getAutoCoachSuggestions,
        applyMacroOverride,
        getDailyMissions,
        completeMission,
        buildDailyCoachState,
        buildCoachMessage,
        getWorkoutDelta,
        saveNutritionEntry,
        searchFoodCatalog,
        addFoodLogEntry,
        addFoodLogEntriesBatch,
        removeFoodLogEntry,
        getTodayFoodLog,
        evaluateMealQuality,
        addWaterIntake,
        getSubscriptionStatus,
        hasFeatureAccess,
        startProTrial,
        activateProPlan,
        removeTodayWorkoutSet,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp=()=>useContext(AppContext);
