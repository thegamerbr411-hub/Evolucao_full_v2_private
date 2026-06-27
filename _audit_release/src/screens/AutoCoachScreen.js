import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, PrimaryButton, ScreenHeader } from '../components/ui';
import { colors, spacing } from '../theme';

const CARD = colors.card;
const BORDER = colors.border;
const TEXT = colors.textPrimary;
const MUTED = colors.textSecondary;
const ACCENT = colors.secondary;

function ScoreArc({ score }) {
  const color =
    score >= 85 ? colors.success :
    score >= 70 ? '#3B82F6' :
    score >= 50 ? colors.warning :
    colors.danger;

  return (
    <View style={styles.scoreArcWrapper}>
      <View style={[styles.scoreCircle, { borderColor: color }]}>
        <Text style={[styles.scoreNumber, { color }]}>{score}</Text>
        <Text style={styles.scoreMax}>/100</Text>
      </View>
    </View>
  );
}

function MiniBar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <View style={styles.miniBarRow}>
      <Text style={styles.miniBarLabel}>{label}</Text>
      <View style={styles.miniBarBg}>
        <View style={[styles.miniBarFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.miniBarPts, { color }]}>{value}/{max}</Text>
    </View>
  );
}

function MissionCard({ mission, onComplete }) {
  const borderColor = mission.completed ? colors.success : BORDER;
  const bgColor = mission.completed ? '#0F2A1A' : CARD;

  return (
    <View style={[styles.missionCard, { borderColor, backgroundColor: bgColor }]}>
      <View style={styles.missionLeft}>
        <Text style={styles.missionIcon}>{mission.icon}</Text>
        <View style={styles.missionInfo}>
          <Text style={[styles.missionTitle, mission.completed ? styles.missionTitleDone : null]}>{mission.title}</Text>
          <Text style={styles.missionDesc}>{mission.description}</Text>
        </View>
      </View>
      <View style={styles.missionRight}>
        {mission.completed ? (
          <Text style={styles.missionDoneText}>Feito</Text>
        ) : (
          <TouchableOpacity style={styles.missionBtn} onPress={() => onComplete(mission.id, mission.xpReward)}>
            <Text style={styles.missionBtnText}>+{mission.xpReward} XP</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SuggestionCard({ suggestion, applied, onApply }) {
  const isAlert = suggestion.payload == null;

  return (
    <View style={[styles.suggCard, isAlert ? styles.suggCardAlert : null]}>
      <View style={styles.suggHeader}>
        <Text style={styles.suggIcon}>{suggestion.icon}</Text>
        <Text style={styles.suggTitle}>{suggestion.title}</Text>
      </View>
      <Text style={styles.suggReason}>{suggestion.reason}</Text>
      {!isAlert ? (
        <View style={styles.suggFooter}>
          <Text style={styles.suggAction}>{suggestion.action}</Text>
          {applied ? (
            <View style={styles.appliedBadge}>
              <Text style={styles.appliedText}>Aplicado</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.applyBtn} onPress={() => onApply(suggestion.payload)}>
              <Text style={styles.applyBtnText}>Aplicar ajuste</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </View>
  );
}

export default function AutoCoachScreen({ navigation }) {
  const {
    getPerformanceScore,
    getAutoCoachSuggestions,
    applyMacroOverride,
    getDailyMissions,
    completeMission,
    hasFeatureAccess,
  } = useApp();

  const [appliedIds, setAppliedIds] = useState([]);
  const [missionFeedback, setMissionFeedback] = useState('');

  const score = useMemo(() => {
    const raw = getPerformanceScore?.() || {};
    return {
      score: Number(raw.score || 0),
      label: String(raw.label || 'Sem dados suficientes'),
      training: Number(raw.training || 0),
      maxTraining: Number(raw.maxTraining || 100),
      diet: Number(raw.diet || 0),
      maxDiet: Number(raw.maxDiet || 100),
      consistency: Number(raw.consistency || 0),
      maxConsistency: Number(raw.maxConsistency || 100),
    };
  }, [getPerformanceScore]);
  const coach = useMemo(() => {
    const raw = getAutoCoachSuggestions?.() || {};
    return {
      hasData: Boolean(raw.hasData),
      message: String(raw.message || 'Sem dados suficientes para sugerir ajustes agora.'),
      applied: raw.applied || null,
      suggestions: Array.isArray(raw.suggestions) ? raw.suggestions : [],
    };
  }, [getAutoCoachSuggestions]);
  const missions = useMemo(() => {
    const raw = getDailyMissions?.();
    return Array.isArray(raw) ? raw : [];
  }, [getDailyMissions]);

  const handleApply = useCallback((payload, id) => {
    applyMacroOverride(payload);
    setAppliedIds((prev) => [...prev, id]);
  }, [applyMacroOverride]);

  const handleComplete = useCallback((missionId, xpReward) => {
    completeMission(missionId, xpReward);
    setMissionFeedback(`+${xpReward} XP`);
    setTimeout(() => setMissionFeedback(''), 1800);
  }, [completeMission]);

  if (!hasFeatureAccess('auto_coach')) {
    return (
      <View style={styles.lockContainer}>
        <ScreenHeader title="Auto Coach" subtitle="Recurso premium para ajustes inteligentes." />
        <PrimaryButton
          title="Desbloquear PRO"
          onPress={() => navigation.replace('Paywall', { featureKey: 'auto_coach', source: 'auto_coach_screen' })}
        />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <ScreenHeader title="Auto Coach" subtitle="IA analisa sua semana e age por voce" />

      <AppCard style={styles.scoreCard}>
        <View style={styles.scoreLeft}>
          <Text style={styles.sectionTitle}>Performance Score</Text>
          <Text style={[styles.scoreLabel, score.score >= 70 ? styles.scoreLabelGood : score.score >= 50 ? styles.scoreLabelMed : styles.scoreLabelLow]}>
            {score.label}
          </Text>
          <MiniBar label="Treino" value={score.training} max={score.maxTraining} color="#3B82F6" />
          <MiniBar label="Dieta" value={score.diet} max={score.maxDiet} color={colors.success} />
          <MiniBar label="Consistencia" value={score.consistency} max={score.maxConsistency} color={colors.warning} />
        </View>
        <ScoreArc score={score.score} />
      </AppCard>

      <Text style={styles.sectionTitle}>Missoes do dia</Text>
      {missionFeedback ? (
        <View style={styles.xpToast}>
          <Text style={styles.xpToastText}>{missionFeedback} conquistado</Text>
        </View>
      ) : null}
      {missions.map((mission) => (
        <MissionCard key={mission.id} mission={mission} onComplete={handleComplete} />
      ))}

      <Text style={[styles.sectionTitle, styles.sectionTop]}>Ajustes automáticos</Text>
      {!coach.hasData ? (
        <AppCard style={styles.emptyCard}>
          <Text style={styles.emptyText}>{coach.message}</Text>
        </AppCard>
      ) : coach.suggestions.length === 0 ? (
        <AppCard style={styles.emptyCard}>
          <Text style={styles.emptyText}>Seus macros e treinos estão dentro do esperado esta semana. Continue assim.</Text>
        </AppCard>
      ) : (
        <>
          {coach.applied ? (
            <Text style={styles.appliedInfoText}>Ultimo ajuste aplicado em {coach.applied}</Text>
          ) : null}
          {coach.suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              applied={appliedIds.includes(suggestion.id)}
              onApply={(payload) => handleApply(payload, suggestion.id)}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  lockContainer: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionTop: {
    marginTop: 18,
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  scoreLeft: {
    flex: 1,
    paddingRight: 12,
  },
  scoreLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  scoreLabelGood: { color: colors.success },
  scoreLabelMed: { color: colors.warning },
  scoreLabelLow: { color: colors.danger },
  scoreArcWrapper: {
    alignItems: 'center',
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNumber: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
  scoreMax: {
    fontSize: 10,
    color: MUTED,
  },
  miniBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  miniBarLabel: {
    fontSize: 11,
    color: MUTED,
    width: 72,
  },
  miniBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: BORDER,
    borderRadius: 4,
    overflow: 'hidden',
  },
  miniBarFill: {
    height: 4,
    borderRadius: 4,
  },
  miniBarPts: {
    fontSize: 10,
    fontWeight: '700',
    width: 28,
    textAlign: 'right',
  },
  missionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  missionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  missionIcon: {
    fontSize: 22,
    marginTop: 2,
  },
  missionInfo: {
    flex: 1,
  },
  missionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 2,
  },
  missionTitleDone: {
    color: MUTED,
    textDecorationLine: 'line-through',
  },
  missionDesc: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 16,
  },
  missionRight: {
    marginLeft: 10,
    alignItems: 'flex-end',
  },
  missionBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  missionBtnText: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '700',
  },
  missionDoneText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  xpToast: {
    backgroundColor: CARD,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: BORDER,
  },
  xpToastText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '700',
  },
  suggCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 12,
  },
  suggCardAlert: {
    borderColor: '#7C3AED',
    backgroundColor: '#1A0F33',
  },
  suggHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  suggIcon: {
    fontSize: 20,
  },
  suggTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: TEXT,
  },
  suggReason: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 20,
    marginBottom: 12,
  },
  suggFooter: {
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 12,
  },
  suggAction: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: '600',
    marginBottom: 10,
  },
  applyBtn: {
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  applyBtnText: {
    color: '#E0F2FE',
    fontSize: 14,
    fontWeight: '700',
  },
  appliedBadge: {
    backgroundColor: '#0F2A1A',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success,
  },
  appliedText: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '700',
  },
  appliedInfoText: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 10,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  unlockButton: {
    marginTop: 12,
  },
});
