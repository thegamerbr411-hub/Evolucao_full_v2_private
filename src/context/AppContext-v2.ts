import React, { createContext, useContext, useEffect, useMemo, useCallback, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';

import { useUserStore } from '../stores/useUserStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useNutritionStore } from '../stores/useNutritionStore';
import { useAppStore } from '../stores/useAppStore';
import { useCoachStore } from '../stores/useCoachStore';
import { useGamificationStore } from '../stores/useGamificationStore';
import { useSubscriptionDomain } from './subscription/SubscriptionProvider';
import { auth } from '../services/firebase';

// Import logic modules
import {
  getTodayKey,
  getPreviousDateKey,
  round,
  clamp,
  roundToStep,
} from '../context/modules/utils';

import {
  buildMacroInsight,
  classifyMacro,
  estimateNutritionFromTextInput,
  evaluateMealQuality,
  getNutritionMacroTargets,
  sumNutritionTotals,
  getLatestDateKeysFromLogs,
  searchFoodCatalogByName,
  getCanonicalFoodData,
} from '../context/modules/nutrition';

import {
  WORKOUT_LIBRARY,
  getTodayWorkoutUseCase,
  getRecommendedWorkout,
  buildTrainingAdjustment,
  getWorkoutBySplit,
  getExerciseCatalogFromSources,
  getWeeklyMacroSummary,
  getNextWeightSuggestion,
  getRecoveryInsightUseCase,
  resolveExerciseIdentity,
  filterLogsByExercise,
  getProgressionStep,
  getExerciseTemplate,
  getDefaultStartingWeight,
  applyPainAdaptiveWorkout,
  resolveRoutineExerciseName,
  buildRoutineId,
} from '../context/modules/workout';

import {
  buildDailyCoachState,
  buildCoachMessage,
  getLevelFromXp,
  getLevelLabel,
  SCREENS,
  trackEvent,
  sendIntelligentNotification,
  getAnalyticsSnapshot,
  saveProductMetricsSnapshot,
  getProductMetricsSnapshotHistory,
  getProductMetricsSnapshot,
  logError,
  CALORIE_RANGES,
  XP_RULES,
  FOOD_CATALOG,
  FRACTION_WORDS,
  NUTRITION_SYNONYMS,
  MUSCLE_SUGGESTION_MAP,
  getExerciseProgressionSuggestion as getExerciseProgressionSuggestionUseCase,
  estimateNutritionFromPhotoHintInput,
  clampCaloriesByStrategy,
  normalizeTimezone,
  normalizeText,
  getWeekBounds,
  buildWeeklyMacroProgress,
  getCanonicalFoodData as getCanonicalFoodDataFn,
} from '../context/modules/coach';

const AppContext = createContext();
const WorkoutContext = createContext();
const NutritionContext = createContext();
const CoachContext = createContext();

type AppProviderProps = {
  children: React.ReactNode;
};

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const userStore = useUserStore();
  const workoutStore = useWorkoutStore();
  const nutritionStore = useNutritionStore();
  const appStore = useAppStore();
  const coachStore = useCoachStore();
  const gamificationStore = useGamificationStore();
  const subscriptionDomain = useSubscriptionDomain();

  // Refs for caching local decisions
  const localDecisionCacheRef = useRef({
    workoutRecommendation: {},
  });
  const workoutStartedTrackedRef = useRef({});
  const workoutFlowStartedAtRef = useRef({});
  const hydrationRefreshSignatureRef = useRef('');

  // Destructure stores states
  const user = userStore.user;
  const profile = userStore.profile;
  const isHydrated = userStore.isHydrated;
  const isAppStoreHydrated = appStore.isHydrated;

  const workout = workoutStore.workout;
  const workoutLogs = workoutStore.workoutLogs;
  const exerciseTargets = workoutStore.exerciseTargets;

  const nutritionLogs = nutritionStore.nutritionLogs;
  const history = nutritionStore.history;
  const plan = nutritionStore.plan;

  const hasCompletedQuestionnaire = appStore.hasCompletedQuestionnaire;
  const userRoutines = appStore.userRoutines;
  const monetization = subscriptionDomain.monetization;

  const gamification = gamificationStore.gamification;
  const setUserInStore = userStore.setUser;
  const logoutUserInStore = userStore.logout;
  const setUserHydrated = userStore.setHydrated;

  // Initialize hydration
  useEffect(() => {
    if (!isHydrated) {
      const hydrateApp = async () => {
        try {
          if (!isAppStoreHydrated && typeof appStore.hydrateAppStore === 'function') {
            await appStore.hydrateAppStore();
          }

          setUserHydrated(true);
        } catch (error) {
          logError(error, { screen: SCREENS?.CONTEXT || 'Context', action: 'hydrateApp' });
          setUserHydrated(true);
        }
      };

      hydrateApp();
    }
  }, [isHydrated, isAppStoreHydrated, setUserInStore, setUserHydrated]);

  useEffect(() => {
    if (!auth) {
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(auth, () => {
      if (!useUserStore.getState().isHydrated) {
        setUserHydrated(true);
      }
    });

    return () => unsubscribe();
  }, [setUserHydrated, setUserInStore]);

  useEffect(() => {
    const today = getTodayKey();
    const trainedToday = workoutLogs.some((item) => item.date === today);
    const estimatedTrainingHours = trainedToday ? 1 : 0;
    const weightKg = Number(profile?.currentWeight || 0);

    if (!weightKg) {
      hydrationRefreshSignatureRef.current = '';
      return;
    }

    const signature = `${today}|${weightKg}|${trainedToday ? 1 : 0}|${estimatedTrainingHours}`;
    if (hydrationRefreshSignatureRef.current === signature) {
      return;
    }

    hydrationRefreshSignatureRef.current = signature;
    nutritionStore.refreshHydrationForToday({
      weightKg,
      trainedToday,
      trainingHours: estimatedTrainingHours,
    });
  }, [profile?.currentWeight, workoutLogs]);

  const normalizeQuestionnaireSubmission = useCallback((input: any) => {
    if (!input || typeof input !== 'object') {
      return { profile: null, plan: null };
    }

    const profileInput = input.profile && typeof input.profile === 'object' ? input.profile : input;
    const currentWeight = Number(profileInput.currentWeight || 0);
    const targetWeight = Number(profileInput.targetWeight || profileInput.currentWeight || 0);
    const height = Number(profileInput.height || 170);
    const trainingDaysPerWeek = Number(profileInput.trainingDaysPerWeek || 3);
    const level = profileInput.level || 'iniciante';
    const goal = profileInput.goal || 'recomposicao';

    if (!currentWeight) {
      return { profile: null, plan: null };
    }

    const normalizedProfile = {
      goal,
      level,
      currentWeight,
      targetWeight,
      height,
      trainingDaysPerWeek,
    };

    const strategy =
      goal === 'emagrecer'
        ? 'cutting'
        : goal === 'ganhar_massa'
        ? 'bulking'
        : 'recomposicao';

    const baseCalories = currentWeight * 30 + height * 4 + trainingDaysPerWeek * 80;
    const targetCalories =
      strategy === 'cutting'
        ? round(baseCalories - 350)
        : strategy === 'bulking'
        ? round(baseCalories + 300)
        : round(baseCalories);

    const calorieRange = CALORIE_RANGES?.[strategy] || { min: 1200, max: 5000 };
    const trainingSplit =
      trainingDaysPerWeek <= 3
        ? 'Full body 3x semana'
        : trainingDaysPerWeek === 4
        ? 'Superior/Inferior 4x semana'
        : level === 'iniciante'
        ? 'Push/Pull/Legs + Full body (5x semana)'
        : 'Divisao classica (5x semana)';

    const normalizedPlan = input.plan && typeof input.plan === 'object'
      ? input.plan
      : {
          caloriesPerDay: clamp(targetCalories, calorieRange.min, calorieRange.max),
          waterLitersPerDay: Number(((currentWeight * 35 + trainingDaysPerWeek * 250) / 1000).toFixed(1)),
          trainingSplit,
          strategy,
        };

    return { profile: normalizedProfile, plan: normalizedPlan };
  }, []);

  // Business logic functions - moved from original AppContext
  const saveQuestionnaire = useCallback(
    (payload) => {
      const { profile: newProfile, plan: newPlan } = normalizeQuestionnaireSubmission(payload);
      if (!newProfile) return { ok: false };

      userStore.setProfile(newProfile);
      nutritionStore.setPlan(newPlan);
      appStore.setHasCompletedQuestionnaire(true);

      trackEvent('questionnaire_submitted', {
        screen: SCREENS?.HOME || 'Home',
        meta: {
          domain: 'onboarding',
          version: 1,
          profile: { level: newProfile.level, goal: newProfile.goal },
        },
      });

      return { ok: true };
    },
    [normalizeQuestionnaireSubmission]
  );

  const getRecentHistory = useCallback(() => {
    return history.slice(0, 7);
  }, [history]);

  const getWeeklySummary = useCallback(() => {
    const last7 = history.slice(0, 7);
    const trainedDays = last7.filter((item) => item.trained).length;
    const macroTargets = getNutritionMacroTargets(plan, profile);
    const avgProtein = last7.length ? round(last7.reduce((acc, item) => acc + Number(item.protein || 0), 0) / last7.length) : 0;
    const avgCals = last7.length ? round(last7.reduce((acc, item) => acc + Number(item.calories || 0), 0) / last7.length) : 0;
    const proteinStatus = macroTargets.protein ? avgProtein / macroTargets.protein : 0;

    return {
      trainedDays,
      avgProtein,
      avgCals,
      proteinStatus: proteinStatus > 0.9 ? 'acima' : proteinStatus > 0.8 ? 'ok' : 'abaixo',
    };
  }, [history, plan, profile]);

  const getWeeklyInsight = useCallback(() => {
    const last7 = history.slice(0, 7);
    const daysLogged = last7.length;
    const trainedDays = last7.filter((item) => item.trained).length;
    const consistencyScore = round((daysLogged / 7) * 100);
    const diagnosis = consistencyScore >= 80
      ? 'Sua consistencia semanal esta alta e o comportamento esta estavel.'
      : consistencyScore >= 60
      ? 'A consistencia semanal esta moderada; voce ja criou base, mas ainda oscila.'
      : 'A consistencia semanal esta baixa e o ritmo precisa ser retomado.';
    const recommendation = trainedDays >= 4
      ? 'Mantenha o mesmo ritmo e priorize qualidade de execucao e recuperacao.'
      : trainedDays >= 2
      ? 'Inclua 1 treino curto extra nesta semana para subir consistencia sem sobrecarga.'
      : 'Comece por um treino enxuto hoje para quebrar a inercia e recuperar o habito.';

    return {
      daysLogged,
      trainedDays,
      consistencyScore,
      guidance: consistencyScore > 80 ? 'excelente' : consistencyScore > 60 ? 'bom' : 'melhorar',
      diagnosis,
      recommendation,
    };
  }, [history]);

  const getAutoAdjustmentSuggestion = useCallback(() => {
    const todayKey = getTodayKey();
    const last7 = history.slice(0, 7);
    const analyzedDays = last7.length;

    if (analyzedDays < 3 || !plan) {
      return {
        canApply: false,
        message: 'Registre mais dias para ajuste automatico.',
      };
    }

    const summary = getWeeklySummary();
    const weeklyInsight = getWeeklyInsight();
    const expectedWeeklyDays = Number(profile?.trainingDaysPerWeek || 3);
    const expectedInWindow = Math.max(1, round((expectedWeeklyDays / 7) * analyzedDays));
    const trainingGap = Math.max(0, expectedInWindow - summary.trainedDays);
    const belowDays = last7.filter((item) => item.status === 'abaixo').length;
    const aboveDays = last7.filter((item) => item.status === 'acima').length;

    let calorieDelta = 0;

    if (profile?.goal === 'emagrecer') {
      if (aboveDays >= belowDays + 1) {
        calorieDelta -= 120;
      } else if (belowDays >= aboveDays + 2) {
        calorieDelta += 80;
      }
    } else if (profile?.goal === 'ganhar_massa') {
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
      message: newCalories === currentCalories
        ? 'Plano calorico mantido. Ajuste principal da semana sera na consistencia de execucao.'
        : 'Ajuste calculado com limite seguro para a proxima semana.',
      generatedAt: getTodayKey(),
    };
  }, [history, plan, profile, getWeeklySummary, getWeeklyInsight]);

  const applyAutoPlanAdjustment = useCallback(() => {
    const suggestion = getAutoAdjustmentSuggestion();

    if (!suggestion.canApply) {
      return suggestion;
    }

    nutritionStore.updatePlan({
      caloriesPerDay: suggestion.newCalories,
      weeklyTrainingAdjustment: suggestion.trainingAdjustment,
      lastAutoAdjustmentAt: suggestion.generatedAt,
    });

    return suggestion;
  }, [getAutoAdjustmentSuggestion]);

  const getTodayWorkout = useCallback(() => {
    const adaptive = getTodayWorkoutUseCase({
      trainingSplit: plan?.trainingSplit,
      exerciseTargets,
      profile,
      workoutLogs,
      library: WORKOUT_LIBRARY,
      applyPainAdaptiveWorkout,
      getExerciseCatalogFromSources,
    });

    if (adaptive?.error) {
      return [];
    }

    return Array.isArray(adaptive?.exercises) ? adaptive.exercises : [];
  }, [plan?.trainingSplit, exerciseTargets, profile, workoutLogs]);

  const getTodayWorkoutSummary = useCallback(() => {
    const today = getTodayKey();
    const todayLogs = workoutLogs.filter((item) => item.date === today);
    const todayGuidedLogs = todayLogs.filter((item) => (item.mode || 'guided') !== 'free');
    const plannedSets = getTodayWorkout().reduce(
      (acc, item) => acc + Math.max(1, Number(item.sets || 1)),
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
  }, [workoutLogs, getTodayWorkout]);

  const getNutritionFeedback = useCallback(({ proteinConsumed, caloriesConsumed, trainedToday } = {}) => {
    const macroTargets = getNutritionMacroTargets(plan, profile);
    const todayTotals = sumNutritionTotals(nutritionLogs.filter((l) => l.date === getTodayKey()));
    const todayWorkout = getTodayWorkoutSummary();

    const safeProteinConsumed = Number(proteinConsumed != null ? proteinConsumed : Number(todayTotals.protein || 0));
    const safeCaloriesConsumed = Number(caloriesConsumed != null ? caloriesConsumed : Number(todayTotals.calories || 0));
    const proteinGoal = Number(macroTargets?.protein || 0);
    const caloriesGoal = Number(macroTargets?.calories || 0);
    const didTrainToday = trainedToday != null ? Boolean(trainedToday) : Number(todayWorkout?.guidedSets || 0) > 0;

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
        urgency: 'ok',
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
        urgency: 'alta',
        title: `Faltam ${missingProtein}g de proteina hoje`,
        message: 'Calorias no teto, mas proteina baixa. Priorize fonte limpa agora para proteger resultado.',
        suggestion,
        missingProtein,
      };
    }

    return {
      tone: didTrainToday ? 'priority' : 'default',
      urgency: missingProtein > 35 || didTrainToday ? 'media' : 'ok',
      title: `Faltam ${missingProtein}g de proteina hoje`,
      message: didTrainToday
        ? 'Voce treinou hoje. Priorize proteina agora para acelerar recuperacao e performance.'
        : 'Ainda da para bater a meta com uma refeicao simples e rapida.',
      suggestion,
      missingProtein,
    };
  }, [plan, profile, nutritionLogs, getTodayWorkoutSummary]);

  const getWorkoutGamification = useCallback(() => {
    const xp = Number(gamification.xp || 0);
    const level = getLevelFromXp(xp);
    const currentLevelBaseXp = Math.pow(Math.max(0, level - 1), 2) * 100;
    const nextLevelXp = Math.pow(level, 2) * 100;
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
  }, [gamification]);

  const getSmartWorkoutRecommendation = useCallback(() => {
    const weeklyTarget = Math.max(1, Number(profile?.trainingDaysPerWeek || 3));
    const recommendation = getRecommendedWorkout({
      workoutLogs,
      weeklyTarget,
      pain: profile?.currentPain,
      library: WORKOUT_LIBRARY,
      catalog: getExerciseCatalogFromSources(),
      todayKey: getTodayKey(),
    });

    const trainedThisWeek = Number(recommendation?.trainedThisWeek || 0);
    const remaining = Math.max(0, weeklyTarget - trainedThisWeek);

    return {
      ...recommendation,
      title: recommendation?.title || 'Treino de consistencia',
      justification: remaining > 0
        ? `Faltam ${remaining} treino(s) para fechar sua meta semanal.`
        : 'Meta semanal concluida. Mantenha execucao para consolidar progresso.',
      urgencyMessage: remaining > 2
        ? 'Voce esta atrasado na semana — vale um treino mais curto hoje.'
        : remaining === 1
        ? 'Mais um treino e voce fecha a semana!'
        : remaining === 0
        ? 'Meta semanal atingida 🎉'
        : '',
      trainedThisWeek,
      weeklyTarget,
      isBehindWeek: remaining > 0,
    };
  }, [workoutLogs, profile?.trainingDaysPerWeek, profile?.currentPain]);

  const addWaterIntake = useCallback((amountMl = 0) => {
    const safeAmount = Math.max(0, Number(amountMl || 0));
    if (!safeAmount) {
      return { ok: false, reason: 'invalid_amount' };
    }

    const today = getTodayKey();
    const hydrationState = nutritionStore.getState().hydration;
    if (!hydrationState || hydrationState.dayKey !== today) {
      nutritionStore.refreshHydrationForToday({
        targetWaterMl: Math.round(Number(plan?.waterLitersPerDay || 3) * 1000),
      });
    }

    nutritionStore.addHydrationIntake(safeAmount);
    const todayEntry = history.find((item) => item.date === today);
    const currentWater = Number(todayEntry?.waterMl || 0);

    nutritionStore.updateHistoryEntry(today, {
      date: today,
      waterMl: currentWater + safeAmount,
      protein: Number(todayEntry?.protein || 0),
      calories: Number(todayEntry?.calories || 0),
      carbs: Number(todayEntry?.carbs || 0),
      fats: Number(todayEntry?.fats || 0),
      trained: Boolean(todayEntry?.trained),
      status: String(todayEntry?.status || 'indefinido'),
      insight: String(todayEntry?.insight || ''),
      macroInsight: String(todayEntry?.macroInsight || ''),
    });

    return { ok: true, amountMl: safeAmount };
  }, [history, plan?.waterLitersPerDay]);

  const getExerciseProgressionSuggestion = useCallback((exerciseName, exerciseId = null) => {
    const identity = resolveExerciseIdentity(exerciseName, exerciseId);
    const logs = filterLogsByExercise(workoutLogs, identity);

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

    return getExerciseProgressionSuggestionUseCase({
      exerciseName,
      workoutLogs,
      profile,
    });
  }, [workoutLogs, profile]);

  // Stub computação das métricas
  const computeProductMetrics = useCallback(() => {
    return {
      userMetrics: {
        xp: gamification.xp,
        level: getLevelFromXp(gamification.xp),
      },
    };
  }, [gamification.xp]);

  // Create memoized values with ALL functions from original AppContext
  const contextValue = useMemo(
    () => ({
      // State
      profile,
      user,
      plan,
      history,
      nutritionLogs,
      workoutLogs,
      workout,
      exerciseTargets,
      gamification,
      monetization,
      hasCompletedQuestionnaire,
      isHydrated,
      userRoutines,

      // User actions
      setUser: (nextUser) => {
        if (typeof nextUser === 'function') {
          const resolvedUser = nextUser(user);
          userStore.setUser(resolvedUser);
          return;
        }
        userStore.setUser(nextUser);
      },
      setProfile: userStore.setProfile,
      updateProfileSettings: (partial) => userStore.updateProfile(partial),

      // Questionnaire
      saveQuestionnaire,
      resetQuestionnaire: () => {
        userStore.setProfile(null);
        appStore.setHasCompletedQuestionnaire(false);
      },

      // Workout
      setWorkout: workoutStore.setWorkout,
      addExercise: workoutStore.addExercise,
      updateSet: workoutStore.updateSet,
      getTodayWorkout,
      getSmartWorkoutRecommendation,
      getRecommendedWorkoutV4: getSmartWorkoutRecommendation,
      prepareTodayWorkoutTargets: () => {
        const today = getTodayKey();
        const todayWorkout = getWorkoutBySplit(plan?.trainingSplit);
        if (!todayWorkout.length) {
          return;
        }
        const { exerciseTargets: prev, setExerciseTargets } = useWorkoutStore.getState();
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
            next[exercise.name] = { ...current, targetWeight: suggestion.suggestedWeight };
            hasChanged = true;
          }
        }
        if (hasChanged) {
          setExerciseTargets(next);
        }
      },
      saveWorkoutSet: (data) => {
        const log = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          date: getTodayKey(),
          createdAt: new Date().toISOString(),
          sessionId: useWorkoutStore.getState().workoutSessionId || undefined,
          exerciseId: data.exerciseId,
          exerciseName: data.exerciseName,
          weight: Number(data.weight),
          reps: Number(data.reps),
          rpe: data.rpe ? Number(data.rpe) : undefined,
          failed: Boolean(data.failed),
          mode: data.mode || 'guided',
        };
        const xpDelta = Number(data?.failed ? 3 : 10);
        workoutStore.addWorkoutLog(log);
        gamificationStore.addXp(xpDelta);
        return { ok: true, xpDelta };
      },

      saveFreeWorkoutSet: (data) => {
        const log = {
          id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          date: getTodayKey(),
          createdAt: new Date().toISOString(),
          exerciseId: data.exerciseId,
          exerciseName: data.exerciseName,
          weight: Number(data.weight),
          reps: Number(data.reps),
          rpe: data.rpe ? Number(data.rpe) : undefined,
          failed: Boolean(data.failed),
          mode: 'free',
        };
        const xpDelta = Number(data?.failed ? 2 : 6);
        workoutStore.addWorkoutLog(log);
        gamificationStore.addXp(xpDelta);
        return { ok: true, xpDelta };
      },

      removeTodayWorkoutSet: ({ exerciseName, setIndex, mode = 'guided' }) => {
        const today = getTodayKey();
        const todayLogs = workoutLogs.filter(
          (item) => item.date === today && item.exerciseName === exerciseName && (item.mode || 'guided') === mode
        );
        if (todayLogs[setIndex]) {
          workoutStore.removeWorkoutLog(todayLogs[setIndex].id);
          return { ok: true };
        }
        return { ok: false };
      },

      getExerciseProgress: (exerciseName) => {
        const logs = filterLogsByExercise(workoutLogs, resolveExerciseIdentity(exerciseName));
        const successful = logs.filter((item) => !item.failed);
        const recent = successful.slice(0, 5);
        const totalReps = recent.reduce((acc, item) => acc + Number(item.reps || 0), 0);

        return {
          bestWeight: successful.length ? Math.max(...successful.map((item) => Number(item.weight || 0))) : 0,
          totalSets: logs.length,
          recentAverageReps: recent.length ? round(totalReps / recent.length) : 0,
        };
      },

      getExerciseProgressionSuggestion,
      getTodayWorkoutSummary,
      getExerciseSetProgress: (exerciseName, plannedSets = 3) => {
        const today = getTodayKey();
        const identity = resolveExerciseIdentity(exerciseName);
        const activeSessionId = useWorkoutStore.getState().workoutSessionId;
        const todayLogs = workoutLogs.filter((item) => item.date === today);
        const sessionLogs = activeSessionId
          ? todayLogs.filter((item) => item.sessionId === activeSessionId)
          : todayLogs;
        const todayExerciseLogs = filterLogsByExercise(sessionLogs, identity);
        const completedSets = todayExerciseLogs.length;
        const totalSets = Math.max(1, Number(plannedSets) || 1);

        return {
          completedSets,
          totalSets,
          nextSet: Math.min(totalSets, completedSets + 1),
          isDone: completedSets >= totalSets,
        };
      },

      // History & Summary
      analyzeDay: (dateKeyOrMacro, maybeMacro) => {
        const isSinglePayload = dateKeyOrMacro && typeof dateKeyOrMacro === 'object';
        const dateKey = isSinglePayload ? getTodayKey() : String(dateKeyOrMacro || getTodayKey());
        const macro = isSinglePayload ? (dateKeyOrMacro || {}) : (maybeMacro || {});
        const consumedCalories = Math.max(0, Number(macro.consumedCalories || macro.calories || 0));
        const protein = Math.max(0, Number(macro.protein || 0));
        const carbs = Math.max(0, Number(macro.carbs || 0));
        const fats = Math.max(0, Number(macro.fats || 0));
        const trained = Boolean(macro.trained ?? macro.trainedToday ?? false);
        const macroTargets = getNutritionMacroTargets(plan, profile);
        const calorieTarget = Number(macroTargets?.calories || 0);
        const calorieRatio = calorieTarget > 0 ? consumedCalories / calorieTarget : 0;
        const status = calorieRatio > 1.1 ? 'acima' : calorieRatio < 0.85 ? 'abaixo' : 'ok';
        const macroInsight = {
          status: {
            protein: classifyMacro(protein, Number(macroTargets?.protein || 0)),
            carbs: classifyMacro(carbs, Number(macroTargets?.carbs || 0)),
            fats: classifyMacro(fats, Number(macroTargets?.fats || 0)),
          },
          message: buildMacroInsight(
            { calories: consumedCalories, protein, carbs, fats },
            macroTargets
          ),
        };
        const nutritionFeedback = getNutritionFeedback({
          proteinConsumed: protein,
          caloriesConsumed: consumedCalories,
          trainedToday: trained,
        });
        const entry = {
          date: dateKey,
          consumedCalories,
          calories: consumedCalories,
          protein,
          carbs,
          fats,
          trained,
          status,
          macroInsight: macroInsight.message,
          insight: nutritionFeedback?.message || nutritionFeedback?.title || '',
        };
        nutritionStore.addHistoryEntry(entry);
        return {
          ok: true,
          status,
          macroTargets,
          macroInsight,
          message: nutritionFeedback?.message || nutritionFeedback?.title || 'Analise salva com sucesso.',
        };
      },

      getRecentHistory,
      getWeeklySummary,
      getWeeklyInsight,
      getAutoAdjustmentSuggestion,
      applyAutoPlanAdjustment,

      // Nutrition
      estimateNutritionFromText: (text) => estimateNutritionFromTextInput(text),
      estimateNutritionFromPhotoHint: ({ description, portionFactor = 1 }) => estimateNutritionFromPhotoHintInput(description, portionFactor),
      getDailyMacroTargets: () => getNutritionMacroTargets(plan, profile),
      getWeeklyMacroSummary: () => getWeeklyMacroSummary(history, plan, profile),

      searchFoodCatalog: (query) => searchFoodCatalogByName(query),
      
      addFoodLogEntry: (log) => {
        const entry = {
          id: `${Date.now()}`,
          date: getTodayKey(),
          loggedAt: new Date().toISOString(),
          ...log,
        };
        nutritionStore.addNutritionLog(entry);
        return { ok: true };
      },

      addFoodLogEntriesBatch: ({ items = [], loggedAt } = {}) => {
        if (!items.length) return { ok: false, message: 'Nenhum alimento valido.' };
        const safeLoggedAt = loggedAt || new Date().toISOString();
        items.forEach((item) => {
          const entry = {
            id: `${Date.now()}-${Math.random()}`,
            date: getTodayKey(),
            loggedAt: safeLoggedAt,
            ...item,
          };
          nutritionStore.addNutritionLog(entry);
        });
        return { ok: true };
      },

      removeFoodLogEntry: (id) => {
        nutritionStore.removeNutritionLog(id);
        return { ok: true };
      },

      getTodayFoodLog: () => nutritionLogs.filter((l) => l.date === getTodayKey()),
      getNutritionFeedback,
      saveNutritionEntry: (entry) => {
        nutritionStore.addHistoryEntry(entry);
        return { ok: true };
      },

      // Gamification
      getWorkoutGamification,
      getDailyMissions: () => [],
      completeMission: (id, xp) => {
        gamificationStore.addXp(xp);
      },

      // Performance & Insights
      getPerformanceRecoveryInsight: () => ({}),
      getPerformanceScore: () => ({ score: 0, label: 'Pouco dados' }),
      getTopFoods: ({ days = 7, limit = 5 } = {}) => ({ ranking: [] }),
      evaluateMealQuality: (entry) => ({ score: 0 }),
      getDailyScoreForDate: (date) => ({ score: 0 }),
      getScoreTrendSummary: (days = 7) => ({ points: [], averageScore: 0 }),

      // Other
      getWorkoutDelta: (current = {}, previous = null) => {
        const currentSets = Number(current?.totalSets || 0);
        const previousSets = Number(previous?.totalSets || 0);
        const currentLoad = Number(current?.totalLoad || 0);
        const previousLoad = Number(previous?.totalLoad || 0);
        return {
          setsDiff: currentSets - previousSets,
          loadDiff: currentLoad - previousLoad,
          setsDiffPct: previousSets > 0 ? round(((currentSets - previousSets) / previousSets) * 100) : 0,
          loadDiffPct: previousLoad > 0 ? round(((currentLoad - previousLoad) / previousLoad) * 100) : 0,
        };
      },
      getExerciseCatalog: () => {
        const catalog = getExerciseCatalogFromSources(WORKOUT_LIBRARY);
        return Array.isArray(catalog) ? catalog : [];
      },
      getExerciseHistorySnapshot: (exerciseName: string, limit = 5, exerciseId?: string) => {
        const identity = resolveExerciseIdentity(exerciseName, exerciseId);
        const logs = filterLogsByExercise(workoutLogs, identity)
          .filter((item) => !item.failed)
          .slice(0, Math.max(1, Number(limit || 5)));
        return logs.map((item) => ({
          date: String(item.date || ''),
          weight: Number(item.weight || 0),
          reps: Number(item.reps || 0),
          rpe: Number(item.rpe || 0),
        }));
      },
      getExercisesByMuscleGroup: (group: string) => {
        const normalizedGroup = normalizeText(group || '');
        if (!normalizedGroup) {
          return [];
        }

        const libraryList = Array.isArray(WORKOUT_LIBRARY) ? WORKOUT_LIBRARY : [];
        return libraryList
          .filter((item: any) => normalizeText(item?.muscle || item?.group || '').includes(normalizedGroup))
          .map((item: any) => String(item?.name || '').trim())
          .filter(Boolean)
          .slice(0, 40);
      },
      getFreeWorkoutSuggestions: (excluded = []) => {
        const excludedSet = new Set((Array.isArray(excluded) ? excluded : []).map((name) => normalizeText(name)));
        const catalog = getExerciseCatalogFromSources(WORKOUT_LIBRARY);
        return (Array.isArray(catalog) ? catalog : [])
          .filter((name: string) => !excludedSet.has(normalizeText(name)))
          .slice(0, 20);
      },
      getWorkoutTemplates: () => [
        { key: 'fullBody', name: 'Full Body' },
        { key: 'upper', name: 'Superior' },
        { key: 'lower', name: 'Inferior' },
        { key: 'push', name: 'Push' },
        { key: 'pull', name: 'Pull' },
      ],

      getUserRoutines: () => (Array.isArray(userRoutines) ? userRoutines : []),
      getUserRoutineById: (id) => (Array.isArray(userRoutines) ? userRoutines : []).find((r) => r.id === id),
      createUserRoutine: ({ name, exercises }) => {
        const safeExercises = Array.isArray(exercises) ? exercises : [];
        const routine = { id: `routine-${Date.now()}`, name, exercises: safeExercises };
        appStore.updateUserRoutines((routines) => [routine, ...(Array.isArray(routines) ? routines : [])]);
        return { ok: true, routine };
      },

      updateUserRoutine: ({ routineId, name, exercises }) => {
        const safeExercises = Array.isArray(exercises) ? exercises : [];
        appStore.updateUserRoutines((routines) => 
          (Array.isArray(routines) ? routines : []).map((r) => (r.id === routineId ? { ...r, name, exercises: safeExercises } : r))
        );
        return { ok: true };
      },

      deleteUserRoutine: (id) => {
        appStore.updateUserRoutines((routines) => (Array.isArray(routines) ? routines : []).filter((r) => r.id !== id));
        return { ok: true };
      },

      // Not fully implemented yet
      getAutoCoachSuggestions: () => ({ hasData: false, suggestions: [] }),
      applyMacroOverride: () => {},
      buildDailyCoachState,
      buildCoachMessage,
      getDebugMetricsSnapshot: () => ({}),
      getProductMetricsDashboard: async () => ({}),
      getProductMetricsHistory: async () => ({}),
      getSubscriptionStatus: subscriptionDomain.getSubscriptionStatus,
      hasFeatureAccess: subscriptionDomain.hasFeatureAccess,
      startProTrial: subscriptionDomain.startProTrial,
      activateProPlan: subscriptionDomain.activateProPlan,
      addWaterIntake,
      createRoutineFromTemplate: ({ templateKey, frequency } = {}) => {
        const templates = {
          fullBody: { name: 'Full Body', exercises: [{ name: 'Agachamento Livre' }, { name: 'Supino Reto Barra' }, { name: 'Remada Curvada Barra' }] },
          upper: { name: 'Superior', exercises: [{ name: 'Supino Reto Barra' }, { name: 'Puxada Frontal Polia' }, { name: 'Desenvolvimento Militar Halter' }] },
          lower: { name: 'Inferior', exercises: [{ name: 'Agachamento Livre' }, { name: 'Leg Press' }, { name: 'Stiff' }] },
          push: { name: 'Push', exercises: [{ name: 'Supino Reto Barra' }, { name: 'Desenvolvimento Militar Halter' }, { name: 'Triceps Polia' }] },
          pull: { name: 'Pull', exercises: [{ name: 'Puxada Frontal Polia' }, { name: 'Remada Curvada Barra' }, { name: 'Rosca Direta Barra' }] },
        };
        const template = templates[templateKey as string];
        if (!template) {
          return { ok: false, message: 'Template nao encontrado.' };
        }
        const routine = { id: `routine-${Date.now()}`, name: template.name, exercises: template.exercises };
        appStore.updateUserRoutines((routines) => [routine, ...(Array.isArray(routines) ? routines : [])]);
        return { ok: true, routine };
      },
      saveTodayWorkoutAsRoutine: ({ name, frequency } = {} as any) => {
        const todayExercises = getTodayWorkout();
        if (!todayExercises.length) {
          return { ok: false, message: 'Nenhum treino definido para hoje.' };
        }
        const routine = {
          id: `routine-${Date.now()}`,
          name: String(name || 'Minha Rotina'),
          exercises: todayExercises.map((e: any) => ({ name: e.name, sets: e.sets, reps: e.reps })),
        };
        appStore.updateUserRoutines((routines) => [routine, ...(Array.isArray(routines) ? routines : [])]);
        return { ok: true, routine };
      },
      reorderUserRoutineExercises: ({ routineId, from, to } = {} as any) => {
        appStore.updateUserRoutines((routines) => {
          const safeRoutines = Array.isArray(routines) ? routines : [];
          return safeRoutines.map((r) => {
            if (r.id !== routineId) return r;
            const exercises = Array.isArray(r.exercises) ? [...r.exercises] : [];
            const [moved] = exercises.splice(from, 1);
            exercises.splice(to, 0, moved);
            return { ...r, exercises };
          });
        });
        return { ok: true };
      },
      duplicateUserRoutine: (id: string) => {
        const safeRoutines = Array.isArray(userRoutines) ? userRoutines : [];
        const source = safeRoutines.find((r) => r.id === id);
        if (!source) return { ok: false, message: 'Rotina nao encontrada.' };
        const copy = { ...source, id: `routine-${Date.now()}`, name: `${source.name} (copia)` };
        appStore.updateUserRoutines((routines) => [copy, ...(Array.isArray(routines) ? routines : [])]);
        return { ok: true, routine: copy };
      },
    }),
    [
      profile,
      user,
      plan,
      history,
      nutritionLogs,
      workoutLogs,
      workout,
      exerciseTargets,
      gamification,
      monetization,
      hasCompletedQuestionnaire,
      isHydrated,
      userRoutines,
      getTodayWorkout,
      getTodayWorkoutSummary,
      getNutritionFeedback,
      getWorkoutGamification,
      getSmartWorkoutRecommendation,
      getExerciseProgressionSuggestion,
      getRecentHistory,
      getWeeklySummary,
      getWeeklyInsight,
      getAutoAdjustmentSuggestion,
      saveQuestionnaire,
      applyAutoPlanAdjustment,
      addWaterIntake,
      subscriptionDomain,
    ]
  );

  const workoutValue = useMemo(
    () => ({
      getTodayWorkout,
      workout,
      setWorkout: workoutStore.setWorkout,
      addExercise: workoutStore.addExercise,
      updateSet: workoutStore.updateSet,
      getSmartWorkoutRecommendation,
      getRecommendedWorkoutV4: getSmartWorkoutRecommendation,
      prepareTodayWorkoutTargets: () => {
        const today = getTodayKey();
        const todayWorkout = getWorkoutBySplit(plan?.trainingSplit);
        if (!todayWorkout.length) {
          return;
        }
        const { exerciseTargets: prev, setExerciseTargets } = useWorkoutStore.getState();
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
            next[exercise.name] = { ...current, targetWeight: suggestion.suggestedWeight };
            hasChanged = true;
          }
        }
        if (hasChanged) {
          setExerciseTargets(next);
        }
      },
      saveWorkoutSet: contextValue.saveWorkoutSet,
      saveFreeWorkoutSet: contextValue.saveFreeWorkoutSet,
      removeTodayWorkoutSet: contextValue.removeTodayWorkoutSet,
      getExerciseProgress: contextValue.getExerciseProgress,
      getExerciseSetProgress: contextValue.getExerciseSetProgress,
      getExerciseProgressionSuggestion: contextValue.getExerciseProgressionSuggestion,
      getExerciseCatalog: contextValue.getExerciseCatalog,
      getExercisesByMuscleGroup: contextValue.getExercisesByMuscleGroup,
      getFreeWorkoutSuggestions: contextValue.getFreeWorkoutSuggestions,
      getWorkoutGamification,
      getExerciseHistorySnapshot: contextValue.getExerciseHistorySnapshot,
      getTodayWorkoutSummary,
      getWorkoutDelta: contextValue.getWorkoutDelta,
      workoutLogs,
      gamification,
      exerciseTargets,
    }),
    [
      getTodayWorkout,
      workout,
      getExerciseProgressionSuggestion,
      getWorkoutGamification,
      getSmartWorkoutRecommendation,
      getTodayWorkoutSummary,
      workoutLogs,
      gamification,
      exerciseTargets,
      contextValue,
    ]
  );

  const nutritionValue = useMemo(
    () => ({
      estimateNutritionFromText: contextValue.estimateNutritionFromText,
      estimateNutritionFromPhotoHint: contextValue.estimateNutritionFromPhotoHint,
      searchFoodCatalog: contextValue.searchFoodCatalog,
      addFoodLogEntry: contextValue.addFoodLogEntry,
      addFoodLogEntriesBatch: contextValue.addFoodLogEntriesBatch,
      removeFoodLogEntry: contextValue.removeFoodLogEntry,
      getTodayFoodLog: contextValue.getTodayFoodLog,
      getDailyMacroTargets: contextValue.getDailyMacroTargets,
      getWeeklyMacroSummary: contextValue.getWeeklyMacroSummary,
      getNutritionFeedback,
      getTopFoods: () => ({}),
      getPerformanceRecoveryInsight: () => ({}),
      evaluateMealQuality: () => ({}),
      saveNutritionEntry: contextValue.saveNutritionEntry,
      addWaterIntake,
      nutritionLogs,
      history,
      plan,
    }),
    [nutritionLogs, history, plan, getNutritionFeedback, contextValue, addWaterIntake]
  );

  const coachValue = useMemo(
    () => ({
      buildDailyCoachState,
      buildCoachMessage,
      getAutoCoachSuggestions: () => ({ hasData: false, suggestions: [], message: 'Sem dados para ajustes automaticos agora.' }),
      applyMacroOverride: () => {},
      getDailyMissions: () => [],
      completeMission: () => {},
      getPerformanceScore: () => ({ score: 0, label: 'Sem dados', training: 0, maxTraining: 100, diet: 0, maxDiet: 100, consistency: 0, maxConsistency: 100 }),
      getNutritionFeedback,
      getSmartWorkoutRecommendation,
      addWaterIntake,
      history,
      nutritionLogs,
      workoutLogs,
    }),
    [history, nutritionLogs, workoutLogs, getNutritionFeedback, getSmartWorkoutRecommendation, addWaterIntake]
  );

  return React.createElement(
    AppContext.Provider,
    { value: contextValue },
    React.createElement(
      WorkoutContext.Provider,
      { value: workoutValue },
      React.createElement(
        NutritionContext.Provider,
        { value: nutritionValue },
        React.createElement(
          CoachContext.Provider,
          { value: coachValue },
          children
        )
      )
    )
  );
};

export const useApp = () => useContext(AppContext);
export const useWorkoutDomain = () => {
  const context = useContext(WorkoutContext);
  if (!context) {
    throw new Error('useWorkoutDomain must be used within AppProvider');
  }
  return context;
};
export const useNutritionDomain = () => {
  const context = useContext(NutritionContext);
  if (!context) {
    throw new Error('useNutritionDomain must be used within AppProvider');
  }
  return context;
};
export const useCoachDomain = () => {
  const context = useContext(CoachContext);
  if (!context) {
    throw new Error('useCoachDomain must be used within AppProvider');
  }
  return context;
};
