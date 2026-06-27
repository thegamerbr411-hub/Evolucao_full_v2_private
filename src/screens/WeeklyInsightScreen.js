import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, PrimaryButton, ScreenHeader } from '../components/ui';
import { colors, spacing } from '../theme';

function scoreColor(score) {
  if (score >= 80) {
    return '#1F7A3F';
  }

  if (score >= 55) {
    return '#A06A00';
  }

  return '#A24242';
}

export default function WeeklyInsightScreen() {
  const { getWeeklySummary, getWeeklyInsight, getAutoAdjustmentSuggestion, applyAutoPlanAdjustment, getRecentHistory } = useApp();
  const [applyMessage, setApplyMessage] = useState('');

  const summary = useMemo(() => getWeeklySummary(), [getWeeklySummary]);
  const insight = useMemo(() => getWeeklyInsight(), [getWeeklyInsight]);
  const adjustment = useMemo(() => getAutoAdjustmentSuggestion(), [getAutoAdjustmentSuggestion, insight]);
  const outOfTargetDays = useMemo(() => {
    const recent = typeof getRecentHistory === 'function' ? getRecentHistory() : [];
    return recent.filter((item) => item.trained && item.status !== 'ok' && item.status !== 'indefinido').length;
  }, [getRecentHistory]);

  const handleApply = () => {
    const result = applyAutoPlanAdjustment();

    if (!result.canApply) {
      setApplyMessage(result.message);
      return;
    }

    const signal = result.calorieDelta > 0 ? '+' : '';
    setApplyMessage(
      `Plano ajustado: ${result.currentCalories} -> ${result.newCalories} kcal (${signal}${result.calorieDelta}).`
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="IA da Semana" subtitle="Diagnóstico comportamental com base nos últimos 7 dias." />

      <AppCard>
        <Text style={styles.scoreLabel}>Consistency Score</Text>
        <Text style={[styles.scoreValue, { color: scoreColor(insight.consistencyScore) }]}>
          {insight.consistencyScore}%
        </Text>
      </AppCard>

      <AppCard>
        <Text style={styles.sectionTitle}>Resumo objetivo</Text>
        <Text style={styles.line}>Media calorica: {summary.avgCals || 0} kcal</Text>
        <Text style={styles.line}>Dias treinados: {summary.trainedDays || 0}</Text>
        <Text style={styles.line}>Dias fora da meta: {outOfTargetDays}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.sectionTitle}>Diagnóstico</Text>
        <Text style={styles.paragraph}>{insight.diagnosis}</Text>
        <Text style={[styles.sectionTitle, styles.recommendationTitle]}>Recomendação prática</Text>
        <Text style={styles.paragraph}>{insight.recommendation}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.sectionTitle}>Ajuste automático da próxima semana</Text>
        <Text style={styles.line}>{adjustment.message}</Text>

        {adjustment.canApply ? (
          <>
            <Text style={styles.line}>Calorias atuais: {adjustment.currentCalories} kcal</Text>
            <Text style={styles.line}>Nova meta: {adjustment.newCalories} kcal</Text>
            <Text style={styles.line}>Treino: {adjustment.trainingAdjustment}</Text>

            <PrimaryButton title="Aplicar ajuste automático" onPress={handleApply} style={styles.button} />
          </>
        ) : null}

        {applyMessage ? <Text style={styles.feedback}>{applyMessage}</Text> : null}
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
  scoreLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  line: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  paragraph: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  recommendationTitle: {
    marginTop: 14,
  },
  button: {
    marginTop: spacing.sm,
  },
  feedback: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
