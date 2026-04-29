import React, { useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { EXERCISE_NAMES_V2 } from '../data/exerciseLibraryV2.js';
import { getExerciseByName, getExerciseFilters, searchExercises } from '../data/exercises.js';
import { fuzzySearchExercises } from '../services/fuzzySearch';
import { AnimatedToast, AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
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
  // confidence pode ser string ('alta','media','baixa') ou número (0.0–1.0)
  const num = Number(confidence);
  if (!Number.isNaN(num)) {
    if (num >= 0.8) return '🟢 alta';
    if (num >= 0.5) return '🟡 media';
    return '🔴 baixa';
  }
  if (confidence === 'alta') return '🟢 alta';
  if (confidence === 'media') return '🟡 media';
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
  const [muscleFilter, setMuscleFilter] = useState('all');
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  const [builderExercises, setBuilderExercises] = useState([]);
  const [selectedCatalogExercises, setSelectedCatalogExercises] = useState([]);
  const [builderStep, setBuilderStep] = useState(1);
  const [editingRoutineId, setEditingRoutineId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const todayRoutine = useMemo(() => getTodayWorkout(), [getTodayWorkout]);
  const smart = useMemo(() => getSmartWorkoutRecommendation(), [getSmartWorkoutRecommendation]);
  const userRoutines = useMemo(() => getUserRoutines(), [getUserRoutines]);
  const exerciseCatalog = useMemo(() => {
    const base = Array.isArray(getExerciseCatalog()) ? getExerciseCatalog() : [];
    return Array.from(new Set([...QUICK_EXERCISES, ...EXERCISE_NAMES_V2, ...base]));
  }, [getExerciseCatalog]);
  const routineTemplates = useMemo(() => getWorkoutTemplates(), [getWorkoutTemplates]);
  const exerciseFilters = useMemo(() => getExerciseFilters(), []);
  const safeTodayRoutine = Array.isArray(todayRoutine) ? todayRoutine : [];
  const safeRoutineTemplates = Array.isArray(routineTemplates) ? routineTemplates : [];
  const safeUserRoutines = Array.isArray(userRoutines) ? userRoutines : [];
  const safeMuscles = Array.isArray(exerciseFilters?.muscles) ? exerciseFilters.muscles : [];
  const safeEquipments = Array.isArray(exerciseFilters?.equipments) ? exerciseFilters.equipments : [];

  const filteredCatalog = useMemo(() => {
    const query = normalizeText(exerciseQuery);
    const premium = searchExercises({
      query,
      muscle: muscleFilter,
      equipment: equipmentFilter,
    }).map((item) => item.name);

    const fallback = query
      ? fuzzySearchExercises(query, exerciseCatalog, 20)
      : exerciseCatalog.slice(0, 20);

    return Array.from(new Set([...premium, ...fallback]))
      .slice(0, 12)
      .map((name) => {
        const detail = getExerciseByName(name);
        return {
          name,
          thumbnail: detail?.thumbnail || null,
          muscle: detail?.musclePrimary?.[0] || detail?.muscleSecondary?.[0] || 'geral',
          equipment: detail?.equipment || 'livre',
        };
      });
  }, [exerciseCatalog, exerciseQuery, muscleFilter, equipmentFilter]);

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

  const toggleCatalogSelection = (exerciseName) => {
    const safeName = String(exerciseName || '').trim();
    if (!safeName) {
      return;
    }

    setSelectedCatalogExercises((prev) => (
      prev.includes(safeName)
        ? prev.filter((item) => item !== safeName)
        : [...prev, safeName]
    ));
  };

  const addSelectedCatalogToBuilder = () => {
    if (!selectedCatalogExercises.length) {
      return;
    }

    setBuilderExercises((prev) => {
      const map = new Set(prev);
      selectedCatalogExercises.forEach((name) => map.add(name));
      return Array.from(map);
    });
    setToastMessage(`${selectedCatalogExercises.length} exercicio(s) adicionados na rotina.`);
    setSelectedCatalogExercises([]);
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
    setSelectedCatalogExercises([]);
    setBuilderStep(1);
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
        setToastMessage(`Nao foi possivel atualizar: ${String(result?.message || 'erro desconhecido')}`);
        return;
      }

      setToastMessage('Rotina atualizada com sucesso.');
      resetBuilder();
      return;
    }

    const result = createUserRoutine({
      name: routineName,
      frequency: Number(profile?.trainingDaysPerWeek || 3),
      exercises: builderExercises.map((name) => ({ name })),
    });

    if (!result.ok) {
      setToastMessage(`Nao foi possivel salvar: ${String(result?.message || 'erro desconhecido')}`);
      return;
    }

    setToastMessage('Rotina criada e salva em Minhas Rotinas.');
    resetBuilder();
  };

  const loadRoutineToEdit = (routine) => {
    setEditingRoutineId(routine.id);
    setBuilderStep(3);
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
      setToastMessage(`Nao foi possivel salvar: ${String(result?.message || 'erro desconhecido')}`);
      return;
    }

    setToastMessage('Rotina recomendada salva em Minhas Rotinas.');
  };

  const startRoutine = (routine) => {
    if (!routine?.exercises?.length) return;

    navigation.navigate('Workout', { workoutId: routine.id });
  };

  const openExerciseDetail = (exercise) => {
    navigation.navigate('ExerciseDetail', { exercise });
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
    <AnimatedToast message={toastMessage} onHide={() => setToastMessage('')} />
    <ScrollView testID="screen-routines" contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      <ScreenHeader title="Rotinas" subtitle="Controle total: recomendadas e criadas por voce no mesmo padrao." />

      <AppCard testID="card-routine-templates">
        <Text style={styles.cardTitle}>Templates prontos</Text>
        <Text style={styles.recommendationSub}>Inicie com 1 toque e depois personalize.</Text>
        <View style={styles.chipsWrap}>
          {safeRoutineTemplates.map((template) => (
            <TouchableOpacity
              key={template.key}
              style={styles.chip}
              onPress={() => {
                const result = createRoutineFromTemplate({
                  templateKey: template.key,
                  frequency: Number(profile?.trainingDaysPerWeek || 3),
                });
                if (!result.ok) {
                  setToastMessage(`Nao foi possivel criar: ${String(result?.message || 'erro desconhecido')}`);
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
        {safeTodayRoutine.map((item) => (
          <Text key={item.id} style={styles.line}>• {item.name} ({item.sets}x{item.reps})</Text>
        ))}
        <PrimaryButton title="Salvar como treino proprio" onPress={saveRecommendedAsOwn} style={styles.primaryButton} />
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>{editingRoutineId ? 'Editar rotina' : 'Criar rotina manual'}</Text>
        <Text style={styles.recommendationSub}>Etapa {builderStep}/4</Text>

        {builderStep === 1 ? (
          <>
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
          </>
        ) : null}

        {builderStep === 2 ? (
          <>
            <Text style={styles.stepLabel}>2. Adicionar exercicios</Text>
            <Text style={styles.helperText}>Selecione em lote e adicione de uma vez.</Text>

            <View style={styles.chipsWrap}>
              {QUICK_EXERCISES.map((item) => (
                <TouchableOpacity
                  testID={`chip-routine-quick-${toTestId(item)}`}
                  key={`quick-${item}`}
                  style={[styles.quickChip, selectedCatalogExercises.includes(item) ? styles.quickChipSelected : null]}
                  onPress={() => toggleCatalogSelection(item)}
                >
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

            <Text style={styles.helperText}>Filtrar por musculo:</Text>
            <View style={styles.chipsWrap}>
              <TouchableOpacity
                style={[styles.filterChip, muscleFilter === 'all' ? styles.filterChipActive : null]}
                onPress={() => setMuscleFilter('all')}
              >
                <Text style={[styles.filterChipText, muscleFilter === 'all' ? styles.filterChipTextActive : null]}>Todos</Text>
              </TouchableOpacity>
              {safeMuscles.slice(0, 8).map((item) => (
                <TouchableOpacity
                  key={`muscle-${item}`}
                  style={[styles.filterChip, muscleFilter === item ? styles.filterChipActive : null]}
                  onPress={() => setMuscleFilter(item)}
                >
                  <Text style={[styles.filterChipText, muscleFilter === item ? styles.filterChipTextActive : null]}>{item.replace(/_/g, ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredCatalog.length === 0 ? <Text style={styles.empty}>Nenhum exercicio encontrado. Tente "leg press" ou "agachamento".</Text> : null}
            <View style={styles.catalogList}>
              {filteredCatalog.map((item) => {
                const selected = selectedCatalogExercises.includes(item.name);
                return (
                  <View key={item.name} style={[styles.catalogCard, selected ? styles.catalogCardSelected : null]}>
                    <View style={styles.catalogInfoRow}>
                      {item.thumbnail ? <Image source={{ uri: item.thumbnail }} style={styles.catalogThumb} /> : <View style={styles.catalogThumbFallback} />}
                      <View style={styles.catalogTextWrap}>
                        <Text style={styles.catalogName}>{item.name}</Text>
                        <Text style={styles.catalogMeta}>{item.muscle.replace(/_/g, ' ')} · {item.equipment.replace(/_/g, ' ')}</Text>
                      </View>
                    </View>
                    <View style={styles.catalogActions}>
                      <TouchableOpacity
                        testID={`chip-routine-catalog-${toTestId(item.name)}`}
                        style={[styles.catalogAddButton, selected ? styles.catalogAddButtonSelected : null]}
                        onPress={() => toggleCatalogSelection(item.name)}
                      >
                        <Text style={styles.catalogAddButtonText}>{selected ? 'Selecionado' : 'Selecionar'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.catalogDetailButton} onPress={() => openExerciseDetail(item)}>
                        <Text style={styles.catalogDetailButtonText}>Detalhes</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>

            <PrimaryButton
              testID="btn-routine-add-bulk"
              title={`Adicionar ${selectedCatalogExercises.length} exercicio(s)`}
              onPress={addSelectedCatalogToBuilder}
              style={styles.primaryButton}
            />
            <Text style={styles.helperText}>Na rotina agora: {builderExercises.length} exercicio(s).</Text>
          </>
        ) : null}

        {builderStep === 3 ? (
          <>
            <Text style={styles.stepLabel}>3. Revisar rotina</Text>
            <Text style={styles.helperText}>Reordene e ajuste antes de salvar.</Text>
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
          </>
        ) : null}

        {builderStep === 4 ? (
          <>
            <Text style={styles.stepLabel}>4. Salvar rotina</Text>
            <Text style={styles.helperText}>Nome: {routineName || 'sem nome'}</Text>
            <Text style={styles.helperText}>Total de exercicios: {builderExercises.length}</Text>
            <PrimaryButton testID="btn-routine-save" title={editingRoutineId ? 'Salvar edicao' : 'Criar rotina'} onPress={saveRoutine} style={styles.primaryButton} />
          </>
        ) : null}

        <View style={styles.actionsRow}>
          {builderStep > 1 ? (
            <SecondaryButton title="Voltar" onPress={() => setBuilderStep((prev) => Math.max(1, prev - 1))} style={styles.secondaryButton} />
          ) : null}
          {builderStep < 4 ? (
            <PrimaryButton
              title="Proximo"
              onPress={() => {
                if (builderStep === 1 && !String(routineName || '').trim()) {
                  setToastMessage('Defina um nome para a rotina antes de continuar.');
                  return;
                }
                if (builderStep === 2 && builderExercises.length === 0) {
                  setToastMessage('Adicione ao menos 1 exercicio para continuar.');
                  return;
                }
                if (builderStep === 3 && builderExercises.length === 0) {
                  setToastMessage('A revisao precisa de pelo menos 1 exercicio.');
                  return;
                }
                setBuilderStep((prev) => Math.min(4, prev + 1));
              }}
              style={styles.primaryButton}
            />
          ) : null}
          {editingRoutineId ? (
            <SecondaryButton testID="btn-routine-cancel-edit" title="Cancelar" onPress={resetBuilder} style={styles.secondaryButton} />
          ) : null}
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>Minhas rotinas</Text>
        {safeUserRoutines.length === 0 ? <Text style={styles.empty}>Nenhuma rotina salva ainda.</Text> : null}
        {safeUserRoutines.map((routine) => (
          <View testID={`card-routine-${toTestId(routine.name || routine.id)}`} key={routine.id} style={styles.savedRoutineCard}>
            <Text style={styles.savedRoutineTitle}>{routine.name}</Text>
            <Text style={styles.recommendationSub}>{routine.frequency}x por semana</Text>
            {(Array.isArray(routine?.exercises) ? routine.exercises : []).map((item, index) => (
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
                    setToastMessage(`Erro: ${String(result?.message || 'falha ao excluir rotina')}`);
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
  filterChip: {
    borderWidth: 1,
    borderColor: '#2A3448',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#111722',
  },
  filterChipActive: {
    borderColor: '#3D8BFF',
    backgroundColor: '#11243F',
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: '#D7E8FF',
  },
  catalogList: {
    gap: 8,
    marginBottom: 8,
  },
  catalogCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#101722',
    padding: 10,
    gap: 8,
  },
  catalogCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#11243F',
  },
  catalogInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  catalogThumb: {
    width: 46,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0c1118',
  },
  catalogThumbFallback: {
    width: 46,
    height: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0c1118',
  },
  catalogTextWrap: {
    flex: 1,
  },
  catalogName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  catalogMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  catalogActions: {
    flexDirection: 'row',
    gap: 8,
  },
  catalogAddButton: {
    flex: 1,
    borderRadius: 8,
    backgroundColor: '#225FA8',
    paddingVertical: 8,
    alignItems: 'center',
  },
  catalogAddButtonSelected: {
    backgroundColor: '#1B7C47',
  },
  catalogAddButtonText: {
    color: '#E7F2FF',
    fontWeight: '800',
    fontSize: 12,
  },
  catalogDetailButton: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#162131',
  },
  catalogDetailButtonText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  quickChip: {
    borderWidth: 1,
    borderColor: '#3D8BFF',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#11243F',
  },
  quickChipSelected: {
    backgroundColor: '#1B7C47',
    borderColor: '#2EDB8F',
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
