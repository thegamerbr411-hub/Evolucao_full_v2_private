import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { useWorkout } from '../hooks';
import { buildLocalWorkoutLogsPresentation } from '../services/workoutHistoryPresentation';
import { AppCard, PrimaryButton, ScreenHeader } from '../components/ui';
import { colors, spacing } from '../theme';
import { listUserWorkoutsFromApi } from '../services/workoutApiService';

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
  const { getRecentHistory, getWeeklySummary, user } = useApp();
  const { workoutLogs = [] } = useWorkout() || {};
  const localLogsPresentation = useMemo(
    () => buildLocalWorkoutLogsPresentation(workoutLogs, { limit: 10 }),
    [workoutLogs]
  );
  const [remoteLoading, setRemoteLoading] = useState(true);
  const [remoteWorkouts, setRemoteWorkouts] = useState([]);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState('');

  const recentHistory = useMemo(() => getRecentHistory(), [getRecentHistory]);
  const summary = useMemo(() => getWeeklySummary(), [getWeeklySummary]);
  const outOfTargetDays = useMemo(
    () => recentHistory.filter((item) => item.trained && item.status !== 'ok' && item.status !== 'indefinido').length,
    [recentHistory]
  );
  const selectedWorkout = useMemo(
    () => remoteWorkouts.find((item) => String(item.id) === String(selectedWorkoutId)) || null,
    [remoteWorkouts, selectedWorkoutId]
  );

  useEffect(() => {
    let isMounted = true;

    const loadRemote = async () => {
      setRemoteLoading(true);
      const result = await listUserWorkoutsFromApi({ userId: user?.id, limit: 20 });
      if (!isMounted) {
        return;
      }

      if (result?.ok) {
        setRemoteWorkouts(Array.isArray(result.data) ? result.data : []);
      }
      setRemoteLoading(false);
    };

    loadRemote();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const handleHistoryBack = () => {
    if (selectedWorkoutId) {
      setSelectedWorkoutId('');
      return;
    }
    navigation.goBack();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="Historico dos Ultimos 7 Dias" subtitle="Consistencia diaria e resumo semanal." onBack={handleHistoryBack} />

      <AppCard>
        <Text style={styles.summaryTitle}>Resumo semanal</Text>
        <Text style={styles.summaryLine}>Media de calorias: {summary.avgCals || 0} kcal</Text>
        <Text style={styles.summaryLine}>Dias treinados: {summary.trainedDays || 0}</Text>
        <Text style={styles.summaryLine}>Dias fora da meta: {outOfTargetDays}</Text>

        <PrimaryButton title="IA analisar minha semana" onPress={() => navigation.navigate('Insights')} style={styles.button} />
      </AppCard>

      <AppCard testID="history-local-logs-panel">
        <Text style={styles.summaryTitle}>Historico de series (local)</Text>
        {localLogsPresentation.isEmpty ? (
          <Text style={styles.empty}>{localLogsPresentation.emptyCopy}</Text>
        ) : (
          <>
            {localLogsPresentation.entries.map((entry) => (
              <Text key={entry.id} style={styles.summaryLine}>
                {entry.lineText}
              </Text>
            ))}
            {localLogsPresentation.ignoredHint ? (
              <Text style={styles.localLogsFooter}>{localLogsPresentation.ignoredHint}</Text>
            ) : null}
          </>
        )}
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
          <Text style={styles.empty}>Seu historico semanal aparece aqui. Registre treinos e refeicoes para acompanhar sua evolucao.</Text>
        )}
      </AppCard>

      <AppCard>
        <Text style={styles.summaryTitle}>Historico real (backend)</Text>
        {remoteLoading ? <Text style={styles.summaryLine}>Carregando treinos salvos...</Text> : null}
        {!remoteLoading && !remoteWorkouts.length ? (
          <Text style={styles.empty}>Seu histórico aparece aqui. Finalize um treino para ver suas séries, cargas e evolução.</Text>
        ) : null}
        {!remoteLoading && remoteWorkouts.length ? (
          remoteWorkouts.map((item) => (
            <TouchableOpacity key={item.id} style={styles.remoteRow} onPress={() => setSelectedWorkoutId(String(item.id))}>
              <Text style={styles.remoteTitle}>{item.name || 'Treino'}</Text>
              <Text style={styles.remoteMeta}>{item.dateKey || String(item.createdAt || '').slice(0, 10)} · {Number(item.totalSets || 0)} series · {Math.round(Number(item.totalVolume || 0))}kg</Text>
            </TouchableOpacity>
          ))
        ) : null}
      </AppCard>

      {selectedWorkout ? (
        <AppCard>
          <Text style={styles.summaryTitle}>Detalhe do treino</Text>
          <Text style={styles.summaryLine}>Nome: {selectedWorkout.name || 'Treino'}</Text>
          <Text style={styles.summaryLine}>Data: {selectedWorkout.dateKey || String(selectedWorkout.createdAt || '').slice(0, 10)}</Text>
          <Text style={styles.summaryLine}>Volume: {Math.round(Number(selectedWorkout.totalVolume || 0))} kg</Text>
          <Text style={styles.summaryLine}>Duracao: {Number(selectedWorkout.durationMinutes || 0)} min</Text>
          <Text style={styles.summaryLine}>Exercicios: {Array.isArray(selectedWorkout.exercises) ? selectedWorkout.exercises.length : 0}</Text>
        </AppCard>
      ) : null}
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
  localLogsFooter: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  remoteRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#101722',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  remoteTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 13,
  },
  remoteMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
});
