import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { trackEvent } from '../utils/analytics';

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

function SetField({ value, onChangeText, placeholder }) {
  return (
    <TextInput
      keyboardType="numeric"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#7E91B4"
      style={styles.setField}
    />
  );
}

export default function WorkoutScreen({ navigation }) {
  const {
    getTodayWorkout,
    prepareTodayWorkoutTargets,
    saveWorkoutSet,
    getExerciseSetProgress,
    getTodayWorkoutSummary,
    getWorkoutGamification,
    workoutLogs,
    hasFeatureAccess,
  } = useApp();

  const todayKey = useMemo(() => getTodayKeyLocal(), []);
  const exercises = useMemo(() => getTodayWorkout(), [getTodayWorkout]);
  const summary = useMemo(() => getTodayWorkoutSummary(), [getTodayWorkoutSummary]);
  const gamification = useMemo(() => getWorkoutGamification(), [getWorkoutGamification]);

  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [draftSetsByExercise, setDraftSetsByExercise] = useState({});
  const [restPreset, setRestPreset] = useState(75);
  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [xpFeedback, setXpFeedback] = useState('');

  const scrollRef = useRef(null);
  const exercisePositionsRef = useRef({});
  const postWorkoutTriggeredRef = useRef(false);

  useEffect(() => {
    prepareTodayWorkoutTargets();
  }, []);

  useEffect(() => {
    setDraftSetsByExercise((prev) => {
      const next = { ...prev };
      let changed = false;

      for (const exercise of exercises) {
        if (next[exercise.name]) {
          continue;
        }

        next[exercise.name] = Array.from({ length: exercise.sets }, () => ({
          weight: exercise.targetWeight ? String(exercise.targetWeight) : '',
          reps: '',
        }));
        changed = true;
      }

      return changed ? next : prev;
    });
  }, [exercises]);

  useEffect(() => {
    if (!restRunning) {
      return;
    }

    if (restSeconds <= 0) {
      setRestRunning(false);
      Vibration.vibrate(500);
      Alert.alert('Descanso concluido', 'Pode iniciar a proxima serie.');
      return;
    }

    const timeoutId = setTimeout(() => {
      setRestSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [restRunning, restSeconds]);

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
    trackEvent('workout_completed', {
      guidedSets: summary.guidedSets,
      plannedSets: summary.plannedSets,
      completionRate: summary.completionRate,
    });

    if (!hasFeatureAccess('auto_coach')) {
      navigation.navigate('Paywall', {
        featureKey: 'auto_coach',
        source: 'post_workout',
        message: 'Treino completo, mas voce ainda esta treinando no escuro. O Auto Coach ajusta seu treino automaticamente.',
      });
    }
  }, [summary.completionRate, summary.guidedSets, summary.plannedSets, hasFeatureAccess, navigation]);

  useEffect(() => {
    const activeExercise = exercises[activeExerciseIndex];
    if (!activeExercise || !scrollRef.current) {
      return;
    }

    const y = exercisePositionsRef.current[activeExercise.id];
    if (typeof y === 'number') {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 20), animated: true });
    }
  }, [activeExerciseIndex, exercises]);

  const activeExercise = exercises[activeExerciseIndex] || null;

  const startRestTimer = (seconds = restPreset) => {
    Vibration.vibrate(80);
    setRestSeconds(seconds);
    setRestRunning(true);
  };

  const skipRest = () => {
    setRestRunning(false);
    setRestSeconds(0);
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
    for (let index = currentIndex + 1; index < exercises.length; index += 1) {
      const item = exercises[index];
      const progress = getExerciseSetProgress(item.name, item.sets);
      if (!progress.isDone) {
        setActiveExerciseIndex(index);
        return;
      }
    }

    for (let index = 0; index < exercises.length; index += 1) {
      const item = exercises[index];
      const progress = getExerciseSetProgress(item.name, item.sets);
      if (!progress.isDone) {
        setActiveExerciseIndex(index);
        return;
      }
    }
  };

  const saveSetLine = (exercise, exerciseIndex, setIndex, failed) => {
    const todaySets = workoutLogs
      .filter((item) => item.date === todayKey && item.exerciseName === exercise.name && (item.mode || 'guided') !== 'free');

    const nextIndex = todaySets.length;
    if (setIndex !== nextIndex) {
      Alert.alert('Ordem das series', `Salve primeiro a serie ${nextIndex + 1}.`);
      return;
    }

    const row = (draftSetsByExercise[exercise.name] || [])[setIndex] || { weight: '', reps: '' };
    const result = saveWorkoutSet({
      exerciseName: exercise.name,
      weight: Number(row.weight),
      reps: Number(row.reps),
      failed,
    });

    if (!result.ok) {
      Alert.alert('Dados invalidos', result.message);
      return;
    }

    if (result.xpEvents?.length) {
      setXpFeedback(result.xpEvents.join(' | '));
    }

    startRestTimer();

    const currentProgress = getExerciseSetProgress(exercise.name, exercise.sets);
    const nextCompleted = currentProgress.completedSets + 1;
    if (nextCompleted >= exercise.sets) {
      jumpToNextExercise(exerciseIndex);
    }
  };

  if (!exercises.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.title}>Treino de hoje</Text>
        <Text style={styles.emptyText}>Sem treino definido para hoje.</Text>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Treino de hoje</Text>
      <Text style={styles.subtitle}>Fluxo rapido: preencher serie e salvar.</Text>

      <View style={styles.topRow}>
        <Text style={styles.metaText}>{summary.guidedSets}/{summary.plannedSets || 0} series</Text>
        <Text style={styles.metaText}>Nivel {gamification.level} · XP {gamification.xp}</Text>
      </View>

      {restRunning ? (
        <View style={styles.restBanner}>
          <Text style={styles.restBannerLabel}>DESCANSO — {activeExercise?.name || 'TREINO'}</Text>
          <Text
            style={[
              styles.restBannerTimer,
              restSeconds <= 15 ? styles.restBannerTimerDanger : null,
              restSeconds % 2 === 0 ? styles.restBannerTimerPulse : null,
            ]}
          >
            {formatTimer(restSeconds)}
          </Text>
          <TouchableOpacity style={styles.skipButton} onPress={skipRest}>
            <Text style={styles.skipButtonText}>Pular descanso</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {xpFeedback ? <Text style={styles.xpFeedback}>{xpFeedback}</Text> : null}

      <View style={styles.presetRow}>
        {[60, 75, 90].map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.presetBtn, restPreset === value ? styles.presetBtnActive : null]}
            onPress={() => setRestPreset(value)}
          >
            <Text style={[styles.presetText, restPreset === value ? styles.presetTextActive : null]}>{value}s</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.manualRestBtn} onPress={() => startRestTimer(restPreset)}>
          <Text style={styles.manualRestText}>Descanso</Text>
        </TouchableOpacity>
      </View>

      {exercises.map((exercise, exerciseIndex) => {
        const setProgress = getExerciseSetProgress(exercise.name, exercise.sets);
        const isActive = exerciseIndex === activeExerciseIndex;
        const todaySets = workoutLogs
          .filter((item) => item.date === todayKey && item.exerciseName === exercise.name && (item.mode || 'guided') !== 'free')
          .slice(0, exercise.sets);

        const draftRows = draftSetsByExercise[exercise.name] || [];

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
            <View style={styles.exerciseChipRow}>
              <Text style={styles.smallChip}>{exercise.sets}x{exercise.reps}</Text>
              <Text style={styles.smallChip}>Serie {setProgress.nextSet}/{setProgress.totalSets}</Text>
            </View>

            {Array.from({ length: exercise.sets }).map((_, setIndex) => {
              const saved = todaySets[setIndex];
              const draft = draftRows[setIndex] || { weight: exercise.targetWeight ? String(exercise.targetWeight) : '', reps: '' };
              const canSave = setIndex === todaySets.length;

              return (
                <View key={`${exercise.id}-set-${setIndex}`} style={styles.setRow}>
                  <Text style={styles.setLabel}>{setIndex + 1}S</Text>

                  {saved ? (
                    <View style={styles.savedSetBox}>
                      <Text style={styles.savedSetText}>{saved.weight}kg x {saved.reps}</Text>
                      {saved.failed ? <Text style={styles.savedSetFail}>falha</Text> : null}
                    </View>
                  ) : (
                    <>
                      <SetField
                        value={draft.weight}
                        onChangeText={(text) => setDraftField(exercise.name, setIndex, 'weight', text)}
                        placeholder="kg"
                      />
                      <SetField
                        value={draft.reps}
                        onChangeText={(text) => setDraftField(exercise.name, setIndex, 'reps', text)}
                        placeholder="reps"
                      />

                      {isActive ? (
                        <View style={[styles.rowActionsInline, canSave ? styles.rowActionsInlineCurrent : null]}>
                          <TouchableOpacity
                            style={[styles.inlineBtn, styles.inlineBtnGood, !canSave ? styles.inlineBtnDisabled : null]}
                            onPress={() => canSave && saveSetLine(exercise, exerciseIndex, setIndex, false)}
                          >
                            <Text style={styles.inlineBtnText}>+ serie</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.inlineBtn, styles.inlineBtnBad, !canSave ? styles.inlineBtnDisabled : null]}
                            onPress={() => canSave && saveSetLine(exercise, exerciseIndex, setIndex, true)}
                          >
                            <Text style={styles.inlineBtnText}>- serie</Text>
                          </TouchableOpacity>
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              );
            })}

            {!isActive ? <Text style={styles.inactiveHint}>Toque para focar</Text> : null}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0D1322',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 34,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#0D1322',
  },
  emptyText: {
    color: '#A8B7D3',
    fontSize: 14,
    marginTop: 8,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#F6FBFF',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 12,
    color: '#A8B7D3',
    fontSize: 14,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metaText: {
    color: '#98AED3',
    fontSize: 12,
    fontWeight: '700',
  },
  restBanner: {
    backgroundColor: '#122845',
    borderWidth: 1,
    borderColor: '#355B8E',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  restBannerLabel: {
    color: '#B8D5FF',
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
    color: '#FFC5C5',
  },
  skipButton: {
    marginTop: 8,
    backgroundColor: '#B63A3A',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  skipButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  xpFeedback: {
    color: '#9CE5B9',
    fontSize: 12,
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
    borderColor: '#476A9C',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  presetBtnActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#DBEAFE',
  },
  presetText: {
    color: '#B9D8FF',
    fontWeight: '700',
    fontSize: 12,
  },
  presetTextActive: {
    color: '#0F3B7A',
  },
  manualRestBtn: {
    marginLeft: 'auto',
    backgroundColor: '#254875',
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  manualRestText: {
    color: '#E4F1FF',
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
    backgroundColor: '#1A3359',
    borderColor: '#7CB8FF',
    transform: [{ scale: 1.01 }],
    shadowColor: '#5FA9FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 12,
    elevation: 3,
  },
  exerciseCardMuted: {
    backgroundColor: '#111D35',
    borderColor: '#243C65',
    opacity: 0.6,
  },
  exerciseName: {
    fontSize: 23,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 8,
  },
  exerciseChipRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  smallChip: {
    backgroundColor: '#1E3559',
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
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  setLabel: {
    width: 26,
    color: '#D5E6FF',
    fontWeight: '800',
  },
  setField: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#4B6896',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#0F1D36',
    color: '#F2F7FF',
    fontSize: 13,
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
    backgroundColor: '#183457',
  },
  inlineBtn: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineBtnGood: {
    backgroundColor: '#28A765',
  },
  inlineBtnBad: {
    backgroundColor: '#B63A3A',
  },
  inlineBtnDisabled: {
    opacity: 0.45,
  },
  inlineBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'lowercase',
  },
  savedSetBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F1D36',
    borderWidth: 1,
    borderColor: '#355B8E',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  savedSetText: {
    color: '#EAF2FF',
    fontSize: 13,
    fontWeight: '700',
  },
  savedSetFail: {
    color: '#F6B6B6',
    fontSize: 11,
    fontWeight: '700',
  },
  inactiveHint: {
    marginTop: 8,
    color: '#8FA5CB',
    fontSize: 12,
  },
});
