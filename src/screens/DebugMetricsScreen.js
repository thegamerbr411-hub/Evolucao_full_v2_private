import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatMs(value) {
  return `${Math.round(Number(value || 0))} ms`;
}

export default function DebugMetricsScreen({ navigation }) {
  const isDev = typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
  if (!isDev) {
    return null;
  }

  const { getProductMetricsDashboard } = useApp();
  const [snapshot, setSnapshot] = useState(null);
  const [history, setHistory] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(10);

  const loadSnapshot = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await getProductMetricsDashboard();
      setSnapshot(result?.snapshot || null);
      setHistory(Array.isArray(result?.history) ? result.history : []);
    } finally {
      setRefreshing(false);
    }
  }, [getProductMetricsDashboard]);

  useEffect(() => {
    loadSnapshot().catch(() => {
      setRefreshing(false);
    });
  }, [loadSnapshot]);

  const activeAlerts = useMemo(() => {
    const items = Array.isArray(snapshot?.alertsDetailed) ? snapshot.alertsDetailed : [];
    return items.filter((item) => item?.active);
  }, [snapshot?.alertsDetailed]);

  const visibleHistory = useMemo(() => {
    return history.slice(0, historyLimit);
  }, [history, historyLimit]);

  const canLoadMoreHistory = history.length > visibleHistory.length;

  const getAlertSeverityStyle = (severity) => {
    if (severity === 'high') {
      return styles.alertHigh;
    }
    if (severity === 'medium') {
      return styles.alertMedium;
    }
    return styles.alertLow;
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadSnapshot} tintColor={colors.primary} />}
    >
      <ScreenHeader title="Debug Metrics" subtitle="Snapshot operacional de produto (fase 7)." />

      {!snapshot ? (
        <AppCard>
          <Text style={styles.cardLabel}>Sem dados ainda</Text>
          <Text style={styles.metric}>Gere eventos no app e toque em Atualizar para montar o primeiro snapshot.</Text>
          <PrimaryButton title="Atualizar" onPress={loadSnapshot} />
        </AppCard>
      ) : null}

      {snapshot ? (
        <>

      <AppCard>
        <Text style={styles.cardLabel}>North Star</Text>
        <Text style={styles.metricStrong}>{formatPercent(snapshot?.northStar?.userBasedValue)}</Text>
        <Text style={styles.metricSub}>Dual adherence user-based</Text>
        <Text style={styles.metric}>DAU: {Number(snapshot?.users?.dau || 0)}</Text>
        <Text style={styles.metric}>Usuarios com treino + nutricao: {Number(snapshot?.users?.usersCompletedBoth || 0)}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Funil Treino</Text>
        <Text style={styles.metric}>Abertura para inicio: {formatPercent(snapshot?.funnels?.workout?.openToStartRate)}</Text>
        <Text style={styles.metric}>Inicio para sets: {formatPercent(snapshot?.funnels?.workout?.startToSetRate)}</Text>
        <Text style={styles.metric}>Inicio para completo: {formatPercent(snapshot?.funnels?.workout?.startToCompleteRate)}</Text>
        <Text style={styles.metric}>Sequencial por usuario: {Number(snapshot?.funnels?.workout?.users?.openedToCompletedSequential || 0)}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Funil Nutricao</Text>
        <Text style={styles.metric}>Meal para day saved: {formatPercent(snapshot?.funnels?.nutrition?.mealToDaySavedRate)}</Text>
        <Text style={styles.metric}>Day saved para completo: {formatPercent(snapshot?.funnels?.nutrition?.daySavedToCompletedRate)}</Text>
        <Text style={styles.metric}>Sequencial por usuario: {Number(snapshot?.funnels?.nutrition?.users?.savedToCompletedSequential || 0)}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Friccao</Text>
        <Text style={styles.metric}>Workout set avg: {formatMs(snapshot?.friction?.workoutSetSave?.avg)}</Text>
        <Text style={styles.metric}>Workout set p50: {formatMs(snapshot?.friction?.workoutSetSave?.p50)}</Text>
        <Text style={styles.metric}>Meal draft avg: {formatMs(snapshot?.friction?.mealDraftSave?.avg)}</Text>
        <Text style={styles.metric}>Workout completed avg: {formatMs(snapshot?.friction?.workoutCompletion?.avg)}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Alertas</Text>
        {activeAlerts.length ? activeAlerts.map((item, index) => (
          <View key={`${item.type}-${index}`} style={[styles.alertRow, getAlertSeverityStyle(item.severity)]}>
            <Text style={[styles.metricStrong, getAlertSeverityStyle(item.severity)]}>{String(item.severity || 'low').toUpperCase()}</Text>
            <Text style={styles.metric}>{item.message}</Text>
          </View>
        )) : <Text style={styles.metric}>Sem alertas ativos no momento.</Text>}
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Historico (compacto)</Text>
        <Text style={styles.metric}>Snapshots salvos: {history.length}</Text>
        {visibleHistory.map((item, index) => (
          <Text key={`h-${index}`} style={styles.metric}>
            {item.iso || '-'} | NS {Number(item.northStar || 0).toFixed(1)}% | WC {Number(item.workoutCompletion || 0).toFixed(1)}%
          </Text>
        ))}
        {canLoadMoreHistory ? (
          <PrimaryButton title="Carregar mais 10" onPress={() => setHistoryLimit((prev) => prev + 10)} />
        ) : null}
      </AppCard>

      <PrimaryButton title="Atualizar" onPress={loadSnapshot} />
      <SecondaryButton title="Observability Logs" onPress={() => navigation.navigate('DebugObservability')} />
        </>
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
    gap: spacing.md,
  },
  cardLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  metric: {
    color: colors.textPrimary,
    fontSize: 13,
    marginBottom: 4,
  },
  metricStrong: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  metricSub: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  alertRow: {
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 6,
  },
  alertHigh: {
    color: '#EF4444',
    borderBottomColor: '#7F1D1D',
  },
  alertMedium: {
    color: '#F59E0B',
    borderBottomColor: '#78350F',
  },
  alertLow: {
    color: '#60A5FA',
  },
});