import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useNotifications, useNutrition, useWorkout } from '../hooks';
import { getCanonicalExerciseId, getCanonicalMuscleGroup } from '../data/exerciseDatabase';
import { SCREENS, trackAppError, trackEvent } from '../utils/analytics';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';

function formatTimer(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function getTodayKeyLocal() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function SetField({ value, onChangeText, placeholder, inputRef }) {
  return (
    <TextInput
      ref={inputRef}
      keyboardType="numeric"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      style={styles.setField}
    />
  );
}

const RPE_CHIPS = ['7', '8', '9', '10'];
const SPARKLINE_WIDTH = 230;
const SPARKLINE_HEIGHT = 58;

function buildSparklinePoints(values = [], width = SPARKLINE_WIDTH, height = SPARKLINE_HEIGHT) {
  const safeValues = Array.isArray(values) ? values.map((entry) => Number(entry || 0)) : [];
  if (!safeValues.length) {
    return [];
  }

  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = Math.max(1, max - min);
  const xStep = safeValues.length > 1 ? width / (safeValues.length - 1) : width;

  return safeValues.map((value, index) => {
    const normalized = (value - min) / range;
    return {
      x: Math.round(index * xStep),
      y: Math.round(height - normalized * height),
      value,
      normalized,
    };
  });
}

export default function WorkoutScreen({ navigation }) {
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
    workoutLogs,
  } = useWorkout();
  const { getNutritionFeedback } = useNutrition();
  const { hasFeatureAccess } = useNotifications();

  const todayKey = useMemo(() => getTodayKeyLocal(), []);
  const baseExercises = useMemo(() => getTodayWorkout(), [getTodayWorkout]);
  const [sessionBaseExercises, setSessionBaseExercises] = useState([]);
  const [customExercises, setCustomExercises] = useState([]);
  const allExercises = useMemo(() => [...sessionBaseExercises, ...customExercises], [sessionBaseExercises, customExercises]);
  const exerciseCatalog = useMemo(() => getExerciseCatalog(), [getExerciseCatalog]);
  const summary = useMemo(() => getTodayWorkoutSummary(), [getTodayWorkoutSummary]);
  const gamification = useMemo(() => getWorkoutGamification(), [getWorkoutGamification]);

  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [draftSetsByExercise, setDraftSetsByExercise] = useState({});
  const [setCountByExercise, setSetCountByExercise] = useState({});
  const [restPreset, setRestPreset] = useState(60);
  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [restDoneMessage, setRestDoneMessage] = useState('');
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

  const postWorkoutNutritionFeedback = getNutritionFeedback({ trainedToday: true });

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
  const exercisePositionsRef = useRef({});
  const setFieldRefs = useRef({});
  const postWorkoutTriggeredRef = useRef(false);
  const lastCountdownTickRef = useRef(null);
  const sessionStartXpRef = useRef(null);
  const actionFeedbackAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    prepareTodayWorkoutTargets();
  }, []);

  useEffect(() => {
    setSessionBaseExercises(baseExercises.map((item) => ({ ...item })));
  }, [baseExercises]);

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
    if (!restRunning) {
      lastCountdownTickRef.current = null;
      return;
    }

    if (restSeconds <= 0) {
      setRestRunning(false);
      lastCountdownTickRef.current = null;
      Vibration.vibrate(500);
      setRestDoneMessage('Descanso concluido. Proxima serie liberada.');
      return;
    }

    // Ultimos 5s com pulso haptico para reforcar retorno ao set.
    if (restSeconds <= 5 && lastCountdownTickRef.current !== restSeconds) {
      lastCountdownTickRef.current = restSeconds;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    const timeoutId = setTimeout(() => {
      setRestSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [restRunning, restSeconds]);

  useEffect(() => {
    if (!restDoneMessage) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setRestDoneMessage('');
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [restDoneMessage]);

  useEffect(() => {
    if (!xpFeedback) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setXpFeedback('');
    }, 2200);

    return () => clearTimeout(timeoutId);
  }, [xpFeedback]);

  useEffect(() => {
    if (summary.completionRate < 1) {
      return;
    }

    if (postWorkoutTriggeredRef.current) {
      return;
    }

    postWorkoutTriggeredRef.current = true;

    if (!hasFeatureAccess('auto_coach')) {
      navigateWithTracking('Paywall', {
        featureKey: 'auto_coach',
        source: 'post_workout',
        message: 'Treino completo, mas voce ainda esta treinando no escuro. O Auto Coach ajusta seu treino automaticamente.',
      }, 'post_workout_paywall');
    }
  }, [summary.completionRate, summary.guidedSets, summary.plannedSets, hasFeatureAccess, navigation]);

  useEffect(() => {
    const activeExercise = allExercises[activeExerciseIndex];
    if (!activeExercise || !scrollRef.current) {
      return;
    }

    const y = exercisePositionsRef.current[activeExercise.id];
    if (typeof y === 'number') {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 20), animated: true });
    }
  }, [activeExerciseIndex, allExercises]);

  const activeExercise = allExercises[activeExerciseIndex] || null;

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

  const suggestedExercises = useMemo(() => {
    if (!activeExercise) {
      return exerciseCatalog.slice(0, 8);
    }

    const group = inferExerciseGroup(activeExercise.name);
    const sameGroup = group ? getExercisesByMuscleGroup(group) : [];
    const related = getFreeWorkoutSuggestions([activeExercise.name]);
    const combined = [...sameGroup, ...related, ...exerciseCatalog];
    const unique = Array.from(new Set(combined));
    const query = String(exerciseQuery || '').toLowerCase().trim();
    const filtered = query
      ? unique.filter((name) => name.toLowerCase().includes(query))
      : unique;
    return filtered.slice(0, 10);
  }, [activeExercise, exerciseCatalog, getFreeWorkoutSuggestions, getExercisesByMuscleGroup, exerciseQuery]);

  const lastSetByExercise = useMemo(() => {
    const map = {};
    workoutLogs.forEach((item) => {
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

  const focusSetField = (exerciseName, setIndex, field = 'weight') => {
    const key = getSetFieldKey(exerciseName, setIndex, field);
    const target = setFieldRefs.current[key];
    if (target?.focus) {
      target.focus();
    }
  };

  const normalizeNumericInput = (value) => String(value || '').replace(',', '.').trim();

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

  const isValidSet = (kg, reps) => {
    const parsedKg = Number(normalizeNumericInput(kg));
    const parsedReps = Number(normalizeNumericInput(reps));
    return kg !== '' && reps !== '' && parsedKg > 0 && parsedReps > 0;
  };

  const startRestTimer = (seconds = restPreset) => {
    Vibration.vibrate(80);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRestSeconds(seconds);
    setRestRunning(true);
  };

  const skipRest = () => {
    setRestRunning(false);
    setRestSeconds(0);
  };

  const extendRestByThirty = () => {
    setRestSeconds((prev) => Math.max(0, Number(prev || 0)) + 30);
  };

  const setDraftField = (exerciseName, setIndex, field, value) => {
    setDraftSetsByExercise((prev) => {
      const currentRows = prev[exerciseName] || [];
      const rows = currentRows.map((row, idx) =>
        idx === setIndex ? { ...row, [field]: value } : row
      );
      return {
        ...prev,
        [exerciseName]: rows,
      };
    });
  };

  const jumpToNextExercise = (currentIndex) => {
    for (let index = currentIndex + 1; index < allExercises.length; index += 1) {
      const item = allExercises[index];
      const plannedSets = Number(setCountByExercise[item.name] || item.sets || 3);
      const progress = getExerciseSetProgress(item.name, plannedSets);
      if (!progress.isDone) {
        setActiveExerciseIndex(index);
        return;
      }
    }

    for (let index = 0; index < allExercises.length; index += 1) {
      const item = allExercises[index];
      const plannedSets = Number(setCountByExercise[item.name] || item.sets || 3);
      const progress = getExerciseSetProgress(item.name, plannedSets);
      if (!progress.isDone) {
        setActiveExerciseIndex(index);
        return;
      }
    }
  };

  const saveSetLine = (exercise, exerciseIndex, setIndex) => {
    const plannedSets = Number(setCountByExercise[exercise.name] || exercise.sets || 3);
    const todaySets = workoutLogs
      .filter((item) => item.date === todayKey && isSameExerciseLog(item, exercise.name) && (item.mode || 'guided') !== 'free');

    const nextIndex = todaySets.length;
    if (setIndex !== nextIndex) {
      Alert.alert('Ordem das series', `Salve primeiro a serie ${nextIndex + 1}.`);
      return;
    }

    const row = (draftSetsByExercise[exercise.name] || [])[setIndex] || { weight: '', reps: '', rpe: '8' };
    if (!isValidSet(row.weight, row.reps)) {
      Alert.alert('Dados invalidos', 'Preencha peso e repeticoes validas.');
      return;
    }

    const result = saveWorkoutSet({
      exerciseName: exercise.name,
      exerciseId: getCanonicalExerciseId(exercise.name) || undefined,
      weight: Number(normalizeNumericInput(row.weight)),
      reps: Number(normalizeNumericInput(row.reps)),
      rpe: Number(normalizeNumericInput(row.rpe || '8')),
      failed: false,
    });

    if (!result.ok) {
      Alert.alert('Dados invalidos', result.message);
      return;
    }

    if (result.xpEvents?.length) {
      setXpFeedback(result.xpEvents.join(' | '));
    } else {
      setXpFeedback('+1 serie concluida');
    }

    showActionToast(`Serie ${setIndex + 1}/${plannedSets} concluida 🔥`);

    if (result.isNewLoadPR) {
      const safeDelta = Number(result.prWeightDelta || 0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showActionToast(`🔥 Novo recorde! +${safeDelta}kg no ${exercise.name}`);
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setSavedSetPulseKey(`${exercise.name}-${setIndex}`);
    setTimeout(() => setSavedSetPulseKey(''), 500);

    startRestTimer();

    const currentProgress = getExerciseSetProgress(exercise.name, plannedSets);
    const nextCompleted = currentProgress.completedSets + 1;
    const nextSetIndex = setIndex + 1;

    if (nextSetIndex >= plannedSets) {
      addSetToExercise(exercise.name);
      setTimeout(() => {
        focusSetField(exercise.name, plannedSets, 'weight');
      }, 80);
    } else {
      setTimeout(() => {
        focusSetField(exercise.name, nextSetIndex, 'weight');
      }, 60);
    }

    if (nextCompleted >= plannedSets) {
      jumpToNextExercise(exerciseIndex);
    }
  };

  const removeSavedSet = (exerciseName, setIndex) => {
    const result = removeTodayWorkoutSet({ exerciseName, setIndex, mode: 'guided' });
    if (!result.ok) {
      Alert.alert('Nao foi possivel remover', result.message);
      return;
    }
    Vibration.vibrate(40);
    setXpFeedback('Serie removida');
  };

  const editSavedSet = (exerciseName, setIndex) => {
    const todaySets = workoutLogs
      .filter((item) => item.date === todayKey && isSameExerciseLog(item, exerciseName) && (item.mode || 'guided') !== 'free');
    const saved = todaySets[setIndex];
    if (!saved) {
      return;
    }

    const removed = removeTodayWorkoutSet({ exerciseName, setIndex, mode: 'guided' });
    if (!removed.ok) {
      Alert.alert('Nao foi possivel editar', removed.message);
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

    setTimeout(() => {
      focusSetField(exerciseName, setIndex, 'weight');
    }, 60);
  };

  const addSetToExercise = (exerciseName) => {
    setSetCountByExercise((prev) => ({
      ...prev,
      [exerciseName]: Number(prev[exerciseName] || 0) + 1,
    }));

    setDraftSetsByExercise((prev) => ({
      ...prev,
      [exerciseName]: [
        ...(prev[exerciseName] || []),
        { weight: '', reps: '', rpe: '8' },
      ],
    }));
  };

  const removeLastSetFromExercise = (exerciseName) => {
    const plannedSets = Number(setCountByExercise[exerciseName] || 0);
    if (plannedSets <= 1) {
      Alert.alert('Limite minimo', 'Cada exercicio precisa de pelo menos 1 serie.');
      return;
    }

    const todaySets = workoutLogs
      .filter((item) => item.date === todayKey && isSameExerciseLog(item, exerciseName) && (item.mode || 'guided') !== 'free');

    if (todaySets.length >= plannedSets) {
      Alert.alert('Remova primeiro', 'A ultima serie ja foi salva. Exclua ela antes de reduzir o total.');
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
    const todaySets = workoutLogs
      .filter((item) => item.date === todayKey && isSameExerciseLog(item, exerciseName) && (item.mode || 'guided') !== 'free');

    if (setIndex < todaySets.length) {
      const result = removeTodayWorkoutSet({ exerciseName, setIndex, mode: 'guided' });
      if (!result.ok) {
        Alert.alert('Nao foi possivel remover', result.message);
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

  const addExerciseToWorkout = () => {
    const safeName = String(newExerciseName || '').trim();
    const sets = Number(newExerciseSets);
    const reps = String(newExerciseReps || '').trim() || '8-12';

    if (!safeName || !sets || sets <= 0) {
      Alert.alert('Dados invalidos', 'Informe nome e quantidade de series validas para o exercicio.');
      return;
    }

    if (!exerciseCatalog.includes(safeName)) {
      Alert.alert('Escolha da lista', 'Selecione um exercicio existente na lista de sugestoes.');
      return;
    }

    if (allExercises.some((item) => item.name.toLowerCase() === safeName.toLowerCase())) {
      Alert.alert('Exercicio ja existe', 'Esse exercicio ja esta no treino de hoje.');
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
  };

  const replaceActiveExercise = () => {
    const safeName = String(newExerciseName || '').trim();
    if (!safeName) {
      Alert.alert('Escolha um exercicio', 'Selecione um exercicio da lista para substituir.');
      return;
    }

    if (!exerciseCatalog.includes(safeName)) {
      Alert.alert('Escolha da lista', 'Selecione um exercicio existente na lista de sugestoes.');
      return;
    }

    if (!activeExercise) {
      return;
    }

    if (activeExerciseIndex < sessionBaseExercises.length) {
      setSessionBaseExercises((prev) =>
        prev.map((item, index) =>
          index === activeExerciseIndex
            ? { ...item, name: safeName, id: `${safeName}-${index}` }
            : item
        )
      );
    } else {
      const customIndex = activeExerciseIndex - sessionBaseExercises.length;
      setCustomExercises((prev) =>
        prev.map((item, index) =>
          index === customIndex
            ? { ...item, name: safeName, id: `${safeName}-custom-${index}` }
            : item
        )
      );
    }

    setXpFeedback('Exercicio substituido com sucesso');
    setShowSubstitutePicker(false);
  };

  const quickReplaceActiveExercise = (exerciseName) => {
    setNewExerciseName(exerciseName);
    setTimeout(() => {
      replaceActiveExercise();
    }, 0);
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

  const finishWorkout = () => {
    const todaySessionLogs = workoutLogs.filter((item) => item.date === todayKey && (item.mode || 'guided') !== 'free');
    const todaySets = todaySessionLogs.length;
    const exerciseCount = new Set(todaySessionLogs.map((item) => item.exerciseName)).size;
    const totalVolume = todaySessionLogs.reduce((acc, item) => acc + (Number(item.weight || 0) * Number(item.reps || 0)), 0);
    const sessionXp = Math.max(0, Number(gamification.xp || 0) - Number(sessionStartXpRef.current || 0));
    const currentWorkout = {
      totalSets: todaySets,
      totalLoad: todaySessionLogs.reduce((acc, item) => acc + (Number(item.weight || 0) * Number(item.reps || 0)), 0),
    };

    const previousDates = Array.from(new Set(
      workoutLogs
        .filter((item) => item.date !== todayKey && (item.mode || 'guided') !== 'free')
        .map((item) => item.date)
    )).sort((a, b) => String(b).localeCompare(String(a)));

    const previousDate = previousDates[0] || null;
    const previousLogs = previousDate
      ? workoutLogs.filter((item) => item.date === previousDate && (item.mode || 'guided') !== 'free')
      : [];
    const previousWorkout = previousDate
      ? {
          totalSets: previousLogs.length,
          totalLoad: previousLogs.reduce((acc, item) => acc + (Number(item.weight || 0) * Number(item.reps || 0)), 0),
        }
      : null;

    const delta = getWorkoutDelta(currentWorkout, previousWorkout);

    trackEvent('workout_finish_manual', { guidedSets: todaySets, plannedSets: summary.plannedSets });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setWorkoutSummary({
      ...(delta || { setsDiff: 0, loadDiff: 0 }),
      totalSets: todaySets,
      exerciseCount,
      totalVolume,
      sessionXp,
    });
    setShowWorkoutSummary(true);
  };

  const closeWorkoutSummary = () => {
    setShowWorkoutSummary(false);
    navigation.goBack();
  };

  const goToEvolution = () => {
    setShowWorkoutSummary(false);
    navigateWithTracking('Insights', undefined, 'post_workout_insights');
  };

  const savePartialAndExit = () => {
    const todaySets = workoutLogs.filter((item) => item.date === todayKey && (item.mode || 'guided') !== 'free').length;
    trackEvent('workout_partial_saved', { guidedSets: todaySets, plannedSets: summary.plannedSets });
    navigation.goBack();
  };

  if (!allExercises.length) {
    return (
      <View style={styles.emptyContainer}>
        <ScreenHeader title="Treino de hoje" />
        <Text style={styles.emptyText}>Sem treino definido para hoje.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
        <ScreenHeader title="Treino de hoje" subtitle="Fluxo rapido: preencher e salvar serie." />

        <View style={styles.topRow}>
          <Text style={styles.metaText}>{summary.guidedSets}/{summary.plannedSets || 0} series</Text>
          <Text style={styles.metaText}>Nivel {gamification.level} · XP {gamification.xp}</Text>
        </View>

        <View style={styles.progressHeaderWrap}>
          <Text style={styles.progressHeaderText}>Treino: {Math.round(Number(summary.completionRate || 0) * 100)}% concluido</Text>
          <Text style={styles.streakText}>🔥 {Number(gamification.streakDays || 0)} dias seguidos</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(2, Math.round(Number(summary.completionRate || 0) * 100))}%` }]} />
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

        {restRunning ? (
          <View style={styles.restBanner}>
            <Text style={styles.restBannerLabel}>DESCANSO - {activeExercise?.name || 'TREINO'}</Text>
            <Text
              style={[
                styles.restBannerTimer,
                restSeconds <= 15 ? styles.restBannerTimerDanger : null,
                restSeconds % 2 === 0 ? styles.restBannerTimerPulse : null,
              ]}
            >
              {formatTimer(restSeconds)}
            </Text>
            <View style={styles.restActionsRow}>
              <TouchableOpacity style={styles.extendRestButton} onPress={extendRestByThirty}>
                <Text style={styles.extendRestText}>+30s</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipButton} onPress={skipRest}>
                <Text style={styles.skipButtonText}>Pular descanso</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {xpFeedback ? <Text style={styles.xpFeedback}>{xpFeedback}</Text> : null}
        {restDoneMessage ? <Text style={styles.restDoneMessage}>{restDoneMessage}</Text> : null}

        <View style={styles.presetRow}>
          {[30, 60, 120].map((value) => (
            <TouchableOpacity
              key={value}
              style={[
                styles.presetBtn,
                value === 30 ? styles.presetBtnFast : null,
                value === 60 ? styles.presetBtnDefault : null,
                value === 120 ? styles.presetBtnLong : null,
                restPreset === value ? styles.presetBtnActive : null,
              ]}
              onPress={() => setRestPreset(value)}
            >
              <Text
                style={[
                  styles.presetText,
                  value === 30 ? styles.presetTextFast : null,
                  value === 120 ? styles.presetTextLong : null,
                  restPreset === value ? styles.presetTextActive : null,
                ]}
              >
                {value}s
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.manualRestBtn} onPress={() => startRestTimer(restPreset)}>
            <Text style={styles.manualRestText}>Descanso</Text>
          </TouchableOpacity>
        </View>

        {allExercises.map((exercise, exerciseIndex) => {
          const plannedSets = Number(setCountByExercise[exercise.name] || exercise.sets || 3);
          const setProgress = getExerciseSetProgress(exercise.name, plannedSets);
          const isActive = exerciseIndex === activeExerciseIndex;
          const todaySets = workoutLogs
            .filter((item) => item.date === todayKey && isSameExerciseLog(item, exercise.name) && (item.mode || 'guided') !== 'free')
            .slice(0, plannedSets);

          const draftRows = draftSetsByExercise[exercise.name] || [];
          const exerciseId = getCanonicalExerciseId(exercise.name) || undefined;
          const historySnapshot = getExerciseHistorySnapshot(exercise.name, 5, exerciseId);
          const progression = getExerciseProgressionSuggestion(exercise.name, exerciseId);
          const exerciseProgress = getExerciseProgress(exercise.name, exerciseId);
          const lastSet = getLastSetForExercise(exercise.name);
          const lastWeight = Number(lastSet?.weight || 0);
          const suggestedWeightNumber = Number(progression?.suggestedWeight || 0);
          const prWeight = Number(exerciseProgress?.bestWeight || 0);
          const prGap = Math.max(0, Number((prWeight - suggestedWeightNumber).toFixed(1)));
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
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <View style={styles.lastWorkoutSticky}>
                <Text style={styles.lastWorkoutStickyTitle}>Ultimo treino</Text>
                <Text style={styles.lastWorkoutStickyValue}>
                  {lastSet?.weight || 0}kg x {lastSet?.reps || 0}
                  {lastSet?.rpe ? ` @RPE ${lastSet?.rpe}` : ''}
                </Text>
              </View>
              <View style={styles.exerciseChipRow}>
                <Text style={styles.smallChip}>{plannedSets}x{exercise.reps}</Text>
                <Text style={styles.smallChip}>Serie {setProgress.nextSet}/{setProgress.totalSets}</Text>
                {isActive ? (
                  <TouchableOpacity style={styles.substituteBtn} onPress={() => setShowSubstitutePicker((prev) => !prev)}>
                    <Text style={styles.substituteBtnText}>Substituir</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text style={styles.progressHint}>
                Ultimo: {lastSet?.weight || 0}kg x {lastSet?.reps || 0} · Melhor: {getExerciseProgress(exercise.name).bestWeight || 0}kg
              </Text>
              <Text style={styles.progressionLine}>
                Hoje: {suggestedWeightNumber || 0}kg {weightDelta > 0 ? `( +${weightDelta}kg )` : weightDelta < 0 ? `( ${weightDelta}kg )` : '( manter )'}
              </Text>
              <Text style={styles.progressionMetaLine}>
                Meta hoje: {progression?.message || 'Consolidar tecnica e repetir carga com qualidade.'}
              </Text>

              {isActive ? (
                <View style={styles.prCard}>
                  <View style={styles.prCardHeader}>
                    <Text style={styles.prCardTitle}>Recorde pessoal</Text>
                    <Text style={styles.prCardBadge}>{exerciseId ? 'ID canonico' : 'Fallback nome'}</Text>
                  </View>
                  <Text style={styles.prCardWeight}>{prWeight || 0}kg</Text>
                  <Text style={styles.prCardMeta}>
                    {prGap > 0
                      ? `Faltam ${prGap}kg para bater o PR hoje.`
                      : 'Carga sugerida em faixa de recorde. Hora de atacar!'}
                  </Text>
                </View>
              ) : null}

              {isActive && historySnapshot.length ? (
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
                              backgroundColor: segment.rising ? '#4ADE80' : '#93C5FD',
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
                              backgroundColor: index === sparklinePoints.length - 1 ? '#FCD34D' : '#93C5FD',
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

              {isActive && showSubstitutePicker ? (
                <View style={styles.substitutePanel}>
                  <Text style={styles.substituteTitle}>Troca rapida da mesma categoria</Text>
                  <View style={styles.substituteChipsWrap}>
                    {substituteCandidates.map((item) => (
                      <TouchableOpacity key={`${exercise.id}-sub-${item}`} style={styles.substituteChip} onPress={() => quickReplaceActiveExercise(item)}>
                        <Text style={styles.substituteChipText}>{item}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : null}

              {isActive ? <Text style={styles.controlHint}>Controles: + serie, - serie e 🗑️ por serie.</Text> : null}

              {Array.from({ length: plannedSets }).map((_, setIndex) => {
                const saved = todaySets[setIndex];
                const draft = draftRows[setIndex] || { weight: '', reps: '', rpe: '8' };
                const canSave = setIndex === todaySets.length;
                const suggestedWeight = suggestedWeightByExercise[exercise.name] || '';

                return (
                  <View
                    key={`${exercise.id}-set-${setIndex}`}
                    style={[
                      styles.setRow,
                      savedSetPulseKey === `${exercise.name}-${setIndex}` ? styles.setRowSavedPulse : null,
                    ]}
                  >
                    <Text style={styles.setLabel}>{setIndex + 1}S</Text>

                    {saved ? (
                      <View style={styles.savedSetBox}>
                        <View>
                            <Text style={styles.savedSetText}>{saved.weight}kg x {saved.reps} {saved.rpe ? `@RPE ${saved.rpe}` : ''}</Text>
                          <Text style={styles.savedSetHint}>Serie salva</Text>
                        </View>
                        <View style={styles.savedActionsWrap}>
                          <TouchableOpacity style={styles.editSetBtn} onPress={() => editSavedSet(exercise.name, setIndex)}>
                            <Text style={styles.removeSetBtnText}>Editar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.removeSetBtn} onPress={() => removeSavedSet(exercise.name, setIndex)}>
                            <Text style={styles.removeSetBtnText}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <>
                        <SetField
                          value={draft.weight}
                          onChangeText={(text) => setDraftField(exercise.name, setIndex, 'weight', text)}
                          placeholder={suggestedWeight ? `${suggestedWeight}kg` : 'kg'}
                          inputRef={(ref) => {
                            setFieldRefs.current[getSetFieldKey(exercise.name, setIndex, 'weight')] = ref;
                          }}
                        />
                        <SetField
                          value={draft.reps}
                          onChangeText={(text) => setDraftField(exercise.name, setIndex, 'reps', text)}
                          placeholder="reps"
                          inputRef={(ref) => {
                            setFieldRefs.current[getSetFieldKey(exercise.name, setIndex, 'reps')] = ref;
                          }}
                        />

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

                        {isActive && canSave && suggestedWeight ? (
                          <TouchableOpacity
                            style={styles.suggestButton}
                            onPress={() => setDraftField(exercise.name, setIndex, 'weight', suggestedWeight)}
                          >
                            <Text style={styles.suggestButtonText}>usar {suggestedWeight}kg</Text>
                          </TouchableOpacity>
                        ) : null}

                        {isActive ? (
                          <View style={[styles.rowActionsInline, canSave ? styles.rowActionsInlineCurrent : null]}>
                            <TouchableOpacity
                              style={[styles.inlineBtn, styles.inlineBtnGood, !canSave ? styles.inlineBtnDisabled : null]}
                              onPress={() => canSave && saveSetLine(exercise, exerciseIndex, setIndex)}
                            >
                              <Text style={styles.inlineBtnText}>Salvar serie</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.inlineBtnRemove}
                              onPress={() => removeDraftSet(exercise.name, setIndex)}
                            >
                              <Text style={styles.inlineBtnText}>🗑️</Text>
                            </TouchableOpacity>
                          </View>
                        ) : null}
                      </>
                    )}
                  </View>
                );
              })}

              {isActive ? (
                <View style={styles.setActionsRow}>
                  <TouchableOpacity style={styles.addSetButton} onPress={() => addSetToExercise(exercise.name)}>
                    <Text style={styles.addSetButtonText}>+ Adicionar serie</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.removeLastSetButton} onPress={() => removeLastSetFromExercise(exercise.name)}>
                    <Text style={styles.addSetButtonText}>- Remover ultima</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {!isActive ? <Text style={styles.inactiveHint}>Toque para focar • {setProgress.completedSets}/{setProgress.totalSets} series</Text> : null}
            </TouchableOpacity>
          );
        })}

        <AppCard style={styles.addExerciseCard}>
          <Text style={styles.addExerciseTitle}>Selecionar exercicio existente</Text>
          <TextInput
            value={exerciseQuery}
            onChangeText={setExerciseQuery}
            placeholder="Buscar exercicio"
            placeholderTextColor="#8FA5CB"
            style={styles.addExerciseInput}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestionScroll}>
            <View style={styles.suggestionRow}>
              {suggestedExercises.map((item) => (
                <TouchableOpacity key={item} style={styles.suggestionChip} onPress={() => setNewExerciseName(item)}>
                  <Text style={styles.suggestionChipText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <Text style={styles.addExerciseTitle}>Adicionar/substituir exercicio</Text>
          <TextInput
            value={newExerciseName}
            onChangeText={setNewExerciseName}
            placeholder="Exercicio selecionado"
            placeholderTextColor="#8FA5CB"
            style={styles.addExerciseInput}
          />
          <View style={styles.addExerciseRow}>
            <TextInput
              value={newExerciseSets}
              onChangeText={setNewExerciseSets}
              placeholder="Series"
              placeholderTextColor="#8FA5CB"
              keyboardType="numeric"
              style={[styles.addExerciseInput, styles.addExerciseSmallInput]}
            />
            <TextInput
              value={newExerciseReps}
              onChangeText={setNewExerciseReps}
              placeholder="Reps ex: 8-12"
              placeholderTextColor="#8FA5CB"
              style={[styles.addExerciseInput, styles.addExerciseSmallInput]}
            />
          </View>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.addExerciseButton} onPress={addExerciseToWorkout}>
              <Text style={styles.addExerciseButtonText}>+ Adicionar exercicio</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.replaceExerciseButton} onPress={replaceActiveExercise}>
              <Text style={styles.addExerciseButtonText}>Substituir exercicio</Text>
            </TouchableOpacity>
          </View>
        </AppCard>

        <View style={styles.finishCard}>
          <PrimaryButton title="Finalizar treino" onPress={finishWorkout} style={styles.finishButton} />
          <SecondaryButton title="Salvar parcial e sair" onPress={savePartialAndExit} style={styles.partialButton} />
        </View>

        {showWorkoutSummary ? (
          <AppCard style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Treino concluido 🔥</Text>
            <Text style={styles.summaryLine}>Exercicios: {Number(workoutSummary?.exerciseCount || 0)}</Text>
            <Text style={styles.summaryLine}>Series: {Number(workoutSummary?.totalSets || 0)}</Text>
            <Text style={styles.summaryLine}>Volume: {Math.round(Number(workoutSummary?.totalVolume || 0))}kg</Text>
            <Text style={styles.summaryLine}>+{Number(workoutSummary?.sessionXp || 0)} XP</Text>
            <Text style={styles.summaryLine}>+{Number(workoutSummary?.setsDiff || 0)} series vs ultimo treino</Text>
            <Text style={styles.summaryLine}>+{Number(workoutSummary?.loadDiff || 0)}kg vs ultimo treino</Text>
            {Number(workoutSummary?.loadDiff || 0) > 0 ? (
              <Text style={styles.summaryPositive}>Evolucao vs ultima sessao</Text>
            ) : null}
            <View style={styles.postWorkoutNutritionWrap}>
              <Text style={styles.postWorkoutNutritionTitle}>Agora: +{Math.max(0, Number(postWorkoutNutritionFeedback?.missingProtein || 0))}g proteina recomendado</Text>
              <Text style={styles.postWorkoutNutritionText}>{postWorkoutNutritionFeedback?.suggestion || 'Sugestao indisponivel'}</Text>
            </View>
            <PrimaryButton title="Treino concluido" onPress={closeWorkoutSummary} style={styles.finishButton} />
            <SecondaryButton title="Ver evolucao" onPress={goToEvolution} style={styles.partialButton} />
          </AppCard>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingBottom: 34,
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
    marginBottom: 10,
  },
  progressHeaderWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressHeaderText: {
    color: '#CFE4FF',
    fontSize: 12,
    fontWeight: '800',
  },
  streakText: {
    color: '#FDBA74',
    fontSize: 12,
    fontWeight: '900',
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: '#1A283C',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2F4766',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#66C7A3',
  },
  actionToast: {
    borderWidth: 1,
    borderColor: '#2F7A5B',
    backgroundColor: '#123429',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  actionToastText: {
    color: '#D1FAE5',
    fontSize: 12,
    fontWeight: '900',
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  restBanner: {
    backgroundColor: '#123429',
    borderWidth: 1,
    borderColor: '#2F7A5B',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  restBannerLabel: {
    color: '#9DE2C2',
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
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  restDoneMessage: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  presetBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  presetBtnFast: {
    borderColor: '#66C7A3',
    backgroundColor: '#153A2B',
  },
  presetBtnDefault: {
    borderColor: colors.border,
    backgroundColor: colors.secondary,
  },
  presetBtnLong: {
    borderColor: '#36506E',
    backgroundColor: '#172333',
    opacity: 0.86,
  },
  presetBtnActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#DBEAFE',
    opacity: 1,
    transform: [{ scale: 1.06 }],
  },
  presetText: {
    fontWeight: '700',
    fontSize: 12,
  },
  presetTextFast: {
    color: '#A9F1D5',
  },
  presetTextLong: {
    color: '#9EB4CF',
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
    backgroundColor: '#1D355F',
    borderColor: '#7CB8FF',
    transform: [{ scale: 1.015 }],
    shadowColor: '#5FA9FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 3,
  },
  exerciseCardMuted: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    opacity: 0.6,
    transform: [{ scale: 0.985 }],
  },
  exerciseName: {
    fontSize: 23,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  lastWorkoutSticky: {
    borderWidth: 1,
    borderColor: '#365A8D',
    borderRadius: 10,
    backgroundColor: '#14253F',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 8,
  },
  lastWorkoutStickyTitle: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  lastWorkoutStickyValue: {
    color: '#E0ECFF',
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
    color: '#9CC4F7',
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
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
  },
  progressionMetaLine: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  prCard: {
    borderWidth: 1,
    borderColor: '#4A6EA3',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#122238',
    marginBottom: 8,
  },
  prCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  prCardTitle: {
    color: '#CFE4FF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  prCardBadge: {
    color: '#93C5FD',
    fontSize: 10,
    fontWeight: '700',
  },
  prCardWeight: {
    color: '#FCD34D',
    fontSize: 22,
    fontWeight: '900',
  },
  prCardMeta: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '700',
  },
  smallChip: {
    backgroundColor: '#1B2840',
    color: '#CFE4FF',
    borderWidth: 1,
    borderColor: '#365A8D',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '700',
  },
  substituteBtn: {
    borderWidth: 1,
    borderColor: '#60A5FA',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    backgroundColor: '#172A45',
  },
  substituteBtnText: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '800',
  },
  substitutePanel: {
    borderWidth: 1,
    borderColor: '#365A8D',
    borderRadius: 10,
    padding: 8,
    backgroundColor: '#141E2E',
    marginBottom: 8,
  },
  substituteTitle: {
    color: '#BFDBFE',
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
    borderColor: '#4B6C96',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: '#1B2B44',
  },
  substituteChipText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  setRowSavedPulse: {
    backgroundColor: '#123429',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  setLabel: {
    width: 26,
    color: '#D5E6FF',
    fontWeight: '800',
  },
  setField: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: '#141922',
    color: colors.textPrimary,
    fontSize: 15,
  },
  rpeWrap: {
    borderWidth: 1,
    borderColor: '#36506E',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 6,
    backgroundColor: '#111C2B',
  },
  rpeLabel: {
    color: '#9CC4F7',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  rpeChipsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  rpeChip: {
    minWidth: 28,
    borderWidth: 1,
    borderColor: '#4B6C96',
    borderRadius: 999,
    backgroundColor: '#1B2B44',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  rpeChipActive: {
    borderColor: '#93C5FD',
    backgroundColor: '#254974',
  },
  rpeChipText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '800',
  },
  rowActionsInline: {
    flexDirection: 'row',
    gap: 6,
  },
  rowActionsInlineCurrent: {
    borderWidth: 1,
    borderColor: '#55A4FF',
    borderRadius: 8,
    padding: 4,
    backgroundColor: '#1C3E6A',
  },
  inlineBtn: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineBtnGood: {
    backgroundColor: '#28A765',
  },
  inlineBtnDisabled: {
    opacity: 0.45,
  },
  inlineBtnRemove: {
    backgroundColor: '#7F1D1D',
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  suggestButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#1B2840',
  },
  suggestButtonText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  savedSetBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141922',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  savedActionsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editSetBtn: {
    borderRadius: 8,
    backgroundColor: '#1F4D7A',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  removeSetBtn: {
    borderRadius: 8,
    backgroundColor: '#7F1D1D',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  removeSetBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  savedSetText: {
    color: '#EAF2FF',
    fontSize: 13,
    fontWeight: '700',
  },
  savedSetHint: {
    color: '#8FB1DD',
    fontSize: 11,
    fontWeight: '700',
  },
  historyWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 8,
    backgroundColor: '#141922',
    marginBottom: 8,
  },
  historyTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sparklineWrap: {
    borderWidth: 1,
    borderColor: '#3A5C86',
    borderRadius: 8,
    backgroundColor: '#101926',
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
    color: '#9CC4F7',
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
    backgroundColor: '#223047',
    overflow: 'hidden',
  },
  historyBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#66C7A3',
  },
  historyBarFail: {
    backgroundColor: '#FCA5A5',
  },
  setActionsRow: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
  },
  addSetButton: {
    flex: 1,
    marginTop: 4,
    backgroundColor: '#2D4F80',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#5F89C4',
    alignItems: 'center',
    paddingVertical: 10,
  },
  addSetButtonText: {
    color: '#F2F7FF',
    fontWeight: '800',
    fontSize: 13,
  },
  removeLastSetButton: {
    flex: 1,
    marginTop: 4,
    backgroundColor: '#7F1D1D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B75A5A',
    alignItems: 'center',
    paddingVertical: 10,
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
  actionRow: {
    flexDirection: 'row',
    gap: 8,
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
    backgroundColor: '#141922',
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
    color: '#000000',
    fontWeight: '800',
    fontSize: 14,
  },
  replaceExerciseButton: {
    flex: 1,
    backgroundColor: colors.secondary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
  },
  finishCard: {
    marginTop: 12,
    marginBottom: 18,
  },
  finishButton: {
    marginBottom: 8,
  },
  partialButton: {
    marginTop: 0,
  },
  summaryCard: {
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
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
    borderColor: '#365A8D',
    borderRadius: 10,
    backgroundColor: '#14253F',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  postWorkoutNutritionTitle: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  postWorkoutNutritionText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
  inactiveHint: {
    marginTop: 8,
    color: '#8FA5CB',
    fontSize: 12,
  },
});
