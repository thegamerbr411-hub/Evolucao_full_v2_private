import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';

export default function WorkoutsHubScreen({ navigation }) {
  const { getTodayWorkoutSummary, getTodayWorkout } = useApp();
  const summary = getTodayWorkoutSummary();
  const todayWorkout = getTodayWorkout();

  return (
    <View style={styles.container}>
      <ScreenHeader title="Treinos" subtitle="Planeje, execute e ajuste o treino do dia." />

      <AppCard>
        <Text style={styles.cardTitle}>Hoje</Text>
        <Text style={styles.cardLine}>Exercicios planejados: {todayWorkout.length}</Text>
        <Text style={styles.cardLine}>Series registradas: {summary.guidedSets}</Text>
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
});
