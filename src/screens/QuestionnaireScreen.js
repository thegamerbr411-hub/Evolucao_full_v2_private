import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useApp } from '../context/AppContext';

const goals = [
  { key: 'emagrecer', label: 'Emagrecer' },
  { key: 'ganhar_massa', label: 'Ganhar massa' },
];

const levels = [
  { key: 'iniciante', label: 'Iniciante' },
  { key: 'intermediario', label: 'Intermediario' },
];

const trainingDays = [
  { key: '3', label: '3x' },
  { key: '4', label: '4x' },
  { key: '5', label: '5x' },
  { key: '6', label: '6x' },
  { key: 'custom', label: 'Personalizado' },
];

function OptionGroup({ title, options, selected, onSelect }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{title}</Text>
      <View style={styles.rowWrap}>
        {options.map((option) => {
          const isSelected = selected === option.key;
          return (
            <TouchableOpacity
              key={option.key}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => onSelect(option.key)}
            >
              <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function NumberField({ label, value, onChangeText, placeholder, testID }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType="numeric"
        style={styles.input}
      />
    </View>
  );
}

export default function QuestionnaireScreen({ navigation }) {
  const { saveQuestionnaire } = useApp();

  const [goal, setGoal] = useState('emagrecer');
  const [level, setLevel] = useState('iniciante');
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [height, setHeight] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState('3');
  const [customDaysPerWeek, setCustomDaysPerWeek] = useState('');

  const handleSubmit = () => {
    const trainingDaysValue = Number(daysPerWeek === 'custom' ? customDaysPerWeek : daysPerWeek);
    const payload = {
      goal,
      level,
      currentWeight: Number(currentWeight),
      targetWeight: Number(targetWeight),
      height: Number(height),
      trainingDaysPerWeek: trainingDaysValue,
    };

    const isInvalid =
      !payload.currentWeight ||
      !payload.targetWeight ||
      !payload.height ||
      payload.currentWeight < 30 ||
      payload.currentWeight > 300 ||
      payload.targetWeight < 30 ||
      payload.targetWeight > 300 ||
      payload.height < 120 ||
      payload.height > 230 ||
      !payload.trainingDaysPerWeek ||
      payload.trainingDaysPerWeek < 2 ||
      payload.trainingDaysPerWeek > 7;

    if (isInvalid) {
      Alert.alert('Dados invalidos', 'Preencha os campos com valores validos para continuar.');
      return;
    }

    try {
      saveQuestionnaire(payload);
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    } catch (_error) {
      Alert.alert('Erro ao salvar', 'Nao foi possivel concluir o questionario agora. Tente novamente.');
    }
  };

  return (
    <ScrollView
      testID="scroll-container"
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View testID="questionnaire-screen">
      <Text style={styles.title}>Questionario Inteligente</Text>
      <Text style={styles.subtitle}>Monte seu plano inicial em menos de 1 minuto.</Text>

      <OptionGroup title="Objetivo" options={goals} selected={goal} onSelect={setGoal} />
      <OptionGroup title="Nivel" options={levels} selected={level} onSelect={setLevel} />

      <NumberField
        label="Peso atual (kg)"
        value={currentWeight}
        onChangeText={setCurrentWeight}
        placeholder="Ex: 78"
        testID="input-peso-atual"
      />

      <NumberField
        label="Peso meta (kg)"
        value={targetWeight}
        onChangeText={setTargetWeight}
        placeholder="Ex: 72"
        testID="input-peso-meta"
      />

      <NumberField
        label="Altura (cm)"
        value={height}
        onChangeText={setHeight}
        placeholder="Ex: 175"
        testID="input-altura"
      />

      <View style={styles.group}>
        <Text style={styles.label}>Dias de treino por semana</Text>
        <View style={styles.rowWrap}>
          {trainingDays.map((day) => {
            const selected = daysPerWeek === day.key;
            return (
              <TouchableOpacity
                key={day.key}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => setDaysPerWeek(day.key)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{day.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {daysPerWeek === 'custom' ? (
          <TextInput
            value={customDaysPerWeek}
            onChangeText={setCustomDaysPerWeek}
            placeholder="Quantos dias por semana? (2 a 7)"
            keyboardType="numeric"
            style={[styles.input, { marginTop: 10 }]}
          />
        ) : null}
      </View>

      <TouchableOpacity testID="btn-continuar" style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Gerar plano automatico</Text>
      </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 120,
    backgroundColor: '#F7F8FA',
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1B1E28',
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
    marginBottom: 24,
    color: '#4F5565',
  },
  group: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    color: '#303545',
    fontSize: 14,
    fontWeight: '600',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C6CDDB',
    backgroundColor: '#FFFFFF',
  },
  chipSelected: {
    borderColor: '#0A84FF',
    backgroundColor: '#EAF3FF',
  },
  chipText: {
    color: '#2E3342',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#0A5EC0',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: '#C6CDDB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    fontSize: 15,
  },
  button: {
    marginTop: 16,
    backgroundColor: '#141A2A',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
