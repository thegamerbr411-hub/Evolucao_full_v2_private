import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, PrimaryButton, ScreenHeader } from '../components/ui';
import { colors, spacing } from '../theme';
import { getGamificationFormulaFromApi, getLeaderboardFromApi, getUserStatsFromApi } from '../services/workoutApiService';

function getMetricValue(row, metric) {
  if (metric === 'volume') return Number(row?.volumeScore || 0);
  if (metric === 'completed') return Number(row?.completedScore || 0);
  if (metric === 'consistency') return Number(row?.consistencyScore || 0);
  return Number(row?.xpScore || 0);
}

export default function RankingEvolutionScreen({ navigation }) {
  const { user, getWorkoutGamification } = useApp();
  const [metric, setMetric] = useState('xp');
  const [ranking, setRanking] = useState([]);
  const [myStats, setMyStats] = useState(null);
  const [formula, setFormula] = useState(null);
  const [loading, setLoading] = useState(false);

  const safeUserId = useMemo(() => String(user?.id || '').trim(), [user?.id]);
  const localGamification = getWorkoutGamification();

  const loadData = async () => {
    setLoading(true);
    const [rankingResult, statsResult, formulaResult] = await Promise.all([
      getLeaderboardFromApi({ metric, userId: safeUserId }),
      getUserStatsFromApi({ userId: safeUserId }),
      getGamificationFormulaFromApi(),
    ]);

    setLoading(false);

    if (rankingResult?.ok) {
      setRanking(Array.isArray(rankingResult?.data?.ranking) ? rankingResult.data.ranking : []);
    } else {
      setRanking([]);
    }

    if (statsResult?.ok) {
      setMyStats(statsResult.data || null);
    } else {
      setMyStats(null);
    }

    if (formulaResult?.ok) {
      setFormula(formulaResult.data || null);
    } else {
      setFormula(null);
    }
  };

  useEffect(() => {
    loadData();
  }, [metric, safeUserId]);

  const myRow = useMemo(
    () => ranking.find((item) => item.userId === safeUserId) || null,
    [ranking, safeUserId]
  );

  const xpRemaining = useMemo(() => {
    const apiRemaining = Number(myStats?.xpToNextLevel);
    if (Number.isFinite(apiRemaining) && apiRemaining > 0) {
      return apiRemaining;
    }

    const fallback = Number(myStats?.xpNeeded || 0) - Number(myStats?.xpInLevel || 0);
    return Math.max(0, Number.isFinite(fallback) ? fallback : 0);
  }, [myStats]);

  const showGoalFallback = xpRemaining <= 0 && Number(myStats?.xp || localGamification?.xp || 0) <= 0;

  return (
    <ScrollView testID="screen-ranking" contentContainerStyle={styles.container}>
      <ScreenHeader title="Ranking e Evolucao" subtitle="Suba de liga, acompanhe XP e pressione o topo." onBack={() => navigation.goBack()} />

      <AppCard>
        <Text style={styles.title}>Seu progresso</Text>
        <Text style={styles.line}>Nivel: {Number(myStats?.level || localGamification?.level || 1)}</Text>
        <Text style={styles.line}>XP total: {Number(myStats?.xp || localGamification?.xp || 0)}</Text>
        <Text style={styles.line}>Streak: {Number(myStats?.streak || localGamification?.streakDays || 0)} dias</Text>
        <Text style={styles.line}>Liga: {String(myStats?.league || myRow?.league || 'bronze').toUpperCase()}</Text>
        <Text style={styles.goal}>
          {showGoalFallback
            ? 'Progresso de nivel em sincronizacao. Continue registrando treinos.'
            : `Faltam ${xpRemaining} XP para o proximo nivel.`}
        </Text>
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Ranking</Text>
        <View style={styles.tabs}>
          {['xp', 'consistency', 'volume', 'completed'].map((item) => (
            <TouchableOpacity
              key={item}
              style={[styles.tab, metric === item ? styles.tabActive : null]}
              onPress={() => setMetric(item)}
            >
              <Text style={[styles.tabText, metric === item ? styles.tabTextActive : null]}>{item}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? <Text style={styles.meta}>Carregando ranking...</Text> : null}
        {!loading && !ranking.length ? <Text style={styles.meta}>Sem dados de ranking no momento.</Text> : null}
        {!loading && ranking.slice(0, 12).map((row) => (
          <Text key={`${row.userId}-${row.rank}`} style={styles.line}>
            #{row.rank} {row.userId} • {getMetricValue(row, metric)} • {String(row.league || '').toUpperCase()}
          </Text>
        ))}
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Formula oficial de XP</Text>
        {formula ? (
          <>
            <Text style={styles.meta}>Versao: {String(formula.version || 'xp')}</Text>
            <Text style={styles.meta}>Ligas: {(formula.leagueTiers || []).join(' | ')}</Text>
            <Text style={styles.meta}>Treino base: +{Number(formula?.rules?.baseWorkout || 0)} XP</Text>
            <Text style={styles.meta}>Serie: +{Number(formula?.rules?.perSet || 0)} XP (ate {Number(formula?.rules?.maxSetXp || 0)})</Text>
            <Text style={styles.meta}>Bonus semanal: +{Number(formula?.rules?.weeklyConsistencyBonusXp || 0)} XP</Text>
            <Text style={styles.meta}>Penalidade streak: -{Number(formula?.rules?.streakBreakPenaltyPerDay || 0)} XP por dia quebrado</Text>
          </>
        ) : (
          <Text style={styles.meta}>Formula indisponivel offline.</Text>
        )}
      </AppCard>

      <PrimaryButton title="Ver social e desafios" onPress={() => navigation.navigate('SocialChallenges')} />
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
    marginBottom: 8,
  },
  line: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  goal: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  tab: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    backgroundColor: '#141922',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tabActive: {
    backgroundColor: '#1D2B40',
    borderColor: colors.secondary,
  },
  tabText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  tabTextActive: {
    color: '#BFDBFE',
  },
});
