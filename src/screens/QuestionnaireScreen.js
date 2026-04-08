import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useApp } from '../context/AppContext';
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
  { key: '3', label: '3x' },
  { key: '4', label: '4x' },
  { key: '5', label: '5x' },
  { key: '6', label: '6x' },
  { key: 'custom', label: 'Personalizado' },
];

const onboardingSlides = [
  {
    key: 'slide-1',
    title: 'Seu treino. Sua evolução.',
    subtitle: 'Acompanhe tudo em um so lugar.',
  },
  {
    key: 'slide-2',
    title: 'Controle sua alimentacao',
    subtitle: 'Proteina, agua e calorias sem complicacao.',
  },
  {
    key: 'slide-3',
    title: 'Seu coach diario',
    subtitle: 'O app te diz exatamente o que fazer.',
  },
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
  const [activeSlide, setActiveSlide] = useState(0);

  const [goal, setGoal] = useState('emagrecer');
  const [level, setLevel] = useState('iniciante');
  const [currentWeight, setCurrentWeight] = useState('');
  const [targetWeight, setTargetWeight] = useState('');
  const [height, setHeight] = useState('');
  const [daysPerWeek, setDaysPerWeek] = useState('3');
  const [customDaysPerWeek, setCustomDaysPerWeek] = useState('');

  const moveSlide = (direction) => {
    if (direction === 'next') {
      setActiveSlide((prev) => Math.min(prev + 1, onboardingSlides.length - 1));
      return;
    }

    setActiveSlide((prev) => Math.max(prev - 1, 0));
  };

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
      <Text style={styles.title}>Monte seu plano inicial</Text>
      <Text style={styles.subtitle}>Leva menos de 1 minuto para personalizar sua rotina.</Text>

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

      <View style={styles.onboardingCard}>
        <FlatList
          data={onboardingSlides}
          horizontal
          pagingEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          extraData={activeSlide}
          keyExtractor={(item) => item.key}
          renderItem={({ item, index }) => {
            const visible = index === activeSlide;
            return (
              <View style={styles.slide}>
                <Text style={styles.slideEyebrow}>Onboarding</Text>
                <Text style={styles.slideTitle}>{visible ? item.title : ' '}</Text>
                <Text style={styles.slideSubtitle}>{visible ? item.subtitle : ' '}</Text>
              </View>
            );
          }}
        />
        <View style={styles.slideDots}>
          {onboardingSlides.map((item, index) => (
            <View key={item.key} style={[styles.dot, index === activeSlide && styles.dotActive]} />
          ))}
        </View>
        <View style={styles.slideActions}>
          <TouchableOpacity onPress={() => moveSlide('back')} disabled={activeSlide === 0} style={[styles.slideButton, activeSlide === 0 && styles.slideButtonDisabled]}>
            <Text style={styles.slideButtonText}>Voltar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => moveSlide('next')} disabled={activeSlide === onboardingSlides.length - 1} style={[styles.slideButton, activeSlide === onboardingSlides.length - 1 && styles.slideButtonDisabled]}>
            <Text style={styles.slideButtonText}>Avancar</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity testID="btn-continuar" style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>COMEÇAR AGORA</Text>
      </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: 120,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  onboardingCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  slide: {
    width: 320,
    minHeight: 120,
    justifyContent: 'center',
  },
  slideEyebrow: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  slideTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  slideSubtitle: {
    ...typography.body,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  slideDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: '#2B3341',
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 18,
  },
  slideActions: {
    marginTop: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  slideButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#314058',
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#101826',
  },
  slideButtonDisabled: {
    opacity: 0.4,
  },
  slideButtonText: {
    color: '#D8E7FF',
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    ...typography.title,
  },
  subtitle: {
    ...typography.body,
    marginTop: 8,
    marginBottom: 24,
    color: colors.textSecondary,
  },
  group: {
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
    color: colors.textPrimary,
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
    borderColor: '#364155',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#0F1724',
    color: '#FFFFFF',
    fontSize: 15,
  },
  button: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonText: {
    color: '#000000',
    fontWeight: '700',
    fontSize: 16,
  },
});
