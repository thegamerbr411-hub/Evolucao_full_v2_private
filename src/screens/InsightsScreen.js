import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, ScreenHeader } from '../components/ui';
import { colors, spacing } from '../theme';

export default function InsightsScreen() {
  const { getWeeklySummary, getWeeklyInsight, getWeeklyMacroSummary, getRecentHistory } = useApp();

  const weekly = useMemo(() => getWeeklySummary(), [getWeeklySummary]);
  const insight = useMemo(() => getWeeklyInsight(), [getWeeklyInsight]);
  const macros = useMemo(() => getWeeklyMacroSummary(), [getWeeklyMacroSummary]);
  const history = useMemo(() => getRecentHistory(), [getRecentHistory]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="Seu progresso" subtitle="Resumo consolidado da sua semana." />

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
});
