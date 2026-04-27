import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useUserStore } from '../stores/useUserStore';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing, radius, typography } from '../theme';

function WorkoutStatBadge({ label, value, color }) {
  return (
    <View style={statStyles.wrap}>
      <Text style={[statStyles.value, color && { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', paddingVertical: spacing.xs },
  value: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  label: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
});

export function WorkoutsHubView({ navigation, summary, todayWorkout, recommended, isAdmin }) {
  const safeSummary = summary || { guidedSets: 0 };
  const safeTodayWorkout = Array.isArray(todayWorkout) ? todayWorkout : [];
  const safeRecommended = recommended || {
    title: 'Sem recomendação',
    source: 'fallback',
    confidenceScore: 0,
    decisionReasons: [],
    replacements: [],
  };
  const decisionReasons = Array.isArray(safeRecommended?.decisionReasons)
    ? safeRecommended.decisionReasons
    : [];
  const replacements = Array.isArray(safeRecommended?.replacements)
    ? safeRecommended.replacements
    : [];

  const confidence = Math.round(Number(safeRecommended.confidenceScore || 0) * 100);
  const recommendationSource = String(safeRecommended.source || '').trim() || 'motor_v4/local';

  return (
    <ScrollView
      testID="screen-treinos"
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <ScreenHeader title="Treinos" subtitle="Execute, registre e evolua." />

      {/* Stats do dia */}
      <AppCard>
        <Text style={styles.cardTitle}>Hoje</Text>
        <View style={styles.statsRow}>
          <WorkoutStatBadge
            label="Exercícios"
            value={safeTodayWorkout.length}
            color={safeTodayWorkout.length > 0 ? colors.primary : colors.textMuted}
          />
          <View style={styles.statsDivider} />
          <WorkoutStatBadge
            label="Séries"
            value={safeSummary.guidedSets || 0}
            color={(safeSummary.guidedSets || 0) > 0 ? colors.success : colors.textMuted}
          />
          <View style={styles.statsDivider} />
          <WorkoutStatBadge
            label="Status"
            value={(safeSummary.guidedSets || 0) > 0 ? '✓' : '–'}
            color={(safeSummary.guidedSets || 0) > 0 ? colors.success : colors.textMuted}
          />
        </View>
      </AppCard>

      {/* Motor inteligente */}
      <AppCard accent>
        <View style={styles.recommendedHeader}>
          <Ionicons name="flash" size={18} color={colors.primary} />
          <Text style={styles.recommendedTitle}>Motor V4 — Recomendado</Text>
          {confidence > 0 && (
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>{confidence}%</Text>
            </View>
          )}
        </View>
        <Text style={styles.recommendedWorkout}>{safeRecommended.title}</Text>
        <Text style={styles.recommendedSource}>Fonte: {recommendationSource}</Text>
        {decisionReasons.map((reason, index) => {
          if (index > 1) {
            return null;
          }
          return (
          <Text key={reason} style={styles.reasonLine}>• {reason}</Text>
          );
        })}
        {replacements.map((change, index) => {
          if (index > 0) {
            return null;
          }
          return (
          <Text key={`${change.from}-${index}`} style={styles.replacementLine}>
            ↕ {change.from} → {change.to}
          </Text>
          );
        })}
      </AppCard>

      {/* CTAs principais */}
      <PrimaryButton
        testID="btn-iniciar-treino"
        title="Iniciar treino"
        onPress={() => navigation.navigate('TreinoHoje')}
      />

      <SecondaryButton
        testID="btn-open-history"
        title="Ver histórico de treinos"
        onPress={() => navigation.navigate('Historico')}
      />

      {/* Ações secundárias */}
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          testID="btn-open-free-workout"
          style={styles.actionItem}
          onPress={() => navigation.navigate('TreinoLivre')}
        >
          <Ionicons name="barbell-outline" size={22} color={colors.secondary} />
          <Text style={styles.actionLabel}>Treino Livre</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="btn-open-routines"
          style={styles.actionItem}
          onPress={() => navigation.navigate('Rotinas')}
        >
          <Ionicons name="repeat-outline" size={22} color={colors.accent} />
          <Text style={styles.actionLabel}>Rotinas</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="btn-open-import-workout"
          style={styles.actionItem}
          onPress={() => navigation.navigate('ImportWorkout')}
        >
          <Ionicons name="sparkles-outline" size={22} color={colors.warning} />
          <Text style={styles.actionLabel}>Import IA</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="btn-open-social"
          style={styles.actionItem}
          onPress={() => navigation.navigate('SocialChallenges')}
        >
          <Ionicons name="flame-outline" size={22} color={colors.danger} />
          <Text style={styles.actionLabel}>Desafios</Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="btn-open-ranking"
          style={styles.actionItem}
          onPress={() => navigation.navigate('RankingEvolution')}
        >
          <Ionicons name="trophy-outline" size={22} color={colors.primary} />
          <Text style={styles.actionLabel}>Ranking</Text>
        </TouchableOpacity>
      </View>

      {/* Admin — somente para role admin */}
      {isAdmin && (
        <SecondaryButton
          testID="btn-open-admin"
          title="⚙️ Painel admin"
          onPress={() => navigation.navigate('Admin')}
          style={styles.adminBtn}
        />
      )}
    </ScrollView>
  );
}

export default function WorkoutsHubScreen({ navigation }) {
  const { getTodayWorkoutSummary, getTodayWorkout, getRecommendedWorkoutV4 } = useApp();
  const user = useUserStore((state) => state.user);
  const isAdmin = user?.role === 'admin';

  const summary = getTodayWorkoutSummary();
  const todayWorkout = getTodayWorkout();
  const recommended = getRecommendedWorkoutV4();

  return (
    <WorkoutsHubView
      navigation={navigation}
      summary={summary}
      todayWorkout={todayWorkout}
      recommended={recommended}
      isAdmin={isAdmin}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingTop: 56,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  cardTitle: {
    ...typography.sectionTitle,
    marginBottom: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },

  // Recommended card
  recommendedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  recommendedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  confidenceBadge: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  recommendedWorkout: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  recommendedSource: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  reasonLine: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  replacementLine: {
    color: colors.warning,
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },

  // Actions grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  actionItem: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 6,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
  },

  adminBtn: {
    marginTop: spacing.xs,
    borderColor: colors.danger,
  },
});
