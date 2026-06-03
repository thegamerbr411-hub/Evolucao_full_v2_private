import { getMacroTargetsUseCase } from '../domains/nutrition/useCases/getMacroTargets.js';

function getMacroTargetsFromPlanProfile(plan = {}, profile = {}) {
  const calories = Number(plan?.calories || plan?.caloriesPerDay || 0);
  const weight = Number(profile?.currentWeight || profile?.weight || 70);
  const goal = String(profile?.goal || plan?.goal || '').trim();
  const overrides = plan?.overrides && typeof plan.overrides === 'object' ? plan.overrides : {};
  const targets = getMacroTargetsUseCase({ calories, weight, goal, overrides });
  if (!targets || targets.error) {
    return { calories: 0, protein: 0, carbs: 0, fats: 0 };
  }
  return targets;
}

function sumNutritionTotals(logs = []) {
  const safe = Array.isArray(logs) ? logs : [];
  return safe.reduce(
    (acc, item) => ({
      calories: acc.calories + Number(item?.calories || 0),
      protein: acc.protein + Number(item?.protein || 0),
      carbs: acc.carbs + Number(item?.carbs || 0),
      fats: acc.fats + Number(item?.fats || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );
}

/** Calendar day key YYYY-MM-DD (local). */
export function getDailyTodayKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** XP earned today from guided workout set logs (matches saveWorkoutSet deltas). */
export function computeXpTodayFromLogs(workoutLogs = [], todayKey = getDailyTodayKey()) {
  const safeLogs = Array.isArray(workoutLogs) ? workoutLogs : [];
  return safeLogs
    .filter((item) => item?.date === todayKey && (item.mode || 'guided') !== 'free')
    .reduce((sum, item) => sum + (item.failed ? 3 : 10), 0);
}

/** True only when all planned sets for the session are logged. */
export function canFinishWorkout({ plannedSets = 0, completedSets = 0 } = {}) {
  const planned = Math.max(0, Number(plannedSets) || 0);
  const completed = Math.max(0, Number(completedSets) || 0);
  return planned > 0 && completed >= planned;
}

/**
 * Unified workout session status for Home / Treino hub / Coach.
 * @returns {{ status: string, label: string, ctaLabel: string, ctaSubtitle: string, isContinue: boolean, isCompleted: boolean, isPartial: boolean }}
 */
export function computeWorkoutSessionStatus({
  guidedSets = 0,
  plannedSets = 0,
  plannedExerciseCount = 0,
  hasResumableSession = false,
} = {}) {
  const safeGuided = Math.max(0, Number(guidedSets) || 0);
  const safePlannedSets = Math.max(0, Number(plannedSets) || 0);
  const safePlannedExercises = Math.max(0, Number(plannedExerciseCount) || 0);
  const resumable = Boolean(hasResumableSession);
  const canFinish = canFinishWorkout({ plannedSets: safePlannedSets, completedSets: safeGuided });
  const isPartial = safeGuided > 0 && !canFinish;

  if (canFinish) {
    return {
      status: 'completed',
      label: 'Concluido',
      ctaLabel: 'VER RESUMO DO TREINO',
      ctaSubtitle: 'Treino de hoje finalizado',
      isContinue: false,
      isCompleted: true,
      isPartial: false,
    };
  }

  if (safeGuided > 0 || resumable) {
    const label = safeGuided > 0
      ? 'Em andamento'
      : (resumable ? 'Parcial' : 'Em andamento');
    const ctaSubtitle = resumable
      ? 'Voce parou no treino. Quer continuar de onde parou?'
      : 'Voce tem um treino em andamento. Continue de onde parou.';

    return {
      status: 'in_progress',
      label,
      ctaLabel: 'CONTINUAR TREINO',
      ctaSubtitle,
      isContinue: true,
      isCompleted: false,
      isPartial,
    };
  }

  if (safePlannedExercises > 0) {
    return {
      status: 'not_started',
      label: 'Nao iniciado',
      ctaLabel: 'INICIAR TREINO',
      ctaSubtitle: 'Comece agora',
      isContinue: false,
      isCompleted: false,
      isPartial: false,
    };
  }

  return {
    status: 'not_started',
    label: 'Nao iniciado',
    ctaLabel: 'INICIAR TREINO',
    ctaSubtitle: 'Comece agora',
    isContinue: false,
    isCompleted: false,
    isPartial: false,
  };
}

export function formatStreakLabel(streakDays = 0) {
  const safe = Math.max(0, Number(streakDays) || 0);
  if (safe === 0) {
    return 'Sem sequencia ativa';
  }
  if (safe === 1) {
    return 'Dia 1 de sequencia';
  }
  return `${safe} dias de sequencia`;
}

/**
 * Single source of truth for daily progress shown across Home, Treino, Coach, Nutricao.
 */
export function buildDailyState({
  todayKey = getDailyTodayKey(),
  plan = {},
  profile = {},
  gamification = {},
  nutritionLogs = [],
  history = [],
  hydration = null,
  workoutLogs = [],
  todayWorkout = [],
  workoutSummary = {},
  recovery = null,
} = {}) {
  const macroTargets = getMacroTargetsFromPlanProfile(plan, profile);
  const proteinTarget = Math.round(Number(macroTargets?.protein || 0));

  const todayNutritionLogs = (Array.isArray(nutritionLogs) ? nutritionLogs : []).filter((l) => l.date === todayKey);
  const todayTotals = sumNutritionTotals(todayNutritionLogs);
  const proteinToday = Math.round(Number(todayTotals.protein || 0));

  const todayHistory = (Array.isArray(history) ? history : []).find((item) => item.date === todayKey) || {};
  const waterFromHydration = hydration?.dayKey === todayKey ? Number(hydration?.consumedMl || 0) : 0;
  const waterFromHistory = Number(todayHistory?.waterMl || 0);
  const waterTodayMl = Math.round(Math.max(waterFromHydration, waterFromHistory));
  const waterTargetMl = Math.round(Number(hydration?.waterGoalMl || (Number(plan?.waterLitersPerDay || 3) * 1000)));

  const streakDays = Math.max(0, Number(gamification?.streakDays || 0));
  const xpTotal = Math.max(0, Number(gamification?.xp || 0));
  const xpToday = computeXpTodayFromLogs(workoutLogs, todayKey);

  const plannedExerciseCount = Array.isArray(todayWorkout) ? todayWorkout.length : 0;
  const guidedSets = Number(workoutSummary?.guidedSets || 0);
  const plannedSets = Number(workoutSummary?.plannedSets || 0);
  const completionRate = plannedSets > 0 ? guidedSets / plannedSets : 0;
  const sessionCanFinish = canFinishWorkout({ plannedSets, completedSets: guidedSets });

  const workoutSession = computeWorkoutSessionStatus({
    guidedSets,
    plannedSets,
    plannedExerciseCount,
    hasResumableSession: Boolean(recovery) && !sessionCanFinish,
  });

  const didWorkoutToday = guidedSets > 0;
  const workoutCompletedToday = workoutSession.status === 'completed';
  const hasActiveWorkoutSession = workoutSession.status === 'in_progress';

  return {
    todayKey,
    macroTargets,
    proteinTarget,
    proteinToday,
    waterTodayMl,
    waterTargetMl,
    streakDays,
    streakLabel: formatStreakLabel(streakDays),
    xpTotal,
    xpToday,
    workoutSession,
    didWorkoutToday,
    workoutCompletedToday,
    hasActiveWorkoutSession,
    plannedExerciseCount,
    guidedSets,
    plannedSets,
    completionRate,
  };
}
