import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';

function getConfidenceVisual(confidence) {
  if (confidence === 'alta') {
    return '🟢 alta';
  }
  if (confidence === 'media') {
    return '🟡 media';
  }
  return '🔴 baixa';
}

export default function RoutinesScreen() {
  const {
    profile,
    getTodayWorkout,
    getExerciseCatalog,
    getSmartWorkoutRecommendation,
    getUserRoutines,
    createUserRoutine,
    updateUserRoutine,
    duplicateUserRoutine,
    deleteUserRoutine,
  } = useApp();

  const [routineName, setRoutineName] = useState('');
  const [routineFrequency, setRoutineFrequency] = useState(Number(profile?.trainingDaysPerWeek || 3));
  const [exerciseQuery, setExerciseQuery] = useState('');
  const [builderExercises, setBuilderExercises] = useState([]);
  const [editingRoutineId, setEditingRoutineId] = useState(null);

  const todayRoutine = useMemo(() => getTodayWorkout(), [getTodayWorkout]);
  const smart = useMemo(() => getSmartWorkoutRecommendation(), [getSmartWorkoutRecommendation]);
  const userRoutines = useMemo(() => getUserRoutines(), [getUserRoutines]);
  const exerciseCatalog = useMemo(() => getExerciseCatalog(), [getExerciseCatalog]);

  const filteredCatalog = useMemo(() => {
    const query = String(exerciseQuery || '').toLowerCase().trim();
    if (!query) {
      return exerciseCatalog.slice(0, 10);
    }

    return exerciseCatalog
      .filter((item) => String(item || '').toLowerCase().includes(query))
      .slice(0, 10);
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
    const result = createUserRoutine({
      name: `Rotina ${smart.title}`,
      frequency: Number(profile?.trainingDaysPerWeek || 3),
      exercises: todayRoutine.map((item) => item.name),
    });

    if (!result.ok) {
      Alert.alert('Nao foi possivel salvar', result.message);
      return;
    }

    Alert.alert('Rotina salva', 'A recomendacao de hoje foi salva em Minhas Rotinas.');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Rotinas</Text>
      <Text style={styles.subtitle}>Controle total: recomendadas e criadas por voce no mesmo padrao.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recomendada hoje</Text>
        <Text style={styles.recommendationMain}>🔥 Hoje e {smart.title}. Foco nisso.</Text>
        <Text style={styles.recommendationSub}>Confianca: {getConfidenceVisual(smart.confidence)} · Semana: {smart.trainedThisWeek}/{smart.weeklyTarget}</Text>
        <Text style={styles.recommendationSub}>{smart.urgencyMessage}</Text>
        {todayRoutine.map((item) => (
          <Text key={item.id} style={styles.line}>• {item.name} ({item.sets}x{item.reps})</Text>
        ))}
        <TouchableOpacity style={styles.primaryButton} onPress={saveRecommendedAsOwn}>
          <Text style={styles.primaryButtonText}>Salvar como treino proprio</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{editingRoutineId ? 'Editar rotina' : 'Criar rotina manual'}</Text>

        <TextInput
          value={routineName}
          onChangeText={setRoutineName}
          placeholder="Nome da rotina"
          placeholderTextColor="#8FA5CB"
          style={styles.input}
        />

        <View style={styles.frequencyRow}>
          <TouchableOpacity style={styles.freqButton} onPress={() => setRoutineFrequency((prev) => Math.max(1, prev - 1))}>
            <Text style={styles.freqButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.frequencyText}>Frequencia: {routineFrequency}x/sem</Text>
          <TouchableOpacity style={styles.freqButton} onPress={() => setRoutineFrequency((prev) => Math.min(7, prev + 1))}>
            <Text style={styles.freqButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          value={exerciseQuery}
          onChangeText={setExerciseQuery}
          placeholder="Buscar exercicio para adicionar"
          placeholderTextColor="#8FA5CB"
          style={styles.input}
        />

        <View style={styles.chipsWrap}>
          {filteredCatalog.map((item) => (
            <TouchableOpacity key={item} style={styles.chip} onPress={() => addExerciseToBuilder(item)}>
              <Text style={styles.chipText}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.blockLabel}>Exercicios da rotina</Text>
        {builderExercises.length === 0 ? <Text style={styles.empty}>Adicione exercicios para montar sua rotina.</Text> : null}
        {builderExercises.map((item) => (
          <View key={item} style={styles.builderRow}>
            <Text style={styles.line}>• {item}</Text>
            <TouchableOpacity onPress={() => removeExerciseFromBuilder(item)}>
              <Text style={styles.removeText}>Remover</Text>
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={saveRoutine}>
            <Text style={styles.primaryButtonText}>{editingRoutineId ? 'Salvar edicao' : 'Criar rotina'}</Text>
          </TouchableOpacity>
          {editingRoutineId ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={resetBuilder}>
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Minhas rotinas</Text>
        {userRoutines.length === 0 ? <Text style={styles.empty}>Nenhuma rotina salva ainda.</Text> : null}
        {userRoutines.map((routine) => (
          <View key={routine.id} style={styles.savedRoutineCard}>
            <Text style={styles.savedRoutineTitle}>{routine.name}</Text>
            <Text style={styles.recommendationSub}>{routine.frequency}x por semana</Text>
            {routine.exercises.map((item) => (
              <Text key={`${routine.id}-${item}`} style={styles.line}>• {item}</Text>
            ))}
            <View style={styles.actionsRow}>
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0B0F14',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 12,
    color: '#B8C4D6',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#121821',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#263040',
    padding: 14,
    marginBottom: 10,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  recommendationMain: {
    color: '#9FE3D6',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
  },
  recommendationSub: {
    color: '#C4D1E4',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  line: {
    color: '#D6E4F8',
    fontSize: 13,
    marginBottom: 4,
    fontWeight: '600',
  },
  primaryButton: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryButton: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#DCE8FF',
    fontWeight: '700',
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderColor: '#4B6896',
    borderRadius: 10,
    backgroundColor: '#0F1D36',
    color: '#F2F7FF',
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
    backgroundColor: '#1F3B66',
    alignItems: 'center',
    justifyContent: 'center',
  },
  freqButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
  frequencyText: {
    color: '#DCE8FF',
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
    borderColor: '#456696',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#0F1D36',
  },
  chipText: {
    color: '#CFE4FF',
    fontSize: 12,
    fontWeight: '700',
  },
  blockLabel: {
    color: '#AFC1D9',
    textTransform: 'uppercase',
    fontWeight: '800',
    fontSize: 11,
    marginBottom: 6,
  },
  empty: {
    color: '#8FA5CB',
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
    borderColor: '#2A3D57',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#0E1724',
  },
  savedRoutineTitle: {
    color: '#F1F7FF',
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
    backgroundColor: '#355B8E',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  smallButtonDanger: {
    backgroundColor: '#7F1D1D',
  },
  smallButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
});
