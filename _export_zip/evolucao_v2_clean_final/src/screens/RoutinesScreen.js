import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { EXERCISE_NAMES_V2 } from '../data/exerciseLibraryV2';
import { fuzzySearchExercises } from '../services/fuzzySearch';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';

const QUICK_EXERCISES = [
  'Leg Press 45',
  'Agachamento Livre',
  'Supino Maquina (Chest Press)',
  'Remada Sentada Maquina',
  'Puxada Frontal Polia',
  'Graviton (Barra Assistida)',
  'Stiff',
];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toTestId(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getConfidenceVisual(confidence) {
  if (confidence === 'alta') {
    return '🟢 alta';
  }
  if (confidence === 'media') {
    return '🟡 media';
  }
  return '🔴 baixa';
}

export default function RoutinesScreen({ navigation }) {
  const {
    profile,
    getTodayWorkout,
    getExerciseCatalog,
    getSmartWorkoutRecommendation,
    getUserRoutines,
    createUserRoutine,
    updateUserRoutine,
    duplicateUserRoutine,
    reorderUserRoutineExercises,
    deleteUserRoutine,
    getWorkoutTemplates,
    createRoutineFromTemplate,
    saveTodayWorkoutAsRoutine,
  } = useApp();

  const [routineName, setRoutineName] = useState('');
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [builderExercises, setBuilderExercises] = useState([]);
  const [editingRoutineId, setEditingRoutineId] = useState(null);

  const todayRoutine = useMemo(() => getTodayWorkout(), [getTodayWorkout]);
  const smart = useMemo(() => getSmartWorkoutRecommendation(), [getSmartWorkoutRecommendation]);
  const userRoutines = useMemo(() => getUserRoutines(), [getUserRoutines]);
  const exerciseCatalog = useMemo(() => {
    const base = Array.isArray(getExerciseCatalog()) ? getExerciseCatalog() : [];
    return Array.from(new Set([...QUICK_EXERCISES, ...EXERCISE_NAMES_V2, ...base]));
  }, [getExerciseCatalog]);
  const routineTemplates = useMemo(() => getWorkoutTemplates(), [getWorkoutTemplates]);

  const filteredCatalog = useMemo(() => {
    const query = normalizeText(exerciseQuery);
    const mergedCatalog = exerciseCatalog;

    if (!query) {
      return mergedCatalog.slice(0, 12);
    }

    return fuzzySearchExercises(query, mergedCatalog, 20).slice(0, 12);
  }, [exerciseCatalog, exerciseQuery]);

  const addExerciseToBuilder = (exerciseName) => {
    const safeName = String(exerciseName || '').trim();
    if (!safeName) {
      return;
    }

    if (builderExercises.includes(safeName)) {
      return;
    }

    setBuilderExercises((prev) => [...prev, safeName]);
  };

  const removeExerciseFromBuilder = (exerciseName) => {
    setBuilderExercises((prev) => prev.filter((item) => item !== exerciseName));
  };

  const moveBuilderExercise = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= builderExercises.length) {
      return;
    }

    setBuilderExercises((prev) => {
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  };

  const resetBuilder = () => {
    setRoutineName('');
    setBuilderExercises([]);
    setExerciseQuery('');
    setEditingRoutineId(null);
  };

  const saveRoutine = () => {
    if (editingRoutineId) {
      const result = updateUserRoutine({
        routineId: editingRoutineId,
        name: routineName,
        frequency: Number(profile?.trainingDaysPerWeek || 3),
        exercises: builderExercises.map((name) => ({ name })),
      });

      if (!result.ok) {
        Alert.alert('Nao foi possivel atualizar', result.message);
        return;
      }

      Alert.alert('Rotina atualizada', 'Sua rotina foi atualizada com sucesso.');
      resetBuilder();
      return;
    }

    const result = createUserRoutine({
      name: routineName,
      frequency: Number(profile?.trainingDaysPerWeek || 3),
      exercises: builderExercises.map((name) => ({ name })),
    });

    if (!result.ok) {
      Alert.alert('Nao foi possivel salvar', result.message);
      return;
    }

    Alert.alert('Rotina criada', 'Sua rotina foi salva em Minhas Rotinas.');
    resetBuilder();
  };

  const loadRoutineToEdit = (routine) => {
    setEditingRoutineId(routine.id);
    setRoutineName(routine.name);
    setBuilderExercises(
      Array.isArray(routine.exercises)
        ? routine.exercises.map((item) => (typeof item === 'string' ? item : item?.name)).filter(Boolean)
        : []
    );
  };

  const saveRecommendedAsOwn = () => {
    const result = saveTodayWorkoutAsRoutine({
      name: `Rotina ${smart.title}`,
      frequency: Number(profile?.trainingDaysPerWeek || 3),
    });

    if (!result.ok) {
      Alert.alert('Nao foi possivel salvar', result.message);
      return;
    }

    Alert.alert('Rotina salva', 'A recomendacao de hoje foi salva em Minhas Rotinas.');
  };

  const startRoutine = (routine) => {
    if (!routine?.exercises?.length) return;

    navigation.navigate('Workout', { workoutId: routine.id });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
    <ScrollView testID="screen-routines" contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      <ScreenHeader title="Rotinas" subtitle="Controle total: recomendadas e criadas por voce no mesmo padrao." />

      <AppCard testID="card-routine-templates">
        <Text style={styles.cardTitle}>Templates prontos</Text>
        <Text style={styles.recommendationSub}>Inicie com 1 toque e depois personalize.</Text>
        <View style={styles.chipsWrap}>
          {routineTemplates.map((template) => (
            <TouchableOpacity
              key={template.key}
              style={styles.chip}
              onPress={() => {
                const result = createRoutineFromTemplate({
                  templateKey: template.key,
                  frequency: Number(profile?.trainingDaysPerWeek || 3),
                });
                if (!result.ok) {
                  Alert.alert('Nao foi possivel criar', result.message);
                }
              }}
            >
              <Text style={styles.chipText}>{template.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </AppCard>

      <AppCard testID="card-routine-builder">
        <Text style={styles.cardTitle}>Recomendada hoje</Text>
        <Text style={styles.recommendationMain}>🔥 Hoje e {smart.title}. Foco nisso.</Text>
        <Text style={styles.recommendationSub}>Confianca: {getConfidenceVisual(smart.confidence)} · Semana: {smart.trainedThisWeek}/{smart.weeklyTarget}</Text>
        <Text style={styles.recommendationSub}>{smart.urgencyMessage}</Text>
        {todayRoutine.map((item) => (
          <Text key={item.id} style={styles.line}>• {item.name} ({item.sets}x{item.reps})</Text>
        ))}
        <PrimaryButton title="Salvar como treino proprio" onPress={saveRecommendedAsOwn} style={styles.primaryButton} />
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>{editingRoutineId ? 'Editar rotina' : 'Criar rotina manual'}</Text>

        <Text style={styles.stepLabel}>1. Nome da rotina</Text>
        <Text style={styles.helperText}>Escolha um nome curto: exemplo "Perna A" ou "Upper Forte".</Text>

        <TextInput
          testID="input-routine-name"
          value={routineName}
          onChangeText={setRoutineName}
          placeholder="Ex: Perna A"
          placeholderTextColor="#8FA5CB"
          style={styles.input}
        />

        <Text style={styles.stepLabel}>2. Exercicios</Text>
        <Text style={styles.helperText}>Atalhos populares (toque para adicionar rapido):</Text>
        <View style={styles.chipsWrap}>
          {QUICK_EXERCISES.map((item) => (
            <TouchableOpacity testID={`chip-routine-quick-${toTestId(item)}`} key={`quick-${item}`} style={styles.quickChip} onPress={() => addExerciseToBuilder(item)}>
              <Text style={styles.quickChipText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          testID="input-routine-search"
          value={exerciseQuery}
          onChangeText={setExerciseQuery}
          placeholder="Buscar exercicio (ex: leg press)"
          placeholderTextColor="#8FA5CB"
          style={styles.input}
        />

        {filteredCatalog.length === 0 ? <Text style={styles.empty}>Nenhum exercicio encontrado. Tente "leg press" ou "agachamento".</Text> : null}
        <View style={styles.chipsWrap}>
          {filteredCatalog.map((item) => (
            <TouchableOpacity testID={`chip-routine-catalog-${toTestId(item)}`} key={item} style={styles.chip} onPress={() => addExerciseToBuilder(item)}>
              <Text style={styles.chipText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.blockLabel}>Exercicios da rotina</Text>
        {builderExercises.length === 0 ? <Text style={styles.empty}>Adicione exercicios para montar sua rotina.</Text> : null}
        {builderExercises.map((item, index) => (
          <View testID={`row-routine-builder-${toTestId(item)}`} key={item} style={styles.builderRow}>
            <Text style={styles.line}>• {item}</Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.smallButton} onPress={() => moveBuilderExercise(index, -1)}>
                <Text style={styles.smallButtonText}>↑</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallButton} onPress={() => moveBuilderExercise(index, 1)}>
                <Text style={styles.smallButtonText}>↓</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeExerciseFromBuilder(item)}>
                <Text style={styles.removeText}>Remover</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={styles.actionsRow}>
          <PrimaryButton testID="btn-routine-save" title={editingRoutineId ? 'Salvar edicao' : 'Criar rotina'} onPress={saveRoutine} style={styles.primaryButton} />
          {editingRoutineId ? (
            <SecondaryButton testID="btn-routine-cancel-edit" title="Cancelar" onPress={resetBuilder} style={styles.secondaryButton} />
          ) : null}
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>Minhas rotinas</Text>
        {userRoutines.length === 0 ? <Text style={styles.empty}>Nenhuma rotina salva ainda.</Text> : null}
        {userRoutines.map((routine) => (
          <View testID={`card-routine-${toTestId(routine.name || routine.id)}`} key={routine.id} style={styles.savedRoutineCard}>
            <Text style={styles.savedRoutineTitle}>{routine.name}</Text>
            <Text style={styles.recommendationSub}>{routine.frequency}x por semana</Text>
            {routine.exercises.map((item, index) => (
              <View key={`${routine.id}-${String(typeof item === 'string' ? item : item?.name)}-${index}`} style={styles.builderRow}>
                <Text style={styles.line}>• {typeof item === 'string' ? item : item?.name}</Text>
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => reorderUserRoutineExercises({ routineId: routine.id, fromIndex: index, toIndex: index - 1 })}
                  >
                    <Text style={styles.smallButtonText}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => reorderUserRoutineExercises({ routineId: routine.id, fromIndex: index, toIndex: index + 1 })}
                  >
                    <Text style={styles.smallButtonText}>↓</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <View style={styles.actionsRow}>
              <TouchableOpacity testID={`btn-routine-start-${toTestId(routine.name || routine.id)}`} style={styles.smallButton} onPress={() => startRoutine(routine)}>
                <Text style={styles.smallButtonText}>Iniciar</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`btn-routine-edit-${toTestId(routine.name || routine.id)}`} style={styles.smallButton} onPress={() => loadRoutineToEdit(routine)}>
                <Text style={styles.smallButtonText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`btn-routine-duplicate-${toTestId(routine.name || routine.id)}`} style={styles.smallButton} onPress={() => duplicateUserRoutine(routine.id)}>
                <Text style={styles.smallButtonText}>Duplicar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID={`btn-routine-delete-${toTestId(routine.name || routine.id)}`}
                style={[styles.smallButton, styles.smallButtonDanger]}
                onPress={() => {
                  const result = deleteUserRoutine(routine.id);
                  if (!result.ok) {
                    Alert.alert('Erro', result.message);
                  }
                }}
              >
                <Text style={styles.smallButtonText}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </AppCard>
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
    paddingBottom: spacing.xl,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  recommendationMain: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
  },
  recommendationSub: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  stepLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  helperText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  line: {
    color: colors.textPrimary,
    fontSize: 13,
    marginBottom: 4,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 8,
  },
  secondaryButton: {
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#141922',
    color: colors.textPrimary,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginBottom: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#141922',
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  quickChip: {
    borderWidth: 1,
    borderColor: '#3D8BFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#11243F',
  },
  quickChipText: {
    color: '#D7E8FF',
    fontSize: 12,
    fontWeight: '800',
  },
  blockLabel: {
    color: colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '800',
    fontSize: 11,
    marginBottom: 6,
  },
  empty: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  builderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  removeText: {
    color: '#FCA5A5',
    fontSize: 12,
    fontWeight: '800',
  },
  savedRoutineCard: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#141922',
  },
  savedRoutineTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  smallButton: {
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  smallButtonDanger: {
    backgroundColor: '#7F1D1D',
  },
  smallButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
});
