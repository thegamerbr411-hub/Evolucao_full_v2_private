import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, ScreenHeader } from '../components/ui';
import { calculateVolume, getDailyPriority } from '../services/performanceEngine';
import { buildLocalRanking, calculateXpForWorkout, getLevelFromXp } from '../services/gamificationEngine';
import { colors, spacing } from '../theme';

export default function InsightsScreen() {
  const { getWeeklyMacroSummary, getRecentHistory, workoutLogs, getWorkoutGamification } = useApp();

  const macros = useMemo(() => getWeeklyMacroSummary(), [getWeeklyMacroSummary]);
  const history = useMemo(() => getRecentHistory(), [getRecentHistory]);
  const safeHistory = Array.isArray(history) ? history : [];

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
    const latest = safeHistory[0] || null;
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
  }, [safeHistory, macros?.macroTargets?.protein]);

  const socialStats = useMemo(() => {
    const safeLogs = Array.isArray(workoutLogs) ? workoutLogs : [];
    const myVolume = calculateVolume(safeLogs);
    const mySets = safeLogs.length;
    const baseGamification = getWorkoutGamification();
    const earnedXp = calculateXpForWorkout({
      sets: mySets,
      volume: myVolume,
      hitPr: false,
      streakDays: Number(baseGamification?.streakDays || 0),
    });
    const myXp = Math.max(Number(baseGamification?.xp || 0), earnedXp);
    const me = {
      id: 'me',
      name: 'Voce',
      xp: myXp,
      streak: Number(baseGamification?.streakDays || 0),
    };

    const ranking = buildLocalRanking([
      me,
      { id: 'u1', name: 'Leo', xp: myXp + 140, streak: 7 },
      { id: 'u2', name: 'Ana', xp: Math.max(0, myXp - 80), streak: 5 },
      { id: 'u3', name: 'Bia', xp: Math.max(0, myXp - 160), streak: 3 },
    ]);

    return {
      xp: myXp,
      level: getLevelFromXp(myXp),
      streak: Number(baseGamification?.streakDays || 0),
      ranking,
    };
  }, [workoutLogs, getWorkoutGamification]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="Insights" subtitle="So o que importa para decidir melhor." />

      <AppCard testID="insights-dashboard">
        <Text style={styles.title}>Dashboard da semana</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Volume semanal</Text>
            <Text style={styles.statValue}>{dashboardStats.weeklyVolume.toLocaleString('pt-BR')} kg</Text>
            <Text style={styles.statHint}>Carga total da semana</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Forca</Text>
            <Text style={styles.statValue}>{dashboardStats.strengthPct > 0 ? '+' : ''}{dashboardStats.strengthPct}%</Text>
            <Text style={styles.statHint}>Vs semana anterior</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Frequencia</Text>
            <Text style={styles.statValue}>{dashboardStats.frequency} treinos</Text>
            <Text style={styles.statHint}>Nesta semana</Text>
          </View>
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Loop do coach</Text>
        <Text style={styles.line}>{coachLoop.resultLine}</Text>
        <Text style={styles.lineStrong}>Prioridade de hoje: {coachLoop.priority}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Resumo nutricional rapido</Text>
        <Text style={styles.line}>Proteina media: {macros.avgProtein || 0}g</Text>
        <Text style={styles.line}>Calorias medias: {macros.avgCalories || 0} kcal</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Social + Gamificacao</Text>
        <Text style={styles.lineStrong}>XP: {socialStats.xp} | Nivel: {socialStats.level} | Streak: {socialStats.streak} dias</Text>
        {socialStats.ranking.map((user) => (
          <Text key={user.id} style={styles.line}>#{user.rank} {user.name} • {user.xp} XP • {user.streak} dias</Text>
        ))}
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
  statHint: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
});
