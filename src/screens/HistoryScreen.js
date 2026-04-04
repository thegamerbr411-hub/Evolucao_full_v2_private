import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';

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
      <Text style={styles.title}>Historico dos Ultimos 7 Dias</Text>
      <Text style={styles.subtitle}>Consistencia diaria e resumo semanal.</Text>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Resumo semanal</Text>
        <Text style={styles.summaryLine}>Media de calorias: {summary.averageCalories || 0} kcal</Text>
        <Text style={styles.summaryLine}>Dias treinados: {summary.trainedDays || 0}</Text>
        <Text style={styles.summaryLine}>Dias fora da meta: {summary.outOfTargetDays || 0}</Text>

        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate('IAWeekly')}>
          <Text style={styles.buttonText}>IA analisar minha semana</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listCard}>
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
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE2F0',
    padding: 14,
    marginBottom: 14,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17233F',
    marginBottom: 8,
  },
  summaryLine: {
    color: '#3A4358',
    fontSize: 14,
    marginBottom: 4,
  },
  button: {
    marginTop: 10,
    backgroundColor: '#111C3D',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCE2F0',
    paddingVertical: 4,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F8',
    flexDirection: 'row',
    alignItems: 'center',
  },
  day: {
    width: 44,
    fontWeight: '800',
    color: '#111B35',
  },
  middle: {
    flex: 1,
  },
  statusText: {
    fontWeight: '700',
    fontSize: 13,
  },
  metaText: {
    color: '#52607A',
    fontSize: 13,
    marginTop: 2,
  },
  dateText: {
    color: '#6C7790',
    fontSize: 12,
  },
  empty: {
    padding: 14,
    color: '#66728F',
    fontSize: 14,
  },
});
