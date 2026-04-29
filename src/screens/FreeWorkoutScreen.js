import React, { useEffect, useMemo, useState } from 'react';
import {
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
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { getExerciseByName, getExerciseFilters, searchExercises } from '../data/exercises.js';
import { matchNutritionToken } from '../data/nutritionDatabase.js';
import { logError } from '../utils/errorLogger';
import { AnimatedToast, AppCard, PrimaryButton, ScreenHeader } from '../components/ui';
import { colors, spacing, radius, typography } from '../theme';

const CATEGORIES = [
  { key: 'peito', label: 'Peito', terms: ['supino', 'crucifixo', 'peito'] },
  { key: 'costas', label: 'Costas', terms: ['remada', 'puxada', 'costa'] },
  { key: 'perna', label: 'Perna', terms: ['agach', 'leg', 'stiff', 'panturrilha', 'extensora'] },
  { key: 'ombro', label: 'Ombro', terms: ['desenvolvimento', 'elevacao', 'ombro'] },
  { key: 'braco', label: 'Braco', terms: ['rosca', 'triceps', 'biceps'] },
  { key: 'core', label: 'Core', terms: ['abdom', 'prancha', 'core'] },
];

function formatTimer(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function groupCatalogByCategory(catalog, categoryKey) {
  const category = CATEGORIES.find((item) => item.key === categoryKey);
  if (!category) {
    return [];
  }

  const list = catalog.filter((name) => {
    const text = String(name || '').toLowerCase();
    return category.terms.some((term) => text.includes(term));
  });

  return list.slice(0, 8);
}

function toTestId(value) {
  const base = String(value || '');
  const normalized = typeof base.normalize === 'function' ? base.normalize('NFD') : base;

  return normalized
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function FreeWorkoutScreen({ navigation }) {
  const [toastMessage, setToastMessage] = useState('');
  const {
    saveFreeWorkoutSet,
    getExerciseCatalog,
    getFreeWorkoutSuggestions,
    getExerciseSetProgress,
    createUserRoutine,
    profile,
  } = useApp();

  const catalog = useMemo(() => {
    const result = typeof getExerciseCatalog === 'function' ? getExerciseCatalog() : [];
    return Array.isArray(result) ? result : [];
  }, [getExerciseCatalog]);
  const [activeCategory, setActiveCategory] = useState('peito');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  const [exerciseNameInput, setExerciseNameInput] = useState('');
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [setData, setSetData] = useState({});
  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const exerciseFilters = useMemo(() => {
    const raw = typeof getExerciseFilters === 'function' ? getExerciseFilters() : {};
    const equipments = Array.isArray(raw?.equipments) ? raw.equipments : [];
    return { ...raw, equipments };
  }, []);

  const categoryExercises = useMemo(
    () => {
      const muscleMap = {
        peito:  'chest',
        costas: 'back',
        perna:  'legs',
        ombro:  'shoulders',
        braco:  'biceps',
        core:   'core',
      };

      const premiumResults = searchExercises({
        query: catalogSearch,
        muscle: muscleMap[activeCategory] || 'all',
        equipment: equipmentFilter,
      });
      const premiumNames = (Array.isArray(premiumResults) ? premiumResults : [])
        .map((item) => item?.name)
        .filter(Boolean);

      const fallback = groupCatalogByCategory(catalog, activeCategory).filter((name) => {
        if (!catalogSearch.trim()) return true;
        return String(name || '').toLowerCase().includes(String(catalogSearch || '').toLowerCase());
      });

      return Array.from(new Set([...premiumNames, ...fallback])).slice(0, 8);
    },
    [catalog, activeCategory, catalogSearch, equipmentFilter]
  );

  const suggestions = useMemo(
    () => {
      const raw = typeof getFreeWorkoutSuggestions === 'function'
        ? getFreeWorkoutSuggestions(selectedExercises)
        : [];
      return (Array.isArray(raw) ? raw : []).slice(0, 6);
    },
    [selectedExercises, getFreeWorkoutSuggestions]
  );

  const addExercise = (rawName) => {
    const name = String(rawName || '').trim();
    if (!name) {
      return;
    }

    const nutritionHit = matchNutritionToken(name);
    const exerciseHit = getExerciseByName(name);
    if (nutritionHit && !exerciseHit) {
      setToastMessage('Entrada invalida. Esse item parece alimento; adicione apenas exercicios.');
      return;
    }

    setSelectedExercises((prev) => {
      if (prev.includes(name)) {
        return prev;
      }
      return [...prev, name];
    });
  };

  const setField = (exerciseName, field, nextValue) => {
    setSetData((prev) => ({
      ...prev,
      [exerciseName]: {
        ...(prev[exerciseName] || { weight: '', reps: '' }),
        [field]: nextValue,
      },
    }));
  };

  useEffect(() => {
    if (!restRunning) {
      return;
    }

    if (restSeconds <= 0) {
      setRestRunning(false);
      Vibration.vibrate(450);
      setToastMessage('Descanso concluido. Pode fazer o proximo set.');
      return;
    }

    const timeoutId = setTimeout(() => {
      setRestSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [restRunning, restSeconds]);

  const startRest = () => {
    setRestSeconds(75);
    setRestRunning(true);
  };

  const stopRest = () => {
    setRestRunning(false);
    setRestSeconds(0);
  };

  const openExerciseDetail = (exerciseName) => {
    const detail = getExerciseByName(exerciseName) || { name: exerciseName };
    navigation.navigate('ExerciseDetail', { exercise: detail });
  };

  const saveSelectionAsRoutine = () => {
    if (!selectedExercises.length) {
      logError(new Error('free_workout_empty_routine'), {
        screen: 'FreeWorkout',
        severity: 'low',
      });
      setToastMessage('Sem exercicios. Adicione ao menos 1 exercicio para salvar sua rotina.');
      return;
    }

    const result = createUserRoutine({
      name: `Treino livre ${new Date().toLocaleDateString('pt-BR')}`,
      frequency: Number(profile?.trainingDaysPerWeek || 3),
      exercises: selectedExercises,
    });

    if (!result.ok) {
      logError(new Error('free_workout_save_routine_failed'), {
        screen: 'FreeWorkout',
        severity: 'low',
        extra: { reason: result.message },
      });
      setToastMessage(`Nao foi possivel salvar: ${String(result?.message || 'erro desconhecido')}`);
      return;
    }

    setToastMessage('Rotina criada e salva em Minhas Rotinas.');
    navigation.navigate('Rotinas');
  };

  const submitSet = (exerciseName, failed) => {
    const values = setData[exerciseName] || { weight: '', reps: '' };
    const result = saveFreeWorkoutSet({
      exerciseName,
      weight: Number(values.weight),
      reps: Number(values.reps),
      failed,
    });

    if (!result.ok) {
      logError(new Error('free_workout_invalid_set'), {
        screen: 'FreeWorkout',
        severity: 'low',
        extra: { exerciseName, reason: result.message, failed },
      });
      setToastMessage(`Dados invalidos: ${String(result?.message || 'verifique os campos')}`);
      return;
    }

    setSetData((prev) => ({
      ...prev,
      [exerciseName]: {
        weight: values.weight,
        reps: '',
      },
    }));

    startRest();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <AnimatedToast message={toastMessage} onHide={() => setToastMessage('')} />
      <ScrollView
        testID="screen-free-workout"
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
      <ScreenHeader title="Treino livre" subtitle="Monte seu treino na hora com fluxo rápido e organizado." />

      <AppCard elevated>
        <Text style={styles.kpiLabel}>SELEÇÃO ATUAL</Text>
        <View style={styles.kpiRow}>
          <View style={styles.kpiItem}>
            <Ionicons name="barbell-outline" size={18} color={colors.primary} />
            <Text style={styles.kpiValue}>{selectedExercises.length}</Text>
            <Text style={styles.kpiText}>Exercícios</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={styles.kpiItem}>
            <Ionicons name="time-outline" size={18} color={colors.secondary} />
            <Text style={styles.kpiValue}>{formatTimer(restSeconds)}</Text>
            <Text style={styles.kpiText}>Descanso</Text>
          </View>
        </View>
        <PrimaryButton testID="btn-free-save-routine" title="Salvar seleção como rotina" onPress={saveSelectionAsRoutine} style={styles.primaryButton} />
      </AppCard>

      <View style={styles.timerBox}>
        <Text style={styles.timerLabel}>Descanso</Text>
        <Text style={styles.timerValue}>{formatTimer(restSeconds)}</Text>
        <TouchableOpacity
          testID="btn-free-rest-toggle"
          style={[styles.timerAction, restRunning ? styles.timerActionStop : null]}
          onPress={restRunning ? stopRest : startRest}
        >
          <Text style={styles.timerActionText}>{restRunning ? 'Parar descanso' : 'Iniciar descanso'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Adicionar exercicio</Text>
        <TextInput
          testID="input-free-exercise-name"
          placeholder="Nome do exercicio"
          placeholderTextColor="#8AA2C7"
          value={exerciseNameInput}
          onChangeText={setExerciseNameInput}
          style={styles.input}
        />
        <TouchableOpacity
          testID="btn-free-add-exercise"
          style={styles.addButton}
          onPress={() => {
            addExercise(exerciseNameInput);
            setExerciseNameInput('');
          }}
        >
          <Text style={styles.addButtonText}>Adicionar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Categorias</Text>
        <TextInput
          testID="input-free-catalog-search"
          placeholder="Buscar exercicio"
          placeholderTextColor="#8AA2C7"
          value={catalogSearch}
          onChangeText={setCatalogSearch}
          style={styles.input}
        />

        <View style={styles.chipsWrap}>
          <TouchableOpacity
            style={[styles.chip, equipmentFilter === 'all' ? styles.chipActive : null]}
            onPress={() => setEquipmentFilter('all')}
          >
            <Text style={[styles.chipText, equipmentFilter === 'all' ? styles.chipTextActive : null]}>Todos</Text>
          </TouchableOpacity>
          {exerciseFilters.equipments.map((item) => (
            <TouchableOpacity
              key={`free-equipment-${item}`}
              style={[styles.chip, equipmentFilter === item ? styles.chipActive : null]}
              onPress={() => setEquipmentFilter(item)}
            >
              <Text style={[styles.chipText, equipmentFilter === item ? styles.chipTextActive : null]}>{item.replace(/_/g, ' ')}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.chipsWrap}>
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.key}
              testID={`chip-free-category-${category.key}`}
              style={[styles.chip, activeCategory === category.key ? styles.chipActive : null]}
              onPress={() => setActiveCategory(category.key)}
            >
              <Text style={[styles.chipText, activeCategory === category.key ? styles.chipTextActive : null]}>
                {category.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.chipsWrap}>
          {categoryExercises.map((name) => (
            <View key={name} style={styles.catalogRow}>
              <TouchableOpacity testID={`chip-free-exercise-${toTestId(name)}`} style={styles.suggestionChip} onPress={() => addExercise(name)}>
                <Text style={styles.suggestionChipText}>{name}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.detailInlineButton} onPress={() => openExerciseDetail(name)}>
                <Text style={styles.detailInlineButtonText}>Detalhes</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>

      {selectedExercises.length ? (
        <View style={styles.cardGreen}>
          <Text style={styles.cardTitleGreen}>Sugestoes para continuar</Text>
          <View style={styles.chipsWrap}>
            {suggestions.map((name) => (
              <TouchableOpacity key={name} testID={`chip-free-suggestion-${toTestId(name)}`} style={styles.suggestionChipGreen} onPress={() => addExercise(name)}>
                <Text style={styles.suggestionChipGreenText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {selectedExercises.map((exerciseName) => {
        const values = setData[exerciseName] || { weight: '', reps: '' };
        const setProgress = getExerciseSetProgress(exerciseName, 3);

        return (
          <View key={exerciseName} testID={`card-free-exercise-${toTestId(exerciseName)}`} style={styles.exerciseCard}>
            <Text style={styles.exerciseName}>{exerciseName}</Text>
            <Text style={styles.progressText}>Serie {setProgress.nextSet}/3</Text>

            <View style={styles.row}>
              <TextInput
                testID={`input-free-weight-${toTestId(exerciseName)}`}
                keyboardType="numeric"
                placeholder="Carga"
                placeholderTextColor="#8AA2C7"
                value={values.weight}
                onChangeText={(text) => setField(exerciseName, 'weight', text)}
                style={styles.input}
              />
              <TextInput
                testID={`input-free-reps-${toTestId(exerciseName)}`}
                keyboardType="numeric"
                placeholder="Reps"
                placeholderTextColor="#8AA2C7"
                value={values.reps}
                onChangeText={(text) => setField(exerciseName, 'reps', text)}
                style={styles.input}
              />
            </View>

            <View style={styles.row}>
              <TouchableOpacity testID={`btn-free-save-set-${toTestId(exerciseName)}`} style={styles.successButton} onPress={() => submitSet(exerciseName, false)}>
                <Text style={styles.successText}>+ serie</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`btn-free-fail-set-${toTestId(exerciseName)}`} style={styles.failButton} onPress={() => submitSet(exerciseName, true)}>
                <Text style={styles.failText}>- serie</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`btn-free-inline-rest-${toTestId(exerciseName)}`} style={styles.restButton} onPress={restRunning ? stopRest : startRest}>
                <Text style={styles.restText}>descanso</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
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
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl,
  },
  primaryButton: {
    marginTop: spacing.sm,
  },
  kpiLabel: {
    ...typography.sectionTitle,
    marginBottom: spacing.sm,
  },
  kpiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  kpiItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  kpiDivider: {
    width: 1,
    height: 42,
    backgroundColor: colors.border,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  kpiText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  timerBox: {
    backgroundColor: colors.cardElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.secondaryMuted,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  timerLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  timerValue: {
    color: colors.textPrimary,
    fontSize: 34,
    fontWeight: '900',
  },
  timerAction: {
    marginTop: 8,
    backgroundColor: colors.secondaryDim,
    borderRadius: radius.sm,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  timerActionStop: {
    backgroundColor: colors.danger,
  },
  timerActionText: {
    color: colors.text,
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardGreen: {
    backgroundColor: colors.cardElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.success,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  cardTitleGreen: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
  },
  addButton: {
    marginTop: 8,
    backgroundColor: colors.secondary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  saveRoutineButton: {
    backgroundColor: '#1F7A47',
    borderWidth: 1,
    borderColor: '#2D9B61',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
    marginBottom: 10,
  },
  saveRoutineButtonText: {
    color: '#E7FFF1',
    fontWeight: '900',
    fontSize: 13,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.secondaryMuted,
    borderColor: colors.secondary,
  },
  chipText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  chipTextActive: {
    color: colors.textPrimary,
  },
  suggestionChip: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestionChipText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  detailInlineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  detailInlineButtonText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  suggestionChipGreen: {
    backgroundColor: colors.successMuted,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestionChipGreenText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  exerciseName: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  progressText: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  successButton: {
    flexGrow: 1,
    minWidth: 88,
    backgroundColor: colors.success,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  failButton: {
    flexGrow: 1,
    minWidth: 88,
    backgroundColor: colors.danger,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  restButton: {
    flexGrow: 1,
    minWidth: 88,
    backgroundColor: colors.secondaryMuted,
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  successText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textTransform: 'lowercase',
  },
  failText: {
    color: '#FFFFFF',
    fontWeight: '800',
    textTransform: 'lowercase',
  },
  restText: {
    color: colors.textPrimary,
    fontWeight: '800',
    textTransform: 'lowercase',
  },
});
