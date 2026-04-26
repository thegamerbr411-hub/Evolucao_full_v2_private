import { getFoodCatalog } from '../../data/nutritionDatabase';
import {
  SCREENS,
  trackEvent,
  getAnalyticsSnapshot,
  saveProductMetricsSnapshot,
  getProductMetricsSnapshotHistory,
  getProductMetricsSnapshot,
} from '../../utils/analytics';
import { sendIntelligentNotification } from '../../utils/notifications';
import { logError } from '../../core/logger';
import { getLevelFromXp } from '../../services/gamificationEngine';
import { estimateNutritionFromTextInput } from './nutrition';
import { getCanonicalFoodData as _getCanonicalFoodData } from './nutrition';
import {
  getWeekBounds,
  filterLogsByExercise,
  resolveExerciseIdentity,
  getExerciseTemplate,
  parseRepRange,
  getProgressionStep,
  buildConfidence,
  getDefaultStartingWeight,
  getNextWeightSuggestion,
} from './workout';

export { buildWeeklyUrgency, buildDailyCoachState } from './coachRules';
export { buildCoachMessage } from './coachMessages';

export {
  SCREENS,
  trackEvent,
  sendIntelligentNotification,
  getAnalyticsSnapshot,
  saveProductMetricsSnapshot,
  getProductMetricsSnapshotHistory,
  getProductMetricsSnapshot,
  logError,
  getLevelFromXp,
};

export const CALORIE_RANGES = {
  cutting: { min: 1200, max: 2500 },
  bulking: { min: 2000, max: 3500 },
  recomposicao: { min: 1800, max: 2800 },
};

export const XP_RULES = {
  completeSet: 5,
  newLoadPR: 20,
  completeWorkout: 50,
  consistencyBonus: 30,
  xpPerLevel: 300,
};

export const FOOD_CATALOG = getFoodCatalog();

export const FRACTION_WORDS = {
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

export const NUTRITION_SYNONYMS = {
  mussarela: 'queijo mussarela',
  muzarela: 'queijo mussarela',
  'queijo mussarela': 'queijo mussarela',
  paozinho: 'pao frances',
  pao: 'pao',
  ovos: 'ovo',
  'ovo inteiro': 'ovo inteiro',
};

export const MUSCLE_SUGGESTION_MAP = {
  peito: ['Triceps Corda Polia', 'Triceps Testa Barra EZ', 'Desenvolvimento Militar Halter'],
  costas: ['Rosca Direta Barra', 'Rosca Martelo Halter', 'Face Pull Polia'],
  perna: ['Cadeira Extensora', 'Cadeira Flexora', 'Panturrilha em Pe'],
  ombro: ['Elevacao Lateral Halter', 'Desenvolvimento Militar Halter', 'Face Pull Polia'],
  triceps: ['Supino Reto Barra', 'Supino Inclinado Halter', 'Desenvolvimento Militar Barra'],
  biceps: ['Puxada Frontal Polia', 'Remada Curvada Barra', 'Rosca Martelo Halter'],
};

export const getLevelLabel = (level = 1) => {
  if (level >= 12) return 'Elite';
  if (level >= 8) return 'Avancado';
  if (level >= 4) return 'Intermediario';
  return 'Iniciante';
};

export const clampCaloriesByStrategy = (calories, strategy = 'recomposicao') => {
  const range = CALORIE_RANGES[strategy] || CALORIE_RANGES.recomposicao;
  const safeCalories = Number(calories || 0);
  return Math.max(range.min, Math.min(range.max, safeCalories));
};

export const normalizeTimezone = (value) => {
  const candidate = String(value || '').trim();
  if (!candidate) return 'UTC';

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'UTC';
  }
};

export const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

export const estimateNutritionFromPhotoHintInput = (description, portionFactor = 1) =>
  estimateNutritionFromTextInput(String(description || ''), Number(portionFactor || 1));

export const buildWeeklyMacroProgress = (history = [], target = {}) => {
  const totals = Array.isArray(history)
    ? history.reduce(
        (acc, item) => ({
          calories: acc.calories + Number(item?.calories || 0),
          protein: acc.protein + Number(item?.protein || 0),
          carbs: acc.carbs + Number(item?.carbs || 0),
          fat: acc.fat + Number(item?.fat || 0),
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
      )
    : { calories: 0, protein: 0, carbs: 0, fat: 0 };

  const safeDays = Math.max(1, Array.isArray(history) ? history.length : 1);

  const avg = {
    calories: Math.round(totals.calories / safeDays),
    protein: Math.round(totals.protein / safeDays),
    carbs: Math.round(totals.carbs / safeDays),
    fat: Math.round(totals.fat / safeDays),
  };

  const percent = (value, goal) => {
    const g = Number(goal || 0);
    if (!g) return 0;
    return Math.round((Number(value || 0) / g) * 100);
  };

  return {
    average: avg,
    progress: {
      calories: percent(avg.calories, target.calories),
      protein: percent(avg.protein, target.protein),
      carbs: percent(avg.carbs, target.carbs),
      fat: percent(avg.fat, target.fat),
    },
  };
};

export { getWeekBounds };

export const getCanonicalFoodData = _getCanonicalFoodData;

const roundToStep = (value, step = 2.5) => Math.round(value / step) * step;

export function getExerciseProgressionSuggestion({ exerciseName = '', workoutLogs = [], profile = {} } = {}) {
  const identity = resolveExerciseIdentity(exerciseName, null);
  const logs = filterLogsByExercise(workoutLogs, identity);
  const template = getExerciseTemplate(exerciseName);
  const repRange = parseRepRange(template?.reps);
  const step = getProgressionStep(exerciseName);

  const withFallback = (partial) => ({
    confidence: buildConfidence({ logsCount: logs.length, hasTemplate: Boolean(template) }),
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
      message: last3AvgRpe != null && last3AvgRpe >= 9.5
        ? 'RPE medio muito alto. Reduza carga para manter qualidade e recuperar melhor.'
        : 'Houve falhas recentes. Reduza carga para manter tecnica e diminuir risco.',
    });
  }

  if (successInLast3 === 3) {
    const last3AvgReps = Math.round(
      last3.reduce((acc, item) => acc + Number(item.reps || 0), 0) / successInLast3
    );

    if (last3AvgReps >= repRange.max && (last3AvgRpe == null || last3AvgRpe <= 8.5)) {
      const suggested = roundToStep(v4Suggestion.suggestedWeight || (reference + step));
      return withFallback({
        level: 'aumentar',
        suggestedWeight: suggested,
        delta: roundToStep(suggested - reference),
        source: v4Suggestion.source,
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
    message: 'Mantenha a carga e busque estabilidade de repeticoes antes de subir peso.',
  });
}
