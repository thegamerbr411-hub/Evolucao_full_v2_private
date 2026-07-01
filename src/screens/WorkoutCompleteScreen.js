import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme';
import * as Haptics from 'expo-haptics';
import {
  WORKOUT_COMPLETE_TEST_IDS,
  buildWorkoutCompleteSummary,
} from '../services/workoutSessionSummary.js';

function getConquestMessage(streak, evolution) {
  if (streak >= 7) return { emoji: '🔥', title: 'Semana completa!', sub: 'Você treinou 7 dias seguidos. Isso é raro.' };
  if (streak >= 3) return { emoji: '⚡', title: 'Sequência em chamas!', sub: `${streak} dias seguidos. Continue assim!` };
  if (Number(evolution) > 5) return { emoji: '📈', title: 'Evolução incrível!', sub: `+${evolution}% em relação ao último treino.` };
  if (streak === 1) return { emoji: '💪', title: 'Treino concluído!', sub: 'Você deu o primeiro passo. Volte amanhã!' };
  return { emoji: '🏆', title: 'Treino concluído!', sub: 'Cada treino te aproxima do seu objetivo.' };
}

export default function WorkoutCompleteScreen({ route, navigation }) {
  const {
    streak = 1,
    evolution,
    prevWeight,
    currWeight,
    exerciseCount = 0,
    plannedExercises = 0,
    sessionDurationMinutes = 0,
    totalSets = 0,
    completedSets,
    plannedSets = 0,
    finishedAt,
    exerciseNames = [],
    totalVolume = 0,
    sessionXp = 0,
  } = route?.params || {};

  const heroScale = useRef(new Animated.Value(0.92)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const xpPulse = useRef(new Animated.Value(0)).current;

  const summary = useMemo(() => buildWorkoutCompleteSummary({
    exerciseCount,
    plannedExercises,
    completedSets: completedSets ?? totalSets,
    plannedSets,
    totalVolume,
    sessionDurationMinutes,
    finishedAt,
    exerciseNames,
    streak,
    sessionXp,
  }), [
    exerciseCount,
    plannedExercises,
    completedSets,
    totalSets,
    plannedSets,
    totalVolume,
    sessionDurationMinutes,
    finishedAt,
    exerciseNames,
    streak,
    sessionXp,
  ]);

  const conquest = getConquestMessage(streak, evolution);
  const evolutionNum = Number(evolution || 0);
  const showEvolutionBar = evolutionNum !== 0;
  const safeXp = Math.max(0, Number(sessionXp || 0));
  const safePlanned = Math.max(0, Number(plannedExercises || 0));
  const safeDone = Math.max(0, Number(exerciseCount || 0));
  const exerciseCompletionPct = safePlanned > 0
    ? Math.min(100, Math.round((safeDone / safePlanned) * 100))
    : 0;
  const personalityLine = useMemo(() => {
    if (safeXp >= 160) return 'Hoje você jogou no modo bruto. Continue amanhã.';
    if (safeXp >= 100) return 'Treino forte entregue. Seu nível acabou de subir.';
    return 'Mais um passo sólido. Consistência vence tudo.';
  }, [safeXp]);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.parallel([
      Animated.spring(heroScale, {
        toValue: 1,
        friction: 6,
        tension: 60,
        useNativeDriver: true,
      }),
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(xpPulse, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(xpPulse, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
      { iterations: 2 }
    ).start();
  }, [heroOpacity, heroScale, xpPulse]);

  return (
    <ScrollView
      testID={WORKOUT_COMPLETE_TEST_IDS.screen}
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* ── CONQUISTA ── */}
      <Animated.View
        style={[
          styles.conquestCard,
          {
            opacity: heroOpacity,
            transform: [{ scale: heroScale }],
          },
        ]}
      >
        <Text style={styles.conquestEmoji}>{conquest.emoji}</Text>
        <Text style={styles.conquestTitle}>{conquest.title}</Text>
        <Text style={styles.conquestSub}>{conquest.sub}</Text>
        <Animated.View
          style={[
            styles.xpVictoryBadge,
            {
              transform: [
                {
                  scale: xpPulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.08],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.xpVictoryText}>+{safeXp} XP</Text>
        </Animated.View>
      </Animated.View>

      {/* ── RESUMO PREMIUM DO TREINO ── */}
      <View testID={WORKOUT_COMPLETE_TEST_IDS.summaryCard} style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>{summary.title}</Text>
        <Text style={styles.summarySubtitle}>{summary.subtitle}</Text>

        <View style={styles.summaryStatsGrid}>
          <View style={styles.summaryStatBlock}>
            <Text style={styles.summaryStatLabel}>{summary.durationLabel}</Text>
            <Text testID={WORKOUT_COMPLETE_TEST_IDS.duration} style={styles.summaryStatValue}>
              {summary.durationValue}
            </Text>
          </View>
          <View style={styles.summaryStatBlock}>
            <Text style={styles.summaryStatLabel}>{summary.exercisesLabel}</Text>
            <Text testID={WORKOUT_COMPLETE_TEST_IDS.exercises} style={styles.summaryStatValue}>
              {summary.exercisesValue}
            </Text>
          </View>
          <View style={styles.summaryStatBlock}>
            <Text style={styles.summaryStatLabel}>{summary.setsLabel}</Text>
            <Text testID={WORKOUT_COMPLETE_TEST_IDS.sets} style={styles.summaryStatValue}>
              {summary.setsValue}
            </Text>
          </View>
          {summary.showVolume ? (
            <View style={styles.summaryStatBlock}>
              <Text style={styles.summaryStatLabel}>{summary.volumeLabel}</Text>
              <Text testID={WORKOUT_COMPLETE_TEST_IDS.volume} style={styles.summaryStatValue}>
                {summary.volumeValue}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.finishedAtRow}>
          <Text style={styles.summaryStatLabel}>{summary.finishedAtLabel}</Text>
          <Text testID={WORKOUT_COMPLETE_TEST_IDS.finishedAt} style={styles.finishedAtValue}>
            {summary.finishedAtValue}
          </Text>
        </View>

        <View style={styles.exerciseListSection}>
          <Text style={styles.summaryStatLabel}>Exercícios realizados</Text>
          <Text testID={WORKOUT_COMPLETE_TEST_IDS.exerciseList} style={styles.exerciseListText}>
            {summary.exerciseList.displayText}
          </Text>
        </View>

        <View style={styles.streakRow}>
          <View style={styles.statItem}>
            <Ionicons name="flame-outline" size={20} color={colors.warning} />
            <Text style={styles.streakValue}>{streak}</Text>
            <Text style={styles.streakLabel}>{streak === 1 ? 'dia seguido' : 'dias seguidos'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.directionCard}>
        <View style={styles.directionHeader}>
          <Text style={styles.directionTitle}>Progresso do treino</Text>
          <Text style={styles.directionValue}>{safeDone}/{safePlanned || safeDone} exercícios</Text>
        </View>
        <View style={styles.directionTrack}>
          <View style={[styles.directionFill, { width: `${Math.max(6, exerciseCompletionPct)}%` }]} />
        </View>
        <Text style={styles.directionSub}>{personalityLine}</Text>
      </View>

      {/* ── EVOLUÇÃO ── */}
      {showEvolutionBar && (
        <View style={styles.evolutionCard}>
          <View style={styles.evolutionRow}>
            <Text style={styles.evolutionLabel}>Evolução vs. último treino</Text>
            <Text style={[styles.evolutionPct, evolutionNum > 0 ? styles.evolutionPos : styles.evolutionNeg]}>
              {evolutionNum > 0 ? `+${evolutionNum}%` : `${evolutionNum}%`}
            </Text>
          </View>
          {prevWeight !== undefined && currWeight !== undefined && (
            <Text style={styles.evolutionCompare}>
              Carga média: {prevWeight}kg → {currWeight}kg
            </Text>
          )}
          <View style={styles.evolutionTrack}>
            <View
              style={[
                styles.evolutionFill,
                { width: `${Math.min(Math.abs(evolutionNum), 100)}%` },
                evolutionNum < 0 && styles.evolutionFillNeg,
              ]}
            />
          </View>
        </View>
      )}

      {/* ── CTAs ── */}
      <View style={styles.actions}>
        <TouchableOpacity
          testID={WORKOUT_COMPLETE_TEST_IDS.btnHome}
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        >
          <Ionicons name="home-outline" size={18} color="#fff" />
          <Text style={styles.btnPrimaryText}>{summary.copy.btnHome}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID={WORKOUT_COMPLETE_TEST_IDS.btnHistory}
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => navigation.navigate('Historico')}
        >
          <Ionicons name="time-outline" size={18} color={colors.primary} />
          <Text style={styles.btnSecondaryText}>{summary.copy.btnHistory}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.motivational}>Mais uma sessão no bolso. Bora manter a sequência 🔥</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
    alignItems: 'center',
  },

  conquestCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    width: '100%',
  },
  conquestEmoji: {
    fontSize: 72,
    marginBottom: spacing.sm,
  },
  conquestTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.8,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  conquestSub: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  xpVictoryBadge: {
    marginTop: spacing.sm,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    backgroundColor: colors.successMuted,
    borderWidth: 1,
    borderColor: colors.success,
  },
  xpVictoryText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },

  summaryCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  summarySubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xxs,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryStatBlock: {
    width: '47%',
    backgroundColor: colors.background,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    padding: spacing.sm,
  },
  summaryStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: spacing.xxs,
  },
  summaryStatValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  finishedAtRow: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  finishedAtValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.xxs,
  },
  exerciseListSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  exerciseListText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.xxs,
    fontWeight: '600',
  },
  streakRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  streakValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  streakLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },

  directionCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  directionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  directionTitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  directionValue: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '800',
  },
  directionTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  directionFill: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  directionSub: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },

  evolutionCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  evolutionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xxs,
  },
  evolutionLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  evolutionPct: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  evolutionPos: { color: colors.success },
  evolutionNeg: { color: colors.danger },
  evolutionCompare: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  evolutionTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  evolutionFill: {
    height: 6,
    backgroundColor: colors.success,
    borderRadius: radius.pill,
  },
  evolutionFillNeg: {
    backgroundColor: colors.danger,
  },

  actions: {
    width: '100%',
    gap: spacing.sm,
  },
  btn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnPrimaryText: {
    color: colors.textInverse,
    fontWeight: '800',
    fontSize: 15,
  },
  btnSecondaryText: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 15,
  },

  motivational: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.2,
    marginTop: spacing.xs,
  },
});
