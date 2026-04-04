import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, PrimaryButton, ScreenHeader } from '../components/ui';
import { colors, spacing } from '../theme';

const weekDays = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

function formatWeekDay(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  return weekDays[date.getDay()];
}

function statusLabel(status, trained) {
  if (!trained) {
    return { text: 'SEM TREINO', icon: '❌', color: '#A24242' };
  }

  if (status === 'ok') {
    return { text: 'OK', icon: '✅', color: '#1F7A3F' };
  }

  if (status === 'abaixo') {
    return { text: 'ABAIXO', icon: '⚠️', color: '#A06A00' };
  }

  return { text: 'ACIMA', icon: '⚠️', color: '#8C3A2E' };
}

export default function HistoryScreen({ navigation }) {
  const { getRecentHistory, getWeeklySummary } = useApp();

  const recentHistory = useMemo(() => getRecentHistory(), [getRecentHistory]);
  const summary = useMemo(() => getWeeklySummary(), [getWeeklySummary]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="Historico dos Ultimos 7 Dias" subtitle="Consistencia diaria e resumo semanal." />

      <AppCard>
        <Text style={styles.summaryTitle}>Resumo semanal</Text>
        <Text style={styles.summaryLine}>Media de calorias: {summary.averageCalories || 0} kcal</Text>
        <Text style={styles.summaryLine}>Dias treinados: {summary.trainedDays || 0}</Text>
        <Text style={styles.summaryLine}>Dias fora da meta: {summary.outOfTargetDays || 0}</Text>

        <PrimaryButton title="IA analisar minha semana" onPress={() => navigation.navigate('Insights')} style={styles.button} />
      </AppCard>

      <AppCard style={styles.listCard}>
        {recentHistory.length ? (
          recentHistory.map((item) => {
            const status = statusLabel(item.status, item.trained);
            return (
              <View key={item.date} style={styles.row}>
                <Text style={styles.day}>{formatWeekDay(item.date)}</Text>
                <View style={styles.middle}>
                  <Text style={[styles.statusText, { color: status.color }]}>
                    {status.text} {status.icon}
                  </Text>
                  <Text style={styles.metaText}>{item.calories} kcal</Text>
                </View>
                <Text style={styles.dateText}>{item.date}</Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.empty}>Nenhuma analise salva ainda. Gere uma analise do dia primeiro.</Text>
        )}
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
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  summaryLine: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 4,
  },
  button: {
    marginTop: spacing.sm,
  },
  listCard: {
    paddingVertical: 4,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  day: {
    width: 44,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  middle: {
    flex: 1,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 13,
  },
  metaText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  dateText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  empty: {
    padding: 14,
    color: colors.textSecondary,
    fontSize: 14,
  },
});
