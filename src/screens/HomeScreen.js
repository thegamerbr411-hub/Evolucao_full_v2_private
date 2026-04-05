import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useInsights, useWorkout, useNutrition } from '../hooks';
import { AppCard, MetricText, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, radius, spacing } from '../theme';

export default function HomeScreen({ navigation }) {
  const { getDailyMacroTargets, getNutritionFeedback, history, plan, workoutLogs } = useNutrition();
  const { gamification, getSmartWorkoutRecommendation } = useWorkout();
  const { getPerformanceRecoveryInsight } = useInsights();

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
  const trainedToday = workoutLogs.some((item) => item.date === today);
  const nutritionFeedback = useMemo(
    () => getNutritionFeedback({ proteinConsumed: proteinToday, caloriesConsumed: Number(todayHistory?.calories || 0), trainedToday }),
    [getNutritionFeedback, proteinToday, todayHistory?.calories, trainedToday]
  );
  const recoveryInsight = useMemo(
    () => getPerformanceRecoveryInsight(),
    [getPerformanceRecoveryInsight, history, workoutLogs]
  );
  const waterRemaining = Math.max(0, waterTarget - waterToday);
  const monthPrefix = today.slice(0, 7);
  const monthlyWorkoutDays = new Set(
    workoutLogs
      .filter((item) => String(item.date || '').startsWith(monthPrefix))
      .map((item) => item.date)
  ).size;
  const streakDays = Number(gamification?.streakDays || 0);

  const weekDates = useMemo(
    () => Array.from(new Set(history.slice(0, 7).map((item) => String(item.date || '')).filter(Boolean)))
      .sort((a, b) => String(a).localeCompare(String(b))),
    [history]
  );

  const weeklyTrendRows = useMemo(() => {
    if (!weekDates.length) {
      return [];
    }

    const rows = weekDates.map((date) => {
      const dayHistory = history.find((item) => item.date === date) || {};
      const protein = Number(dayHistory.protein || 0);
      const trainingLoad = workoutLogs
        .filter((item) => String(item.date || '') === date)
        .reduce((acc, item) => acc + Number(item.weight || 0) * Number(item.reps || 0), 0);

      return {
        date,
        protein,
        trainingLoad,
      };
    });

    const maxProtein = Math.max(1, ...rows.map((item) => item.protein));
    const maxLoad = Math.max(1, ...rows.map((item) => item.trainingLoad));

    return rows.map((item) => ({
      ...item,
      proteinPct: Math.max(4, Math.round((item.protein / maxProtein) * 100)),
      loadPct: Math.max(4, Math.round((item.trainingLoad / maxLoad) * 100)),
    }));
  }, [weekDates, history, workoutLogs]);

  const intelligentShortcut = useMemo(() => {
    if (recoveryInsight?.tone === 'warning' || nutritionFeedback?.urgency === 'alta') {
      return {
        title: 'Adicionar proteina agora',
        subtitle: `Atalho rapido: faltam ${Math.max(0, Number(nutritionFeedback?.missingProtein || proteinRemaining))}g hoje.`,
        onPress: () => navigation.navigate('Scanner'),
      };
    }

    return {
      title: 'Ver detalhes',
      subtitle: 'Acompanhar insights completos e histórico semanal.',
      onPress: () => navigation.navigate('Insights'),
    };
  }, [recoveryInsight?.tone, nutritionFeedback?.urgency, nutritionFeedback?.missingProtein, proteinRemaining, navigation]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="Hoje" subtitle="Prioridades do dia em um so lugar." />

      <AppCard style={styles.heroCard}>
        <Text style={styles.cardLabel}>Insight de performance</Text>
        <Text style={[
          styles.heroTitle,
          recoveryInsight?.tone === 'warning'
            ? styles.heroTitleWarning
            : recoveryInsight?.tone === 'success'
            ? styles.heroTitleSuccess
            : null,
        ]}>
          {recoveryInsight?.title || 'Sem insight no momento'}
        </Text>
        <Text style={styles.cardSub}>{recoveryInsight?.message || 'Continue registrando para liberar recomendações mais precisas.'}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Treino do dia</Text>
        <Text style={styles.cardMain}>{smartWorkout?.title}</Text>
        <Text style={styles.cardSub}>{smartWorkout?.justification}</Text>
        <PrimaryButton title="Iniciar treino" onPress={() => navigation.navigate('TreinoHoje')} style={styles.primaryButton} />
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Proteina</Text>
        <MetricText value={`${proteinToday} / ${proteinTarget}g`} label="Meta diaria" />
        <Text style={[styles.cardSub, nutritionFeedback?.urgency === 'alta' ? styles.proteinHighUrgency : nutritionFeedback?.urgency === 'media' ? styles.proteinMediumUrgency : null]}>
          {nutritionFeedback?.title || (proteinRemaining > 0
            ? `Faltam ${proteinRemaining}g de proteina - bora fechar isso hoje.`
            : 'Meta de proteina fechada hoje. Excelente consistencia.')}
        </Text>
        <Text style={styles.cardSub}>{nutritionFeedback?.suggestion || ''}</Text>
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

      <AppCard>
        <Text style={styles.cardLabel}>Trend proteína x treino</Text>
        <Text style={styles.cardSub}>Comparativo dos ultimos {weeklyTrendRows.length || 0} dias</Text>
        {!weeklyTrendRows.length ? (
          <Text style={styles.cardSub}>Sem dados suficientes para visualizar tendência semanal.</Text>
        ) : (
          <View style={styles.trendWrap}>
            {weeklyTrendRows.map((row) => (
              <View key={`trend-${row.date}`} style={styles.trendRow}>
                <Text style={styles.trendDate}>{row.date.slice(5)}</Text>
                <View style={styles.trendBars}>
                  <View style={styles.trendTrack}>
                    <View style={[styles.trendProtein, { width: `${row.proteinPct}%` }]} />
                  </View>
                  <View style={styles.trendTrack}>
                    <View style={[styles.trendLoad, { width: `${row.loadPct}%` }]} />
                  </View>
                </View>
                <View style={styles.trendMetaWrap}>
                  <Text style={styles.trendMeta}>{Math.round(row.protein)}g</Text>
                  <Text style={styles.trendMeta}>{Math.round(row.trainingLoad)}kg</Text>
                </View>
              </View>
            ))}
            <View style={styles.trendLegend}>
              <Text style={styles.legendProtein}>Proteína</Text>
              <Text style={styles.legendLoad}>Volume treino</Text>
            </View>
          </View>
        )}
      </AppCard>

      <PrimaryButton title={intelligentShortcut.title} onPress={intelligentShortcut.onPress} />
      <Text style={styles.shortcutHint}>{intelligentShortcut.subtitle}</Text>
      <SecondaryButton title="Ver insights completos" onPress={() => navigation.navigate('Insights')} />
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
  heroCard: {
    borderWidth: 1,
    borderColor: '#3F6CA0',
    backgroundColor: '#122238',
  },
  heroTitle: {
    color: '#BFDBFE',
    fontSize: 17,
    fontWeight: '900',
  },
  heroTitleWarning: {
    color: '#FCD34D',
  },
  heroTitleSuccess: {
    color: '#86EFAC',
  },
  streakCopy: {
    marginTop: spacing.xs,
    color: colors.warning,
    fontSize: 12,
    fontWeight: '800',
  },
  proteinHighUrgency: {
    color: '#FCD34D',
    fontWeight: '800',
  },
  proteinMediumUrgency: {
    color: '#BFDBFE',
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
  trendWrap: {
    marginTop: spacing.sm,
    gap: 8,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendDate: {
    width: 42,
    color: '#AFC6E6',
    fontSize: 11,
    fontWeight: '800',
  },
  trendBars: {
    flex: 1,
    gap: 4,
  },
  trendTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: '#223047',
    overflow: 'hidden',
  },
  trendProtein: {
    height: '100%',
    backgroundColor: '#4ADE80',
    borderRadius: radius.pill,
  },
  trendLoad: {
    height: '100%',
    backgroundColor: '#60A5FA',
    borderRadius: radius.pill,
  },
  trendMetaWrap: {
    width: 62,
    alignItems: 'flex-end',
  },
  trendMeta: {
    color: '#D8E7FF',
    fontSize: 10,
    fontWeight: '700',
  },
  trendLegend: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendProtein: {
    color: '#86EFAC',
    fontSize: 11,
    fontWeight: '800',
  },
  legendLoad: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
  },
  shortcutHint: {
    marginTop: 8,
    marginBottom: 6,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
});
