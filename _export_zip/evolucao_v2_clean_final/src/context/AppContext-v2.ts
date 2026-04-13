import React, { createContext, useContext, useEffect, useMemo, useCallback, useRef } from 'react';

import { useUserStore } from '../stores/useUserStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { useNutritionStore } from '../stores/useNutritionStore';
import { useAppStore } from '../stores/useAppStore';
import { useCoachStore } from '../stores/useCoachStore';
import { useGamificationStore } from '../stores/useGamificationStore';

// Import logic modules
import {
  normalizeHistoryStatus,
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
  getTodayWorkoutUseCase,
  getRecommendedWorkout,
  buildWeeklyUrgency,
  buildTrainingAdjustment,
  getWorkoutBySplit,
  WORKOUT_LIBRARY,
  getExerciseCatalogFromSources,
  getWeeklyMacroSummary,
  getNextWeightSuggestion,
  getRecoveryInsightUseCase,
  resolveExerciseIdentity,
  filterLogsByExercise,
  matchesExerciseLog,
  getWorkoutDelta,
  normalizeExerciseLabel,
  isLowerBodyExercise,
  getProgressionStep,
  parseRepRange,
  getExerciseTemplate,
  getDefaultStartingWeight,
  buildConfidence,
  detectPainFromDescription,
  applyPainAdaptiveWorkout,
  inferMuscleGroup,
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
  getExerciseProgressionSuggestion: getExerciseProgressionSuggestionUseCase,
  estimateNutritionFromPhotoHintInput,
  clampCaloriesByStrategy,
  normalizeTimezone,
  normalizeText,
  getWeekBounds,
  buildWeeklyMacroProgress,
  getCanonicalFoodData: getCanonicalFoodDataFn,
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

  // Refs for caching local decisions
  const localDecisionCacheRef = useRef({
    workoutRecommendation: {},
  });
  const workoutStartedTrackedRef = useRef({});
  const workoutFlowStartedAtRef = useRef({});

  // Destructure stores states
  const user = userStore.user;
  const profile = userStore.profile;
  const isHydrated = userStore.isHydrated;

  const workout = workoutStore.workout;
  const workoutLogs = workoutStore.workoutLogs;
  const exerciseTargets = workoutStore.exerciseTargets;

  const nutritionLogs = nutritionStore.nutritionLogs;
  const history = nutritionStore.history;
  const plan = nutritionStore.plan;

  const hasCompletedQuestionnaire = appStore.hasCompletedQuestionnaire;
  const userRoutines = appStore.userRoutines;
  const monetization = appStore.monetization;

  const gamification = gamificationStore.gamification;

  // Initialize hydration
  useEffect(() => {
    if (!isHydrated) {
      const hydrateApp = async () => {
        try {
          // TODO: Load from localStorage/MMKV
          userStore.setHydrated(true);
        } catch (error) {
          logError(error, { screen: SCREENS.CONTEXT, action: 'hydrateApp' });
          userStore.setHydrated(true);
        }
      };

      hydrateApp();
    }
  }, [isHydrated]);

  useEffect(() => {
    const today = getTodayKey();
    const trainedToday = workoutLogs.some((item) => item.date === today);
    const estimatedTrainingHours = trainedToday ? 1 : 0;
    const weightKg = Number(profile?.currentWeight || 0);

    if (!weightKg) {
      return;
    }

    nutritionStore.refreshHydrationForToday({
      weightKg,
      trainedToday,
      trainingHours: estimatedTrainingHours,
    });
  }, [profile?.currentWeight, workoutLogs, nutritionStore]);

  // Business logic functions - moved from original AppContext
  const saveQuestionnaire = useCallback(
    ({ profile: newProfile, plan: newPlan }) => {
      if (!newProfile) return { ok: false };

      userStore.setProfile(newProfile);
      nutritionStore.setPlan(newPlan);
      appStore.setHasCompletedQuestionnaire(true);

      trackEvent('questionnaire_submitted', {
        screen: SCREENS.HOME,
        meta: {
          domain: 'onboarding',
          version: 1,
          profile: { level: newProfile.level, goal: newProfile.goal },
        },
      });

      return { ok: true };
    },
    []
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

    return {
      daysLogged,
      trainedDays,
      consistencyScore,
      guidance: consistencyScore > 80 ? 'excelente' : consistencyScore > 60 ? 'bom' : 'melhorar',
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

    return adaptive.exercises;
  }, [plan?.trainingSplit, exerciseTargets, profile, workoutLogs]);

  const getTodayWorkoutSummary = useCallback(() => {
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
  }, [workoutLogs, plan?.trainingSplit]);

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
      setUser: userStore.setUser,
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
      getSmartWorkoutRecommendation: () => ({}),
      getRecommendedWorkoutV4: () => ({}),
      prepareTodayWorkoutTargets: () => {},
      saveWorkoutSet: (data) => {
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
          mode: data.mode || 'guided',
        };
        workoutStore.addWorkoutLog(log);
        return { ok: true, xpDelta: 10 };
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
        workoutStore.addWorkoutLog(log);
        return { ok: true };
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
        const todayExerciseLogs = filterLogsByExercise(workoutLogs.filter((item) => item.date === today), identity);
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
      analyzeDay: (dateKey, macro) => {
        const entry = {
          date: dateKey,
          ...macro,
          trained: macro.trained || false,
          status: normalizeHistoryStatus(macro),
        };
        nutritionStore.addHistoryEntry(entry);
        return { ok: true };
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

      addFoodLogEntriesBatch: (logs) => {
        logs.forEach((log) => {
          const entry = {
            id: `${Date.now()}-${Math.random()}`,
            date: getTodayKey(),
            loggedAt: new Date().toISOString(),
            ...log,
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
      getTopFoods: ({ days = 7, limit = 5 } = {}) => ({}),
      evaluateMealQuality: (entry) => ({ score: 0 }),
      getDailyScoreForDate: (date) => ({ score: 0 }),
      getScoreTrendSummary: (days = 7) => ({ points: [], averageScore: 0 }),

      // Other
      getWorkoutDelta: () => ({}),
      getExerciseCatalog: () => [],
      getExerciseHistorySnapshot: () => [],
      getExercisesByMuscleGroup: () => [],
      getFreeWorkoutSuggestions: () => [],
      getWorkoutTemplates: () => [],

      getUserRoutines: () => userRoutines,
      getUserRoutineById: (id) => userRoutines.find((r) => r.id === id),
      createUserRoutine: ({ name, exercises }) => {
        const routine = { id: `routine-${Date.now()}`, name, exercises };
        appStore.updateUserRoutines((routines) => [routine, ...routines]);
        return { ok: true, routine };
      },

      updateUserRoutine: ({ routineId, name, exercises }) => {
        appStore.updateUserRoutines((routines) => 
          routines.map((r) => (r.id === routineId ? { ...r, name, exercises } : r))
        );
        return { ok: true };
      },

      deleteUserRoutine: (id) => {
        appStore.updateUserRoutines((routines) => routines.filter((r) => r.id !== id));
        return { ok: true };
      },

      // Not fully implemented yet
      getAutoCoachSuggestions: () => ({ hasData: false, suggestions: [] }),
      applyMacroOverride: () => {},
      buildDailyCoachState: () => ({}),
      buildCoachMessage: () => ({}),
      getDebugMetricsSnapshot: () => ({}),
      getProductMetricsDashboard: async () => ({}),
      getProductMetricsHistory: async () => ({}),
      getSubscriptionStatus: () =>  monetization,
      hasFeatureAccess: () => true,
      startProTrial: () => {},
      activateProPlan: () => {},
      addWaterIntake: () => {},
      createRoutineFromTemplate: () => {},
      saveTodayWorkoutAsRoutine: () => {},
      reorderUserRoutineExercises: () => {},
      duplicateUserRoutine: () => {},
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
      getExerciseProgressionSuggestion,
      getRecentHistory,
      getWeeklySummary,
      getWeeklyInsight,
      getAutoAdjustmentSuggestion,
      saveQuestionnaire,
      applyAutoPlanAdjustment,
    ]
  );

  const workoutValue = useMemo(
    () => ({
      getTodayWorkout,
      workout,
      setWorkout: workoutStore.setWorkout,
      addExercise: workoutStore.addExercise,
      updateSet: workoutStore.updateSet,
      getSmartWorkoutRecommendation: () => ({}),
      getRecommendedWorkoutV4: () => ({}),
      prepareTodayWorkoutTargets: () => {},
      saveWorkoutSet: contextValue.saveWorkoutSet,
      saveFreeWorkoutSet: contextValue.saveFreeWorkoutSet,
      removeTodayWorkoutSet: contextValue.removeTodayWorkoutSet,
      getExerciseProgress: contextValue.getExerciseProgress,
      getExerciseSetProgress: contextValue.getExerciseSetProgress,
      getExerciseProgressionSuggestion,
      getExerciseCatalog: () => [],
      getExercisesByMuscleGroup: () => [],
      getFreeWorkoutSuggestions: () => [],
      getWorkoutGamification,
      getExerciseHistorySnapshot: () => [],
      getTodayWorkoutSummary,
      getWorkoutDelta: () => ({}),
      workoutLogs,
      gamification,
      exerciseTargets,
    }),
    [
      getTodayWorkout,
      workout,
      getExerciseProgressionSuggestion,
      getWorkoutGamification,
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
      addWaterIntake: () => {},
      nutritionLogs,
      history,
      plan,
    }),
    [nutritionLogs, history, plan, getNutritionFeedback, contextValue]
  );

  const coachValue = useMemo(
    () => ({
      buildDailyCoachState: () => ({}),
      buildCoachMessage: () => ({}),
      getAutoCoachSuggestions: () => ({}),
      applyMacroOverride: () => {},
      getDailyMissions: () => [],
      completeMission: () => {},
      getPerformanceScore: () => ({}),
      getNutritionFeedback,
      getSmartWorkoutRecommendation: () => ({}),
      addWaterIntake: () => {},
      history,
      nutritionLogs,
      workoutLogs,
    }),
    [history, nutritionLogs, workoutLogs, getNutritionFeedback]
  );

  return (
    <AppContext.Provider value={contextValue}>
      <WorkoutContext.Provider value={workoutValue}>
        <NutritionContext.Provider value={nutritionValue}>
          <CoachContext.Provider value={coachValue}>
            {children}
          </CoachContext.Provider>
        </NutritionContext.Provider>
      </WorkoutContext.Provider>
    </AppContext.Provider>
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
