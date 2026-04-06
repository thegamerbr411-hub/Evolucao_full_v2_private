import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
import { useApp } from '../context/AppContext';

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

export default function FreeWorkoutScreen() {
  const {
    saveFreeWorkoutSet,
    getExerciseCatalog,
    getFreeWorkoutSuggestions,
    getExerciseSetProgress,
  } = useApp();

  const catalog = useMemo(() => getExerciseCatalog(), [getExerciseCatalog]);
  const [activeCategory, setActiveCategory] = useState('peito');
  const [exerciseNameInput, setExerciseNameInput] = useState('');
  const [selectedExercises, setSelectedExercises] = useState([]);
  const [setData, setSetData] = useState({});
  const [restSeconds, setRestSeconds] = useState(0);
  const [restRunning, setRestRunning] = useState(false);

  const categoryExercises = useMemo(
    () => groupCatalogByCategory(catalog, activeCategory),
    [catalog, activeCategory]
  );

  const suggestions = useMemo(
    () => getFreeWorkoutSuggestions(selectedExercises).slice(0, 6),
    [selectedExercises, getFreeWorkoutSuggestions]
  );

  const addExercise = (rawName) => {
    const name = String(rawName || '').trim();
    if (!name) {
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
      Alert.alert('Descanso concluido', 'Pode fazer o proximo set.');
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

  const submitSet = (exerciseName, failed) => {
    const values = setData[exerciseName] || { weight: '', reps: '' };
    const result = saveFreeWorkoutSet({
      exerciseName,
      weight: Number(values.weight),
      reps: Number(values.reps),
      failed,
    });

    if (!result.ok) {
      Alert.alert('Dados invalidos', result.message);
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
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 16 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
      <Text style={styles.title}>Treino livre</Text>
      <Text style={styles.subtitle}>Escolha exercicios por categoria e registre rapido.</Text>

      <View style={styles.timerBox}>
        <Text style={styles.timerLabel}>Descanso</Text>
        <Text style={styles.timerValue}>{formatTimer(restSeconds)}</Text>
        <TouchableOpacity
          style={[styles.timerAction, restRunning ? styles.timerActionStop : null]}
          onPress={restRunning ? stopRest : startRest}
        >
          <Text style={styles.timerActionText}>{restRunning ? 'Parar descanso' : 'Iniciar descanso'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Adicionar exercicio</Text>
        <TextInput
          placeholder="Nome do exercicio"
          placeholderTextColor="#8AA2C7"
          value={exerciseNameInput}
          onChangeText={setExerciseNameInput}
          style={styles.input}
        />
        <TouchableOpacity
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
        <View style={styles.chipsWrap}>
          {CATEGORIES.map((category) => (
            <TouchableOpacity
              key={category.key}
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
            <TouchableOpacity key={name} style={styles.suggestionChip} onPress={() => addExercise(name)}>
              <Text style={styles.suggestionChipText}>{name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {selectedExercises.length ? (
        <View style={styles.cardGreen}>
          <Text style={styles.cardTitleGreen}>Sugestoes para continuar</Text>
          <View style={styles.chipsWrap}>
            {suggestions.map((name) => (
              <TouchableOpacity key={name} style={styles.suggestionChipGreen} onPress={() => addExercise(name)}>
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
          <View key={exerciseName} style={styles.exerciseCard}>
            <Text style={styles.exerciseName}>{exerciseName}</Text>
            <Text style={styles.progressText}>Serie {setProgress.nextSet}/3</Text>

            <View style={styles.row}>
              <TextInput
                keyboardType="numeric"
                placeholder="Carga"
                placeholderTextColor="#8AA2C7"
                value={values.weight}
                onChangeText={(text) => setField(exerciseName, 'weight', text)}
                style={styles.input}
              />
              <TextInput
                keyboardType="numeric"
                placeholder="Reps"
                placeholderTextColor="#8AA2C7"
                value={values.reps}
                onChangeText={(text) => setField(exerciseName, 'reps', text)}
                style={styles.input}
              />
            </View>

            <View style={styles.row}>
              <TouchableOpacity style={styles.successButton} onPress={() => submitSet(exerciseName, false)}>
                <Text style={styles.successText}>+ serie</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.failButton} onPress={() => submitSet(exerciseName, true)}>
                <Text style={styles.failText}>- serie</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.restButton} onPress={restRunning ? stopRest : startRest}>
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
    backgroundColor: '#0F172A',
  },
  container: {
    flexGrow: 1,
    backgroundColor: '#0F172A',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 84,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 12,
    color: '#9FB3D9',
    fontSize: 14,
  },
  timerBox: {
    backgroundColor: '#13294B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#355B8E',
    padding: 14,
    marginBottom: 10,
  },
  timerLabel: {
    color: '#AAC7F4',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  timerValue: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
  },
  timerAction: {
    marginTop: 8,
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  timerActionStop: {
    backgroundColor: '#B63A3A',
  },
  timerActionText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#111D35',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A446D',
    padding: 12,
    marginBottom: 10,
  },
  cardGreen: {
    backgroundColor: '#0F2A1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2D6E53',
    padding: 12,
    marginBottom: 10,
  },
  cardTitle: {
    color: '#DCE8FF',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  cardTitleGreen: {
    color: '#BDEFD7',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#4B6896',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0F1D36',
    color: '#F2F7FF',
  },
  addButton: {
    marginTop: 8,
    backgroundColor: '#2B6CB0',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 10,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#4E6FA4',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: '#EAF2FF',
    borderColor: '#EAF2FF',
  },
  chipText: {
    color: '#AECBFF',
    fontWeight: '700',
    fontSize: 12,
  },
  chipTextActive: {
    color: '#10386D',
  },
  suggestionChip: {
    backgroundColor: '#203659',
    borderWidth: 1,
    borderColor: '#395B8B',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestionChipText: {
    color: '#D7E7FF',
    fontSize: 12,
    fontWeight: '700',
  },
  suggestionChipGreen: {
    backgroundColor: '#1C4C39',
    borderWidth: 1,
    borderColor: '#2D6E53',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  suggestionChipGreenText: {
    color: '#DDF8EB',
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseCard: {
    backgroundColor: '#111D35',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2A446D',
    padding: 12,
    marginBottom: 10,
  },
  exerciseName: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 2,
  },
  progressText: {
    color: '#8CC7FF',
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
    backgroundColor: '#28A765',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  failButton: {
    flexGrow: 1,
    minWidth: 88,
    backgroundColor: '#B63A3A',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  restButton: {
    flexGrow: 1,
    minWidth: 88,
    backgroundColor: '#274870',
    borderWidth: 1,
    borderColor: '#4F78AA',
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
    color: '#E4F1FF',
    fontWeight: '800',
    textTransform: 'lowercase',
  },
});
