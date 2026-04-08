import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { EXERCISE_NAMES_V2 } from '../data/exerciseLibraryV2';
import { fuzzySearchExercises } from '../services/fuzzySearch';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';

const QUICK_EXERCISES = ['Leg Press 45', 'Agachamento Livre', 'Supino Reto', 'Remada Curvada', 'Stiff'];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
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
  const [routineFrequency, setRoutineFrequency] = useState(Number(profile?.trainingDaysPerWeek || 3));
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
    setRoutineFrequency(Number(profile?.trainingDaysPerWeek || 3));
    setBuilderExercises([]);
    setExerciseQuery('');
    setEditingRoutineId(null);
  };

  const saveRoutine = () => {
    if (editingRoutineId) {
      const result = updateUserRoutine({
        routineId: editingRoutineId,
        name: routineName,
        frequency: routineFrequency,
        exercises: builderExercises,
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
      frequency: routineFrequency,
      exercises: builderExercises,
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
    setRoutineFrequency(Number(routine.frequency || 3));
    setBuilderExercises(Array.isArray(routine.exercises) ? routine.exercises : []);
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

  const startRoutineNow = (routine) => {
    const routineExercises = (Array.isArray(routine?.exercises) ? routine.exercises : [])
      .map((name, index) => ({
        id: `routine-${String(routine?.id || 'custom')}-${index}`,
        name: String(name || '').trim(),
        sets: 3,
        reps: '8-12',
        targetWeight: 0,
      }))
      .filter((item) => item.name);

    if (!routineExercises.length) {
      Alert.alert('Rotina vazia', 'Essa rotina nao possui exercicios validos.');
      return;
    }

    navigation.navigate('TreinoHoje', {
      routineName: routine.name,
      routineExercises,
      routineSeed: `${routine.id}-${Date.now()}`,
    });
  };

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
    >
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      <ScreenHeader title="Rotinas" subtitle="Controle total: recomendadas e criadas por voce no mesmo padrao." />

      <AppCard>
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

      <AppCard>
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
          value={routineName}
          onChangeText={setRoutineName}
          placeholder="Ex: Perna A"
          placeholderTextColor="#8FA5CB"
          style={styles.input}
        />

        <Text style={styles.stepLabel}>2. Frequencia</Text>

        <View style={styles.frequencyRow}>
          <TouchableOpacity style={styles.freqButton} onPress={() => setRoutineFrequency((prev) => Math.max(1, prev - 1))}>
            <Text style={styles.freqButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.frequencyText}>Frequencia: {routineFrequency}x/sem</Text>
          <TouchableOpacity style={styles.freqButton} onPress={() => setRoutineFrequency((prev) => Math.min(7, prev + 1))}>
            <Text style={styles.freqButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.stepLabel}>3. Exercicios</Text>
        <Text style={styles.helperText}>Atalhos populares (toque para adicionar rapido):</Text>
        <View style={styles.chipsWrap}>
          {QUICK_EXERCISES.map((item) => (
            <TouchableOpacity key={`quick-${item}`} style={styles.quickChip} onPress={() => addExerciseToBuilder(item)}>
              <Text style={styles.quickChipText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          value={exerciseQuery}
          onChangeText={setExerciseQuery}
          placeholder="Buscar exercicio (ex: leg press)"
          placeholderTextColor="#8FA5CB"
          style={styles.input}
        />

        {filteredCatalog.length === 0 ? <Text style={styles.empty}>Nenhum exercicio encontrado. Tente "leg press" ou "agachamento".</Text> : null}
        <View style={styles.chipsWrap}>
          {filteredCatalog.map((item) => (
            <TouchableOpacity key={item} style={styles.chip} onPress={() => addExerciseToBuilder(item)}>
              <Text style={styles.chipText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.blockLabel}>Exercicios da rotina</Text>
        {builderExercises.length === 0 ? <Text style={styles.empty}>Adicione exercicios para montar sua rotina.</Text> : null}
        {builderExercises.map((item, index) => (
          <View key={item} style={styles.builderRow}>
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
          <PrimaryButton title={editingRoutineId ? 'Salvar edicao' : 'Criar rotina'} onPress={saveRoutine} style={styles.primaryButton} />
          {editingRoutineId ? (
            <SecondaryButton title="Cancelar" onPress={resetBuilder} style={styles.secondaryButton} />
          ) : null}
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>Minhas rotinas</Text>
        {userRoutines.length === 0 ? <Text style={styles.empty}>Nenhuma rotina salva ainda.</Text> : null}
        {userRoutines.map((routine) => (
          <View key={routine.id} style={styles.savedRoutineCard}>
            <Text style={styles.savedRoutineTitle}>{routine.name}</Text>
            <Text style={styles.recommendationSub}>{routine.frequency}x por semana</Text>
            {routine.exercises.map((item, index) => (
              <View key={`${routine.id}-${item}-${index}`} style={styles.builderRow}>
                <Text style={styles.line}>• {item}</Text>
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
              <TouchableOpacity style={styles.smallButton} onPress={() => startRoutineNow(routine)}>
                <Text style={styles.smallButtonText}>Iniciar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallButton} onPress={() => loadRoutineToEdit(routine)}>
                <Text style={styles.smallButtonText}>Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallButton} onPress={() => duplicateUserRoutine(routine.id)}>
                <Text style={styles.smallButtonText}>Duplicar</Text>
              </TouchableOpacity>
              <TouchableOpacity
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
  frequencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  freqButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  freqButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
  frequencyText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
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
