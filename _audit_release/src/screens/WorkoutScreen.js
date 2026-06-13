import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNotifications, useNutrition, useWorkout } from '../hooks';
import { updateStreak } from '../utils/streak';
import { suggestNextWeight } from '../utils/suggestNextWeight';
import { calcEvolution } from '../utils/calcEvolution';
import { scheduleStreakPush } from '../utils/push';
import StreakBar from '../components/StreakBar';
import QuickExerciseRegister from '../components/QuickExerciseRegister';
import { useApp } from '../context/AppContext';
import { getCanonicalExerciseId, getCanonicalMuscleGroup } from '../data/exerciseDatabase.js';
import { SCREENS, trackAppError, trackEvent } from '../utils/analytics';
import { calculate1RM, calculateSRPE, calculateVolume, getProgression } from '../services/performanceEngine';
import {
  getWorkoutSetValidationToast,
  isPlausibleStoredWorkoutSet,
  validateWorkoutSetInput,
} from '../services/workoutInputValidation';
import { sanitizeWorkoutLogsForRead } from '../services/workoutLogIntegrity';
import { findBestFuzzyMatch, fuzzySearchExercises } from '../services/fuzzySearch';
import { loadWorkout, saveWorkout } from '../services/storage';
import { loadWorkoutCloud, saveWorkoutCloud } from '../services/cloudWorkoutService';
import { AppCard, CustomKeypad, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { ExerciseCard } from '../components/workout/ExerciseCard';
import { ExerciseExecutionCta } from '../components/exercise/ExerciseExecutionCta';
import { ExerciseMediaFallback } from '../components/exercise/ExerciseMediaFallback';
import { getExerciseByName } from '../data/exercises.js';
import { resolveExerciseMedia } from '../utils/exerciseMedia';
import { colors, spacing, radius } from '../theme';
import { logEvent } from '../core/logger';
import {
  dismissDropRecoveryCandidate,
  markWorkoutSessionState,
  trackEmptyState,
  trackScreenAction,
} from '../core/observability';
import { success } from '../services/feedbackService.js';
import { logError as logQaError } from '../utils/errorLogger';
import { saveCompletedWorkoutToApi, syncPendingWorkouts } from '../services/workoutApiService';
import { onWorkoutCompleted, getEngagementMessage } from '../services/socialEngagementService';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { getWorkoutBySplit, WORKOUT_LIBRARY } from '../context/modules/workout.js';
import { workoutDevLog } from '../utils/workoutDevLog';
import {
  RPE_CHIPS,
  SPARKLINE_WIDTH,
  SPARKLINE_HEIGHT,
  EXERCISE_NAMES_V2,
  safeGetExerciseMetaByName,
  formatTimer,
  getTodayKeyLocal,
  resolveExperimentVariant,
  buildSparklinePoints,
  normalizeText,
  findBestCatalogMatch,
  isCardioExerciseName,
  isCardioExercise,
  normalizeWorkoutExercise,
} from './workout/workoutScreenUtils';
import { WorkoutSetField as SetField } from '../components/workout/WorkoutSetField';
import { useWorkoutRestTimer, WORKOUT_REST_END_STORAGE_KEY } from './workout/useWorkoutRestTimer';
import {
  useWorkoutDraftPersistence,
  WORKOUT_DRAFTS_STORAGE_KEY,
  WORKOUT_SET_COUNT_STORAGE_KEY,
} from './workout/useWorkoutDraftPersistence';
import { useWorkoutSessionUiPersistence, WORKOUT_UI_SESSION_STORAGE_KEY } from './workout/useWorkoutSessionUiPersistence';
import { useWorkoutStorageFlushOnAppState } from './workout/useWorkoutStorageFlushOnAppState';
import { createWorkoutSessionId, resolveEffectiveWorkoutLogs } from '../utils/workoutSessionLogs';
import { canFinishWorkout } from '../services/dailyState';
import {
  INCOMPLETE_EXIT_CONFIRMATION,
  shouldMarkPartialSessionOnExit,
} from '../services/workoutFinishFlow';
import {
  applyExerciseSwapToWorkout,
  buildDraftCleanupForSwap,
  buildExerciseSwapActionCopy,
  buildExerciseSwapPlan,
  hasNonEmptyDraftRows,
  migrateSetCountForSwap,
} from '../services/workoutExerciseSwap';
import { buildWorkoutProgressCopy } from '../services/workoutProgressCopy';
import { buildWorkoutModePresentation } from '../services/workoutModeCopy';
import { buildWorkoutSetRowState } from '../services/workoutSetRowState';
import {
  buildWorkoutSetInputDisplay,
  normalizeSetFieldValue,
} from '../services/workoutSetDisplayValue';
import { buildWorkoutHistoryPresentation } from '../services/workoutHistoryPresentation';

const WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY = '@workout:active-routine-id-v1';
const WORKOUT_FAST_FINISH_EXPERIMENT_KEY = 'exp_workout_fast_finish_v1';
const PAYWALL_TIMING_EXPERIMENT_KEY = 'exp_paywall_timing_v1';

export default function WorkoutScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { workout, setWorkout, user, plan, getUserRoutineById } = useApp();
  const setCurrentExerciseState = useWorkoutStore((state) => state.setCurrentExerciseState);
  const advanceCurrentSet = useWorkoutStore((state) => state.advanceCurrentSet);
  const setRestingState = useWorkoutStore((state) => state.setRestingState);
  const setWorkoutSessionId = useWorkoutStore((state) => state.setWorkoutSessionId);
  const workoutSessionId = useWorkoutStore((state) => state.workoutSessionId);
  const workoutApi = useWorkout() || {};
  const {
    getTodayWorkout,
    prepareTodayWorkoutTargets,
    saveWorkoutSet,
    removeTodayWorkoutSet,
    getExerciseCatalog,
    getExercisesByMuscleGroup,
    getFreeWorkoutSuggestions,
    getExerciseProgress,
    getExerciseSetProgress,
    getExerciseProgressionSuggestion,
    getExerciseHistorySnapshot,
    getTodayWorkoutSummary,
    getWorkoutGamification,
    getWorkoutDelta,
    getSmartWorkoutRecommendation,
    workoutLogs,
  } = workoutApi;
  const { getNutritionFeedback } = useNutrition();
  const { hasFeatureAccess } = useNotifications();

  const todayKey = useMemo(() => getTodayKeyLocal(), []);
  const baseExercises = useMemo(() => {
    const fromToday = Array.isArray(getTodayWorkout?.()) ? getTodayWorkout() : [];
    const recommendation = typeof getSmartWorkoutRecommendation === 'function'
      ? getSmartWorkoutRecommendation()
      : null;
    const fromRecommended = Array.isArray(recommendation?.exercises) ? recommendation.exercises : [];

    let best = fromToday.length >= fromRecommended.length ? fromToday : fromRecommended;
    if (best.length >= 2) {
      return best;
    }

    const fromSplit = getWorkoutBySplit(plan?.trainingSplit) || [];
    if (fromSplit.length >= 2) {
      return fromSplit;
    }

    const pushFallback = WORKOUT_LIBRARY.push || [];
    if (pushFallback.length >= 2) {
      return pushFallback;
    }
    // Fallback definitivo: garante pelo menos 2 exercicios para evitar "ex2-not-added"
    const definitiveFallback = WORKOUT_LIBRARY.fullBody || [];
    if (definitiveFallback.length >= 2) {
      return definitiveFallback;
    }
    return best.length > 0 ? best : definitiveFallback;
  }, [getTodayWorkout, getSmartWorkoutRecommendation, plan?.trainingSplit]);
  const [sessionBaseExercises, setSessionBaseExercises] = useState([]);
  const [customExercises, setCustomExercises] = useState([]);
  const sessionExerciseKey = useMemo(
    () => sessionBaseExercises.map((item) => item.name).join('|'),
    [sessionBaseExercises],
  );
  const allExercises = useMemo(
    () => [...sessionBaseExercises, ...customExercises]
      .map((item, index) => normalizeWorkoutExercise(item, index, 'workout'))
      .filter(Boolean),
    [sessionBaseExercises, customExercises]
  );
  const exerciseCatalog = useMemo(() => {
    const baseCatalog = Array.isArray(getExerciseCatalog()) ? getExerciseCatalog() : [];
    return Array.from(new Set([...baseCatalog, ...EXERCISE_NAMES_V2]));
  }, [getExerciseCatalog]);
  const summary = useMemo(() => getTodayWorkoutSummary(), [getTodayWorkoutSummary]);
  const gamification = useMemo(() => getWorkoutGamification(), [getWorkoutGamification]);
  const workoutVariant = useMemo(
    () => resolveExperimentVariant(String(user?.id || 'anonymous')),
    [user?.id]
  );
  const paywallTimingVariant = useMemo(
    () => resolveExperimentVariant(`${PAYWALL_TIMING_EXPERIMENT_KEY}:${String(user?.id || 'anonymous')}`),
    [user?.id]
  );

  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const draftSetsRef = useRef({});
  const keypadValueRef = useRef('');
  const [draftSetsByExercise, setDraftSetsByExercise] = useState({});
  const [setCountByExercise, setSetCountByExercise] = useState({});
  const { isDraftHydrated } = useWorkoutDraftPersistence({
    draftSetsByExercise,
    setDraftSetsByExercise,
    setCountByExercise,
    setSetCountByExercise,
  });
  const {
    restPreset,
    setRestPreset,
    restSeconds,
    restRunning,
    restEndAt,
    restDoneMessage,
    startRestTimer,
    skipRest,
    extendRestByThirty,
  } = useWorkoutRestTimer();
  const [xpFeedback, setXpFeedback] = useState('');
  const [newExerciseName, setNewExerciseName] = useState('');
  const [newExerciseSets, setNewExerciseSets] = useState('3');
  const [newExerciseReps, setNewExerciseReps] = useState('8-12');
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [savedSetPulseKey, setSavedSetPulseKey] = useState('');
  const [showWorkoutSummary, setShowWorkoutSummary] = useState(false);
  const [workoutSummary, setWorkoutSummary] = useState(null);
  const [showSubstitutePicker, setShowSubstitutePicker] = useState(false);
  const [actionFeedback, setActionFeedback] = useState('');
  const [saveSuccessVisible, setSaveSuccessVisible] = useState(false);
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [syncStatusMessage, setSyncStatusMessage] = useState('');
  const [setSpeedStats, setSetSpeedStats] = useState({ avgMs: 0, lastMs: 0, count: 0 });
  const [simpleMode, setSimpleMode] = useState(true);
  const [restPresetByExercise, setRestPresetByExercise] = useState({});
  const [showCoachDetailsByExercise, setShowCoachDetailsByExercise] = useState({});
  const [keypadState, setKeypadState] = useState({
    visible: false,
    exerciseName: '',
    exerciseIndex: -1,
    setIndex: -1,
    field: 'weight',
    value: '',
  });

  useFocusEffect(
    useCallback(() => () => {
      setKeypadState((prev) => (prev.visible ? { ...prev, visible: false } : prev));
    }, [])
  );

  const { isUiSessionHydrated } = useWorkoutSessionUiPersistence({
    activeExerciseIndex,
    setActiveExerciseIndex,
    simpleMode,
    setSimpleMode,
    hasExercises: allExercises.length > 0,
    workoutSessionId,
    sessionDayKey: todayKey,
  });

  useWorkoutStorageFlushOnAppState({
    enabled: Boolean(isDraftHydrated && isUiSessionHydrated && allExercises.length > 0),
    draftSetsByExercise,
    setCountByExercise,
    activeExerciseIndex,
    simpleMode,
  });

  const computedPlannedSets = useMemo(() => (
    allExercises.reduce((acc, exercise) => (
      acc + Math.max(1, Number(setCountByExercise?.[exercise?.name] || exercise?.sets || 1))
    ), 0)
  ), [allExercises, setCountByExercise]);
  const computedGuidedSets = useMemo(() => {
    const todayLogs = workoutLogs.filter((item) => item.date === todayKey);
    const effectiveLogs = resolveEffectiveWorkoutLogs(todayLogs, workoutSessionId);
    return effectiveLogs.length;
  }, [workoutLogs, todayKey, workoutSessionId]);
  const computedCompletionRate = computedPlannedSets > 0
    ? Math.min(1, computedGuidedSets / computedPlannedSets)
    : 0;

  const displayedSeriesTotal = useMemo(
    () => Math.max(1, computedPlannedSets),
    [computedPlannedSets]
  );

  const canFinishWorkoutNow = useMemo(
    () => canFinishWorkout({ plannedSets: computedPlannedSets, completedSets: computedGuidedSets }),
    [computedPlannedSets, computedGuidedSets]
  );

  const finishButtonTitle = useMemo(() => {
    if (isSavingWorkout) {
      return 'Salvando treino...';
    }

    if (computedPlannedSets > 0) {
      return `Finalizar treino (${computedGuidedSets}/${computedPlannedSets})`;
    }

    return 'Finalizar treino';
  }, [isSavingWorkout, computedGuidedSets, computedPlannedSets]);

  const progressCopy = useMemo(
    () => buildWorkoutProgressCopy({
      completedSets: computedGuidedSets,
      plannedSets: computedPlannedSets,
      currentExerciseIndex: activeExerciseIndex,
      totalExercises: allExercises.length,
      canFinish: canFinishWorkoutNow,
    }),
    [computedGuidedSets, computedPlannedSets, activeExerciseIndex, allExercises.length, canFinishWorkoutNow]
  );

  const modePresentation = useMemo(
    () => buildWorkoutModePresentation({ simpleMode }),
    [simpleMode]
  );

  const postWorkoutNutritionFeedback = typeof getNutritionFeedback === 'function'
    ? getNutritionFeedback({ trainedToday: true })
    : { suggestion: '', missingProtein: 0 };

  const safeGetExerciseSetProgress = (...args) => (
    typeof getExerciseSetProgress === 'function'
      ? (getExerciseSetProgress(...args) || { completedSets: 0, totalSets: Number(args?.[1] || 0), nextSet: 1, isDone: false })
      : { completedSets: 0, totalSets: Number(args?.[1] || 0), nextSet: 1, isDone: false }
  );

  const safeGetExerciseHistorySnapshot = (...args) => (
    typeof getExerciseHistorySnapshot === 'function' ? (getExerciseHistorySnapshot(...args) || []) : []
  );

  const safeGetExerciseProgressionSuggestion = (...args) => (
    typeof getExerciseProgressionSuggestion === 'function'
      ? (getExerciseProgressionSuggestion(...args) || { suggestedWeight: 0, message: '' })
      : { suggestedWeight: 0, message: '' }
  );

  const safeGetExerciseProgress = (...args) => (
    typeof getExerciseProgress === 'function'
      ? (getExerciseProgress(...args) || { bestWeight: 0 })
      : { bestWeight: 0 }
  );

  const navigateWithTracking = (target, params, action) => {
    trackEvent('navigation_triggered', {
      screen: SCREENS.WORKOUT,
      meta: {
        domain: 'navigation',
        version: 1,
        action,
        from: SCREENS.WORKOUT,
        to: target,
      },
    });

    try {
      navigation.navigate(target, params);
    } catch (error) {
      trackAppError(error, {
        screen: SCREENS.WORKOUT,
        action: 'navigation.navigate',
        target,
        context: { navigationAction: action },
      });
    }
  };

  const scrollRef = useRef(null);
  const prevActiveExerciseIndexRef = useRef(activeExerciseIndex);
  const exercisePositionsRef = useRef({});
  const setFieldRefs = useRef({});
  const xpPulseAnim = useRef(new Animated.Value(0)).current;
  const setInteractionStartRef = useRef({});
  const postWorkoutTriggeredRef = useRef(false);
  const prevCompletionRateRef = useRef(null);
  const sessionSetsSavedRef = useRef(0);
  const sessionStartXpRef = useRef(null);
  const actionFeedbackAnim = useRef(new Animated.Value(0)).current;
  const rowPulseAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const sessionStartedAtRef = useRef(Date.now());
  const emptyExerciseListLoggedRef = useRef(false);
  
  // BLOCO 1: Animação + Recompensa
  const xpFloatAnimY = useRef(new Animated.Value(0)).current;
  const xpFloatOpacity = useRef(new Animated.Value(1)).current;
  const successFlashAnim = useRef(new Animated.Value(0)).current;
  const [showXpFloat, setShowXpFloat] = useState(false);
  const [xpFloatValue, setXpFloatValue] = useState('+20 XP');
  const [showSuccessFlash, setShowSuccessFlash] = useState(false);

  // BLOCO 4: Progresso Visual - Smooth progress bar animation
  const progressFillAnim = useRef(new Animated.Value(0)).current;

  // BLOCO 4: Animar progress bar quando completion rate mudar
  useEffect(() => {
    const targetValue = Math.max(2, progressCopy.completionPercent || 0);
    Animated.timing(progressFillAnim, {
      toValue: targetValue,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progressCopy.completionPercent, progressFillAnim]);

  useEffect(() => {
    let alive = true;

    (async () => {
      let nextSessionId = null;
      try {
        const raw = await AsyncStorage.getItem(WORKOUT_UI_SESSION_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.sessionDayKey === todayKey && parsed?.workoutSessionId) {
            nextSessionId = parsed.workoutSessionId;
          }
        }
      } catch (error) {
        logQaError(error, {
          action: 'restoreWorkoutSessionId',
          screen: SCREENS.WORKOUT,
          severity: 'low',
        });
      }

      if (!nextSessionId) {
        nextSessionId = createWorkoutSessionId();
      }

      if (!alive) {
        return;
      }

      const oldSessionId = useWorkoutStore.getState().workoutSessionId || null;
      setWorkoutSessionId(nextSessionId);
      workoutDevLog('START_WORKOUT', {
        source: route?.params?.source || 'workout_screen_mount',
        oldSessionId,
        newSessionId: nextSessionId,
        reused: oldSessionId === nextSessionId,
      });
    })();

    return undefined;
  }, [route?.params?.source, setWorkoutSessionId, todayKey]);

  useEffect(() => {
    workoutDevLog('SCREEN_OPEN', {
      route: route?.name || 'Workout',
      dayKey: todayKey,
      activeWorkout: useWorkoutStore.getState().workoutSessionId || null,
      initialCounter: `${computedGuidedSets}/${displayedSeriesTotal}`,
    });
  }, [computedGuidedSets, displayedSeriesTotal, route?.name, todayKey]);

  useEffect(() => {
    loadWorkout().then((data) => {
      if (data) setWorkout(data);
    }).catch(() => {
      // Ignora cache inválido sem interromper o treino.
    });
  }, []);

  useEffect(() => {
    saveWorkout(workout).catch(() => {
      // Persistência local resiliente.
    });
  }, [workout]);

  useEffect(() => {
    setRestingState(restRunning);
  }, [restRunning, setRestingState]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    loadWorkoutCloud(user.id)
      .then((data) => {
        if (data?.exercises?.length) {
          setWorkout(data);
        }
      })
      .catch(() => {
        // Mantem fallback local quando cloud estiver indisponivel.
      });
  }, [user?.id, setWorkout]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    saveWorkoutCloud(user.id, workout).catch(() => {
      // Falha de sync cloud nao pode bloquear o treino local.
    });
  }, [user?.id, workout]);

  const selectedWorkoutId = String(route?.params?.workoutId || '').trim();
  const selectedWorkout = selectedWorkoutId ? getUserRoutineById(selectedWorkoutId) : null;

  useEffect(() => {
    if (!selectedWorkoutId) {
      return;
    }

    AsyncStorage.setItem(WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY, selectedWorkoutId).catch(() => {
      // Falha de cache local nao pode interromper o treino.
    });
  }, [selectedWorkoutId]);

  const addExercise = (exercise) => {
    setWorkout(prev => ({
      ...prev,
      exercises: [
        ...prev.exercises,
        {
          ...exercise,
          sets: [{ reps: '', weight: '', done: false }]
        }
      ]
    }));
  };

  const openExerciseDetail = useCallback((exerciseName) => {
    const detail = safeGetExerciseMetaByName(exerciseName) || { name: exerciseName };
    navigateWithTracking('ExerciseDetail', { exercise: detail }, 'open_exercise_detail');
  }, [navigateWithTracking]);

  const updateSet = useCallback((exerciseIndex, setIndex, field, value) => {
    setWorkout((prev) => {
      const currentExercises = Array.isArray(prev?.exercises) ? prev.exercises : [];
      const updated = currentExercises.map((exercise, idx) => {
        if (idx !== exerciseIndex) {
          return exercise;
        }

        const nextSets = (Array.isArray(exercise?.sets) ? exercise.sets : []).map((setItem, setIdx) => {
          if (setIdx !== setIndex) {
            return setItem;
          }

          return {
            ...setItem,
            [field]: value,
          };
        });

        return {
          ...exercise,
          sets: nextSets,
        };
      });

      return {
        ...prev,
        exercises: updated,
      };
    });
  }, [setWorkout]);

  useEffect(() => {
    if (typeof prepareTodayWorkoutTargets === 'function') {
      prepareTodayWorkoutTargets();
    }
    logEvent('workout_start', {
      screen: SCREENS.WORKOUT,
      source: 'WorkoutScreen',
    });
  }, []);

  useEffect(() => {
    if (allExercises.length > 0) {
      emptyExerciseListLoggedRef.current = false;
      return;
    }

    if (emptyExerciseListLoggedRef.current) {
      return;
    }

    emptyExerciseListLoggedRef.current = true;
    trackEmptyState({
      screen: SCREENS.WORKOUT,
      reason: 'exercise_list_empty',
      filter: 'today',
    });
    logEvent('empty_exercise_list', {
      screen: SCREENS.WORKOUT,
      filter: 'today',
    });
  }, [allExercises.length]);

  useEffect(() => {
    trackEvent('workout_fast_finish_cta_viewed', {
      screen: SCREENS.WORKOUT,
      meta: {
        domain: 'workout',
        version: 1,
        experimentKey: WORKOUT_FAST_FINISH_EXPERIMENT_KEY,
        variant: workoutVariant,
        canFinish: canFinishWorkoutNow,
        guidedSets: computedGuidedSets,
        plannedSets: computedPlannedSets,
      },
    });
    if (!canFinishWorkoutNow && computedPlannedSets > 0 && computedGuidedSets < computedPlannedSets) {
      trackEvent('workout_finish_blocked_incomplete', {
        screen: SCREENS.WORKOUT,
        meta: {
          guidedSets: computedGuidedSets,
          plannedSets: computedPlannedSets,
          completionRate: computedCompletionRate,
        },
      });
    }
  }, [workoutVariant, canFinishWorkoutNow, computedGuidedSets, computedPlannedSets, computedCompletionRate]);

  useEffect(() => {
    if (selectedWorkoutId || customExercises.length > 0) {
      return;
    }

    const normalized = (Array.isArray(baseExercises) ? baseExercises : [])
      .map((item, index) => normalizeWorkoutExercise(item, index, 'base'))
      .filter(Boolean);

    if (!normalized.length) {
      return;
    }

    if (!sessionBaseExercises.length) {
      setSessionBaseExercises(normalized);
      return;
    }

    if (sessionBaseExercises.length >= normalized.length) {
      return;
    }

    const sessionKey = sessionBaseExercises.map((item) => item.name).join('|');
    const targetKey = normalized.map((item) => item.name).join('|');
    if (sessionKey === targetKey) {
      return;
    }

    setSessionBaseExercises(normalized);
    setSetCountByExercise(
      normalized.reduce((acc, item) => {
        acc[item.name] = Math.max(3, Number(item.sets || 3));
        return acc;
      }, {})
    );
  }, [baseExercises, selectedWorkoutId, sessionBaseExercises, customExercises.length]);

  const qaMultiWorkoutEnabled = __DEV__
    && String(process.env.EXPO_PUBLIC_QA_MULTI_WORKOUT || '').trim() === '1';

  useEffect(() => {
    if (selectedWorkoutId || !isDraftHydrated) {
      return;
    }

    const normalized = (Array.isArray(baseExercises) ? baseExercises : [])
      .map((item, index) => normalizeWorkoutExercise(item, index, 'base'))
      .filter(Boolean);

    if (normalized.length < 2) {
      return;
    }

    const guidedSetsToday = sanitizeWorkoutLogsForRead(
      Array.isArray(workoutLogs) ? workoutLogs : []
    )
      .filter((item) => item.date === todayKey && (item.mode || 'guided') !== 'free')
      .length;

    if (guidedSetsToday > 0 && sessionBaseExercises.length >= 1) {
      if (sessionBaseExercises.length < normalized.length) {
        const sessionName = String(sessionBaseExercises[0]?.name || '').trim().toLowerCase();
        const sessionInTarget = normalized.some(
          (item) => String(item?.name || '').trim().toLowerCase() === sessionName,
        );
        if (sessionInTarget) {
          const existingNames = new Set(
            sessionBaseExercises.map((item) => String(item?.name || '').trim().toLowerCase()),
          );
          const toAppend = normalized.filter(
            (item) => !existingNames.has(String(item?.name || '').trim().toLowerCase()),
          );
          if (toAppend.length > 0) {
            setSessionBaseExercises([...sessionBaseExercises, ...toAppend]);
            setSetCountByExercise((prev) => {
              const next = { ...prev };
              toAppend.forEach((item) => {
                if (!next[item.name]) {
                  next[item.name] = Math.max(3, Number(item.sets || 3));
                }
              });
              return next;
            });
          } else if (sessionBaseExercises.length < normalized.length) {
            setSessionBaseExercises(normalized);
          }
        }
      }
      if (sessionBaseExercises.length >= normalized.length) {
        return;
      }
    }

    if (sessionBaseExercises.length >= normalized.length) {
      return;
    }

    const sessionKey = sessionBaseExercises.map((item) => item.name).join('|');
    const targetKey = normalized.map((item) => item.name).join('|');
    if (sessionKey === targetKey) {
      return;
    }

    setSessionBaseExercises(normalized);
    setCustomExercises([]);
    setActiveExerciseIndex(0);
    setSetCountByExercise(
      normalized.reduce((acc, item) => {
        acc[item.name] = Math.max(3, Number(item.sets || 3));
        return acc;
      }, {})
    );
  }, [
    selectedWorkoutId,
    isDraftHydrated,
    baseExercises,
    sessionBaseExercises,
    workoutLogs,
    todayKey,
  ]);

  useEffect(() => {
    if (!qaMultiWorkoutEnabled || selectedWorkoutId || !isDraftHydrated) {
      return;
    }

    const normalized = (Array.isArray(baseExercises) ? baseExercises : [])
      .map((item, index) => normalizeWorkoutExercise(item, index, 'base'))
      .filter(Boolean);

    if (normalized.length < 5) {
      return;
    }

    const sessionKey = sessionBaseExercises.map((item) => item.name).join('|');
    const targetKey = normalized.map((item) => item.name).join('|');
    if (sessionKey === targetKey) {
      return;
    }

    setSessionBaseExercises(normalized);
    setCustomExercises([]);
    setActiveExerciseIndex(0);
    setSetCountByExercise(
      normalized.reduce((acc, item) => {
        acc[item.name] = Math.max(3, Number(item.sets || 3));
        return acc;
      }, {})
    );
  }, [
    qaMultiWorkoutEnabled,
    selectedWorkoutId,
    isDraftHydrated,
    baseExercises,
    sessionBaseExercises,
  ]);

  useEffect(() => {
    if (!selectedWorkoutId) {
      return;
    }

    const selectedRoutine = getUserRoutineById(selectedWorkoutId);
    if (!selectedRoutine?.exercises?.length) {
      return;
    }

    const safeRoutine = selectedRoutine.exercises
      .map((item, index) => {
        const rawName = typeof item === 'string' ? item : item?.name;
        const name = String(rawName || '').trim();

        return {
          id: String((typeof item === 'object' && item?.canonicalId) || `${selectedRoutine.id}-exercise-${index + 1}`),
          name,
          sets: Math.max(1, Number((typeof item === 'object' && item?.sets) || 3)),
          reps: String((typeof item === 'object' && item?.reps) || '8-12'),
          targetWeight: Number((typeof item === 'object' && item?.targetWeight) || 0),
        };
      })
      .filter((item) => item.name);

    if (!safeRoutine.length) {
      return;
    }

    const targetKey = safeRoutine.map((item) => item.name).join('|');
    if (sessionExerciseKey === targetKey) {
      return;
    }

    const guidedSetsToday = sanitizeWorkoutLogsForRead(
      Array.isArray(workoutLogs) ? workoutLogs : []
    )
      .filter((item) => item.date === todayKey && (item.mode || 'guided') !== 'free')
      .length;
    const shouldPreserveSessionState = guidedSetsToday > 0 && !sessionExerciseKey;

    const normalizedBase = (Array.isArray(baseExercises) ? baseExercises : [])
      .map((item, index) => normalizeWorkoutExercise(item, index, 'base'))
      .filter(Boolean);

    if (safeRoutine.length < 2 && normalizedBase.length >= 2) {
      const baseTargetKey = normalizedBase.map((item) => item.name).join('|');
      if (sessionExerciseKey === baseTargetKey) {
        return;
      }

      setSessionBaseExercises(normalizedBase);
      setCustomExercises([]);
      if (!shouldPreserveSessionState) {
        setActiveExerciseIndex(0);
        setSetCountByExercise(
          normalizedBase.reduce((acc, item) => {
            acc[item.name] = Number(item.sets || 3);
            return acc;
          }, {})
        );
        setDraftSetsByExercise(
          normalizedBase.reduce((acc, item) => {
            const totalSets = Math.max(1, Number(item.sets || 3));
            acc[item.name] = Array.from({ length: totalSets }, () => ({
              weight: '',
              reps: '',
              rpe: '8',
            }));
            return acc;
          }, {})
        );
      }
      setShowWorkoutSummary(false);
      setShowSubstitutePicker(false);
      setExerciseQuery('');
      return;
    }

    setSessionBaseExercises(safeRoutine);
    setCustomExercises([]);
    if (!shouldPreserveSessionState) {
      setActiveExerciseIndex(0);
      setSetCountByExercise(
        safeRoutine.reduce((acc, item) => {
          acc[item.name] = Number(item.sets || 3);
          return acc;
        }, {})
      );
      setDraftSetsByExercise(
        safeRoutine.reduce((acc, item) => {
          const totalSets = Math.max(1, Number(item.sets || 3));
          acc[item.name] = Array.from({ length: totalSets }, () => ({
            weight: '',
            reps: '',
            rpe: '8',
          }));
          return acc;
        }, {})
      );
    }
    setShowWorkoutSummary(false);
    setShowSubstitutePicker(false);
    setExerciseQuery('');
  }, [selectedWorkoutId, getUserRoutineById, sessionExerciseKey, workoutLogs, todayKey, baseExercises]);

  useEffect(() => {
    if (!allExercises.length) {
      if (activeExerciseIndex !== 0) {
        setActiveExerciseIndex(0);
      }
      return;
    }

    if (activeExerciseIndex < 0 || activeExerciseIndex >= allExercises.length) {
      setActiveExerciseIndex(0);
    }
  }, [allExercises.length, activeExerciseIndex]);

  useEffect(() => {
    setDraftSetsByExercise((prev) => {
      const next = { ...prev };
      let changed = false;

      for (const exercise of allExercises) {
        if (next[exercise.name]) {
          continue;
        }

        next[exercise.name] = Array.from({ length: Number(exercise.sets || 3) }, () => ({
          weight: '',
          reps: '',
          rpe: '8',
        }));
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [allExercises]);

  useEffect(() => {
    setSetCountByExercise((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const exercise of allExercises) {
        if (next[exercise.name]) {
          continue;
        }
        next[exercise.name] = Number(exercise.sets || 3);
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [allExercises]);

  useEffect(() => {
    if (sessionStartXpRef.current == null) {
      sessionStartXpRef.current = Number(gamification.xp || 0);
    }
  }, [gamification.xp]);

  const inferRepTarget = (exercise) => {
    const range = String(exercise?.reps || '8-12');
    if (range.includes('-')) {
      const parts = range.split('-').map((item) => Number(String(item).trim())).filter((num) => Number.isFinite(num));
      if (parts.length === 2) {
        return String(parts[1]);
      }
    }
    const numeric = Number(range);
    if (Number.isFinite(numeric) && numeric > 0) {
      return String(numeric);
    }
    return '10';
  };

  useEffect(() => {
    if (!xpFeedback) {
      return;
    }

    xpPulseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(xpPulseAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(xpPulseAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    const timeoutId = setTimeout(() => {
      setXpFeedback('');
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [xpFeedback, xpPulseAnim]);

  useEffect(() => {
    if (!showWorkoutSummary) {
      fadeAnim.setValue(0);
      return;
    }

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [showWorkoutSummary, fadeAnim]);

  useEffect(() => {
    const prevRate = prevCompletionRateRef.current;
    prevCompletionRateRef.current = computedCompletionRate;

    if (computedCompletionRate < 1) {
      return;
    }

    if (sessionSetsSavedRef.current <= 0) {
      return;
    }

    // Nao redirecionar ao abrir treino ja concluido em sessao anterior.
    if (prevRate === null || prevRate >= 1) {
      return;
    }

    if (postWorkoutTriggeredRef.current) {
      return;
    }

    postWorkoutTriggeredRef.current = true;

    if (!hasFeatureAccess('auto_coach')) {
      const paywallPayload = {
        featureKey: 'auto_coach',
        source: paywallTimingVariant === 'B' ? 'post_workout_insight' : 'post_workout',
        message: 'Treino completo, mas voce ainda esta treinando no escuro. O Auto Coach ajusta seu treino automaticamente.',
        paywallExperiment: {
          key: PAYWALL_TIMING_EXPERIMENT_KEY,
          variant: paywallTimingVariant,
        },
      };

      if (paywallTimingVariant === 'B') {
        navigateWithTracking('Insights', {
          postValuePaywall: paywallPayload,
          paywallExperiment: paywallPayload.paywallExperiment,
        }, 'post_workout_insight_then_paywall');
        return;
      }

      navigateWithTracking('Paywall', paywallPayload, 'post_workout_paywall');
    }
  }, [computedCompletionRate, computedGuidedSets, computedPlannedSets, hasFeatureAccess, navigation, paywallTimingVariant]);

  useEffect(() => {
    const prevIndex = prevActiveExerciseIndexRef.current;
    prevActiveExerciseIndexRef.current = activeExerciseIndex;
    if (simpleMode || prevIndex === activeExerciseIndex) {
      return;
    }

    const activeExercise = allExercises[activeExerciseIndex];
    if (!activeExercise || !scrollRef.current) {
      return;
    }

    const y = exercisePositionsRef.current[activeExercise.id];
    if (typeof y === 'number') {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 20), animated: true });
    }
  }, [activeExerciseIndex, allExercises, simpleMode]);

  const activeExercise = allExercises[activeExerciseIndex] || null;
  const exerciseSwapUiCopy = useMemo(
    () => buildExerciseSwapActionCopy({
      currentExerciseName: activeExercise?.name,
    }),
    [activeExercise?.name]
  );

  const getExerciseRestPreset = useCallback((exerciseName) => {
    const perExercise = restPresetByExercise[exerciseName];
    if (Number.isFinite(Number(perExercise)) && Number(perExercise) > 0) {
      return Number(perExercise);
    }
    return restPreset;
  }, [restPresetByExercise, restPreset]);

  const handleExerciseRestPreset = useCallback((exerciseName, value) => {
    const safeValue = Math.max(30, Number(value || 60));
    setRestPreset(safeValue);
    if (exerciseName) {
      setRestPresetByExercise((prev) => ({ ...prev, [exerciseName]: safeValue }));
    }
  }, []);

  useEffect(() => {
    if (!activeExercise) {
      setCurrentExerciseState(null, 1);
      return;
    }

    const plannedSets = Number(setCountByExercise[activeExercise.name] || activeExercise.sets || 3);
    const progress = safeGetExerciseSetProgress(activeExercise.name, plannedSets);
    setCurrentExerciseState(activeExercise, progress?.nextSet || 1);
  }, [activeExercise, safeGetExerciseSetProgress, setCountByExercise, setCurrentExerciseState]);

  const inferExerciseGroup = (exerciseName) => {
    const canonical = getCanonicalMuscleGroup(exerciseName);
    if (canonical) return canonical;

    const lower = String(exerciseName || '').toLowerCase();
    if (lower.includes('supino') || lower.includes('crucifixo') || lower.includes('peck')) return 'peito';
    if (lower.includes('remada') || lower.includes('puxada') || lower.includes('pull')) return 'costas';
    if (lower.includes('agach') || lower.includes('leg') || lower.includes('stiff') || lower.includes('panturrilha') || lower.includes('terra')) return 'perna';
    if (lower.includes('desenvolvimento') || lower.includes('elevacao')) return 'ombro';
    if (lower.includes('triceps')) return 'triceps';
    if (lower.includes('rosca') || lower.includes('biceps')) return 'biceps';
    return null;
  };

  const getExerciseKey = (exerciseName = '') => {
    const canonicalId = getCanonicalExerciseId(exerciseName);
    if (canonicalId) {
      return `id:${canonicalId}`;
    }
    return `name:${String(exerciseName || '').toLowerCase().trim()}`;
  };

  const isSameExerciseLog = (entry, exerciseName) => {
    if (!entry) {
      return false;
    }

    const targetKey = getExerciseKey(exerciseName);
    const logKey = entry.exerciseId
      ? `id:${entry.exerciseId}`
      : getExerciseKey(entry.exerciseName);

    return targetKey === logKey;
  };

  const getChronologicalExerciseLogs = (exerciseName, { includeFree = false } = {}) => {
    const todayLogs = workoutLogs.filter((item) => item.date === todayKey);
    const effectiveLogs = resolveEffectiveWorkoutLogs(todayLogs, workoutSessionId);

    return effectiveLogs
      .filter((item) => isSameExerciseLog(item, exerciseName)
        && (includeFree || (item.mode || 'guided') !== 'free'))
      .slice()
      .sort((a, b) => {
        const left = Number(new Date(a.createdAt || a.date || 0));
        const right = Number(new Date(b.createdAt || b.date || 0));
        return left - right;
      });
  };

  const buildUnifiedSetRows = useCallback((exerciseName, plannedSets) => {
    const safePlannedSets = Math.max(1, Number(plannedSets || 1));
    const persistedSets = getChronologicalExerciseLogs(exerciseName)
      .slice(0, safePlannedSets);
    const draftRows = draftSetsByExercise[exerciseName] || [];

    return Array.from({ length: safePlannedSets }).map((_, index) => {
      const saved = persistedSets[index] || null;
      const draft = draftRows[index] || { weight: '', reps: '', rpe: '8' };

      if (saved) {
        return {
          id: `${exerciseName}-saved-${index}`,
          index,
          done: true,
          saved,
          weight: normalizeSetFieldValue(saved.weight),
          reps: normalizeSetFieldValue(saved.reps),
          rpe: normalizeSetFieldValue(saved.rpe || '8'),
        };
      }

      return {
        id: `${exerciseName}-draft-${index}`,
        index,
        done: false,
        saved: null,
        weight: normalizeSetFieldValue(draft.weight),
        reps: normalizeSetFieldValue(draft.reps),
        rpe: normalizeSetFieldValue(draft.rpe || '8'),
      };
    });
  }, [draftSetsByExercise, isSameExerciseLog, todayKey, workoutLogs]);

  const suggestedExercises = useMemo(() => {
    const query = normalizeText(exerciseQuery);
    if (!activeExercise) {
      if (!query) {
        return exerciseCatalog.slice(0, 20);
      }

      return fuzzySearchExercises(query, exerciseCatalog, 20).slice(0, 20);
    }

    const group = inferExerciseGroup(activeExercise.name);
    const sameGroup = group ? getExercisesByMuscleGroup(group) : [];
    const related = getFreeWorkoutSuggestions([activeExercise.name]);
    const combined = [...sameGroup, ...related, ...exerciseCatalog];
    const unique = Array.from(new Set(combined));

    if (!query) {
      return unique.slice(0, 20);
    }

    return fuzzySearchExercises(query, unique, 20).slice(0, 20);
  }, [activeExercise, exerciseCatalog, getFreeWorkoutSuggestions, getExercisesByMuscleGroup, exerciseQuery]);

  const lastSetByExercise = useMemo(() => {
    const map = {};
    workoutLogs.forEach((item) => {
      if (!isPlausibleStoredWorkoutSet(item)) {
        return;
      }
      const key = item.exerciseId ? `id:${item.exerciseId}` : getExerciseKey(item.exerciseName);
      if (!map[key]) {
        map[key] = item;
      }
    });
    return map;
  }, [workoutLogs]);

  const getLastSetForExercise = (exerciseName) => {
    return lastSetByExercise[getExerciseKey(exerciseName)] || null;
  };

  const suggestedWeightByExercise = useMemo(() => {
    const map = {};
    allExercises.forEach((exercise) => {
      const suggestion = getExerciseProgressionSuggestion(exercise.name);
      const suggested = Number(suggestion?.suggestedWeight || exercise.targetWeight || 0);
      map[exercise.name] = suggested > 0 ? String(suggested) : '';
    });
    return map;
  }, [allExercises, getExerciseProgressionSuggestion]);

  // Preenche peso/reps/rpe default para reduzir toque manual no primeiro preenchimento.
  useEffect(() => {
    setDraftSetsByExercise((prev) => {
      const next = { ...prev };
      let changed = false;

      allExercises.forEach((exercise) => {
        const rows = Array.isArray(next[exercise.name]) ? [...next[exercise.name]] : [];
        const suggestedWeight = String(suggestedWeightByExercise[exercise.name] || '');
        const lastSet = getLastSetForExercise(exercise.name);
        const lastReps = String(lastSet?.reps || '');
        const defaultReps = lastReps || inferRepTarget(exercise);
        const defaultRpe = String(lastSet?.rpe || '8');

        const updatedRows = rows.map((row) => {
          const normalized = { ...row };
          if (!String(normalized.weight || '').trim() && suggestedWeight) {
            normalized.weight = suggestedWeight;
          }
          if (!String(normalized.reps || '').trim() && defaultReps) {
            normalized.reps = defaultReps;
          }
          if (!String(normalized.rpe || '').trim()) {
            normalized.rpe = defaultRpe;
          }

          if (normalized.weight !== row.weight || normalized.reps !== row.reps || normalized.rpe !== row.rpe) {
            changed = true;
          }

          return normalized;
        });

        next[exercise.name] = updatedRows;
      });

      return changed ? next : prev;
    });
  }, [allExercises, suggestedWeightByExercise, lastSetByExercise]);

  const getSetFieldKey = (exerciseName, setIndex, field) => `${exerciseName}-${setIndex}-${field}`;
  const getSetInteractionKey = (exerciseName, setIndex) => `${exerciseName}::${setIndex}`;

  const focusSetField = (exerciseName, setIndex, field = 'weight') => {
    const key = getSetFieldKey(exerciseName, setIndex, field);
    const target = setFieldRefs.current[key];
    if (target?.focus) {
      target.focus();
    }
  };

  const normalizeNumericInput = (value) => String(value || '').replace(',', '.').trim();

  const openKeypadForField = (exercise, exerciseIndex, setIndex, field, currentValue) => {
    const nextValue = String(currentValue || '');
    keypadValueRef.current = nextValue;
    setKeypadState({
      visible: true,
      exerciseName: String(exercise?.name || ''),
      exerciseIndex,
      setIndex,
      field,
      value: nextValue,
    });
  };

  const closeKeypad = () => {
    setKeypadState((prev) => ({ ...prev, visible: false }));
  };

  const confirmKeypad = () => {
    const { exerciseName, setIndex, field, exerciseIndex } = keypadState;
    if (exerciseName && setIndex >= 0 && field) {
      const draftRow = (draftSetsRef.current[exerciseName] || [])[setIndex]
        || (draftSetsByExercise[exerciseName] || [])[setIndex]
        || { weight: '', reps: '', rpe: '8' };
      if (field === 'reps') {
        const plannedSets = Number(setCountByExercise[exerciseName] || allExercises?.[exerciseIndex]?.sets || 3);
        const canSave = setIndex === (workoutLogs
          .filter((item) => item.date === todayKey && isSameExerciseLog(item, exerciseName) && (item.mode || 'guided') !== 'free')
          .slice(0, plannedSets).length);
        if (canSave && exerciseIndex >= 0) {
          saveSetLine(allExercises[exerciseIndex], exerciseIndex, setIndex, draftRow);
        }
      }
    }
    closeKeypad();
  };

  const showActionToast = (message) => {
    setActionFeedback(message);
    actionFeedbackAnim.setValue(0);
    Animated.sequence([
      Animated.timing(actionFeedbackAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.delay(900),
      Animated.timing(actionFeedbackAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setActionFeedback('');
    });
  };

  const resolveWithTimeout = async (promise, timeoutMs, fallbackValue) => {
    let timeoutId = null;
    try {
      const timeoutPromise = new Promise((resolve) => {
        timeoutId = setTimeout(() => resolve(fallbackValue), Math.max(500, Number(timeoutMs || 0)));
      });
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  };

  const setDraftField = (exerciseName, setIndex, field, value) => {
    const interactionKey = getSetInteractionKey(exerciseName, setIndex);
    if (!setInteractionStartRef.current[interactionKey]) {
      setInteractionStartRef.current[interactionKey] = Date.now();
    }

    const prevDraft = draftSetsRef.current || {};
    const currentRows = [...(prevDraft[exerciseName] || [])];
    while (currentRows.length <= setIndex) {
      currentRows.push({ weight: '', reps: '', rpe: '8' });
    }
    const rows = currentRows.map((row, idx) =>
      idx === setIndex ? { ...row, [field]: value } : row
    );
    draftSetsRef.current = {
      ...prevDraft,
      [exerciseName]: rows,
    };

    setDraftSetsByExercise((prev) => {
      const stateRows = [...(prev[exerciseName] || [])];
      while (stateRows.length <= setIndex) {
        stateRows.push({ weight: '', reps: '', rpe: '8' });
      }

      const nextRows = stateRows.map((row, idx) =>
        idx === setIndex ? { ...row, [field]: value } : row
      );
      return {
        ...prev,
        [exerciseName]: nextRows,
      };
    });
  };

  const handleChangeSet = (exerciseName, setIndex, field, value) => {
    setDraftField(exerciseName, setIndex, field, value);
  };

  const handleCompleteSet = (exerciseName, setIndex) => {
    const exerciseIndex = allExercises.findIndex((item) => item.name === exerciseName);
    const exercise = allExercises[exerciseIndex];
    if (!exercise) {
      showActionToast('Exercicio indisponivel no momento.');
      return;
    }
    saveSetLine(exercise, exerciseIndex, setIndex);
  };

  const handleAddSet = (exerciseName) => {
    addSetToExercise(exerciseName);
  };

  const jumpToNextExercise = (currentIndex) => {
    for (let index = currentIndex + 1; index < allExercises.length; index += 1) {
      const item = allExercises[index];
      const plannedSets = Number(setCountByExercise[item.name] || item.sets || 3);
      const progress = safeGetExerciseSetProgress(item.name, plannedSets);
      if (!progress.isDone) {
        setActiveExerciseIndex(index);
        return;
      }
    }

    // Evita salto para o primeiro exercício quando o usuário está focado em outro.
    setActiveExerciseIndex(currentIndex);
  };

  const saveSetLine = (exercise, exerciseIndex, setIndex, rowOverride) => {
    const saveStartAt = Date.now();
    const plannedSets = Number(setCountByExercise[exercise.name] || exercise.sets || 3);
    const todaySets = getChronologicalExerciseLogs(exercise.name);
    workoutDevLog('SET_SAVE_BEFORE', {
      dayKey: todayKey,
      exercise: exercise?.name,
      completed: Number(todaySets?.length || 0),
      planned: plannedSets,
      setIndex: Number(setIndex),
    });

    const nextIndex = todaySets.length;
    const requestedIndex = Number.isInteger(setIndex) ? setIndex : nextIndex;
    const effectiveSetIndex = requestedIndex >= nextIndex ? nextIndex : requestedIndex;

    if (requestedIndex < nextIndex) {
      logQaError(new Error('workout_set_order_invalid'), {
        screen: SCREENS.WORKOUT,
        severity: 'low',
        extra: { expectedSetIndex: nextIndex, receivedSetIndex: requestedIndex },
      });
      showActionToast(`A serie ${requestedIndex + 1} ja foi salva.`);
      return;
    }

    // Hard guard: nunca permitir salvar além das séries planejadas (bug "5/4").
    // Sem isso, "+ serie" continuava aceitando registros depois de plannedSets.
    if (nextIndex >= plannedSets) {
      workoutDevLog('SET_LIMIT_BLOCKED', {
        exercise: exercise?.name,
        attempted: nextIndex + 1,
        planned: plannedSets,
      });
      logQaError(new Error('workout_set_over_limit'), {
        screen: SCREENS.WORKOUT,
        severity: 'low',
        extra: {
          exerciseName: exercise.name,
          plannedSets,
          attempted: nextIndex + 1,
        },
      });
      showActionToast(
        canFinishWorkoutNow
          ? `Limite de ${plannedSets} series atingido. Toque em Finalizar treino.`
          : `Limite de ${plannedSets} series neste exercicio. Continue o treino ou salve o progresso parcial.`
      );
      return;
    }

    const row = rowOverride
      || (draftSetsRef.current[exercise.name] || [])[effectiveSetIndex]
      || (draftSetsByExercise[exercise.name] || [])[effectiveSetIndex]
      || { weight: '', reps: '', rpe: '8' };
    const isCardioSet = isCardioExercise(exercise);
    const validation = validateWorkoutSetInput({
      weight: row.weight,
      reps: row.reps,
      rpe: row.rpe || '8',
      isCardio: isCardioSet,
    });
    if (!validation.ok) {
      logQaError(new Error('workout_set_invalid_fields'), {
        screen: SCREENS.WORKOUT,
        severity: 'low',
        extra: { exerciseName: exercise.name, weight: row.weight, reps: row.reps, errors: validation.errors },
      });
      showActionToast(getWorkoutSetValidationToast(validation.errors));
      return;
    }

    if (typeof saveWorkoutSet !== 'function') {
      showActionToast('Motor de treino indisponivel no momento.');
      return;
    }

    const result = saveWorkoutSet({
      exerciseName: exercise.name,
      exerciseId: getCanonicalExerciseId(exercise.name) || undefined,
      weight: validation.sanitized.weight,
      reps: validation.sanitized.reps,
      rpe: validation.sanitized.rpe ?? 8,
      failed: false,
      isCardio: isCardioSet,
    });

    if (!result.ok) {
      workoutDevLog('SET_SAVE_AFTER', {
        dayKey: todayKey,
        exercise: exercise?.name,
        completed: Number(todaySets?.length || 0),
        planned: plannedSets,
        ok: false,
        reason: result?.message || 'unknown',
      });
      logQaError(new Error('workout_set_save_failed'), {
        screen: SCREENS.WORKOUT,
        severity: 'low',
        extra: { exerciseName: exercise.name, reason: result.message },
      });
      showActionToast(getWorkoutSetValidationToast(result.errors) || result.message || 'Nao foi possivel salvar a serie.');
      return;
    }

    sessionSetsSavedRef.current += 1;

    const interactionKey = getSetInteractionKey(exercise.name, effectiveSetIndex);
    const interactionStartedAt = Number(setInteractionStartRef.current[interactionKey] || saveStartAt);
    const tapToSaveMs = Math.max(0, saveStartAt - interactionStartedAt);
    const saveDurationMs = Math.max(0, Date.now() - saveStartAt);
    delete setInteractionStartRef.current[interactionKey];

    trackScreenAction(SCREENS.WORKOUT, 'screen_action', {
      source: 'set_logged',
      exerciseName: exercise.name,
      setIndex: effectiveSetIndex + 1,
    });

    trackEvent('set_logged', {
      time: saveDurationMs,
      tapToSaveMs,
      setIndex: effectiveSetIndex + 1,
      exerciseName: exercise.name,
      mode: 'guided',
    });
    const completedAfter = Number(getChronologicalExerciseLogs(exercise.name)?.length || 0);
    workoutDevLog('SET_SAVE_AFTER', {
      dayKey: todayKey,
      exercise: exercise?.name,
      completed: completedAfter,
      planned: plannedSets,
      ok: true,
      setIndex: effectiveSetIndex + 1,
    });

    advanceCurrentSet(exercise, effectiveSetIndex);

    setSetSpeedStats((prev) => {
      const prevCount = Number(prev.count || 0);
      const nextCount = prevCount + 1;
      const nextAvg = ((Number(prev.avgMs || 0) * prevCount) + tapToSaveMs) / nextCount;
      return {
        avgMs: Math.round(nextAvg),
        lastMs: tapToSaveMs,
        count: nextCount,
      };
    });

    setSaveSuccessVisible(true);
    setTimeout(() => setSaveSuccessVisible(false), 1800);

    const earnedXp = Math.max(1, Number(result?.xpDelta || 10));
    setXpFeedback(`+${earnedXp} XP`);
    success();

    const tone = (effectiveSetIndex + 1) % 3;
    const personality = tone === 0
      ? 'Mais uma série. Bora 🔥'
      : tone === 1
        ? 'Cadência forte. Continua ⚡'
        : 'Execução limpa. Segue 🚀';
    showActionToast(`${personality} • ${effectiveSetIndex + 1}/${plannedSets}`);

    if (result.isNewLoadPR) {
      const safeDelta = Number(result.prWeightDelta || 0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showActionToast(`🔥 Novo recorde! +${safeDelta}kg no ${exercise.name}`);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // BLOCO 1: Animação + Recompensa no set salvo
    // 1. XP flutuante (subindo + fade out)
    setXpFloatValue(`+${earnedXp} XP`);
    setShowXpFloat(true);
    xpFloatAnimY.setValue(0);
    xpFloatOpacity.setValue(1);
    Animated.parallel([
      Animated.timing(xpFloatAnimY, {
        toValue: -80,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(xpFloatOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowXpFloat(false);
    });

    // 2. Flash verde (success feedback visual)
    setShowSuccessFlash(true);
    successFlashAnim.setValue(0);
    Animated.timing(successFlashAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      Animated.timing(successFlashAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        setShowSuccessFlash(false);
      });
    });

    // Pulse animation na linha salva
    setSavedSetPulseKey(`${exercise.name}-${effectiveSetIndex}`);
    rowPulseAnim.setValue(0);
    Animated.sequence([
      Animated.timing(rowPulseAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(rowPulseAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => setSavedSetPulseKey(''));

    startRestTimer(getExerciseRestPreset(exercise.name));

    const completedAfterSave = nextIndex + 1;
    const nextSetIndex = effectiveSetIndex + 1;

    if (nextSetIndex < plannedSets) {
      setTimeout(() => {
        focusSetField(exercise.name, nextSetIndex, 'weight');
      }, 60);
    }

    if (completedAfterSave >= plannedSets) {
      jumpToNextExercise(exerciseIndex);
    }
  };

  const removeSavedSet = (exerciseName, setIndex) => {
    const result = removeTodayWorkoutSet({ exerciseName, setIndex, mode: 'guided' });
    if (!result.ok) {
      showActionToast(result.message || 'Nao foi possivel remover a serie.');
      return;
    }
    Vibration.vibrate(40);
    setXpFeedback('Serie removida');
  };

  const editSavedSet = (exerciseName, setIndex) => {
    const todaySets = getChronologicalExerciseLogs(exerciseName);
    const saved = todaySets[setIndex];
    if (!saved) {
      return;
    }

    const removed = removeTodayWorkoutSet({ exerciseName, setIndex, mode: 'guided' });
    if (!removed.ok) {
      showActionToast(removed.message || 'Nao foi possivel editar a serie.');
      return;
    }

    setDraftSetsByExercise((prev) => {
      const rows = [...(prev[exerciseName] || [])];
      rows[setIndex] = {
        weight: String(saved.weight || ''),
        reps: String(saved.reps || ''),
        rpe: String(saved.rpe || '8'),
      };
      return {
        ...prev,
        [exerciseName]: rows,
      };
    });

    setInteractionStartRef.current[getSetInteractionKey(exerciseName, setIndex)] = Date.now();

    setTimeout(() => {
      focusSetField(exerciseName, setIndex, 'weight');
    }, 60);
  };

  const addSetToExercise = (exerciseName) => {
    const exercise = allExercises.find((item) => item.name === exerciseName);
    const lastSet = getLastSetForExercise(exerciseName);
    const suggestedWeight = String(suggestedWeightByExercise[exerciseName] || '');
    const defaultReps = String(lastSet?.reps || inferRepTarget(exercise));
    const defaultWeight = String(lastSet?.weight || suggestedWeight || '');
    const defaultRpe = String(lastSet?.rpe || '8');

    setSetCountByExercise((prev) => ({
      ...prev,
      [exerciseName]: Number(prev[exerciseName] || 0) + 1,
    }));

    setDraftSetsByExercise((prev) => ({
      ...prev,
      [exerciseName]: [
        ...(prev[exerciseName] || []),
        {
          weight: defaultWeight,
          reps: defaultReps,
          rpe: defaultRpe,
        },
      ],
    }));
  };

  // BLOCO 2: Auto-fill + Submit handlers
  const handleSetSubmitWeight = (exerciseName, setIndex) => {
    // Auto-fill com peso anterior se este set estiver vazio
    const currentRows = draftSetsByExercise[exerciseName] || [];
    const currentRow = currentRows[setIndex] || {};
    
    // Se peso está vazio E set anterior tem peso, auto-fill
    if (!String(currentRow.weight || '').trim() && setIndex > 0) {
      const prevRow = currentRows[setIndex - 1];
      if (prevRow?.weight) {
        setDraftField(exerciseName, setIndex, 'weight', String(prevRow.weight));
      }
    }
  };

  const handleSetSubmitReps = (exerciseName, setIndex) => {
    // Similar auto-fill para reps
    const currentRows = draftSetsByExercise[exerciseName] || [];
    const currentRow = currentRows[setIndex] || {};
    
    if (!String(currentRow.reps || '').trim() && setIndex > 0) {
      const prevRow = currentRows[setIndex - 1];
      if (prevRow?.reps) {
        setDraftField(exerciseName, setIndex, 'reps', String(prevRow.reps));
      }
    }
  };

  const removeLastSetFromExercise = (exerciseName) => {
    const plannedSets = Number(setCountByExercise[exerciseName] || 0);
    if (plannedSets <= 1) {
      logQaError(new Error('workout_remove_last_set_below_minimum'), {
        screen: SCREENS.WORKOUT,
        severity: 'low',
        extra: { exerciseName, plannedSets },
      });
      showActionToast('Cada exercicio precisa de pelo menos 1 serie.');
      return;
    }

    const todaySets = getChronologicalExerciseLogs(exerciseName);

    if (todaySets.length >= plannedSets) {
      logQaError(new Error('workout_remove_last_set_saved_conflict'), {
        screen: SCREENS.WORKOUT,
        severity: 'low',
        extra: { exerciseName, plannedSets, savedSets: todaySets.length },
      });
      showActionToast('A ultima serie ja foi salva. Exclua ela antes de reduzir o total.');
      return;
    }

    setSetCountByExercise((prev) => ({
      ...prev,
      [exerciseName]: Math.max(1, Number(prev[exerciseName] || 1) - 1),
    }));

    setDraftSetsByExercise((prev) => {
      const currentRows = prev[exerciseName] || [];
      return {
        ...prev,
        [exerciseName]: currentRows.slice(0, -1),
      };
    });
  };

  const removeDraftSet = (exerciseName, setIndex) => {
    const todaySets = getChronologicalExerciseLogs(exerciseName);

    if (setIndex < todaySets.length) {
      const result = removeTodayWorkoutSet({ exerciseName, setIndex, mode: 'guided' });
      if (!result.ok) {
        showActionToast(result.message || 'Nao foi possivel remover a serie.');
        return;
      }
      Vibration.vibrate(40);
      return;
    }

    setDraftSetsByExercise((prev) => {
      const currentRows = prev[exerciseName] || [];
      const nextRows = currentRows.filter((_, idx) => idx !== setIndex);
      return {
        ...prev,
        [exerciseName]: nextRows,
      };
    });

    setSetCountByExercise((prev) => ({
      ...prev,
      [exerciseName]: Math.max(1, Number(prev[exerciseName] || 1) - 1),
    }));
  };

  const clearWorkoutDraftStorage = async () => {
    try {
      await AsyncStorage.multiRemove([
        WORKOUT_DRAFTS_STORAGE_KEY,
        WORKOUT_SET_COUNT_STORAGE_KEY,
        WORKOUT_UI_SESSION_STORAGE_KEY,
        WORKOUT_REST_END_STORAGE_KEY,
      ]);
      setDraftSetsByExercise({});
      setSetCountByExercise({});
    } catch (error) {
      logQaError(error, {
        action: 'clearWorkoutDraftStorage',
        screen: SCREENS.WORKOUT,
        severity: 'medium',
      });
    }
  };

  const addExerciseToWorkout = () => {
    const typedName = String(newExerciseName || '').trim();
    const safeName = findBestFuzzyMatch(typedName, exerciseCatalog);
    const sets = Number(newExerciseSets);
    const reps = String(newExerciseReps || '').trim() || '8-12';

    if (!typedName || !sets || sets <= 0) {
      logQaError(new Error('workout_add_exercise_invalid_payload'), {
        screen: SCREENS.WORKOUT,
        severity: 'low',
        extra: { typedName, sets, reps },
      });
      showActionToast('Informe nome e quantidade de series validas para o exercicio.');
      return;
    }

    if (!exerciseCatalog.includes(safeName)) {
      logQaError(new Error('workout_add_exercise_unknown_name'), {
        screen: SCREENS.WORKOUT,
        severity: 'low',
        extra: { typedName, safeName },
      });
      showActionToast('Tente buscar pelo nome aproximado na lista de sugestoes.');
      return;
    }

    if (allExercises.some((item) => item.name.toLowerCase() === safeName.toLowerCase())) {
      logQaError(new Error('workout_add_exercise_duplicate'), {
        screen: SCREENS.WORKOUT,
        severity: 'low',
        extra: { exerciseName: safeName },
      });
      showActionToast('Esse exercicio ja esta no treino de hoje.');
      return;
    }

    const exercise = {
      id: `custom-${Date.now()}`,
      name: safeName,
      sets,
      reps,
      targetWeight: 0,
    };

    setCustomExercises((prev) => [...prev, exercise]);
    setSetCountByExercise((prev) => ({ ...prev, [safeName]: sets }));
    setNewExerciseName('');
    setNewExerciseSets('3');
    setNewExerciseReps('8-12');
    setActiveExerciseIndex(allExercises.length);
    logEvent('exercise_added');
  };

  const getSwapProgressForExercise = (exerciseName) => ({
    hasCompletedSets: getChronologicalExerciseLogs(exerciseName).length > 0,
    hasDraftSets: hasNonEmptyDraftRows(draftSetsByExercise[exerciseName]),
  });

  const executeExerciseSwap = (plan) => {
    const {
      exerciseIndex,
      oldExerciseName,
      newExerciseName,
      replacement,
      hasCompletedSets,
      hasDraftSets,
      clearDraftForPreviousExercise,
    } = plan;

    if (exerciseIndex < sessionBaseExercises.length) {
      setSessionBaseExercises((prev) => {
        const result = applyExerciseSwapToWorkout({
          exercises: prev,
          exerciseIndex,
          replacementExercise: replacement,
        });
        return result.ok ? result.exercises : prev;
      });
    } else {
      const customIndex = exerciseIndex - sessionBaseExercises.length;
      setCustomExercises((prev) => {
        const result = applyExerciseSwapToWorkout({
          exercises: prev,
          exerciseIndex: customIndex,
          replacementExercise: replacement,
        });
        return result.ok ? result.exercises : prev;
      });
    }

    setSetCountByExercise((prev) => migrateSetCountForSwap({
      setCountByExercise: prev,
      oldExerciseName,
      newExerciseName,
    }));

    if (clearDraftForPreviousExercise) {
      setDraftSetsByExercise((prev) => {
        const cleanup = buildDraftCleanupForSwap({
          oldExerciseName,
          hasDraftSets,
        });
        if (!Object.keys(cleanup).length) {
          return prev;
        }

        const next = { ...prev };
        Object.keys(cleanup).forEach((key) => {
          delete next[key];
        });
        return next;
      });
    }

    setXpFeedback(plan.successToast || `${oldExerciseName} substituido por ${newExerciseName} no treino de hoje.`);
    setShowSubstitutePicker(false);
    setNewExerciseName('');

    logEvent('workout_exercise_swapped', {
      screen: SCREENS.WORKOUT,
      oldExerciseName,
      newExerciseName,
      hadCompletedSets: Boolean(hasCompletedSets),
      hadDraftSets: Boolean(hasDraftSets),
    });
  };

  const replaceActiveExercise = (overrideExerciseName) => {
    const typedName = String(overrideExerciseName ?? newExerciseName ?? '').trim();
    const safeName = findBestFuzzyMatch(typedName, exerciseCatalog);
    if (!safeName) {
      logQaError(new Error('workout_replace_exercise_missing_name'), {
        screen: SCREENS.WORKOUT,
        severity: 'low',
        extra: { typedName },
      });
      showActionToast('Selecione um exercicio da lista para substituir.');
      return;
    }

    if (!exerciseCatalog.includes(safeName)) {
      logQaError(new Error('workout_replace_exercise_unknown_name'), {
        screen: SCREENS.WORKOUT,
        severity: 'low',
        extra: { typedName, safeName },
      });
      showActionToast('Selecione um exercicio existente na lista de sugestoes.');
      return;
    }

    if (!activeExercise) {
      return;
    }

    const swapProgress = getSwapProgressForExercise(activeExercise.name);
    const replacementExercise = {
      ...activeExercise,
      name: safeName,
      id: activeExerciseIndex < sessionBaseExercises.length
        ? `${safeName}-${activeExerciseIndex}`
        : `${safeName}-custom-${activeExerciseIndex - sessionBaseExercises.length}`,
    };

    const plan = buildExerciseSwapPlan({
      currentExercise: activeExercise,
      replacementExercise,
      exerciseIndex: activeExerciseIndex,
      totalExercises: allExercises.length,
      hasCompletedSets: swapProgress.hasCompletedSets,
      hasDraftSets: swapProgress.hasDraftSets,
    });

    if (!plan.ok) {
      if (plan.error === 'same_exercise') {
        showActionToast('Selecione um exercicio diferente do atual.');
      }
      return;
    }

    if (plan.requiresConfirmation) {
      Alert.alert(
        plan.title,
        plan.message,
        [
          { text: plan.cancelLabel, style: 'cancel' },
          { text: plan.confirmLabel || plan.actionLabel, onPress: () => executeExerciseSwap(plan) },
        ]
      );
      return;
    }

    executeExerciseSwap(plan);
  };

  const quickReplaceActiveExercise = (exerciseName) => {
    replaceActiveExercise(exerciseName);
  };

  const removeExerciseFromWorkout = (exerciseName) => {
    const safeName = String(exerciseName || '').trim();
    if (!safeName) {
      return;
    }

    if (allExercises.length <= 1) {
      logQaError(new Error('workout_remove_exercise_below_minimum'), {
        screen: SCREENS.WORKOUT,
        severity: 'low',
        extra: { exerciseName: safeName, exerciseCount: allExercises.length },
      });
      showActionToast('O treino precisa ter ao menos 1 exercicio.');
      return;
    }

    if (activeExerciseIndex < sessionBaseExercises.length) {
      setSessionBaseExercises((prev) => prev.filter((item) => item.name !== safeName));
    } else {
      setCustomExercises((prev) => prev.filter((item) => item.name !== safeName));
    }

    setDraftSetsByExercise((prev) => {
      const next = { ...prev };
      delete next[safeName];
      return next;
    });

    setSetCountByExercise((prev) => {
      const next = { ...prev };
      delete next[safeName];
      return next;
    });

    setActiveExerciseIndex((prev) => Math.max(0, prev - 1));
  };

  const substituteCandidates = useMemo(() => {
    if (!activeExercise) {
      return [];
    }

    const group = inferExerciseGroup(activeExercise.name);
    const sameGroup = group ? getExercisesByMuscleGroup(group) : [];
    const related = getFreeWorkoutSuggestions([activeExercise.name]);
    const combined = [...sameGroup, ...related, ...exerciseCatalog];
    return Array.from(new Set(combined))
      .filter((item) => String(item || '').toLowerCase() !== String(activeExercise.name || '').toLowerCase())
      .slice(0, 12);
  }, [activeExercise, exerciseCatalog, getExercisesByMuscleGroup, getFreeWorkoutSuggestions]);

  const finishWorkout = async () => {
    if (isSavingWorkout) {
      return;
    }

    if (!canFinishWorkoutNow) {
      trackEvent('workout_finish_blocked_incomplete', {
        screen: SCREENS.WORKOUT,
        meta: {
          action: 'finishWorkout_tap',
          guidedSets: computedGuidedSets,
          plannedSets: computedPlannedSets,
        },
      });
      confirmIncompleteWorkoutExit(() => {
        flushPartialWorkoutState();
      });
      return;
    }

    setIsSavingWorkout(true);
    setSyncStatusMessage('Salvando treino...');

    const todaySessionLogs = sanitizeWorkoutLogsForRead(
      workoutLogs.filter((item) => item.date === todayKey && (item.mode || 'guided') !== 'free')
    );
    const todaySets = todaySessionLogs.length;
    const exerciseCount = new Set(todaySessionLogs.map((item) => item.exerciseName)).size;
    const totalVolume = calculateVolume(todaySessionLogs);
    const sessionXp = Math.max(0, Number(gamification.xp || 0) - Number(sessionStartXpRef.current || 0));
    const sessionDurationMinutes = Math.max(1, Math.round((Date.now() - Number(sessionStartedAtRef.current || Date.now())) / 60000));
    const avgRpe = todaySessionLogs.length
      ? todaySessionLogs.reduce((acc, item) => acc + Number(item.rpe || 0), 0) / todaySessionLogs.length
      : 0;
    const sRpeLoad = Math.round(calculateSRPE(avgRpe, sessionDurationMinutes));
    const topSet = todaySessionLogs
      .slice()
      .sort((a, b) => Number(b.weight || 0) - Number(a.weight || 0))[0] || null;
    const estimated1RM = topSet ? Math.round(calculate1RM(topSet.weight, topSet.reps)) : 0;
    const currentWorkout = {
      totalSets: todaySets,
      totalLoad: totalVolume,
    };

    logEvent('workout_finish', {
      screen: SCREENS.WORKOUT,
      totalSets: todaySets,
      totalVolume,
      durationMinutes: sessionDurationMinutes,
    });

    const previousDates = Array.from(new Set(
      workoutLogs
        .filter((item) => item.date !== todayKey && (item.mode || 'guided') !== 'free')
        .map((item) => item.date)
    )).sort((a, b) => String(b).localeCompare(String(a)));

    const previousDate = previousDates[0] || null;
    const previousLogs = previousDate
      ? sanitizeWorkoutLogsForRead(
          workoutLogs.filter((item) => item.date === previousDate && (item.mode || 'guided') !== 'free')
        )
      : [];
    const previousWorkout = previousDate
      ? {
          totalSets: previousLogs.length,
          totalLoad: calculateVolume(previousLogs),
        }
      : null;

    const previousVolume = Number(previousWorkout?.totalLoad || 0);
    const volumeChangePct = previousVolume > 0
      ? Math.round(((totalVolume - previousVolume) / previousVolume) * 100)
      : 0;

    const delta = getWorkoutDelta(currentWorkout, previousWorkout);

    // Atualiza streak no Firebase sem quebrar o fluxo de finalizacao.
    let streak = 1;
    let lastWorkout = todayKey;
    if (user?.id) {
      try {
        streak = await resolveWithTimeout(updateStreak(user.id), 6000, 1);
        lastWorkout = todayKey;
      } catch (streakError) {
        logQaError(streakError, {
          action: 'updateStreak',
          screen: SCREENS.WORKOUT,
          severity: 'medium',
          extra: { userId: String(user.id) },
        });
        streak = Math.max(1, Number(gamification?.streak || 1));
      }
    }

    // Calcula evolução percentual
    const prevWeight = previousLogs.length ? previousLogs.reduce((acc, item) => acc + (item.weight || 0), 0) / previousLogs.length : 0;
    const currWeight = todaySessionLogs.length ? todaySessionLogs.reduce((acc, item) => acc + (item.weight || 0), 0) / todaySessionLogs.length : 0;
    const evolution = calcEvolution(prevWeight, currWeight);

    try {
      trackEvent('workout_finish_manual', { guidedSets: todaySets, plannedSets: computedPlannedSets });
      trackEvent('workout_completed', {
        guidedSets: todaySets,
        plannedSets: computedPlannedSets,
        totalVolume,
        exerciseCount,
        experimentKey: WORKOUT_FAST_FINISH_EXPERIMENT_KEY,
        variant: workoutVariant,
      });

      const normalizedExercises = allExercises
        .map((exercise) => {
          const setsFromLog = todaySessionLogs.filter((item) => isSameExerciseLog(item, exercise.name));
          const avgReps = setsFromLog.length
            ? Math.round(setsFromLog.reduce((acc, item) => acc + Number(item.reps || 0), 0) / setsFromLog.length)
            : 0;
          const avgWeight = setsFromLog.length
            ? Number((setsFromLog.reduce((acc, item) => acc + Number(item.weight || 0), 0) / setsFromLog.length).toFixed(1))
            : 0;

          return {
            name: exercise.name,
            reps: avgReps,
            sets: setsFromLog.length,
            weight: avgWeight,
          };
        })
        .filter((item) => item.sets > 0);

      const saveResult = await resolveWithTimeout(saveCompletedWorkoutToApi({
        userId: String(user?.id || ''),
        plan: String(plan?.plan || plan?.goal || 'free').toLowerCase().includes('pro') ? 'premium' : 'free',
        workout: {
          createdAt: new Date().toISOString(),
          durationMinutes: sessionDurationMinutes,
          exercises: normalizedExercises,
          mode: 'guided',
          name: selectedWorkout?.name || 'Treino de hoje',
          source: 'workout_screen',
          totalSets: todaySets,
          totalVolume,
        },
      }), 12000, { queuedOffline: true });

      if (saveResult?.queuedOffline) {
        setSyncStatusMessage('Sem internet: salvo offline e pendente de sincronizacao.');
      } else {
        const syncResult = await resolveWithTimeout(syncPendingWorkouts({ userId: String(user?.id || '') }), 10000, { synced: 0 });
        const syncedExtra = Number(syncResult?.synced || 0);
        setSyncStatusMessage(
          syncedExtra > 0
            ? `Sincronizacao concluida (${syncedExtra} pendente(s) enviada(s)).`
            : 'Treino sincronizado com o servidor.'
        );

        // 🔥 INTEGRAÇÃO SOCIAL: Treino concluído → XP → Ranking → Feed
        try {
          const username = user?.name || String(user?.email || 'User').split('@')[0];
          const workoutName = selectedWorkout?.name || 'Treino';
          
          const engagementResult = await resolveWithTimeout(onWorkoutCompleted({
            userId: String(user?.id || ''),
            username,
            workoutType: workoutName,
            totalVolume,
            totalSets: todaySets,
            exerciseCount,
            durationMinutes: sessionDurationMinutes,
          }), 6000, { success: false, xpGained: 0, position: null });

          if (engagementResult.success) {
            const position = engagementResult.position;
            showActionToast(getEngagementMessage(position, engagementResult.xpGained));
          }
        } catch (engagementError) {
          console.error('[WORKOUT_SCREEN] Erro ao atualizar social:', engagementError);
          // Não falha o treino se social falhar
        }
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setWorkoutSummary({
        ...(delta || { setsDiff: 0, loadDiff: 0 }),
        totalSets: todaySets,
        exerciseCount,
        totalVolume,
        estimated1RM,
        sRpeLoad,
        sessionDurationMinutes,
        volumeChangePct,
        sessionXp,
        streak,
        evolution,
        prevWeight: Math.round(prevWeight),
        currWeight: Math.round(currWeight),
      });
      setXpFeedback(`+${Math.max(0, Math.round(sessionXp))} XP`);
      setShowWorkoutSummary(true);

      // Push inteligente
      scheduleStreakPush(streak, lastWorkout);

      // Limpa rascunhos, recovery e estado de sessão depois do treino concluido
      dismissDropRecoveryCandidate();
      setWorkoutSessionId(null);
      try {
        await AsyncStorage.setItem(
          WORKOUT_UI_SESSION_STORAGE_KEY,
          JSON.stringify({ activeExerciseIndex: 0, simpleMode: true, workoutSessionId: null, sessionDayKey: null })
        );
      } catch (storageError) {
        logQaError(storageError, {
          action: 'clearWorkoutSessionAfterFinish',
          screen: SCREENS.WORKOUT,
          severity: 'low',
        });
      }

      // Navega para tela de pós-treino
      navigation.navigate('WorkoutCompleteScreen', {
        streak,
        evolution,
        prevWeight: Math.round(prevWeight),
        currWeight: Math.round(currWeight),
        exerciseCount,
        plannedExercises: allExercises.length,
        sessionDurationMinutes,
        totalSets: todaySets,
        totalVolume,
        sessionXp,
      });

      await clearWorkoutDraftStorage();
    } catch (error) {
      logQaError(error, {
        action: 'finishWorkout',
        screen: SCREENS.WORKOUT,
        severity: 'high',
        extra: { todaySets, totalVolume },
      });
      setSyncStatusMessage('Falha de sincronizacao. Treino mantido localmente.');
      showActionToast('Nao conseguimos enviar agora. Seu treino ficou salvo e sera sincronizado depois.');
    } finally {
      setIsSavingWorkout(false);
    }
  };

  const closeWorkoutSummary = () => {
    setShowWorkoutSummary(false);
    navigation.goBack();
  };

  const goToEvolution = () => {
    setShowWorkoutSummary(false);
    navigateWithTracking('Insights', undefined, 'post_workout_insights');
  };

  const goToHistoryAfterWorkout = () => {
    setShowWorkoutSummary(false);
    navigateWithTracking('Historico', undefined, 'post_workout_history');
  };

  const confirmIncompleteWorkoutExit = (onConfirm) => {
    Alert.alert(
      INCOMPLETE_EXIT_CONFIRMATION.title,
      INCOMPLETE_EXIT_CONFIRMATION.message,
      [
        { text: INCOMPLETE_EXIT_CONFIRMATION.cancelLabel, style: 'cancel' },
        { text: INCOMPLETE_EXIT_CONFIRMATION.confirmLabel, onPress: onConfirm },
      ]
    );
  };

  const flushPartialWorkoutState = async () => {
    closeKeypad();
    skipRest();
    try {
      await AsyncStorage.multiSet([
        [WORKOUT_DRAFTS_STORAGE_KEY, JSON.stringify(draftSetsByExercise)],
        [WORKOUT_SET_COUNT_STORAGE_KEY, JSON.stringify(setCountByExercise)],
        [WORKOUT_UI_SESSION_STORAGE_KEY, JSON.stringify({
          activeExerciseIndex,
          simpleMode,
          workoutSessionId: workoutSessionId || null,
          sessionDayKey: todayKey,
        })],
      ]);
      await AsyncStorage.removeItem(WORKOUT_REST_END_STORAGE_KEY);
    } catch (error) {
      logQaError(error, {
        action: 'savePartialAndExit_flush',
        screen: SCREENS.WORKOUT,
        severity: 'medium',
        extra: { todayKey },
      });
    }
    const todaySets = workoutLogs.filter((item) => item.date === todayKey && (item.mode || 'guided') !== 'free').length;
    const markPartialOnExit = shouldMarkPartialSessionOnExit({
      plannedSets: computedPlannedSets || summary.plannedSets,
      completedSets: computedGuidedSets,
    });
    if (markPartialOnExit) {
      markWorkoutSessionState({ resumable: true, reason: 'partial_exit', routeName: 'TreinoHoje' });
      trackEvent('workout_partial_saved', {
        guidedSets: todaySets,
        plannedSets: computedPlannedSets || summary.plannedSets,
        completionRate: computedCompletionRate,
      });
    }
    navigation.navigate('MainTabs', { screen: 'Treino' });
  };

  const savePartialAndExit = () => {
    const runExit = () => {
      flushPartialWorkoutState();
    };

    if (canFinishWorkoutNow) {
      runExit();
      return;
    }

    confirmIncompleteWorkoutExit(runExit);
  };

  const handleWorkoutBack = () => {
    savePartialAndExit();
  };

  const focusActiveExercise = () => {
    const targetIndex = Math.max(0, Math.min(activeExerciseIndex, allExercises.length - 1));
    const y = exercisePositionsRef.current?.[targetIndex];
    if (scrollRef.current && typeof y === 'number') {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 24), animated: true });
    }
  };

  if (!allExercises.length) {
    return (
      <View style={styles.emptyContainer}>
        <ScreenHeader title="Treino de hoje" onBack={handleWorkoutBack} />
        <Text style={styles.emptyText}>Sem treino definido para hoje.</Text>
      </View>
    );
  }

  const safeActiveForSimple =
    allExercises.length > 0 &&
    activeExerciseIndex >= 0 &&
    activeExerciseIndex < allExercises.length
      ? activeExerciseIndex
      : 0;

  const focusRenderData = simpleMode
    ? (() => {
        const current = allExercises[safeActiveForSimple];
        if (!current || !(current.id || current.name)) {
          return [];
        }
        return [{ ...current, __originalIndex: safeActiveForSimple }];
      })()
    : allExercises;

  const nextExerciseName = allExercises[activeExerciseIndex + 1]?.name || '';

  const renderRestPresetRow = (exerciseName = null, options = {}) => {
    const { compact = false, showManual = true } = options;
    const activePreset = exerciseName ? getExerciseRestPreset(exerciseName) : restPreset;
    const rowTestId = exerciseName ? `rest-presets-exercise-${String(exerciseName).replace(/\s+/g, '-')}` : 'rest-presets-row';

    return (
      <View style={[styles.presetRow, compact ? styles.presetRowCompact : null]} testID={rowTestId}>
        <Text testID="text-rest-preset-active" style={styles.restPresetLabel}>
          Descanso: {activePreset}s
        </Text>
        {[30, 60, 120].map((value) => (
          <TouchableOpacity
            key={`${exerciseName || 'global'}-${value}`}
            testID={`btn-rest-preset-${value}`}
            style={[
              styles.presetBtn,
              activePreset === value ? styles.presetBtnActive : styles.presetBtnIdle,
            ]}
            accessibilityState={{ selected: activePreset === value }}
            onPress={() => handleExerciseRestPreset(exerciseName, value)}
          >
            <Text
              style={[
                styles.presetText,
                activePreset === value ? styles.presetTextActive : styles.presetTextIdle,
              ]}
            >
              {value}s
            </Text>
          </TouchableOpacity>
        ))}
        {showManual ? (
          <TouchableOpacity
            testID="btn-start-rest-manual"
            style={styles.manualRestBtn}
            onPress={() => startRestTimer(activePreset)}
          >
            <Text style={styles.manualRestText}>Descanso</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  // Streak visual no topo
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <StreakBar streak={Number(gamification.streakDays || 0)} />
      {saveSuccessVisible ? (
        <View testID="serie-salva-indicator" style={styles.savedFixedIndicator}>
          <Text style={styles.savedBannerText}>Serie salva</Text>
        </View>
      ) : null}

      {restRunning ? (
        <View testID="rest-timer-floating" style={styles.restFloatingCard}>
          <Text style={styles.restFloatingLabel}>Descanso</Text>
          <Text
            testID="rest-timer-countdown"
            style={[styles.restFloatingValue, restSeconds <= 15 ? styles.restFloatingValueDanger : null]}
          >
            {formatTimer(restSeconds)}
          </Text>
          <View style={styles.restFloatingActions}>
            <TouchableOpacity testID="btn-rest-extend-30" style={styles.restFloatingSecondary} onPress={extendRestByThirty}>
              <Text style={styles.restFloatingSecondaryText}>+30s</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="btn-rest-skip" style={styles.restFloatingDanger} onPress={skipRest}>
              <Text style={styles.restFloatingDangerText}>Pular</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {/* BLOCO 1: XP flutuante (sobe e desaparece) */}
      {showXpFloat ? (
        <Animated.View
          style={[
            styles.xpFloatingContainer,
            {
              transform: [{ translateY: xpFloatAnimY }],
              opacity: xpFloatOpacity,
            },
          ]}
        >
          <Text style={styles.xpFloatingText}>{xpFloatValue}</Text>
        </Animated.View>
      ) : null}

      {/* BLOCO 1: Flash verde (success visual feedback) */}
      {showSuccessFlash ? (
        <Animated.View
          style={[
            styles.successFlashOverlay,
            {
              backgroundColor: successFlashAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['rgba(74, 222, 128, 0)', 'rgba(74, 222, 128, 0.3)'],
              }),
            },
          ]}
          pointerEvents="none"
        />
      ) : null}

      <ScrollView
        testID="screen-workout"
        ref={scrollRef}
        contentContainerStyle={[styles.container, { paddingBottom: 84 + Number(insets.bottom || 0) }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        nestedScrollEnabled
      >

        <ScreenHeader title="Treino de hoje" subtitle="Registre sua carga e avance no treino." onBack={handleWorkoutBack} />

        {/* Registro rápido de exercício (UX 1 clique) */}
        {!__DEV__ ? null : !simpleMode && activeExercise ? (
          <QuickExerciseRegister
            exercise={activeExercise}
            lastWeight={suggestNextWeight(getLastSetForExercise(activeExercise.name)?.weight)}
            onRegister={async (weight) => {
              const validation = validateWorkoutSetInput({ weight, reps: 10, rpe: 8 });
              if (!validation.ok) {
                showActionToast(getWorkoutSetValidationToast(validation.errors));
                return;
              }
              if (typeof saveWorkoutSet === 'function') {
                const result = saveWorkoutSet({
                  exerciseName: activeExercise.name,
                  weight: validation.sanitized.weight,
                  reps: validation.sanitized.reps,
                  rpe: validation.sanitized.rpe ?? 8,
                  failed: false,
                });
                if (!result?.ok) {
                  showActionToast(getWorkoutSetValidationToast(result.errors) || 'Nao foi possivel registrar.');
                  return;
                }
              }
              Vibration.vibrate(80);
              showActionToast('Exercício registrado!');
            }}
          />
        ) : null}

        <View style={styles.modeToggleRow} testID="workout-mode-bar">
          <Text testID="workout-mode-label" style={styles.modeToggleLabel}>
            {modePresentation.modeLabel}
          </Text>
          <TouchableOpacity
            testID="btn-toggle-workout-mode"
            onPress={() => setSimpleMode((prev) => !prev)}
            style={styles.modeToggleAction}
            accessibilityRole="button"
            accessibilityLabel={modePresentation.compactLabel}
          >
            <Text style={styles.modeToggleActionText}>{modePresentation.toggleLabel}</Text>
          </TouchableOpacity>
        </View>
        {modePresentation.showHelper ? (
          <Text style={styles.modeToggleHelper}>{modePresentation.helperText}</Text>
        ) : null}

        {allExercises.length > 0 ? (
          <View
            testID="workout-advanced-header"
            style={[styles.exerciseProgressWrap, !simpleMode && styles.exerciseProgressWrapAdvanced]}
          >
            <Text testID="workout-exercise-progress" style={styles.exerciseProgressText}>
              {progressCopy.headerLabel}
            </Text>
            {!simpleMode && activeExercise?.name ? (
              <Text style={styles.exerciseProgressSub} numberOfLines={1}>{activeExercise.name}</Text>
            ) : null}
          </View>
        ) : null}

        {simpleMode ? renderRestPresetRow(null, { compact: true, showManual: true }) : null}

        <View style={styles.topRow}>
          <Text style={styles.metaText}>Nivel {gamification.level} · XP {gamification.xp}</Text>
          {!simpleMode ? (
            <Text style={styles.metaText}>🔥 {Number(gamification.streakDays || 0)} dias seguidos</Text>
          ) : null}
        </View>
        {__DEV__ ? workoutDevLog('RENDER_COUNTER', {
          exercise: activeExercise?.name || null,
          counter: `${computedGuidedSets}/${displayedSeriesTotal}`,
          savedSets: Number(activeExercise ? getChronologicalExerciseLogs(activeExercise.name)?.length || 0 : 0),
        }) : null}

        {__DEV__ && activeExercise && isCardioExercise(activeExercise) ? (
          <View style={styles.devFeatureTagWrap}>
            <Text style={styles.devFeatureTag}>[F-Cardio] Entrada em Tempo (min) e Distancia (km)</Text>
          </View>
        ) : null}



        <View style={styles.progressHeaderWrap}>
          <Text testID="workout-progress-label" style={styles.progressHeaderText}>
            {progressCopy.workoutProgressLabel}
          </Text>
          {simpleMode ? (
            <Text style={styles.streakText}>🔥 {Number(gamification.streakDays || 0)} dias seguidos</Text>
          ) : null}
        </View>
        {/* BLOCO 4: Progresso Visual - Smooth animated fill */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressFillAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        {actionFeedback ? (
          <Animated.View
            style={[
              styles.actionToast,
              {
                opacity: actionFeedbackAnim,
                transform: [
                  {
                    translateY: actionFeedbackAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [6, 0],
                    }),
                  },
                  {
                    scale: actionFeedbackAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.actionToastText}>{actionFeedback}</Text>
          </Animated.View>
        ) : null}

        {xpFeedback ? (
          <Animated.View
            style={[
              styles.xpFeedbackWrap,
              {
                transform: [
                  {
                    scale: xpPulseAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.08],
                    }),
                  },
                ],
                opacity: xpPulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.92, 1],
                }),
              },
            ]}
          >
            <Text style={styles.xpFeedback}>{xpFeedback}</Text>
          </Animated.View>
        ) : null}
        {restDoneMessage ? <Text style={styles.restDoneMessage}>{restDoneMessage}</Text> : null}

        {simpleMode && allExercises.length > 1 && nextExerciseName ? (
          <View testID="workout-next-exercise-card" style={styles.nextExerciseCard}>
            <Text style={styles.nextExerciseLabel}>Proximo:</Text>
            <Text testID="workout-next-exercise-name" style={styles.nextExerciseText}>{nextExerciseName}</Text>
          </View>
        ) : null}

        <FlatList
          testID={simpleMode ? 'workout-exercise-list-simple' : 'workout-exercise-list-advanced'}
          data={focusRenderData}
          scrollEnabled={false}
          nestedScrollEnabled
          removeClippedSubviews={Platform.OS === 'android' ? false : undefined}
          keyExtractor={(item, index) => String(item?.id || `${item?.name || 'exercise'}-${index}`)}
          renderItem={({ item: exercise, index: renderIndex }) => {
          try {
          const providedIndex = Number(exercise?.__originalIndex);
          const exerciseIndex = Number.isFinite(providedIndex) ? providedIndex : renderIndex;
          const plannedSets = Number(setCountByExercise[exercise.name] || exercise.sets || 3);
          const setProgress = safeGetExerciseSetProgress(exercise.name, plannedSets);
          const isActive = exerciseIndex === activeExerciseIndex;
          const safeLogs = Array.isArray(workoutLogs) ? workoutLogs : [];
          const todaySets = safeLogs
            .filter((item) => item.date === todayKey && typeof isSameExerciseLog === 'function' && isSameExerciseLog(item, exercise.name) && (item.mode || 'guided') !== 'free')
            .slice(0, plannedSets);

          const unifiedSetRows = typeof buildUnifiedSetRows === 'function' ? buildUnifiedSetRows(exercise.name, plannedSets) : [];
          const exerciseId = typeof getCanonicalExerciseId === 'function' ? (getCanonicalExerciseId(exercise.name) || undefined) : undefined;
          const historyPresentation = buildWorkoutHistoryPresentation({
            workoutLogs: safeLogs,
            exerciseName: exercise.name,
            exerciseId,
            limit: 5,
          });
          const historySnapshot = (historyPresentation.summary.logs || [])
            .filter((item) => !item?.failed)
            .map((item) => ({
              date: String(item.date || ''),
              weight: Number(item.weight || 0),
              reps: Number(item.reps || 0),
              rpe: Number(item.rpe || 0),
            }));
          const progression = (() => { try { return safeGetExerciseProgressionSuggestion(exercise.name, exerciseId); } catch (_e) { return { suggestedWeight: 0, message: '' }; } })();
          const exerciseProgress = (() => { try { return safeGetExerciseProgress(exercise.name, exerciseId); } catch (_e) { return { bestWeight: 0 }; } })();
          const isCardio = isCardioExercise(exercise);
          const lastSet = historyPresentation.summary.lastSet;
          const lastWeight = Number(lastSet?.weight || 0);
          const lastReps = Number(lastSet?.reps || 0);
          const hasHistory = historySnapshot.length > 0 || (lastWeight > 0 && lastReps > 0);
          const suggestedWeightNumber = Number(progression?.suggestedWeight || 0);
          const prWeight = Number(historyPresentation.summary.bestWeight || exerciseProgress?.bestWeight || 0);
          const prGap = Math.max(0, Number((prWeight - suggestedWeightNumber).toFixed(1)));
          const estimated1Rm = hasHistory && typeof calculate1RM === 'function' ? Math.round(calculate1RM(lastWeight, lastReps)) : 0;
          const safeSuggestedWeight = hasHistory && suggestedWeightNumber > 0 ? suggestedWeightNumber : 0;
          const progressionTargetWeight = (() => {
            try {
              return hasHistory && lastWeight > 0 && typeof getProgression === 'function' && typeof inferRepTarget === 'function'
                ? Number(getProgression(lastReps, Number(inferRepTarget(exercise)), lastWeight).toFixed(1))
                : 0;
            } catch (_e) { return 0; }
          })();
          const sparklineValues = historySnapshot.map((item) => Number(item.weight || 0));
          const sparklinePoints = buildSparklinePoints(sparklineValues, SPARKLINE_WIDTH, SPARKLINE_HEIGHT);
          const sparklineSegments = sparklinePoints.slice(1).map((point, index) => {
            const prev = sparklinePoints[index];
            const dx = point.x - prev.x;
            const dy = point.y - prev.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            return {
              key: `${exercise.id}-seg-${index}`,
              left: (prev.x + point.x) / 2 - length / 2,
              top: (prev.y + point.y) / 2,
              width: length,
              angle,
              rising: dy < 0,
            };
          });
          const weightDelta = suggestedWeightNumber > 0 && lastWeight > 0
            ? Number((suggestedWeightNumber - lastWeight).toFixed(1))
            : 0;

          if (simpleMode) {
            const mergedSets = unifiedSetRows.map((row) => ({
              id: `${exercise.id}-${row.done ? 'saved' : 'draft'}-${row.index}`,
              index: row.index,
              weight: row.weight,
              reps: row.reps,
              rpe: row.rpe,
              done: row.done,
            }));
            const firstPendingIndex = mergedSets.findIndex((setItem) => !setItem?.done);

            const lastSetLabel = lastSet
              ? isCardio
                ? `${lastSet.reps || 0}min • ${lastSet.weight || 0}km`
                : `${lastSet.weight || 0}kg x ${lastSet.reps || 0}`
              : null;

            return (
              <View key={exercise.id}>
                <ExerciseCard
                  exercise={{
                    name: exercise.name,
                    category: isCardio ? 'cardio' : 'strength',
                    sets: mergedSets,
                    gif: safeGetExerciseMetaByName(exercise.name)?.gif,
                  }}
                  lastSet={lastSetLabel}
                  simpleMode={simpleMode}
                  isSaving={isSavingWorkout}
                  onChangeSet={handleChangeSet}
                  onCompleteSet={handleCompleteSet}
                  onAddSet={handleAddSet}
                  onRemoveExercise={removeExerciseFromWorkout}
                  onViewExecution={openExerciseDetail}
                  testIDs={(setItem, index) => ({
                    weight: isActive && index === firstPendingIndex ? 'input-weight' : `input-weight-${exercise.id}-${index}`,
                    reps: isActive && index === firstPendingIndex ? 'input-reps' : `input-reps-${exercise.id}-${index}`,
                    done: isActive && index === firstPendingIndex ? 'btn-save-set' : `btn-save-set-${exercise.id}-${index}`,
                    addSet: isActive ? 'btn-add-set' : `btn-add-set-${exercise.id}`,
                  })}
                />
                {isActive && !historyPresentation.isEmpty ? (
                  <View testID="workout-exercise-history-panel" style={styles.historyWrap}>
                    <Text style={styles.historyTitle}>Historico do exercicio</Text>
                    <Text testID="workout-history-last-set" style={styles.historyEntryLine}>
                      {lastSetLabel || historyPresentation.emptyCopy}
                    </Text>
                    <Text style={styles.historyEntryLine}>
                      Melhor: {historyPresentation.summary.bestWeight || 0}kg · Volume: {historyPresentation.summary.totalVolume || 0}
                    </Text>
                    {historyPresentation.recentEntries.map((entry) => (
                      <Text key={`${exercise.id}-simple-history-${entry.id}`} style={styles.historyEntryLine}>
                        {entry.lineText}
                      </Text>
                    ))}
                    {historyPresentation.ignoredHint ? (
                      <Text testID="workout-history-ignored-hint" style={styles.historyIgnoredHint}>
                        {historyPresentation.ignoredHint}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          }

          return (
            <TouchableOpacity
              key={exercise.id}
              activeOpacity={0.95}
              onPress={() => setActiveExerciseIndex(exerciseIndex)}
              style={[styles.exerciseCard, isActive ? styles.exerciseCardActive : styles.exerciseCardMuted]}
              onLayout={(event) => {
                exercisePositionsRef.current[exercise.id] = event.nativeEvent.layout.y;
              }}
            >
              <View style={styles.exerciseHeaderRow}>
                {!simpleMode ? (
                  <Text testID={`workout-exercise-index-${exerciseIndex + 1}`} style={styles.exerciseIndexBadge}>
                    {exerciseIndex + 1}/{allExercises.length}
                  </Text>
                ) : null}
                <Text style={styles.exerciseName}>{exercise.name}</Text>
              </View>
              {isActive ? (() => {
                const catalogExercise = getExerciseByName(exercise.name);
                const exerciseMeta = safeGetExerciseMetaByName(exercise.name);
                const media = resolveExerciseMedia({
                  ...catalogExercise,
                  gif: exerciseMeta?.gif,
                });
                const fallbackExercise = catalogExercise || { name: exercise.name };
                return (
                  <View
                    style={styles.exerciseMediaBlock}
                    onStartShouldSetResponder={() => true}
                  >
                    {media.hasRealThumbnail ? (
                      <Image
                        source={{ uri: media.thumbnailUrl }}
                        style={styles.exerciseMediaThumbnail}
                        resizeMode="cover"
                      />
                    ) : (
                      <ExerciseMediaFallback
                        exercise={fallbackExercise}
                        compact
                        testID="workout-exercise-media-fallback"
                      />
                    )}
                    <ExerciseExecutionCta
                      media={media}
                      testID="btn-ver-execucao"
                      onPress={() => openExerciseDetail(exercise.name)}
                    />
                  </View>
                );
              })() : null}
              <View style={styles.lastWorkoutSticky}>
                <Text style={styles.lastWorkoutStickyTitle}>Ultimo treino</Text>
                <Text style={styles.lastWorkoutStickyValue}>
                  {isCardio
                    ? `${lastSet?.reps || 0}min • ${lastSet?.weight || 0}km`
                    : `${lastSet?.weight || 0}kg x ${lastSet?.reps || 0}`}
                  {lastSet?.rpe ? ` @RPE ${lastSet?.rpe}` : ''}
                </Text>
              </View>
              <View style={styles.exerciseChipRow}>
                <Text style={styles.smallChip}>{plannedSets}x{exercise.reps}</Text>
                <Text style={styles.smallChip}>Serie {Math.min(setProgress.nextSet, Math.max(setProgress.totalSets, 1))}/{setProgress.totalSets}</Text>
                {isActive && hasHistory ? (
                  <TouchableOpacity style={styles.substituteBtn} onPress={() => setShowSubstitutePicker((prev) => !prev)}>
                    <Text style={styles.substituteBtnText}>{exerciseSwapUiCopy.buttonLabel}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {isActive && hasHistory ? (
                <Text style={styles.substituteHelperText}>{exerciseSwapUiCopy.helperText}</Text>
              ) : null}

              {isActive ? (
                renderRestPresetRow(exercise.name, { compact: true, showManual: true })
              ) : (
                <Text style={styles.restPresetHint}>Descanso: {getExerciseRestPreset(exercise.name)}s</Text>
              )}

              <Text style={styles.progressHint}>
                {isCardio
                  ? `Ultimo: ${lastSet?.reps || 0}min • ${lastSet?.weight || 0}km`
                  : `Ultimo: ${lastSet?.weight || 0}kg x ${lastSet?.reps || 0} · Melhor: ${safeGetExerciseProgress(exercise.name, exerciseId).bestWeight || 0}kg`}
              </Text>
              {isActive && hasHistory ? (
                <TouchableOpacity
                  style={styles.coachHintToggle}
                  onPress={() => setShowCoachDetailsByExercise((prev) => ({
                    ...prev,
                    [exercise.id]: !prev?.[exercise.id],
                  }))}
                >
                  <Text style={styles.coachHintToggleText}>ℹ Dica do Coach</Text>
                </TouchableOpacity>
              ) : null}

              {isActive && hasHistory && showCoachDetailsByExercise?.[exercise.id] ? (
                <>
                  <Text style={styles.progressionLine}>
                    Hoje: {safeSuggestedWeight}kg {weightDelta > 0 ? `( +${weightDelta}kg )` : weightDelta < 0 ? `( ${weightDelta}kg )` : '( manter )'}
                  </Text>
                  <Text style={styles.progressionMetaLine}>
                    Meta hoje: {progression?.message || 'Consolidar tecnica e repetir carga com qualidade.'}
                  </Text>
                  <Text style={styles.progressionMetaLine}>
                    1RM estimado: {estimated1Rm}kg · RPE base: {lastSet?.rpe ? Number(lastSet.rpe) : 0}
                  </Text>

                  <View style={styles.prCard}>
                    <View style={styles.prCardHeader}>
                      <Text style={styles.prCardTitle}>Recorde pessoal</Text>
                    </View>
                    <Text style={styles.prCardWeight}>{prWeight || 0}kg</Text>
                    <Text style={styles.prCardMeta}>
                      {prGap > 0
                        ? `Faltam ${prGap}kg para bater o PR hoje.`
                        : 'Carga sugerida em faixa de recorde. Hora de atacar!'}
                    </Text>
                  </View>

                  {isActive && !historyPresentation.isEmpty ? (
                    <View testID="workout-exercise-history-panel" style={styles.historyWrap}>
                      <Text style={styles.historyTitle}>Historico do exercicio</Text>
                      <Text testID="workout-history-last-set" style={styles.historyEntryLine}>
                        {isCardio
                          ? `Ultimo: ${lastSet?.reps || 0}min • ${lastSet?.weight || 0}km`
                          : `Ultimo: ${lastSet?.weight || 0}kg x ${lastSet?.reps || 0}`}
                      </Text>
                      <Text style={styles.historyEntryLine}>
                        {isCardio
                          ? `Melhor: ${historyPresentation.summary.bestWeight || 0}km`
                          : `Melhor: ${historyPresentation.summary.bestWeight || 0}kg`}
                      </Text>
                      <Text style={styles.historyEntryLine}>
                        Volume: {historyPresentation.summary.totalVolume || 0}
                      </Text>
                      {historyPresentation.recentEntries.map((entry) => (
                        <Text key={`${exercise.id}-history-${entry.id}`} style={styles.historyEntryLine}>
                          {entry.lineText}
                        </Text>
                      ))}
                      {historyPresentation.ignoredHint ? (
                        <Text testID="workout-history-ignored-hint" style={styles.historyIgnoredHint}>
                          {historyPresentation.ignoredHint}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {historySnapshot.length ? (
                    <View style={styles.historyWrap}>
                      <Text style={styles.historyTitle}>Evolucao (ultimas 5 cargas)</Text>
                      <View style={styles.sparklineWrap}>
                        <View style={styles.sparklineCanvas}>
                          {sparklineSegments.map((segment) => (
                            <View
                              key={segment.key}
                              style={[
                                styles.sparklineSegment,
                                {
                                  left: segment.left,
                                  top: segment.top,
                                  width: segment.width,
                                  transform: [{ rotate: `${segment.angle}deg` }],
                                  backgroundColor: segment.rising ? colors.primary : colors.secondary,
                                },
                              ]}
                            />
                          ))}
                          {sparklinePoints.map((point, index) => (
                            <View
                              key={`${exercise.id}-point-${index}`}
                              style={[
                                styles.sparklinePoint,
                                {
                                  left: point.x - 3,
                                  top: point.y - 3,
                                  backgroundColor: index === sparklinePoints.length - 1 ? colors.warning : colors.secondary,
                                },
                              ]}
                            />
                          ))}
                        </View>
                        <View style={styles.sparklineFooter}>
                          {historySnapshot.map((entry, index) => (
                            <Text key={`${exercise.id}-legend-${entry.date}-${index}`} style={styles.sparklineLabel}>
                              {entry.date.slice(5)} {entry.weight}kg
                            </Text>
                          ))}
                        </View>
                      </View>
                    </View>
                  ) : null}
                </>
              ) : null}

              {isActive && showSubstitutePicker ? (
                <View style={styles.substitutePanel}>
                  <Text style={styles.substituteTitle}>{exerciseSwapUiCopy.panelTitle}</Text>
                  <View style={styles.substituteChipsWrap}>
                    {substituteCandidates.map((item) => (
                      <TouchableOpacity key={`${exercise.id}-sub-${item}`} style={styles.substituteChip} onPress={() => quickReplaceActiveExercise(item)}>
                        <Text style={styles.substituteChipText}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              {isActive ? <Text testID="series-salvas-total" style={styles.controlHint}>Series salvas: {todaySets.length}</Text> : null}

              {unifiedSetRows.map((row) => {
                const setIndex = row.index;
                const saved = row.saved;
                const draft = { weight: row.weight, reps: row.reps, rpe: row.rpe };
                const canSave = setIndex === todaySets.length;
                const suggestedWeight = suggestedWeightByExercise[exercise.name] || '';
                const rowState = buildWorkoutSetRowState({
                  weight: saved ? saved.weight : draft.weight,
                  reps: saved ? saved.reps : draft.reps,
                  rpe: saved ? saved.rpe : draft.rpe,
                  isSaved: Boolean(saved),
                  isFuture: setIndex > todaySets.length,
                  isActiveSet: isActive && canSave,
                  isCardio,
                });

                return (
                  <Animated.View
                    key={`${exercise.id}-set-${row.id}`}
                    style={[
                      styles.setRow,
                      savedSetPulseKey === `${exercise.name}-${setIndex}` ? styles.setRowSavedPulse : null,
                      savedSetPulseKey === `${exercise.name}-${setIndex}`
                        ? {
                            transform: [{
                              scale: rowPulseAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [1, 1.05],
                              }),
                            }],
                            opacity: rowPulseAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [1, 0.96],
                            }),
                          }
                        : null,
                    ]}
                  >
                    <View style={styles.setLabelRow}>
                      <Text style={styles.setLabel}>{setIndex + 1}S</Text>
                      <View style={[
                        styles.setStatusChip,
                        rowState.status === 'saved' ? styles.setStatusChipSaved : null,
                        rowState.status === 'ready' ? styles.setStatusChipReady : null,
                        rowState.status === 'invalid' ? styles.setStatusChipInvalid : null,
                      ]}>
                        <Text style={styles.setStatusChipText}>{rowState.label}</Text>
                      </View>
                    </View>

                    <View style={styles.setBody}>
                      {saved ? (
                        <Swipeable
                          overshootRight={false}
                          renderRightActions={() => (
                            <View style={styles.swipeActionsWrap}>
                              <TouchableOpacity
                                testID={isActive && setIndex === 0 ? 'btn-editar-serie' : `btn-editar-serie-${exercise.id}-${setIndex}`}
                                style={styles.swipeEditBtn}
                                onPress={() => editSavedSet(exercise.name, setIndex)}
                              >
                                <Text style={styles.removeSetBtnText}>Editar</Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                testID={isActive && setIndex === 0 ? 'btn-remover-serie' : `btn-remover-serie-${exercise.id}-${setIndex}`}
                                style={styles.swipeDeleteBtn}
                                onPress={() => removeSavedSet(exercise.name, setIndex)}
                              >
                                <Text style={styles.removeSetBtnText}>Excluir</Text>
                              </TouchableOpacity>
                            </View>
                          )}
                        >
                          <View style={styles.savedSetBox}>
                            <View style={styles.savedSetCopy}>
                              <Text style={styles.savedSetText}>
                                {isCardio
                                  ? `${saved.reps}min • ${saved.weight}km`
                                  : `${saved.weight}kg x ${saved.reps}`}
                                {saved.rpe ? ` @RPE ${saved.rpe}` : ''}
                              </Text>
                              <Text style={styles.savedSetHint}>Serie salva • arraste para editar/remover</Text>
                            </View>
                          </View>
                        </Swipeable>
                      ) : (
                        <>
                          <View style={styles.setInputRow}>
                            <SetField
                              value={draft.weight}
                              savedValue={saved?.weight}
                              placeholder={isCardio ? 'km' : (suggestedWeight ? `${suggestedWeight}kg` : 'kg')}
                              isSaving={isSavingWorkout}
                              isSaved={Boolean(saved)}
                              isDisabled={setIndex > todaySets.length}
                              testID={isActive && canSave ? 'input-weight' : `input-weight-${exercise.id}-${setIndex}`}
                              focused={
                                keypadState.visible
                                && keypadState.exerciseName === exercise.name
                                && keypadState.setIndex === setIndex
                                && keypadState.field === 'weight'
                              }
                              onPress={() => openKeypadForField(exercise, exerciseIndex, setIndex, 'weight', draft.weight)}
                            />
                            <SetField
                              value={draft.reps}
                              savedValue={saved?.reps}
                              placeholder={isCardio ? 'min' : 'reps'}
                              isSaving={isSavingWorkout}
                              isSaved={Boolean(saved)}
                              isDisabled={setIndex > todaySets.length}
                              testID={isActive && canSave ? 'input-reps' : `input-reps-${exercise.id}-${setIndex}`}
                              focused={
                                keypadState.visible
                                && keypadState.exerciseName === exercise.name
                                && keypadState.setIndex === setIndex
                                && keypadState.field === 'reps'
                              }
                              onPress={() => openKeypadForField(exercise, exerciseIndex, setIndex, 'reps', draft.reps)}
                            />
                          </View>
                          <View style={styles.setMetaRow}>
                            <View style={styles.rpeWrap}>
                              <Text style={styles.rpeLabel}>RPE</Text>
                              <View style={styles.rpeChipsRow}>
                                {RPE_CHIPS.map((chip) => (
                                  <TouchableOpacity
                                    key={`${exercise.id}-${setIndex}-rpe-${chip}`}
                                    style={[
                                      styles.rpeChip,
                                      String(draft.rpe || '8') === chip ? styles.rpeChipActive : null,
                                    ]}
                                    onPress={() => setDraftField(exercise.name, setIndex, 'rpe', chip)}
                                  >
                                    <Text style={styles.rpeChipText}>{chip}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            </View>

                            {isActive && canSave && safeSuggestedWeight > 0 && !isCardio ? (
                              <TouchableOpacity
                                style={styles.suggestButton}
                                onPress={() => setDraftField(exercise.name, setIndex, 'weight', String(safeSuggestedWeight))}
                              >
                                <Text style={styles.suggestButtonText}>usar {safeSuggestedWeight}kg</Text>
                              </TouchableOpacity>
                            ) : null}

                            {isActive && canSave && progressionTargetWeight > 0 && !isCardio ? (
                              <TouchableOpacity
                                style={styles.progressionButton}
                                onPress={() => {
                                  const targetReps = Number(inferRepTarget(exercise));
                                  setDraftField(exercise.name, setIndex, 'weight', String(progressionTargetWeight));
                                  trackEvent('progression_applied', {
                                    exerciseName: exercise.name,
                                    fromWeight: lastWeight,
                                    toWeight: progressionTargetWeight,
                                    lastReps,
                                    targetReps,
                                  });
                                }}
                              >
                                <Text style={styles.progressionButtonText}>
                                  meta {progressionTargetWeight.toFixed(1)}kg
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>

                          {isActive && rowState.showAction && rowState.canSave ? (
                            <TouchableOpacity
                              style={[styles.inlineBtn, styles.inlineBtnGood]}
                              testID={isActive && canSave ? 'btn-save-set' : `btn-save-set-${exercise.id}-${setIndex}`}
                              onPress={() => {
                                workoutDevLog('SET_TAP', {
                                  exercise: exercise?.name,
                                  setIndex: Number(setIndex) + 1,
                                  counterBefore: `${computedGuidedSets}/${displayedSeriesTotal}`,
                                });
                                saveSetLine(exercise, exerciseIndex, setIndex);
                              }}
                            >
                              <Text style={styles.inlineBtnText}>{rowState.actionLabel}</Text>
                            </TouchableOpacity>
                          ) : null}

                          {isActive && rowState.helperText ? (
                            <Text style={styles.setRowHelperText}>{rowState.helperText}</Text>
                          ) : null}
                        </>
                      )}
                    </View>
                  </Animated.View>
                );
              })}

              {isActive ? (
                <View style={styles.setActionsRow}>
                  <TouchableOpacity testID="btn-add-set" style={styles.addSetButton} onPress={() => addSetToExercise(exercise.name)}>
                    <Text style={styles.addSetButtonText}>+ Série extra</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {!isActive ? <Text style={styles.inactiveHint}>Toque para focar • {setProgress.completedSets}/{setProgress.totalSets} series</Text> : null}
            </TouchableOpacity>
          );
          } catch (err) {
            console.error('[WorkoutScreen renderItem crash]', exercise?.name, err?.message, '\nSTACK:', err?.stack);
            return (
              <View key={`render-fallback-${renderIndex}`} style={styles.exerciseCardFallback}>
                <Text style={styles.exerciseCardFallbackTitle}>{exercise?.name ?? 'Exercicio'}</Text>
                <Text style={styles.exerciseCardFallbackText}>
                  Nao foi possivel renderizar este bloco agora. Tente alternar para outro exercicio e voltar.
                </Text>
              </View>
            );
          }
          }}
        />

        {!simpleMode ? <AppCard style={styles.addExerciseCard}>
          <Text style={styles.addExerciseTitle}>Selecionar exercicio existente</Text>
          <TextInput
            value={exerciseQuery}
            onChangeText={setExerciseQuery}
            placeholder="Buscar exercicio"
            placeholderTextColor="#8FA5CB"
            style={styles.addExerciseInput}
          />
          <FlatList
            data={suggestedExercises}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggestionScroll}
            keyExtractor={(item, index) => `${item}-${index}`}
            contentContainerStyle={styles.suggestionRow}
            renderItem={({ item }) => (
              <View style={styles.suggestionChipWrap}>
                <TouchableOpacity style={styles.suggestionChip} onPress={() => setNewExerciseName(item)}>
                  <Text style={styles.suggestionChipText}>{item}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.suggestionDetailButton} onPress={() => openExerciseDetail(item)}>
                  <Text style={styles.suggestionDetailButtonText}>Ver execução</Text>
                </TouchableOpacity>
              </View>
            )}
          />
          <Text style={styles.addExerciseTitle}>Adicionar ou trocar exercicio</Text>
          <TextInput
            testID="input-novo-exercicio"
            value={newExerciseName}
            onChangeText={setNewExerciseName}
            placeholder="Exercicio selecionado"
            placeholderTextColor="#8FA5CB"
            style={styles.addExerciseInput}
          />
          <View style={styles.addExerciseRow}>
            <TextInput
              testID="input-novo-exercicio-series"
              value={newExerciseSets}
              onChangeText={setNewExerciseSets}
              placeholder="Series"
              placeholderTextColor="#8FA5CB"
              keyboardType="numeric"
              style={[styles.addExerciseInput, styles.addExerciseSmallInput]}
            />
            <TextInput
              testID="input-novo-exercicio-reps"
              value={newExerciseReps}
              onChangeText={setNewExerciseReps}
              placeholder="Reps ex: 8-12"
              placeholderTextColor="#8FA5CB"
              style={[styles.addExerciseInput, styles.addExerciseSmallInput]}
            />
          </View>
          <Text style={styles.substituteHelperText}>{exerciseSwapUiCopy.helperText}</Text>
          <View style={styles.actionRow}>
            <TouchableOpacity testID="btn-adicionar-exercicio-workout" style={styles.addExerciseButton} onPress={addExerciseToWorkout}>
              <Text style={styles.addExerciseButtonText}>+ Adicionar</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="btn-substituir-exercicio-workout" style={styles.replaceExerciseButton} onPress={replaceActiveExercise}>
              <Text style={styles.replaceExerciseButtonText}>{exerciseSwapUiCopy.buttonLabel}</Text>
            </TouchableOpacity>
          </View>
        </AppCard> : null}

        <View style={styles.finishCard}>
          <Text style={styles.finishHintText}>{progressCopy.footerHint}</Text>
          {canFinishWorkoutNow ? (
            <PrimaryButton testID="btn-finalizar-treino" title={finishButtonTitle} onPress={finishWorkout} style={styles.finishButton} />
          ) : (
            <PrimaryButton testID="btn-continuar-treino" title="Continuar treino" onPress={focusActiveExercise} style={styles.finishButton} />
          )}
          <SecondaryButton
            testID="btn-salvar-parcial"
            title={canFinishWorkoutNow ? 'Salvar parcial e sair' : 'Sair e salvar progresso'}
            onPress={savePartialAndExit}
            style={styles.partialButton}
          />
          {syncStatusMessage ? <Text style={styles.syncStatusText}>{syncStatusMessage}</Text> : null}
        </View>

        {showWorkoutSummary ? (
          <Animated.View style={{ opacity: fadeAnim }}>
            <AppCard style={styles.summaryCard}>
              {/* BLOCO 6: Dopamina máxima - Grande XP display */}
              <View style={styles.summaryXpSection}>
                <Text style={styles.summaryXpLabel}>Você ganhou</Text>
                <Text style={styles.summaryXpValue}>+{Number(workoutSummary?.sessionXp || 0)}</Text>
                <Text style={styles.summaryXpUnit}>XP</Text>
              </View>

              <Text style={styles.summaryTitle}>🔥 Treino concluido!</Text>

              {/* BLOCO 6: Melhor hierarquia - Cards espaçados */}
              <View style={styles.summaryStatsGroup}>
                <Text style={styles.summaryStatLabel}>Volume Total</Text>
                <Text style={styles.summaryStatValue}>{Math.round(Number(workoutSummary?.totalVolume || 0))}kg</Text>
              </View>

              <View style={styles.summaryStatsGroup}>
                <Text style={styles.summaryStatLabel}>Series</Text>
                <Text style={styles.summaryStatValue}>{Number(workoutSummary?.totalSets || 0)}</Text>
              </View>

              <View style={styles.summaryStatsGroup}>
                <Text style={styles.summaryStatLabel}>1RM Estimado</Text>
                <Text style={styles.summaryStatValue}>{Number(workoutSummary?.estimated1RM || 0)}kg</Text>
              </View>

              <View style={styles.postWorkoutNutritionWrap}>
                <Text style={styles.postWorkoutNutritionTitle}>Próximo passo: +{Math.max(0, Number(postWorkoutNutritionFeedback?.missingProtein || 0))}g proteina</Text>
                <Text style={styles.postWorkoutNutritionText}>{postWorkoutNutritionFeedback?.suggestion || 'Sugestao indisponivel'}</Text>
              </View>

              {/* BLOCO 6: CTAs claras - Continue amanhã + Ver progresso */}
              <PrimaryButton title="✅ Continue amanhã" onPress={closeWorkoutSummary} style={styles.finishButton} />
              <SecondaryButton title="📈 Ver progresso" onPress={goToEvolution} style={styles.partialButton} />
              <SecondaryButton title="📋 Histórico" onPress={goToHistoryAfterWorkout} style={styles.partialButton} />
            </AppCard>
          </Animated.View>
        ) : null}
      </ScrollView>

      <CustomKeypad
        visible={keypadState.visible}
        title={keypadState.field === 'weight' ? 'Peso (kg)' : 'Repeticoes'}
        value={keypadState.value}
        onChange={(nextValue) => {
          keypadValueRef.current = nextValue;
          setKeypadState((prev) => {
            if (prev.exerciseName && prev.setIndex >= 0 && prev.field) {
              setDraftField(prev.exerciseName, prev.setIndex, prev.field, nextValue);
            }
            return { ...prev, value: nextValue };
          });
        }}
        onClose={closeKeypad}
        onConfirm={confirmKeypad}
      />
    </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: 84,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginTop: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    paddingBottom: 4,
  },
  modeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingVertical: 4,
  },
  modeToggleLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  modeToggleAction: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.primaryMuted,
  },
  modeToggleActionText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  modeToggleHelper: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  uxSpeedWrap: {
    borderWidth: 1,
    borderColor: colors.outlineStrong,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  uxSpeedLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  uxSpeedGood: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  uxSpeedWarn: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
  },
  progressHeaderWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressHeaderText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  streakText: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '900',
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.borderSubtle,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  actionToast: {
    borderWidth: 1,
    borderColor: colors.primaryDim,
    backgroundColor: colors.successMuted,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  actionToastText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '900',
  },
  metaText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  restBanner: {
    backgroundColor: colors.successMuted,
    borderWidth: 1,
    borderColor: colors.primaryDim,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  restBannerLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  restBannerTimer: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    marginTop: 4,
  },
  restBannerTimerPulse: {
    opacity: 0.82,
  },
  restBannerTimerDanger: {
    color: colors.warning,
  },
  skipButton: {
    marginTop: 8,
    backgroundColor: colors.danger,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
    flex: 1,
  },
  skipButtonText: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  restActionsRow: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  extendRestButton: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  extendRestText: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  xpFeedback: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.2,
  },
  xpFeedbackWrap: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: colors.successMuted,
  },
  restDoneMessage: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  presetRowCompact: {
    marginTop: 4,
    marginBottom: 12,
  },
  restPresetLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginRight: 4,
  },
  restPresetHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  exerciseProgressWrap: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  exerciseProgressWrapAdvanced: {
    borderColor: colors.primary,
    backgroundColor: colors.cardElevated,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  exerciseProgressText: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  exerciseProgressSub: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  advancedMetaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  exerciseIndexBadge: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  presetBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  presetBtnIdle: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
    opacity: 0.78,
  },
  presetBtnActive: {
    backgroundColor: colors.secondaryMuted,
    borderColor: colors.secondary,
    opacity: 1,
    transform: [{ scale: 1.06 }],
  },
  presetText: {
    fontWeight: '700',
    fontSize: 12,
  },
  presetTextIdle: {
    color: colors.textMuted,
  },
  presetTextActive: {
    color: colors.textPrimary,
  },
  manualRestBtn: {
    marginLeft: 'auto',
    backgroundColor: colors.secondary,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  manualRestText: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 12,
  },
  exerciseCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  exerciseCardActive: {
    backgroundColor: colors.cardElevated,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 4,
  },
  exerciseCardMuted: {
    backgroundColor: colors.card,
    borderColor: colors.borderSubtle,
    opacity: 0.72,
  },
  exerciseCardFallback: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.dangerMuted,
    backgroundColor: colors.surface,
  },
  exerciseCardFallbackTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.warning,
    marginBottom: 4,
  },
  exerciseCardFallbackText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  exerciseName: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  exerciseMediaBlock: {
    marginBottom: spacing.sm,
  },
  exerciseMediaThumbnail: {
    width: '100%',
    height: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  lastWorkoutSticky: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  lastWorkoutStickyTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  lastWorkoutStickyValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  exerciseChipRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  controlHint: {
    marginBottom: 8,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  progressHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  progressionLine: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  progressionMetaLine: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  prCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  prCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  prCardTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  prCardWeight: {
    color: colors.warning,
    fontSize: 22,
    fontWeight: '900',
  },
  prCardMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  smallChip: {
    backgroundColor: colors.surface,
    color: colors.textSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '700',
  },
  substituteBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: colors.surface,
  },
  substituteBtnText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  substituteHelperText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    marginBottom: 4,
  },
  substitutePanel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 8,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  substituteTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  substituteChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  substituteChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: colors.card,
  },
  substituteChipText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 10,
  },
  setBody: {
    flex: 1,
    minWidth: 0,
    gap: 8,
  },
  setInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  setMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  setRowSavedPulse: {
    backgroundColor: colors.successMuted,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  setLabel: {
    width: 26,
    color: colors.textSecondary,
    fontWeight: '800',
    paddingTop: 12,
  },
  setLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 8,
  },
  setStatusChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated || colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  setStatusChipReady: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  setStatusChipSaved: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  setStatusChipInvalid: {
    borderColor: '#B45309',
    backgroundColor: '#3A2510',
  },
  setStatusChipText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
  },
  setRowHelperText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  coachHintToggle: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  coachHintToggleText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  rpeWrap: {
    borderWidth: 1,
    borderColor: colors.outlineStrong,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: colors.surface,
    minWidth: 132,
  },
  rpeLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  rpeChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  rpeChip: {
    minWidth: 48,
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.secondaryDim,
    borderRadius: 999,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  rpeChipActive: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondaryMuted,
  },
  rpeChipText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  rowActionsInline: {
    marginTop: 4,
  },
  rowActionsInlineCurrent: {},
  inlineBtn: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineBtnGood: {
    backgroundColor: colors.success,
  },
  inlineBtnDisabled: {
    opacity: 0.35,
  },
  inlineBtnText: {
    color: colors.textInverse,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  nextExerciseCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  nextExerciseLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  nextExerciseText: {
    color: colors.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 2,
  },
  suggestButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.surfaceAlt,
  },
  suggestButtonText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  progressionButton: {
    borderWidth: 1,
    borderColor: colors.primaryDim,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.successMuted,
  },
  progressionButtonText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  savedSetBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: colors.successMuted,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  savedSetCopy: {
    flex: 1,
    minWidth: 0,
  },
  savedActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editSetBtn: {
    borderRadius: 8,
    backgroundColor: colors.secondaryDim,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  removeSetBtn: {
    borderRadius: 8,
    backgroundColor: colors.dangerMuted,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  removeSetBtnText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  swipeActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 8,
  },
  swipeEditBtn: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeDeleteBtn: {
    borderRadius: 8,
    backgroundColor: colors.dangerMuted,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedSetText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  savedSetHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  historyWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 8,
    backgroundColor: colors.surface,
    marginBottom: 8,
  },
  historyTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  historyEntryLine: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  historyIgnoredHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  sparklineWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  sparklineCanvas: {
    width: SPARKLINE_WIDTH,
    height: SPARKLINE_HEIGHT,
    position: 'relative',
    alignSelf: 'center',
    marginBottom: 8,
  },
  sparklineSegment: {
    position: 'absolute',
    height: 2,
    borderRadius: 999,
  },
  sparklinePoint: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#0B1220',
  },
  sparklineFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  sparklineLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  historyRow: {
    marginBottom: 6,
  },
  historyLabel: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 3,
  },
  historyBarTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  historyBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  historyBarFail: {
    backgroundColor: colors.danger,
  },
  setActionsRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
  },
  addSetButton: {
    flex: 1,
    marginTop: 4,
    backgroundColor: 'transparent',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: 10,
  },
  addSetButtonText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  addExerciseCard: {
    marginTop: 8,
  },
  suggestionScroll: {
    marginBottom: 8,
  },
  suggestionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  suggestionChipWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#141922',
  },
  suggestionChipText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  suggestionDetailButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#162233',
  },
  suggestionDetailButtonText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 11,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  savedBanner: {
    alignSelf: 'flex-start',
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
  },
  savedBannerText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '700',
  },
  savedFixedIndicator: {
    position: 'absolute',
    top: 140,
    left: 20,
    right: 20,
    zIndex: 30,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.successMuted,
    borderWidth: 1,
    borderColor: colors.success,
  },
  restFloatingCard: {
    position: 'absolute',
    top: 210,
    right: 16,
    zIndex: 25,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    minWidth: 148,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  restFloatingLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  restFloatingValue: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 2,
    marginBottom: 6,
  },
  restFloatingValueDanger: {
    color: colors.warning,
  },
  restFloatingActions: {
    flexDirection: 'row',
    gap: 6,
  },
  restFloatingSecondary: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  restFloatingSecondaryText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  restFloatingDanger: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  restFloatingDangerText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  addExerciseTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 8,
  },
  addExerciseRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addExerciseInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
    fontSize: 14,
  },
  addExerciseSmallInput: {
    flex: 1,
  },
  addExerciseButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
  },
  addExerciseButtonText: {
    color: colors.textInverse,
    fontWeight: '800',
    fontSize: 14,
  },
  replaceExerciseButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    paddingVertical: 11,
  },
  replaceExerciseButtonText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  finishCard: {
    marginTop: 12,
    marginBottom: 18,
  },
  finishHintText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  finishButton: {
    marginBottom: 8,
  },
  partialButton: {
    marginTop: 0,
  },
  syncStatusText: {
    marginTop: spacing.sm,
    color: '#C7D8F7',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  summaryCard: {
    marginBottom: 24,
  },
  // BLOCO 6: Dopamina máxima - XP grande + melhor layout
  summaryXpSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryXpLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  summaryXpValue: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.primary,
    lineHeight: 56,
  },
  summaryXpUnit: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  summaryStatsGroup: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  summaryStatValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  summaryLine: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  summaryPositive: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  postWorkoutNutritionWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  postWorkoutNutritionTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  postWorkoutNutritionText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  inactiveHint: {
    marginTop: 8,
    color: '#8FA5CB',
    fontSize: 12,
  },
  
  // BLOCO 1: Animação + Recompensa
  xpFloatingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -40,
    zIndex: 999,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  xpFloatingText: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.primary,
    textShadowColor: 'rgba(74, 222, 128, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  successFlashOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    pointerEvents: 'none',
  },
  devFeatureTagWrap: {
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#0B1730',
    borderRadius: 999,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  devFeatureTag: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '800',
  },
});
