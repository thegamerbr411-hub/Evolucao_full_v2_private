import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { useWorkout } from '../hooks';
import { buildLocalWorkoutLogsPresentation, buildRemoteWorkoutSessionCard, buildRemoteWorkoutSessionDetail, HISTORY_SESSION_COPY, HISTORY_SESSION_TEST_IDS } from '../services/workoutHistoryPresentation';
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
  const selectedWorkoutDetail = useMemo(
    () => (selectedWorkout ? buildRemoteWorkoutSessionDetail(selectedWorkout) : null),
    [selectedWorkout]
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
    <ScrollView testID="screen-history" contentContainerStyle={styles.container}>
      <ScreenHeader title="Histórico dos Últimos 7 Dias" subtitle="Consistência diária e resumo semanal." onBack={handleHistoryBack} />

      <AppCard>
        <Text style={styles.summaryTitle}>Resumo semanal</Text>
        <Text style={styles.summaryLine}>Media de calorias: {summary.avgCals || 0} kcal</Text>
        <Text style={styles.summaryLine}>Dias treinados: {summary.trainedDays || 0}</Text>
        <Text style={styles.summaryLine}>Dias fora da meta: {outOfTargetDays}</Text>

        <PrimaryButton title="IA analisar minha semana" onPress={() => navigation.navigate('Insights')} style={styles.button} />
      </AppCard>

      <AppCard testID="history-local-logs-panel">
        <Text style={styles.summaryTitle}>Histórico de séries (local)</Text>
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

      <AppCard testID="history-backend-sessions-panel">
        <Text style={styles.summaryTitle}>{HISTORY_SESSION_COPY.sectionTitle}</Text>
        {remoteLoading ? <Text style={styles.summaryLine}>{HISTORY_SESSION_COPY.loading}</Text> : null}
        {!remoteLoading && !remoteWorkouts.length ? (
          <Text testID={HISTORY_SESSION_TEST_IDS.emptyState} style={styles.empty}>
            {HISTORY_SESSION_COPY.emptyState}
          </Text>
        ) : null}
        {!remoteLoading && remoteWorkouts.length ? (
          remoteWorkouts.map((workout) => {
            const card = buildRemoteWorkoutSessionCard(workout);
            return (
            <TouchableOpacity
              key={String(workout.id || card.id)}
              testID={HISTORY_SESSION_TEST_IDS.sessionCard}
              accessibilityLabel={HISTORY_SESSION_TEST_IDS.btnOpenDetail}
              style={styles.sessionCard}
              onPress={() => setSelectedWorkoutId(String(workout.id))}
            >
              <Text testID={HISTORY_SESSION_TEST_IDS.sessionTitle} style={styles.sessionTitle}>
                {card.title}
              </Text>
              <Text testID={HISTORY_SESSION_TEST_IDS.sessionDate} style={styles.sessionMeta}>
                {card.metaLine}
              </Text>
              <View style={styles.sessionStatsRow}>
                <View style={styles.sessionStatBlock}>
                  <Text style={styles.sessionStatLabel}>{card.labels.duration}</Text>
                  <Text testID={HISTORY_SESSION_TEST_IDS.sessionDuration} style={styles.sessionStatValue}>
                    {card.durationValue}
                  </Text>
                </View>
                <View style={styles.sessionStatBlock}>
                  <Text style={styles.sessionStatLabel}>{card.labels.exercises}</Text>
                  <Text testID={HISTORY_SESSION_TEST_IDS.sessionExercises} style={styles.sessionStatValue}>
                    {card.exercisesValue}
                  </Text>
                </View>
                <View style={styles.sessionStatBlock}>
                  <Text style={styles.sessionStatLabel}>{card.labels.sets}</Text>
                  <Text testID={HISTORY_SESSION_TEST_IDS.sessionSets} style={styles.sessionStatValue}>
                    {card.setsValue}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
            );
          })
        ) : null}
      </AppCard>

      {selectedWorkoutDetail ? (
        <AppCard testID={HISTORY_SESSION_TEST_IDS.sessionDetail}>
          <View testID={HISTORY_SESSION_TEST_IDS.sessionDetailCard} style={styles.detailCard}>
            <Text style={styles.summaryTitle}>{selectedWorkoutDetail.detailTitle}</Text>
            <Text style={styles.sessionTitle}>{selectedWorkoutDetail.title}</Text>

            <View style={styles.detailMetricRow}>
              <Text style={styles.sessionStatLabel}>{selectedWorkoutDetail.labels.finishedAt}</Text>
              <Text style={styles.detailMetricValue}>{selectedWorkoutDetail.finishedAtValue}</Text>
            </View>
            <View style={styles.detailMetricRow}>
              <Text style={styles.sessionStatLabel}>{selectedWorkoutDetail.labels.duration}</Text>
              <Text style={styles.detailMetricValue}>{selectedWorkoutDetail.durationValue}</Text>
            </View>
            <View style={styles.detailMetricRow}>
              <Text style={styles.sessionStatLabel}>{selectedWorkoutDetail.labels.exercises}</Text>
              <Text style={styles.detailMetricValue}>{selectedWorkoutDetail.exercisesValue}</Text>
            </View>
            <View style={styles.detailMetricRow}>
              <Text style={styles.sessionStatLabel}>{selectedWorkoutDetail.labels.sets}</Text>
              <Text style={styles.detailMetricValue}>{selectedWorkoutDetail.setsValue}</Text>
            </View>
            {selectedWorkoutDetail.showVolume ? (
              <View style={styles.detailMetricRow}>
                <Text style={styles.sessionStatLabel}>{selectedWorkoutDetail.labels.volume}</Text>
                <Text style={styles.detailMetricValue}>{selectedWorkoutDetail.volumeValue}</Text>
              </View>
            ) : null}

            {selectedWorkoutDetail.hasExerciseList ? (
              <View style={styles.detailExerciseSection}>
                <Text style={styles.sessionStatLabel}>{selectedWorkoutDetail.labels.exercises}</Text>
                <Text testID={HISTORY_SESSION_TEST_IDS.sessionDetailExerciseList} style={styles.detailExerciseList}>
                  {selectedWorkoutDetail.exerciseList.displayText}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity
              testID={HISTORY_SESSION_TEST_IDS.btnBack}
              style={styles.detailBackButton}
              onPress={() => setSelectedWorkoutId('')}
            >
              <Text style={styles.detailBackText}>Voltar para treinos salvos</Text>
            </TouchableOpacity>
          </View>
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
  sessionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  sessionTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: -0.2,
  },
  sessionMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  sessionStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  sessionStatBlock: {
    minWidth: '30%',
    backgroundColor: colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderSubtle || colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  sessionStatLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  sessionStatValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  detailCard: {
    gap: 4,
  },
  detailMetricRow: {
    marginTop: 8,
  },
  detailMetricValue: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  detailExerciseSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle || colors.border,
  },
  detailExerciseList: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
    fontWeight: '600',
  },
  detailBackButton: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  detailBackText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 13,
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
