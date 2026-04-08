import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, ScreenHeader } from '../components/ui';
import { calculateVolume, getDailyPriority } from '../services/performanceEngine';
import { colors, spacing } from '../theme';

export default function InsightsScreen() {
  const { getWeeklySummary, getWeeklyInsight, getWeeklyMacroSummary, getRecentHistory, workoutLogs } = useApp();

  const weekly = useMemo(() => getWeeklySummary(), [getWeeklySummary]);
  const insight = useMemo(() => getWeeklyInsight(), [getWeeklyInsight]);
  const macros = useMemo(() => getWeeklyMacroSummary(), [getWeeklyMacroSummary]);
  const history = useMemo(() => getRecentHistory(), [getRecentHistory]);

  const todayKey = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const dashboardStats = useMemo(() => {
    const safeLogs = Array.isArray(workoutLogs) ? workoutLogs : [];
    const getDateShiftKey = (baseDate, shiftDays) => {
      const next = new Date(baseDate);
      next.setDate(next.getDate() + shiftDays);
      const y = next.getFullYear();
      const m = String(next.getMonth() + 1).padStart(2, '0');
      const d = String(next.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const today = new Date();
    const currentWeekKeys = new Set(Array.from({ length: 7 }, (_, i) => getDateShiftKey(today, -i)));
    const previousWeekKeys = new Set(Array.from({ length: 7 }, (_, i) => getDateShiftKey(today, -(i + 7))));

    const weekLogs = safeLogs.filter((item) => currentWeekKeys.has(String(item.date || '')));
    const prevWeekLogs = safeLogs.filter((item) => previousWeekKeys.has(String(item.date || '')));

    const weeklyVolume = Math.round(calculateVolume(weekLogs));
    const frequency = new Set(weekLogs.map((item) => String(item.date || '')).filter(Boolean)).size;

    const avgWeight = weekLogs.length
      ? weekLogs.reduce((acc, item) => acc + Number(item.weight || 0), 0) / weekLogs.length
      : 0;
    const prevAvgWeight = prevWeekLogs.length
      ? prevWeekLogs.reduce((acc, item) => acc + Number(item.weight || 0), 0) / prevWeekLogs.length
      : 0;

    const strengthPct = prevAvgWeight > 0
      ? Math.round(((avgWeight - prevAvgWeight) / prevAvgWeight) * 100)
      : 0;

    return {
      weeklyVolume,
      frequency,
      strengthPct,
    };
  }, [workoutLogs]);

  const coachLoop = useMemo(() => {
    const latest = Array.isArray(history) ? history[0] : null;
    const latestTrained = Boolean(latest?.trained);
    const latestProtein = Number(latest?.protein || 0);
    const latestWater = Number(latest?.waterMl || 0);
    const latestStatus = String(latest?.status || 'sem_dados');

    const priority = getDailyPriority({
      trained: latestTrained,
      protein: latestProtein,
      water: latestWater,
      goalProtein: Number(macros?.macroTargets?.protein || 150),
      waterGoal: 2000,
    });

    const resultLine = latest
      ? latestStatus === 'ok'
        ? 'Voce bateu os alvos no ultimo check-in ✅'
        : latestTrained
        ? 'Treino feito, mas ainda havia ajustes nutricionais.'
        : 'Ultimo check-in sem treino completo.'
      : 'Sem dados recentes para validar o loop.';

    return {
      resultLine,
      priority,
    };
  }, [history, macros?.macroTargets?.protein]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="Seu progresso" subtitle="Resumo consolidado da sua semana." />

      <AppCard testID="insights-dashboard">
        <Text style={styles.title}>Dashboard da semana</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Volume</Text>
            <Text style={styles.statValue}>{dashboardStats.weeklyVolume}kg</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Forca</Text>
            <Text style={styles.statValue}>{dashboardStats.strengthPct > 0 ? '+' : ''}{dashboardStats.strengthPct}%</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Treinos</Text>
            <Text style={styles.statValue}>{dashboardStats.frequency}x</Text>
          </View>
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Loop do coach</Text>
        <Text style={styles.line}>{coachLoop.resultLine}</Text>
        <Text style={styles.lineStrong}>Prioridade de hoje: {coachLoop.priority}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Resumo semanal</Text>
        <Text style={styles.line}>Media calorica: {weekly.averageCalories || 0} kcal</Text>
        <Text style={styles.line}>Dias treinados: {weekly.trainedDays || 0}</Text>
        <Text style={styles.line}>Dias fora da meta: {weekly.outOfTargetDays || 0}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Historico recente</Text>
        {history.length ? history.slice(0, 5).map((item) => (
          <View key={item.date} style={styles.row}>
            <Text style={styles.lineStrong}>{item.date}</Text>
            <Text style={styles.line}>{item.calories || 0} kcal | P {item.protein || 0}g</Text>
          </View>
        )) : <Text style={styles.line}>Nenhum dado recente.</Text>}
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Macros</Text>
        <Text style={styles.line}>Calorias medias: {macros.avgCalories || 0} kcal</Text>
        <Text style={styles.line}>Proteina media: {macros.avgProtein || 0}g</Text>
        <Text style={styles.line}>Carbo medio: {macros.avgCarbs || 0}g</Text>
        <Text style={styles.line}>Gordura media: {macros.avgFats || 0}g</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Insights IA</Text>
        <Text style={styles.line}>{insight.diagnosis}</Text>
        <Text style={styles.line}>{insight.recommendation}</Text>
      </AppCard>
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
  title: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  lineStrong: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  line: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  row: {
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statItem: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: '#0F1724',
  },
  statLabel: {
    color: '#9FB8DB',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 4,
  },
});
