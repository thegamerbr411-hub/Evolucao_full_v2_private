import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, PrimaryButton, ScreenHeader } from '../components/ui';
import { colors, spacing } from '../theme';

const GOALS = [
  { key: 'emagrecer', label: 'Perda de gordura' },
  { key: 'ganhar_massa', label: 'Ganho de massa' },
  { key: 'recomposicao', label: 'Recomposicao corporal' },
];

const LEVELS = [
  { key: 'iniciante', label: 'Iniciante' },
  { key: 'intermediario', label: 'Intermediario' },
  { key: 'avancado', label: 'Avancado' },
];

export default function ProfileScreen() {
  const {
    profile,
    plan,
    history,
    userRoutines,
    getWorkoutGamification,
    updateProfileSettings,
  } = useApp();

  const [goal, setGoal] = useState(profile?.goal || 'recomposicao');
  const [level, setLevel] = useState(profile?.level || 'iniciante');
  const [trainingDays, setTrainingDays] = useState(String(profile?.trainingDaysPerWeek || 3));
  const [currentWeight, setCurrentWeight] = useState(String(profile?.currentWeight || 70));
  const [targetWeight, setTargetWeight] = useState(String(profile?.targetWeight || 70));

  const gamification = getWorkoutGamification();

  const historySummary = useMemo(() => {
    const recent = history.slice(0, 7);
    const trainedDays = recent.filter((item) => item.trained).length;
    const avgProtein = recent.length
      ? Math.round(recent.reduce((acc, item) => acc + Number(item.protein || 0), 0) / recent.length)
      : 0;

    return {
      days: recent.length,
      trainedDays,
      avgProtein,
    };
  }, [history]);

  const saveProfile = () => {
    const result = updateProfileSettings({
      goal,
      level,
      trainingDaysPerWeek: Number(trainingDays || 3),
      currentWeight: Number(currentWeight || 0),
      targetWeight: Number(targetWeight || 0),
    });

    if (!result.ok) {
      Alert.alert('Nao foi possivel salvar', result.message);
      return;
    }

    Alert.alert('Perfil atualizado', 'Suas configuracoes ja estao valendo no coach e nas rotinas.');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="Perfil" subtitle="Centro de controle da sua estrategia e evolucao." />

      <AppCard>
        <Text style={styles.cardLabel}>Meta principal</Text>
        <View style={styles.chipsRow}>
          {GOALS.map((item) => (
            <TouchableOpacity key={item.key} style={[styles.chip, goal === item.key ? styles.chipActive : null]} onPress={() => setGoal(item.key)}>
              <Text style={[styles.chipText, goal === item.key ? styles.chipTextActive : null]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Nivel</Text>
        <View style={styles.chipsRow}>
          {LEVELS.map((item) => (
            <TouchableOpacity key={item.key} style={[styles.chip, level === item.key ? styles.chipActive : null]} onPress={() => setLevel(item.key)}>
              <Text style={[styles.chipText, level === item.key ? styles.chipTextActive : null]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Frequencia semanal</Text>
        <TextInput value={trainingDays} onChangeText={setTrainingDays} keyboardType="numeric" style={styles.input} />
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Peso atual (kg)</Text>
        <TextInput value={currentWeight} onChangeText={setCurrentWeight} keyboardType="numeric" style={styles.input} />
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Peso alvo (kg)</Text>
        <TextInput value={targetWeight} onChangeText={setTargetWeight} keyboardType="numeric" style={styles.input} />
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Historico recente</Text>
        <Text style={styles.metric}>Dias com registro: {historySummary.days}</Text>
        <Text style={styles.metric}>Dias treinados: {historySummary.trainedDays}</Text>
        <Text style={styles.metric}>Proteina media: {historySummary.avgProtein}g</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Evolucao e social (base)</Text>
        <Text style={styles.metric}>Nivel {gamification.level} · XP {gamification.xp}</Text>
        <Text style={styles.metric}>Streak: {gamification.streakDays} dias</Text>
        <Text style={styles.metric}>Rotinas salvas: {Array.isArray(userRoutines) ? userRoutines.length : 0}</Text>
        <Text style={styles.metric}>Comunidade: acompanhe sua evolucao e consistencia semanal.</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Plano atual</Text>
        <Text style={styles.metric}>Calorias alvo: {Number(plan?.caloriesPerDay || 0)} kcal/dia</Text>
        <Text style={styles.metric}>Agua alvo: {Number(plan?.waterLitersPerDay || 0)}L/dia</Text>
        <Text style={styles.metric}>Estrategia: {String(plan?.strategy || 'recomposicao')}</Text>
      </AppCard>

      <PrimaryButton title="Salvar perfil" onPress={saveProfile} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  cardLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: colors.textPrimary,
    backgroundColor: '#141922',
  },
  metric: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
});
