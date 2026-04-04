import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, MetricText, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, radius, spacing } from '../theme';

export default function HomeScreen({ navigation }) {
  const {
    plan,
    history,
    workoutLogs,
    gamification,
    getSmartWorkoutRecommendation,
    getDailyMacroTargets,
  } = useApp();

  const today = useMemo(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const smartWorkout = useMemo(() => getSmartWorkoutRecommendation(), [getSmartWorkoutRecommendation]);
  const macroTargets = useMemo(() => getDailyMacroTargets(), [getDailyMacroTargets]);

  const todayHistory = history.find((item) => item.date === today) || null;
  const proteinToday = Number(todayHistory?.protein || 0);
  const proteinTarget = Number(macroTargets?.protein || 0);
  const waterToday = Number(todayHistory?.waterMl || 0);
  const waterTarget = Number((plan?.waterLitersPerDay || 0) * 1000);
  const waterPercent = waterTarget > 0 ? Math.min(1, waterToday / waterTarget) : 0;
  const proteinRemaining = Math.max(0, proteinTarget - proteinToday);
  const waterRemaining = Math.max(0, waterTarget - waterToday);
  const monthPrefix = today.slice(0, 7);
  const monthlyWorkoutDays = new Set(
    workoutLogs
      .filter((item) => String(item.date || '').startsWith(monthPrefix))
      .map((item) => item.date)
  ).size;
  const streakDays = Number(gamification?.streakDays || 0);
  const trainedToday = workoutLogs.some((item) => item.date === today);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="Hoje" subtitle="Prioridades do dia em um so lugar." />

      <AppCard>
        <Text style={styles.cardLabel}>Treino do dia</Text>
        <Text style={styles.cardMain}>{smartWorkout?.title}</Text>
        <Text style={styles.cardSub}>{smartWorkout?.justification}</Text>
        <PrimaryButton title="Iniciar treino" onPress={() => navigation.navigate('TreinoHoje')} style={styles.primaryButton} />
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Proteina</Text>
        <MetricText value={`${proteinToday} / ${proteinTarget}g`} label="Meta diaria" />
        <Text style={styles.cardSub}>
          {proteinRemaining > 0
            ? `Faltam ${proteinRemaining}g de proteina - bora fechar isso hoje.`
            : 'Meta de proteina fechada hoje. Excelente consistencia.'}
        </Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Agua</Text>
        <MetricText value={`${waterToday} / ${waterTarget || 0}ml`} label="Meta diaria" />
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(waterPercent * 100)}%` }]} />
        </View>
        <Text style={styles.cardSub}>
          {waterRemaining > 0
            ? `Faltam ${waterRemaining}ml de agua - mais um copo e voce avanca.`
            : 'Meta de hidratacao batida. Mantenha o ritmo.'}
        </Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Progresso</Text>
        <MetricText value={`🔥 ${streakDays} dias`} label="Streak atual" />
        <Text style={styles.streakCopy}>
          {streakDays > 0 && !trainedToday
            ? 'Se nao fizer hoje, zera.'
            : 'Continue amanha para nao quebrar.'}
        </Text>
        <Text style={styles.cardSub}>📈 {monthlyWorkoutDays} dias treinados no mes</Text>
      </AppCard>

      <SecondaryButton title="Ver detalhes" onPress={() => navigation.navigate('Insights')} />
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
    marginBottom: spacing.xs,
  },
  cardMain: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: '800',
  },
  cardSub: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  streakCopy: {
    marginTop: spacing.xs,
    color: colors.warning,
    fontSize: 12,
    fontWeight: '800',
  },
  primaryButton: {
    marginTop: spacing.sm,
  },
  progressTrack: {
    marginTop: spacing.sm,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
  },
});
