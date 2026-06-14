import React, { useMemo, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { EXERCISE_NAMES_V2 } from '../data/exerciseLibraryV2.js';
import { getExerciseByName, getExerciseFilters, MUSCLE_GROUP_LABELS, resolveExerciseForDetail, searchExercises } from '../data/exercises.js';
import { isPlaceholderMediaUrl } from '../utils/exerciseMedia';
import { fuzzySearchExercises } from '../services/fuzzySearch';
import {
  canStartRoutine,
  formatRoutineWeeklyFrequency,
  getRoutineStartBlockReason,
} from '../services/routineDisplay';
import { AnimatedToast, AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing, radius } from '../theme';

const QUICK_EXERCISES = [
  'Leg Press 45',
  'Agachamento Livre',
  'Supino Maquina (Chest Press)',
  'Remada Sentada Maquina',
  'Puxada Frontal Polia',
  'Graviton (Barra Assistida)',
  'Stiff',
];
const DEFAULT_ROUTINE_SETS = 3;

function clampRoutineSets(value) {
  const parsed = Math.round(Number(value || DEFAULT_ROUTINE_SETS));
  if (!Number.isFinite(parsed)) {
    return DEFAULT_ROUTINE_SETS;
  }
  return Math.max(1, Math.min(12, parsed));
}

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
  const [builderSetsByExercise, setBuilderSetsByExercise] = useState({});
  const [selectedCatalogExercises, setSelectedCatalogExercises] = useState([]);
  const [builderStep, setBuilderStep] = useState(1);
  const [editingRoutineId, setEditingRoutineId] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [showCatalogModal, setShowCatalogModal] = useState(false);

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
          muscle: detail?.primaryMuscle || 'geral',
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
    setBuilderSetsByExercise((prev) => ({
      ...prev,
      [safeName]: clampRoutineSets(prev?.[safeName] || DEFAULT_ROUTINE_SETS),
    }));
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
    setBuilderSetsByExercise((prev) => {
      const next = { ...prev };
      selectedCatalogExercises.forEach((name) => {
        next[name] = clampRoutineSets(next?.[name] || DEFAULT_ROUTINE_SETS);
      });
      return next;
    });
    setToastMessage(`${selectedCatalogExercises.length} exercício(s) adicionados na rotina.`);
    setSelectedCatalogExercises([]);
  };

  const removeExerciseFromBuilder = (exerciseName) => {
    setBuilderExercises((prev) => prev.filter((item) => item !== exerciseName));
    setBuilderSetsByExercise((prev) => {
      const next = { ...prev };
      delete next[exerciseName];
      return next;
    });
  };

  const setExerciseRoutineSets = (exerciseName, rawValue) => {
    const safeName = String(exerciseName || '').trim();
    if (!safeName) {
      return;
    }

    const digitsOnly = String(rawValue || '').replace(/[^0-9]/g, '');
    const nextSets = clampRoutineSets(digitsOnly || DEFAULT_ROUTINE_SETS);
    setBuilderSetsByExercise((prev) => ({
      ...prev,
      [safeName]: nextSets,
    }));
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
    setBuilderSetsByExercise({});
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
        exercises: builderExercises.map((name) => ({
          name,
          sets: clampRoutineSets(builderSetsByExercise?.[name] || DEFAULT_ROUTINE_SETS),
        })),
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
      exercises: builderExercises.map((name) => ({
        name,
        sets: clampRoutineSets(builderSetsByExercise?.[name] || DEFAULT_ROUTINE_SETS),
      })),
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
    const safeExercises = Array.isArray(routine.exercises) ? routine.exercises : [];
    const nextNames = safeExercises
      .map((item) => (typeof item === 'string' ? item : item?.name))
      .filter(Boolean);

    const nextSetsByExercise = {};
    safeExercises.forEach((item) => {
      const name = typeof item === 'string' ? item : item?.name;
      if (!name) {
        return;
      }
      nextSetsByExercise[name] = clampRoutineSets(typeof item === 'object' ? item?.sets : DEFAULT_ROUTINE_SETS);
    });

    setBuilderExercises(nextNames);
    setBuilderSetsByExercise(nextSetsByExercise);
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
    if (!canStartRoutine(routine)) {
      setToastMessage(getRoutineStartBlockReason(routine) || 'Adicione exercicios para iniciar');
      return;
    }

    navigation.navigate('TreinoHoje', { workoutId: routine.id });
  };

  const openExerciseDetail = (item) => {
    const resolved = resolveExerciseForDetail(item.name) || { name: item.name };
    const payload = {
      exercise: { name: resolved.name || item.name, ...resolved },
    };
    navigation.navigate('ExerciseDetail', payload);
    setShowCatalogModal(false);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
    <AnimatedToast message={toastMessage} onHide={() => setToastMessage('')} />
    <ScrollView testID="screen-routines" contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}>
      <ScreenHeader title="Rotinas" subtitle="Controle total: recomendadas e criadas por você no mesmo padrao." onBack={() => navigation.goBack()} />

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
        <Text style={styles.recommendationSub}>Confiança: {getConfidenceVisual(smart.confidence)} · Semana: {smart.trainedThisWeek}/{smart.weeklyTarget}</Text>
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
            <Text style={styles.helperText}>Use o modal para pesquisar e selecionar em lote sem rolagem infinita.</Text>
            <View style={styles.builderSelectionWrap}>
              <Text style={styles.helperText}>Selecionados no modal: {selectedCatalogExercises.length}</Text>
              <Text style={styles.helperText}>Na rotina agora: {builderExercises.length} exercicio(s).</Text>
              <PrimaryButton
                testID="btn-open-routine-catalog-modal"
                title="Buscar e selecionar exercicios"
                onPress={() => setShowCatalogModal(true)}
                style={styles.primaryButton}
              />
            </View>

            {builderExercises.map((item) => (
              <View key={`selected-${item}`} style={styles.builderRow}>
                <Text style={styles.line}>• {item}</Text>
                <TouchableOpacity onPress={() => removeExerciseFromBuilder(item)}>
                  <Text style={styles.removeText}>Remover</Text>
                </TouchableOpacity>
              </View>
            ))}
          </>
        ) : null}

        {builderStep === 3 ? (
          <>
            <Text style={styles.stepLabel}>3. Revisar rotina</Text>
            <Text style={styles.helperText}>Reordene e ajuste antes de salvar.</Text>
            {builderExercises.length === 0 ? <Text style={styles.empty}>Adicione exercicios para montar sua rotina.</Text> : null}
            {builderExercises.map((item, index) => (
              <View testID={`row-routine-builder-${toTestId(item)}`} key={item} style={styles.builderRow}>
                <View style={styles.builderRowMain}>
                  <Text style={styles.line}>• {item}</Text>
                  <View style={styles.builderSetsWrap}>
                    <Text style={styles.builderSetsLabel}>Series</Text>
                    <TextInput
                      testID={`input-routine-sets-${toTestId(item)}`}
                      value={String(clampRoutineSets(builderSetsByExercise?.[item] || DEFAULT_ROUTINE_SETS))}
                      onChangeText={(value) => setExerciseRoutineSets(item, value)}
                      keyboardType="numeric"
                      maxLength={2}
                      style={styles.builderSetsInput}
                    />
                  </View>
                </View>
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
        {safeUserRoutines.map((routine) => {
          const canStart = canStartRoutine(routine);
          const startBlockReason = getRoutineStartBlockReason(routine);
          return (
          <View testID={`card-routine-${toTestId(routine.name || routine.id)}`} key={routine.id} style={styles.savedRoutineCard}>
            <Text style={styles.savedRoutineTitle}>{routine.name}</Text>
            <Text style={styles.recommendationSub}>
              {formatRoutineWeeklyFrequency(routine.frequency, profile?.trainingDaysPerWeek)}
            </Text>
            {(Array.isArray(routine?.exercises) ? routine.exercises : []).map((item, index) => (
              <View key={`${routine.id}-${String(typeof item === 'string' ? item : item?.name)}-${index}`} style={styles.builderRow}>
                <Text style={styles.line}>• {typeof item === 'string' ? item : item?.name} ({clampRoutineSets(typeof item === 'object' ? item?.sets : DEFAULT_ROUTINE_SETS)} series)</Text>
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => reorderUserRoutineExercises({ routineId: routine.id, from: index, to: index - 1 })}
                  >
                    <Text style={styles.smallButtonText}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.smallButton}
                    onPress={() => reorderUserRoutineExercises({ routineId: routine.id, from: index, to: index + 1 })}
                  >
                    <Text style={styles.smallButtonText}>↓</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                testID={`btn-routine-start-${toTestId(routine.name || routine.id)}`}
                style={[styles.smallButton, styles.smallButtonStart, !canStart ? styles.smallButtonDisabled : null]}
                disabled={!canStart}
                onPress={() => startRoutine(routine)}
              >
                <Text style={[styles.smallButtonText, !canStart ? styles.smallButtonTextDisabled : null]}>Iniciar</Text>
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
            {!canStart && startBlockReason ? (
              <Text style={styles.startBlockHint}>{startBlockReason}</Text>
            ) : null}
          </View>
          );
        })}
      </AppCard>

      <Modal
        visible={showCatalogModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCatalogModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.bottomSheet}>
            <Text style={styles.cardTitle}>Selecionar exercicios</Text>

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

            <Text style={styles.helperText}>Filtrar por músculo:</Text>
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
                  <Text style={[styles.filterChipText, muscleFilter === item ? styles.filterChipTextActive : null]}>{MUSCLE_GROUP_LABELS[item] || item.replace(/_/g, ' ')}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView style={styles.modalCatalogScroll} contentContainerStyle={styles.catalogList} keyboardShouldPersistTaps="handled">
              {filteredCatalog.map((item) => {
                const selected = selectedCatalogExercises.includes(item.name);
                return (
                  <View key={item.name} style={[styles.catalogCard, selected ? styles.catalogCardSelected : null]}>
                    <TouchableOpacity
                      style={styles.catalogInfoRow}
                      onPress={() => openExerciseDetail(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Detalhes ${item.name}`}
                      testID={`row-routine-detail-${toTestId(item.name)}`}
                    >
                      {item.thumbnail && !isPlaceholderMediaUrl(item.thumbnail) ? (
                        <Image source={{ uri: item.thumbnail }} style={styles.catalogThumb} />
                      ) : (
                        <View style={styles.catalogThumbFallback} />
                      )}
                      <View style={styles.catalogTextWrap}>
                        <Text style={styles.catalogName}>{item.name}</Text>
                        <Text style={styles.catalogMeta}>{MUSCLE_GROUP_LABELS[item.muscle] || item.muscle.replace(/_/g, ' ')} · {item.equipment.replace(/_/g, ' ')}</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={styles.catalogActions}>
                      <TouchableOpacity
                        testID={`chip-routine-catalog-${toTestId(item.name)}`}
                        style={[styles.catalogAddButton, selected ? styles.catalogAddButtonSelected : null]}
                        onPress={() => toggleCatalogSelection(item.name)}
                      >
                        <Text style={styles.catalogAddButtonText}>{selected ? 'Selecionado' : 'Selecionar'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        testID={`btn-routine-detail-${toTestId(item.name)}`}
                        accessibilityLabel="Detalhes"
                        style={styles.catalogDetailButton}
                        onPress={() => openExerciseDetail(item)}
                      >
                        <Text style={styles.catalogDetailButtonText}>Detalhes</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            <View style={styles.bottomSheetActions}>
              <SecondaryButton title="Fechar" onPress={() => setShowCatalogModal(false)} style={styles.secondaryButton} />
              <PrimaryButton
                testID="btn-routine-add-bulk"
                title={`Adicionar ${selectedCatalogExercises.length} exercicio(s)`}
                onPress={() => {
                  addSelectedCatalogToBuilder();
                  setShowCatalogModal(false);
                }}
                style={styles.primaryButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {builderStep === 2 && selectedCatalogExercises.length > 0 ? (
        <TouchableOpacity
          testID="fab-routine-add-bulk"
          style={styles.batchFab}
          onPress={() => {
            addSelectedCatalogToBuilder();
            setShowCatalogModal(false);
          }}
        >
          <Text style={styles.batchFabText}>Adicionar {selectedCatalogExercises.length} exercicio(s)</Text>
        </TouchableOpacity>
      ) : null}
    </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  cardTitle: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recommendationMain: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: spacing.xxs,
  },
  recommendationSub: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.xxs,
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
    marginBottom: spacing.xs,
  },
  line: {
    color: colors.textPrimary,
    fontSize: 13,
    marginBottom: 4,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: spacing.xs,
  },
  secondaryButton: {
    marginTop: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xxs,
    marginBottom: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.surface,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.cardElevated,
  },
  filterChipActive: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondaryMuted,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: colors.textPrimary,
  },
  catalogList: {
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  catalogCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  catalogCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  catalogInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  catalogThumb: {
    width: 46,
    height: 46,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  catalogThumbFallback: {
    width: 46,
    height: 46,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
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
    gap: spacing.xs,
  },
  catalogAddButton: {
    flex: 1,
    borderRadius: radius.xs,
    backgroundColor: colors.secondary,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  catalogAddButtonSelected: {
    backgroundColor: colors.primary,
  },
  catalogAddButtonText: {
    color: colors.textInverse,
    fontWeight: '800',
    fontSize: 12,
  },
  catalogDetailButton: {
    flex: 1,
    borderRadius: radius.xs,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardElevated,
  },
  catalogDetailButtonText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  quickChip: {
    borderWidth: 1,
    borderColor: colors.secondary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.secondaryMuted,
  },
  quickChipSelected: {
    backgroundColor: colors.primaryDim,
    borderColor: colors.primary,
  },
  quickChipText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  blockLabel: {
    color: colors.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '800',
    fontSize: 11,
    marginBottom: spacing.xxs,
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
  builderRowMain: {
    flex: 1,
    marginRight: spacing.xs,
  },
  builderSetsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    marginTop: spacing.xxs,
  },
  builderSetsLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  builderSetsInput: {
    minWidth: 60,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.xs,
    paddingVertical: 6,
    textAlign: 'center',
    fontWeight: '800',
  },
  removeText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
  savedRoutineCard: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    backgroundColor: colors.card,
  },
  savedRoutineTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: spacing.xxs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  smallButton: {
    marginTop: spacing.xs,
    borderRadius: radius.xs,
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  smallButtonStart: {
    backgroundColor: colors.primary,
  },
  smallButtonDisabled: {
    backgroundColor: colors.cardElevated,
    opacity: 0.55,
  },
  smallButtonTextDisabled: {
    color: colors.textMuted,
  },
  startBlockHint: {
    marginTop: spacing.xxs,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  smallButtonDanger: {
    backgroundColor: colors.dangerMuted,
  },
  smallButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  builderSelectionWrap: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.cardElevated,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    maxHeight: '86%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  modalCatalogScroll: {
    maxHeight: 360,
  },
  bottomSheetActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  batchFab: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    zIndex: 40,
  },
  batchFabText: {
    color: colors.textInverse,
    fontSize: 13,
    fontWeight: '900',
  },
});
