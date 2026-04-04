import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';

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
  const { getWeeklySummary, getWeeklyInsight, getAutoAdjustmentSuggestion, applyAutoPlanAdjustment } = useApp();
  const [applyMessage, setApplyMessage] = useState('');

  const summary = useMemo(() => getWeeklySummary(), [getWeeklySummary]);
  const insight = useMemo(() => getWeeklyInsight(), [getWeeklyInsight]);
  const adjustment = useMemo(() => getAutoAdjustmentSuggestion(), [getAutoAdjustmentSuggestion, insight]);

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
      <Text style={styles.title}>IA da Semana</Text>
      <Text style={styles.subtitle}>Diagnostico comportamental com base nos ultimos 7 dias.</Text>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>Consistency Score</Text>
        <Text style={[styles.scoreValue, { color: scoreColor(insight.consistencyScore) }]}>
          {insight.consistencyScore}%
        </Text>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.sectionTitle}>Resumo objetivo</Text>
        <Text style={styles.line}>Media calorica: {summary.averageCalories || 0} kcal</Text>
        <Text style={styles.line}>Dias treinados: {summary.trainedDays || 0}</Text>
        <Text style={styles.line}>Dias fora da meta: {summary.outOfTargetDays || 0}</Text>
      </View>

      <View style={styles.analysisCard}>
        <Text style={styles.sectionTitle}>Diagnostico</Text>
        <Text style={styles.paragraph}>{insight.diagnosis}</Text>
        <Text style={[styles.sectionTitle, styles.recommendationTitle]}>Recomendacao pratica</Text>
        <Text style={styles.paragraph}>{insight.recommendation}</Text>
      </View>

      <View style={styles.adjustCard}>
        <Text style={styles.sectionTitle}>Ajuste automatico da proxima semana</Text>
        <Text style={styles.line}>{adjustment.message}</Text>

        {adjustment.canApply ? (
          <>
            <Text style={styles.line}>Calorias atuais: {adjustment.currentCalories} kcal</Text>
            <Text style={styles.line}>Nova meta: {adjustment.newCalories} kcal</Text>
            <Text style={styles.line}>Treino: {adjustment.trainingAdjustment}</Text>

            <TouchableOpacity style={styles.button} onPress={handleApply}>
              <Text style={styles.buttonText}>Aplicar ajuste automatico</Text>
            </TouchableOpacity>
          </>
        ) : null}

        {applyMessage ? <Text style={styles.feedback}>{applyMessage}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F6F8FC',
    paddingTop: 56,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#121826',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    color: '#495268',
    fontSize: 15,
  },
  scoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE2F0',
    padding: 16,
    marginBottom: 14,
  },
  scoreLabel: {
    color: '#5A647B',
    fontSize: 14,
    marginBottom: 4,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: '800',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE2F0',
    padding: 14,
    marginBottom: 14,
  },
  analysisCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE2F0',
    padding: 14,
  },
  adjustCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE2F0',
    padding: 14,
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17233F',
    marginBottom: 8,
  },
  line: {
    color: '#3A4358',
    fontSize: 14,
    marginBottom: 4,
  },
  paragraph: {
    color: '#2F3950',
    fontSize: 14,
    lineHeight: 21,
  },
  recommendationTitle: {
    marginTop: 14,
  },
  button: {
    marginTop: 10,
    backgroundColor: '#0B63CE',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  feedback: {
    marginTop: 10,
    color: '#13407E',
    fontSize: 13,
    fontWeight: '600',
  },
});
