import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '../theme';
import * as Haptics from 'expo-haptics';

function getConquestMessage(streak, evolution, isBaseline) {
  if (isBaseline) return { emoji: '✅', title: 'Baseline estabelecida!', sub: 'Primeiro treino registrado com sucesso. Agora so evoluir daqui para frente.' };
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
    totalVolume = 0,
    sessionXp = 0,
  } = route?.params || {};

  const heroScale = useRef(new Animated.Value(0.92)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;
  const xpPulse = useRef(new Animated.Value(0)).current;

  const prevWeightNum = Number(prevWeight || 0);
  const isBaseline = !prevWeightNum;
  const conquest = getConquestMessage(streak, evolution, isBaseline);
  const evolutionNum = Number(evolution || 0);
  const showEvolutionBar = !isBaseline && evolutionNum !== 0;
  const safeXp = Math.max(0, Number(sessionXp || 0));
  const safeVolume = Math.max(0, Number(totalVolume || 0));
  const safePlanned = Math.max(0, Number(plannedExercises || 0));
  const safeDone = Math.max(0, Number(exerciseCount || 0));
  const normalizedDone = safePlanned > 0 ? Math.min(safeDone, safePlanned) : safeDone;
  const exerciseCompletionPct = safePlanned > 0
    ? Math.min(100, Math.round((normalizedDone / safePlanned) * 100))
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

      {/* ── RESUMO DO TREINO ── */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>RESUMO DO TREINO</Text>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Ionicons name="barbell-outline" size={22} color={colors.primary} />
            <Text style={styles.statValue}>{exerciseCount || totalSets}</Text>
            <Text style={styles.statName}>{exerciseCount ? 'exercícios' : 'séries'}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="time-outline" size={22} color={colors.secondary} />
            <Text style={styles.statValue}>{sessionDurationMinutes}</Text>
            <Text style={styles.statName}>minutos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Ionicons name="flame-outline" size={22} color={colors.warning} />
            <Text style={styles.statValue}>{streak}</Text>
            <Text style={styles.statName}>{streak === 1 ? 'dia seguido' : 'dias seguidos'}</Text>
          </View>
        </View>
        <View style={styles.impactRow}>
          <Text style={styles.impactText}>Carga total: {safeVolume.toLocaleString()} kg</Text>
          <Text style={styles.impactText}>XP ganho: +{safeXp}</Text>
        </View>
      </View>

      <View style={styles.directionCard}>
        <View style={styles.directionHeader}>
          <Text style={styles.directionTitle}>Progresso do treino</Text>
          <Text style={styles.directionValue}>{normalizedDone}/{safePlanned || normalizedDone} exercícios</Text>
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

      {isBaseline ? (
        <View style={styles.baselineCard}>
          <Text style={styles.baselineTitle}>Baseline estabelecida!</Text>
          <Text style={styles.baselineText}>Sem treino anterior para comparação. O próximo resumo já mostrará sua evolução real.</Text>
        </View>
      ) : null}

      {/* ── CTAs ── */}
      <View style={styles.actions}>
        <TouchableOpacity
          testID="btn-complete-continuar-amanha"
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => navigation.navigate('MainTabs', { screen: 'Home' })}
        >
          <Ionicons name="calendar-outline" size={18} color="#fff" />
          <Text style={styles.btnPrimaryText}>Continuar amanhã</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="btn-complete-ver-evolucao"
          style={[styles.btn, styles.btnSecondary]}
          onPress={() => navigation.navigate('Historico')}
        >
          <Ionicons name="trending-up-outline" size={18} color={colors.primary} />
          <Text style={styles.btnSecondaryText}>Ver evolução</Text>
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

  // CONQUISTA
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
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
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
    paddingVertical: 6,
    backgroundColor: colors.successMuted,
    borderWidth: 1,
    borderColor: colors.success,
  },
  xpVictoryText: {
    color: colors.success,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  // RESUMO
  summaryCard: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: colors.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  statName: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  impactRow: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  impactText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
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

  // EVOLUÇÃO
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
    marginBottom: 4,
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
  baselineCard: {
    width: '100%',
    backgroundColor: '#0E2233',
    borderWidth: 1,
    borderColor: '#2E6B9A',
    borderRadius: radius.md,
    padding: spacing.md,
  },
  baselineTitle: {
    color: '#86EFAC',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  baselineText: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },

  // AÇÕES
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
  btn: {
    borderRadius: radius.md,
    paddingVertical: 14,
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
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  btnSecondaryText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },

  motivational: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});
