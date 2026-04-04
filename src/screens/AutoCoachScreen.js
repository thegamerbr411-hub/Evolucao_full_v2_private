import React, { useCallback, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useApp } from '../context/AppContext';

const DARK = '#0F172A';
const CARD = '#1E293B';
const BORDER = '#2E3F58';
const TEXT = '#E2E8F0';
const MUTED = '#94A3B8';
const ACCENT = '#60A5FA';

function ScoreArc({ score }) {
  const color =
    score >= 85 ? '#2A9E66' :
    score >= 70 ? '#3B82F6' :
    score >= 50 ? '#F59E0B' :
    '#C14343';
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
  const borderColor = mission.completed ? '#2A9E66' : BORDER;
  const bgColor = mission.completed ? '#0F2A1A' : CARD;
  return (
    <View style={[styles.missionCard, { borderColor, backgroundColor: bgColor }]}>
      <View style={styles.missionLeft}>
        <Text style={styles.missionIcon}>{mission.icon}</Text>
        <View style={styles.missionInfo}>
          <Text style={[styles.missionTitle, mission.completed && styles.missionTitleDone]}>
            {mission.title}
          </Text>
          <Text style={styles.missionDesc}>{mission.description}</Text>
        </View>
      </View>
      <View style={styles.missionRight}>
        {mission.completed ? (
          <Text style={styles.missionDoneText}>✓ Feito</Text>
        ) : (
          <TouchableOpacity
            style={styles.missionBtn}
            onPress={() => onComplete(mission.id, mission.xpReward)}
          >
            <Text style={styles.missionBtnText}>+{mission.xpReward} XP</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function SuggestionCard({ suggestion, applied, onApply }) {
  const isApplied = applied;
  const isAlert = suggestion.payload == null;
  return (
    <View style={[styles.suggCard, isAlert && styles.suggCardAlert]}>
      <View style={styles.suggHeader}>
        <Text style={styles.suggIcon}>{suggestion.icon}</Text>
        <Text style={styles.suggTitle}>{suggestion.title}</Text>
      </View>
      <Text style={styles.suggReason}>{suggestion.reason}</Text>
      {!isAlert && (
        <View style={styles.suggFooter}>
          <Text style={styles.suggAction}>{suggestion.action}</Text>
          {isApplied ? (
            <View style={styles.appliedBadge}>
              <Text style={styles.appliedText}>Aplicado</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.applyBtn} onPress={() => onApply(suggestion.payload)}>
              <Text style={styles.applyBtnText}>Aplicar ajuste</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export default function AutoCoachScreen({ navigation }) {
  const { getPerformanceScore, getAutoCoachSuggestions, applyMacroOverride, getDailyMissions, completeMission, hasFeatureAccess } = useApp();

  if (!hasFeatureAccess('auto_coach')) {
    return (
      <View style={[styles.container, styles.lockContainer]}>
        <View style={styles.content}>
          <Text style={styles.title}>Auto Coach</Text>
          <Text style={styles.subtitle}>Recurso premium para ajustes inteligentes.</Text>
          <TouchableOpacity
            style={styles.unlockButton}
            onPress={() => navigation.replace('Paywall', { featureKey: 'auto_coach', source: 'auto_coach_screen' })}
          >
            <Text style={styles.unlockButtonText}>Desbloquear PRO</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const [appliedIds, setAppliedIds] = useState([]);
  const [missionFeedback, setMissionFeedback] = useState('');

  const score = useMemo(() => getPerformanceScore(), [getPerformanceScore]);
  const coach = useMemo(() => getAutoCoachSuggestions(), [getAutoCoachSuggestions]);
  const missions = useMemo(() => getDailyMissions(), [getDailyMissions]);

  const handleApply = useCallback((payload, id) => {
    applyMacroOverride(payload);
    setAppliedIds((prev) => [...prev, id]);
  }, [applyMacroOverride]);

  const handleComplete = useCallback((missionId, xpReward) => {
    completeMission(missionId, xpReward);
    setMissionFeedback(`+${xpReward} XP`);
    setTimeout(() => setMissionFeedback(''), 2000);
  }, [completeMission]);

  const alreadyApplied = coach.applied;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.backText}>← Voltar</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Auto Coach</Text>
      <Text style={styles.subtitle}>IA analisa sua semana e age por voce</Text>

      {/* Performance Score */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreLeft}>
          <Text style={styles.sectionTitle}>Performance Score</Text>
          <Text style={[styles.scoreLabel, score.score >= 70 ? styles.scoreLabelGood : score.score >= 50 ? styles.scoreLabelMed : styles.scoreLabelLow]}>
            {score.label}
          </Text>
          <MiniBar label="Treino" value={score.training} max={score.maxTraining} color="#3B82F6" />
          <MiniBar label="Dieta" value={score.diet} max={score.maxDiet} color="#2A9E66" />
          <MiniBar label="Consistencia" value={score.consistency} max={score.maxConsistency} color="#F59E0B" />
        </View>
        <ScoreArc score={score.score} />
      </View>

      {/* Daily Missions */}
      <Text style={styles.sectionTitle}>Missoes do dia</Text>
      {missionFeedback ? (
        <View style={styles.xpToast}>
          <Text style={styles.xpToastText}>{missionFeedback} conquistado!</Text>
        </View>
      ) : null}
      {missions.map((m) => (
        <MissionCard key={m.id} mission={m} onComplete={handleComplete} />
      ))}

      {/* Auto Coach Suggestions */}
      <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Ajustes automaticos</Text>
      {!coach.hasData ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>{coach.message}</Text>
        </View>
      ) : coach.suggestions.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            Seus macros e treinos estao dentro do esperado esta semana.{'\n'}Continue assim!
          </Text>
        </View>
      ) : (
        <>
          {alreadyApplied ? (
            <View style={styles.appliedInfoRow}>
              <Text style={styles.appliedInfoText}>Ultimo ajuste aplicado em {alreadyApplied}</Text>
            </View>
          ) : null}
          {coach.suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              applied={appliedIds.includes(s.id)}
              onApply={(payload) => handleApply(payload, s.id)}
            />
          ))}
        </>
      )}

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 40,
  },
  backBtn: {
    marginBottom: 12,
  },
  backText: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: MUTED,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  // Score card
  scoreCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  scoreLeft: {
    flex: 1,
    paddingRight: 12,
  },
  scoreLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  scoreLabelGood: { color: '#2A9E66' },
  scoreLabelMed: { color: '#F59E0B' },
  scoreLabelLow: { color: '#C14343' },
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
    backgroundColor: '#2E3F58',
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
  // Missions
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
    color: '#2A9E66',
    fontSize: 13,
    fontWeight: '700',
  },
  xpToast: {
    backgroundColor: '#172033',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2B4A6F',
  },
  xpToastText: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '700',
  },
  // Suggestions
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
    color: '#CBD5E1',
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
    borderColor: '#2A9E66',
  },
  appliedText: {
    color: '#2A9E66',
    fontSize: 13,
    fontWeight: '700',
  },
  appliedInfoRow: {
    marginBottom: 10,
  },
  appliedInfoText: {
    fontSize: 12,
    color: MUTED,
  },
  emptyCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  emptyText: {
    color: MUTED,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  spacer: {
    height: 20,
  },
  lockContainer: {
    justifyContent: 'center',
  },
  unlockButton: {
    marginTop: 12,
    backgroundColor: '#1D4ED8',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  unlockButtonText: {
    color: '#E2ECFF',
    fontWeight: '800',
  },
});
