import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';

export default function WorkoutsHubScreen({ navigation }) {
  const { getTodayWorkoutSummary, getTodayWorkout, getRecommendedWorkoutV4 } = useApp();
  const summary = getTodayWorkoutSummary();
  const todayWorkout = getTodayWorkout();
  const recommended = getRecommendedWorkoutV4();

  return (
    <View style={styles.container}>
      <ScreenHeader title="Treinos" subtitle="Planeje, execute e ajuste o treino do dia." />

      <AppCard>
        <Text style={styles.cardTitle}>Hoje</Text>
        <Text style={styles.cardLine}>Exercicios planejados: {todayWorkout.length}</Text>
        <Text style={styles.cardLine}>Series registradas: {summary.guidedSets}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardTitle}>Motor inteligente V4</Text>
        <Text style={styles.cardLine}>Treino recomendado: {recommended.title}</Text>
        <Text style={styles.cardLine}>Fonte: {recommended.source} | Confianca: {Math.round(Number(recommended.confidenceScore || 0) * 100)}%</Text>
        {(recommended.decisionReasons || []).map((reason) => (
          <Text key={reason} style={styles.reasonLine}>• {reason}</Text>
        ))}
        {(recommended.replacements || []).map((change, index) => (
          <Text key={`${change.from}-${change.to}-${index}`} style={styles.replacementLine}>Adaptacao automatica: {change.from} {'=>'} {change.to}</Text>
        ))}
      </AppCard>

      <PrimaryButton title="Iniciar treino recomendado" onPress={() => navigation.navigate('TreinoHoje')} style={styles.primaryButton} />

      <SecondaryButton title="Treino livre" onPress={() => navigation.navigate('TreinoLivre')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
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
