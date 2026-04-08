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
import { AppCard, PrimaryButton, ScreenHeader } from '../components/ui';
import { colors, radius, spacing, typography } from '../theme';

const goals = [
  { key: 'emagrecer', label: 'Emagrecer' },
  { key: 'ganhar_massa', label: 'Ganhar massa' },
];

const levels = [
  { key: 'iniciante', label: 'Iniciante' },
  { key: 'intermediario', label: 'Intermediario' },
];

const trainingDays = [
  { key: '2', label: '2x' },
  { key: '3', label: '3x' },
  { key: '4', label: '4x' },
  { key: '5', label: '5x' },
  { key: '6', label: '6x' },
  { key: '7', label: '7x' },
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
  const [weight, setWeight] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState('3');
  const [targetWeight, setTargetWeight] = useState('');
  const [height, setHeight] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const handleSubmit = () => {
    const currentWeight = Number(weight);
    const trainingDaysValue = Number(daysPerWeek);
    const safeTargetWeight = Number(targetWeight || weight);
    const safeHeight = Number(height || 170);

    const payload = {
      goal,
      level,
      currentWeight,
      targetWeight: safeTargetWeight,
      height: safeHeight,
      trainingDaysPerWeek: trainingDaysValue,
    };

    if (!payload.currentWeight || payload.currentWeight < 30 || payload.currentWeight > 300) {
      Alert.alert('Dados invalidos', 'Informe um peso atual valido.');
      return;
    }

    if (!payload.trainingDaysPerWeek || payload.trainingDaysPerWeek < 2 || payload.trainingDaysPerWeek > 7) {
      Alert.alert('Dados invalidos', 'Escolha de 2 a 7 dias por semana.');
      return;
    }

    if (payload.targetWeight < 30 || payload.targetWeight > 300 || payload.height < 120 || payload.height > 230) {
      Alert.alert('Dados invalidos', 'Ajuste peso meta e altura nas opcoes avancadas.');
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
    >
      <View testID="questionnaire-screen">
      <ScreenHeader title="Comece em 30 segundos" subtitle="So o essencial para criar seu plano." />

      <AppCard>
        <OptionGroup title="Objetivo" options={goals} selected={goal} onSelect={setGoal} />
        <OptionGroup title="Nivel" options={levels} selected={level} onSelect={setLevel} />

        <NumberField
          label="Peso atual"
          value={weight}
          onChangeText={setWeight}
          placeholder="Ex: 78"
          testID="input-peso-atual"
        />

        <Text style={styles.label}>Dias por semana</Text>
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

        <TouchableOpacity onPress={() => setAdvancedOpen((value) => !value)} style={styles.moreButton}>
          <Text style={styles.moreText}>{advancedOpen ? 'Ocultar opcoes' : 'Mais opcoes'}</Text>
        </TouchableOpacity>

        {advancedOpen ? (
          <View style={styles.advancedWrap}>
            <NumberField
              label="Peso meta (opcional)"
              value={targetWeight}
              onChangeText={setTargetWeight}
              placeholder="Ex: 72"
              testID="input-peso-meta"
            />

            <NumberField
              label="Altura (opcional)"
              value={height}
              onChangeText={setHeight}
              placeholder="Ex: 175"
              testID="input-altura"
            />

            <Text style={styles.advancedNote}>
              Se preferir, finalize agora. Voce pode ajustar isso depois nas configuracoes.
            </Text>
          </View>
        ) : null}
      </AppCard>

      <PrimaryButton testID="btn-continuar" title="Comecar agora" onPress={handleSubmit} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  group: {
    marginTop: spacing.xs,
  },
  label: {
    marginBottom: spacing.xs,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: '#364155',
    backgroundColor: '#0F1724',
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: '#0F2218',
  },
  chipText: {
    color: '#D3D9E8',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#B7F7C9',
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    color: '#FFFFFF',
    fontSize: 15,
  },
  moreButton: {
    marginTop: spacing.md,
  },
  moreText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  advancedWrap: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  advancedNote: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 12,
    ...typography.body,
  },
});
