import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';

export function WorkoutsHubView({ navigation, summary, todayWorkout, recommended }) {
  const safeSummary = summary || { guidedSets: 0 };
  const safeTodayWorkout = Array.isArray(todayWorkout) ? todayWorkout : [];
  const safeRecommended = recommended || { title: 'Sem recomendacao', source: 'fallback', confidenceScore: 0, decisionReasons: [], replacements: [] };

  return (
    <ScrollView testID="screen-treinos" contentContainerStyle={styles.container}>
      <ScreenHeader title="Treinos" subtitle="Planeje, execute e ajuste o treino do dia." />

      <AppCard>
        <Text style={styles.cardTitle}>Hoje</Text>
        <Text style={styles.cardLine}>Exercicios planejados: {safeTodayWorkout.length}</Text>
        <Text style={styles.cardLine}>Series registradas: {safeSummary.guidedSets}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>Motor inteligente V4</Text>
        <Text style={styles.cardLine}>Treino recomendado: {safeRecommended.title}</Text>
        <Text style={styles.cardLine}>Fonte: {safeRecommended.source} | Confianca: {Math.round(Number(safeRecommended.confidenceScore || 0) * 100)}%</Text>
        {(safeRecommended.decisionReasons || []).map((reason) => (
          <Text key={reason} style={styles.reasonLine}>* {reason}</Text>
        ))}
        {(safeRecommended.replacements || []).map((change, index) => (
          <Text key={`${change.from}-${change.to}-${index}`} style={styles.replacementLine}>Adaptacao automatica: {`${change.from} para ${change.to}`}</Text>
        ))}
      </AppCard>

      <PrimaryButton testID="btn-iniciar-treino" title="Iniciar treino recomendado" onPress={() => navigation.navigate('TreinoHoje')} style={styles.primaryButton} />
      <SecondaryButton title="Treino livre" onPress={() => navigation.navigate('TreinoLivre')} />
    </ScrollView>
  );
}

export default function WorkoutsHubScreen({ navigation }) {
  const { getTodayWorkoutSummary, getTodayWorkout, getRecommendedWorkoutV4 } = useApp();
  const summary = getTodayWorkoutSummary();
  const todayWorkout = getTodayWorkout();
  const recommended = getRecommendedWorkoutV4();

  return <WorkoutsHubView navigation={navigation} summary={summary} todayWorkout={todayWorkout} recommended={recommended} />;
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  cardLine: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '600',
  },
  primaryButton: {
    marginBottom: 8,
  },
  reasonLine: {
    color: '#A7C7F7',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  replacementLine: {
    color: '#FDE68A',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '700',
  },
});
