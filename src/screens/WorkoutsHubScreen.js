import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp, useWorkoutDomain } from '../context/AppContext';
import { useUserStore } from '../stores/useUserStore';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing, radius, typography } from '../theme';
import { logEvent } from '../core/logger';
import { isFeatureVariantEnabled, trackEmptyState, trackScreenAction } from '../core/observability';
import { listExerciseNames, MUSCLE_GROUP_LABELS, searchExercises } from '../data/exercises.js';
import { QA_ELEMENTS, QA_SCREENS, qaAliasProps, qaProps } from '../qa/selectorRegistry';

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

export function WorkoutsHubView({
  navigation,
  summary,
  todayWorkout,
  recommended,
  isAdmin,
  smartSuggestions = [],
  onQuickAddSuggestion,
  quickAddMessage,
}) {
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
  const safeReasons = decisionReasons
    .filter((reason) => typeof reason === 'string' && reason.trim())
    .slice(0, 2);
  const safeReplacements = replacements
    .filter((change) => change && typeof change === 'object' && (change.from || change.to))
    .slice(0, 1);

  const confidence = Math.round(Number(safeRecommended.confidenceScore || 0) * 100);
  const recommendationSource = String(safeRecommended.source || '').trim() || 'motor_v4/local';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView
      {...qaAliasProps(QA_SCREENS.treinos, 'screen-treinos')}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View {...qaProps('workouts_hub_anchor')} style={{ width: 1, height: 1 }} />
      <ScreenHeader title="Treinos" subtitle="Execute, registre e evolua." />

      {/* Stats do dia */}
      <AppCard variant="hero" elevated>
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

      {safeTodayWorkout.length === 0 && smartSuggestions.length > 0 ? (
        <AppCard accent variant="empty">
          <View style={styles.emptyHeader}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
            <Text style={styles.emptyTitle}>Nenhum exercicio encontrado. Quer ver sugestoes?</Text>
          </View>
          <Text style={styles.emptyDescription}>
            Selecionamos opcoes rapidas para manter o treino ativo hoje.
          </Text>
          <View style={styles.emptySuggestionsWrap}>
            {smartSuggestions.map((exercise) => (
              <TouchableOpacity
                key={exercise.id}
                {...qaProps(`btn_smart_empty_${exercise.id}`)}
                style={styles.emptySuggestionButton}
                onPress={() => onQuickAddSuggestion?.(exercise)}
              >
                <Text style={styles.emptySuggestionName}>{exercise.name}</Text>
                <Text style={styles.emptySuggestionMeta}>
                  + Adicionar rapido • {MUSCLE_GROUP_LABELS[exercise.primaryMuscle] || exercise.primaryMuscle || 'geral'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {quickAddMessage ? <Text style={styles.quickAddFeedback}>{quickAddMessage}</Text> : null}
        </AppCard>
      ) : null}

      {/* Motor inteligente */}
      <AppCard accent variant="secondary">
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
        {safeReasons.map((reason) => {
          return (
          <Text key={reason} style={styles.reasonLine}>• {reason}</Text>
          );
        })}
        {safeReplacements.map((change, index) => {
          const from = String(change.from || 'Exercicio atual');
          const to = String(change.to || 'Alternativa segura');
          return (
          <Text key={`${from}-${index}`} style={styles.replacementLine}>
            ↕ {from} → {to}
          </Text>
          );
        })}
      </AppCard>

      {/* CTAs principais */}
      <PrimaryButton
        {...qaAliasProps(QA_ELEMENTS.btnStartWorkout, 'btn-iniciar-treino')}
        title="Iniciar treino"
        onPress={() => navigation.navigate('TreinoHoje')}
      />

      <SecondaryButton
        {...qaProps('btn_open_history')}
        title="Ver histórico de treinos"
        onPress={() => navigation.navigate('Historico')}
      />

      {/* Ações secundárias */}
      <View style={styles.actionsGrid}>
        <TouchableOpacity
          {...qaProps('btn_open_free_workout')}
          style={styles.actionItem}
          onPress={() => navigation.navigate('TreinoLivre')}
        >
          <Ionicons name="barbell-outline" size={22} color={colors.secondary} />
          <Text style={styles.actionLabel}>Treino Livre</Text>
        </TouchableOpacity>

        <TouchableOpacity
          {...qaProps('btn_open_routines')}
          style={styles.actionItem}
          onPress={() => navigation.navigate('Rotinas')}
        >
          <Ionicons name="repeat-outline" size={22} color={colors.accent} />
          <Text style={styles.actionLabel}>Rotinas</Text>
        </TouchableOpacity>

        <TouchableOpacity
          {...qaProps('btn_open_import_workout')}
          style={styles.actionItem}
          onPress={() => navigation.navigate('ImportWorkout')}
        >
          <Ionicons name="sparkles-outline" size={22} color={colors.warning} />
          <Text style={styles.actionLabel}>Import IA</Text>
        </TouchableOpacity>

        <TouchableOpacity
          {...qaProps('btn_open_social')}
          style={styles.actionItem}
          onPress={() => navigation.navigate('SocialChallenges')}
        >
          <Ionicons name="flame-outline" size={22} color={colors.danger} />
          <Text style={styles.actionLabel}>Desafios</Text>
        </TouchableOpacity>

        <TouchableOpacity
          {...qaProps('btn_open_ranking')}
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
          {...qaAliasProps(QA_ELEMENTS.btnOpenAdmin, 'btn-open-admin')}
          title="⚙️ Painel admin"
          onPress={() => navigation.navigate('Admin')}
          style={styles.adminBtn}
        />
      )}
    </ScrollView>
    </SafeAreaView>
  );
}

function inferSuggestedMuscle({ recommended, todayWorkout }) {
  const todayFirst = Array.isArray(todayWorkout) && todayWorkout.length > 0 ? todayWorkout[0] : null;
  const todayMuscle = String(todayFirst?.musclePrimary?.[0] || '').toLowerCase();
  if (todayMuscle) {
    return todayMuscle;
  }

  const textBlob = `${recommended?.title || ''} ${(recommended?.decisionReasons || []).join(' ')}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (textBlob.includes('peito')) return 'peito';
  if (textBlob.includes('costa')) return 'costas';
  if (textBlob.includes('ombro')) return 'ombro';
  if (textBlob.includes('biceps')) return 'biceps';
  if (textBlob.includes('triceps')) return 'triceps';
  if (textBlob.includes('posterior') || textBlob.includes('quadriceps') || textBlob.includes('perna')) {
    return 'pernas';
  }

  return 'all';
}

function buildSmartSuggestions({ recommended, todayWorkout }) {
  const popularNames = new Set([
    'Leg Press 45',
    'Supino Maquina (Chest Press)',
    'Remada Sentada Maquina',
    'Agachamento Livre',
    'Puxada Frontal Polia',
  ]);
  const existingNames = new Set((todayWorkout || []).map((item) => String(item?.name || '').toLowerCase()));
  const muscle = inferSuggestedMuscle({ recommended, todayWorkout });
  const canSearch = typeof searchExercises === 'function';
  const sourceCandidates = canSearch
    ? searchExercises({ muscle })
    : listExerciseNames().map((name, index) => ({
        id: `fallback-${index + 1}`,
        name,
        musclePrimary: [muscle === 'all' ? 'geral' : muscle],
      }));
  const candidates = (Array.isArray(sourceCandidates) ? sourceCandidates : [])
    .filter((item) => item && typeof item === 'object' && String(item?.name || '').trim())
    .filter((item) => !existingNames.has(String(item?.name || '').toLowerCase()));

  return candidates
    .sort((a, b) => {
      const aPopular = popularNames.has(a.name) ? 1 : 0;
      const bPopular = popularNames.has(b.name) ? 1 : 0;
      if (aPopular !== bPopular) {
        return bPopular - aPopular;
      }
      return String(a?.name || '').localeCompare(String(b?.name || ''), 'pt-BR');
    })
    .slice(0, 3);
}

export default function WorkoutsHubScreen({ navigation }) {
  const { getTodayWorkoutSummary, getTodayWorkout, getRecommendedWorkoutV4 } = useApp();
  const { addExercise } = useWorkoutDomain();
  const user = useUserStore((state) => state.user);
  const isAdmin = user?.role === 'admin';
  const [quickAddMessage, setQuickAddMessage] = React.useState('');

  const summary = typeof getTodayWorkoutSummary === 'function' ? getTodayWorkoutSummary() : { guidedSets: 0 };
  const todayWorkout = typeof getTodayWorkout === 'function' ? getTodayWorkout() : [];
  const recommended = typeof getRecommendedWorkoutV4 === 'function'
    ? getRecommendedWorkoutV4()
    : {
        title: 'Treino de consistencia',
        source: 'fallback',
        confidenceScore: 0,
        decisionReasons: ['Recomendacao local indisponivel no momento.'],
        replacements: [],
      };
  const isSmartEmptyEnabled = isFeatureVariantEnabled('smart_empty_state', 'B');
  const smartSuggestions = React.useMemo(
    () => (isSmartEmptyEnabled ? buildSmartSuggestions({ recommended, todayWorkout }) : []),
    [isSmartEmptyEnabled, recommended, todayWorkout],
  );

  const handleQuickAddSuggestion = React.useCallback((exercise) => {
    const safeExercise = exercise && typeof exercise === 'object' ? exercise : null;
    if (!safeExercise?.name) {
      return;
    }

    const alreadyExists = (todayWorkout || []).some(
      (item) => String(item?.name || '').toLowerCase() === String(safeExercise.name || '').toLowerCase(),
    );
    if (alreadyExists) {
      setQuickAddMessage('Esse exercicio ja estava no treino.');
      return;
    }

    addExercise?.({
      id: safeExercise.id || `smart-${Date.now()}`,
      name: safeExercise.name,
      sets: 3,
      reps: '8-12',
      targetWeight: 0,
      musclePrimary: safeExercise.musclePrimary || [],
    });

    setQuickAddMessage(`${safeExercise.name} adicionado ao treino de hoje.`);
    logEvent('smart_empty_quick_add', {
      screen: 'WorkoutsHubScreen',
      exerciseName: safeExercise.name,
      source: 'smart_empty_state',
    });
    trackScreenAction('WorkoutsHubScreen', 'smart_empty_quick_add', {
      exerciseName: safeExercise.name,
      source: 'smart_empty_state',
    });
  }, [addExercise, todayWorkout]);

  React.useEffect(() => {
    if (Array.isArray(todayWorkout) && todayWorkout.length > 0) {
      return;
    }

    trackEmptyState({
      screen: 'WorkoutsHubScreen',
      reason: 'exercise_list_empty',
      filter: 'today',
    });
    logEvent('empty_exercise_list', {
      screen: 'WorkoutsHubScreen',
      filter: 'today',
    });
  }, [todayWorkout]);

  return (
    <WorkoutsHubView
      navigation={navigation}
      summary={summary}
      todayWorkout={todayWorkout}
      recommended={recommended}
      isAdmin={isAdmin}
      smartSuggestions={smartSuggestions}
      onQuickAddSuggestion={isSmartEmptyEnabled ? handleQuickAddSuggestion : null}
      quickAddMessage={quickAddMessage}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.md,
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

  emptyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
    flex: 1,
  },
  emptyDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  emptySuggestionsWrap: {
    gap: spacing.xs,
  },
  emptySuggestionButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  emptySuggestionName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySuggestionMeta: {
    marginTop: 2,
    fontSize: 11,
    color: colors.textSecondary,
    textTransform: 'capitalize',
  },
  quickAddFeedback: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.success,
    fontWeight: '700',
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
