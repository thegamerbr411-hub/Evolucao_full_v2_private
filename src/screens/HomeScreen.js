import React, { useMemo, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useGamificationStore } from '../stores/useGamificationStore';
import { useUserStore } from '../stores/useUserStore';
import { useNutritionStore } from '../stores/useNutritionStore';
import { useApp } from '../context/AppContext';
import { colors, spacing, radius, typography } from '../theme';
import {
  canInterruptCoach,
  dismissDropRecoveryCandidate,
  getAdaptiveHomeConfig,
  logEvent,
  markCoachInterruption,
} from '../core/observability';

const XP_PER_LEVEL = 500;
const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function MacroRing({ label, value, target, color }) {
  const pct = target > 0 ? Math.min(value / target, 1) : 0;
  const barWidth = Math.round(pct * 100);
  return (
    <View style={macroStyles.wrap}>
      <Text style={macroStyles.value}>{value}<Text style={macroStyles.unit}>g</Text></Text>
      <View style={macroStyles.track}>
        <View style={[macroStyles.fill, { width: `${barWidth}%`, backgroundColor: color }]} />
      </View>
      <Text style={macroStyles.label}>{label}</Text>
      <Text style={macroStyles.target}>/{target}g</Text>
    </View>
  );
}

const macroStyles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', gap: 4 },
  value: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  unit: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  track: { width: '85%', height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  label: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase' },
  target: { fontSize: 10, color: colors.textMuted },
});

function QuickAction({ icon, label, onPress, accent, testID }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={[qaStyles.btn, accent && qaStyles.btnAccent]}>
      <Ionicons name={icon} size={22} color={accent ? colors.textInverse : colors.primary} />
      <Text style={[qaStyles.label, accent && qaStyles.labelAccent]}>{label}</Text>
    </TouchableOpacity>
  );
}

function WeeklyProgress({ streak, onPress }) {
  const today = new Date().getDay(); // 0=Dom, 1=Seg...
  // Quantos dias desta semana (Dom a hoje) foram treinados com base no streak
  const daysThisWeek = today + 1; // número de dias da semana até hoje (1-7)
  const trainedInWeek = Math.min(streak, daysThisWeek);
  // Marca os últimos `trainedInWeek` dias antes de hoje como feitos
  const dots = WEEK_DAYS.map((label, idx) => {
    const dayOffset = today - idx; // positivo = passou, 0 = hoje, negativo = futuro
    const done = dayOffset >= 0 && dayOffset < streak;
    const isToday = idx === today;
    return { label, done, isToday };
  });

  const totalWeekWorkouts = dots.filter((d) => d.done).length;

  return (
    <TouchableOpacity style={wpStyles.card} onPress={onPress} activeOpacity={0.85}>
      <View style={wpStyles.header}>
        <Text style={wpStyles.title}>SEMANA ATUAL</Text>
        <Text style={wpStyles.count}>{totalWeekWorkouts}/7 treinos</Text>
      </View>
      <View style={wpStyles.dotsRow}>
        {dots.map(({ label, done, isToday }, i) => (
          <View key={i} style={wpStyles.dotWrap}>
            <View style={[wpStyles.dot, done && wpStyles.dotDone, isToday && wpStyles.dotToday]}>
              {done && <Ionicons name="checkmark" size={10} color="#fff" />}
            </View>
            <Text style={[wpStyles.dotLabel, isToday && wpStyles.dotLabelToday]}>{label}</Text>
          </View>
        ))}
      </View>
      {streak > 0 && (
        <Text style={wpStyles.streakHint}>🔥 {streak} {streak === 1 ? 'dia' : 'dias'} seguidos — continue!</Text>
      )}
    </TouchableOpacity>
  );
}

const qaStyles = StyleSheet.create({
  btn: {
    flexGrow: 1,
    flexBasis: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    minHeight: 72,
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.md,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnAccent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: { fontSize: 11, fontWeight: '700', color: colors.primary, textAlign: 'center' },
  labelAccent: { color: colors.textInverse },
});

const wpStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  count: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dotWrap: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  dotDone: {
    backgroundColor: colors.primary,
  },
  dotToday: {
    borderColor: colors.primary,
  },
  dotLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  dotLabelToday: {
    color: colors.primary,
    fontWeight: '800',
  },
  streakHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    fontWeight: '600',
  },
});

export default function HomeScreen({ navigation }) {
  const { gamification } = useGamificationStore();
  const { profile } = useUserStore();
  const { nutritionLogs, plan } = useNutritionStore();
  const { getTodayWorkout, getTodayWorkoutSummary, addWaterIntake } = useApp();
  const [waterFeedback, setWaterFeedback] = useState(false);
  const [adaptiveConfig, setAdaptiveConfig] = useState(() => getAdaptiveHomeConfig());
  const [showMore, setShowMore] = useState(false);
  const lastCoachTrackedRef = useRef('');
  const waterDebounceRef = useRef(null);

  React.useEffect(() => {
    const refresh = () => {
      setAdaptiveConfig(getAdaptiveHomeConfig());
    };
    refresh();
    const unsubscribe = navigation?.addListener?.('focus', refresh);
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [navigation]);

  const todayKey = useMemo(() => getTodayKey(), []);

  const streak = gamification?.streakDays || 0;
  const xp = gamification?.xp || 0;
  const isNewUser = xp === 0 && streak === 0;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpInLevel = xp % XP_PER_LEVEL;
  const xpPct = Math.round((xpInLevel / XP_PER_LEVEL) * 100);

  const todayLogs = useMemo(
    () => (nutritionLogs || []).filter((l) => l.date === todayKey),
    [nutritionLogs, todayKey],
  );

  const todayCalories = useMemo(
    () => todayLogs.reduce((a, l) => a + Number(l.calories || 0), 0),
    [todayLogs],
  );
  const todayProtein = useMemo(
    () => todayLogs.reduce((a, l) => a + Number(l.protein || 0), 0),
    [todayLogs],
  );
  const todayCarbs = useMemo(
    () => todayLogs.reduce((a, l) => a + Number(l.carbs || 0), 0),
    [todayLogs],
  );

  const macroTargets = useMemo(() => {
    const caloriesPerDay = Number(plan?.caloriesPerDay || 2000);
    // Distribuição padrão: 30% proteína, 40% carbo, 30% gordura
    const protein = Math.round((caloriesPerDay * 0.30) / 4);
    const carbs = Math.round((caloriesPerDay * 0.40) / 4);
    const fat = Math.round((caloriesPerDay * 0.30) / 9);
    return {
      calories: caloriesPerDay,
      protein,
      carbs,
      fat,
    };
  }, [plan]);

  const caloriesPct = macroTargets.calories > 0
    ? Math.min(Math.round((todayCalories / macroTargets.calories) * 100), 100)
    : 0;

  const todayWorkout = useMemo(() => {
    try { return getTodayWorkout?.() || []; }
    catch { return []; }
  }, [getTodayWorkout]);

  const workoutSummary = useMemo(() => {
    try { return getTodayWorkoutSummary?.() || { guidedSets: 0 }; }
    catch { return { guidedSets: 0 }; }
  }, [getTodayWorkoutSummary]);

  const workoutDone = (workoutSummary?.guidedSets || 0) > 0;

  const greeting = getGreeting();
  const waterTargetMl = Math.round(Number(plan?.waterLitersPerDay || 3) * 1000);
  const waterTodayMl = Math.round(todayLogs.reduce((a, l) => a + Number(l.waterMl || 0), 0));
  const proteinTarget = Math.round(Number(macroTargets?.protein || 120));
  const missionTitle = todayWorkout.length > 0
    ? `Treino de hoje: ${todayWorkout[0]?.name || 'Sessao principal'}`
    : 'Treino de hoje: Sessao principal';

  const coachMessage = adaptiveConfig?.coach || null;
  const recovery = adaptiveConfig?.recovery || null;
  const highlightedFeature = String(adaptiveConfig?.highlightedFeature || 'workout');
  const isLightweightMode = Boolean(adaptiveConfig?.lightweightMode);

  const isContinueWorkout = Boolean(recovery) || (todayWorkout.length > 0 && !workoutDone);
  const primaryCtaLabel = isContinueWorkout ? 'CONTINUAR TREINO' : 'INICIAR TREINO';
  const primaryCtaSubtitle = isContinueWorkout
    ? 'Volte para o treino atual'
    : 'Comece agora';

  const orderedActions = useMemo(() => {
    const actionByKey = {
      insights: {
        key: 'insights',
        testID: 'home-shortcut-insights',
        label: 'Ver insights do dia',
        onPress: () => navigation.navigate('Insights', {
          postValuePaywall: {
            featureKey: 'auto_coach',
            source: 'home_insights',
            message: 'Veja seus insights e destrave o plano PRO para receber ajuste automatico semanal.',
            paywallExperiment: {
              key: 'paywall_timing',
              variant: 'B',
            },
          },
          paywallExperiment: {
            key: 'paywall_timing',
            variant: 'B',
          },
        }),
      },
      nutrition: {
        key: 'nutrition',
        testID: 'home-quick-nutricao',
        label: '+ Registrar refeicao',
        onPress: () => navigation.navigate('Scanner'),
      },
      workout: {
        key: 'workout',
        testID: 'home-quick-workout',
        label: 'Retomar treino agora',
        onPress: () => navigation.navigate('TreinoHoje'),
      },
      water: {
        key: 'water',
        testID: 'btn-add-agua',
        label: '+ Beber agua',
        onPress: () => {
          if (waterDebounceRef.current) return;
          try { addWaterIntake?.(300); } catch { return; }
          setWaterFeedback(true);
          waterDebounceRef.current = setTimeout(() => {
            setWaterFeedback(false);
            waterDebounceRef.current = null;
          }, 3000);
        },
      },
    };

    const requested = Array.isArray(adaptiveConfig?.quickActionOrder)
      ? adaptiveConfig.quickActionOrder
      : ['workout', 'nutrition', 'insights'];

    const hydrated = requested
      .map((key) => actionByKey[key])
      .filter(Boolean)
      .slice(0, 3);

    hydrated.push(actionByKey.water);
    return hydrated;
  }, [adaptiveConfig, addWaterIntake, navigation]);

  const secondaryActions = orderedActions.filter((action) => action.key !== 'workout');

  React.useEffect(() => {
    if (!coachMessage?.title) {
      return;
    }

    const signature = `${coachMessage.title}|${coachMessage.routeName || ''}`;
    if (lastCoachTrackedRef.current === signature) {
      return;
    }

    lastCoachTrackedRef.current = signature;
    logEvent('coach_message_sent', {
      screen: 'HomeScreen',
      source: 'coach_card',
      title: coachMessage.title,
    });
  }, [coachMessage]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        testID="screen-home"
      >
        <View testID="home-screen" style={{ width: 1, height: 1 }} />
        <View style={styles.dailyTopCard}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.dailyTopTitle}>🔥 Dia {Math.max(1, Number(streak || 0))} de sequência</Text>
          <Text style={styles.dailyTopXp}>+{Math.max(0, Number(workoutSummary?.sessionXp || 120))} XP hoje</Text>
        </View>

        <TouchableOpacity
          testID="home-main-cta"
          style={styles.mainMissionCta}
          onPress={() => {
            if (recovery) {
              dismissDropRecoveryCandidate();
              logEvent('workout_recovery', {
                screen: 'HomeScreen',
                source: 'main_cta',
              });
            }
            navigation.navigate('TreinoHoje');
          }}
          activeOpacity={0.92}
        >
          <Text style={styles.mainMissionCtaText}>{`▶ ${primaryCtaLabel}`}</Text>
          <Text style={styles.mainMissionCtaSub}>{primaryCtaSubtitle}</Text>
        </TouchableOpacity>

        <View testID="home-ready" style={styles.progressCard}>
          <Text style={styles.progressTitle}>CONTEXTO DO TREINO</Text>
          <Text style={styles.progressLine}>{missionTitle}</Text>
          <Text style={styles.progressLine}>Treino: {workoutDone ? '✅' : '⬜'}</Text>
          <Text style={styles.progressLine}>Proteina: {Math.round(todayProtein)}/{proteinTarget}g</Text>
          <Text style={styles.progressLine}>Agua: {(waterTodayMl / 1000).toFixed(1)}L / {(waterTargetMl / 1000).toFixed(1)}L</Text>
          <Text style={styles.progressFeature}>Prioridade atual: {highlightedFeature}</Text>
          {recovery ? <Text style={styles.progressMode}>{recovery.message}</Text> : null}
          {isLightweightMode ? (
            <Text style={styles.progressMode}>Modo leve ativo para reduzir telas lentas.</Text>
          ) : null}
        </View>

        <View style={styles.quickCard}>
          <Text style={styles.quickTitle}>ACOES RAPIDAS</Text>
          <View style={styles.quickActionsDailyRow}>
            {secondaryActions.slice(0, 2).map((action, index) => (
              <TouchableOpacity
                key={action.key}
                testID={action.testID}
                style={[
                  styles.quickDailyButton,
                  index === 0 ? styles.quickDailyButtonFeatured : null,
                ]}
                onPress={action.onPress}
              >
                <Text
                  style={[
                    styles.quickDailyButtonText,
                    index === 0 ? styles.quickDailyButtonTextFeatured : null,
                  ]}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.quickCard}>
          <TouchableOpacity
            testID="home-more-toggle"
            style={styles.moreToggle}
            onPress={() => setShowMore((prev) => !prev)}
          >
            <Text style={styles.quickTitle}>MAIS OPCOES</Text>
            <Text style={styles.moreToggleText}>{showMore ? 'Ocultar' : 'Expandir'}</Text>
          </TouchableOpacity>

          {showMore ? (
            <>
              {coachMessage ? (
                <View style={styles.coachCard}>
                  <Text style={styles.coachEyebrow}>COACH</Text>
                  <Text style={styles.coachTitle}>{coachMessage.title}</Text>
                  <Text style={styles.coachText}>{coachMessage.message}</Text>
                  <TouchableOpacity
                    testID="home-coach-cta"
                    style={styles.coachCta}
                    onPress={() => {
                      if (canInterruptCoach()) {
                        markCoachInterruption();
                      }

                      logEvent('coach_suggestion_accepted', {
                        screen: 'HomeScreen',
                        source: 'coach_card',
                      });
                      setAdaptiveConfig(getAdaptiveHomeConfig());
                      navigation.navigate(coachMessage.routeName || 'Insights');
                    }}
                  >
                    <Text style={styles.coachCtaText}>{coachMessage.cta || 'Abrir'}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              <View style={styles.quickActionsDailyRow}>
                {secondaryActions.slice(2).map((action) => (
                  <TouchableOpacity
                    key={action.key}
                    testID={action.testID}
                    style={styles.quickDailyButton}
                    onPress={action.onPress}
                  >
                    <Text style={styles.quickDailyButtonText}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <WeeklyProgress
                streak={streak}
                onPress={() => navigation.navigate('Insights')}
              />
            </>
          ) : null}

          {waterFeedback ? <Text testID="feedback-add-agua" style={styles.waterFeedback}>+300ml adicionados 💧</Text> : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: spacing.xxl + spacing.lg,
    gap: 20,
  },
  dailyTopCard: {
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 6,
  },
  dailyTopTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  dailyTopXp: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.success,
  },
  missionMainCard: {
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.cardElevated,
    gap: 8,
  },
  missionMainTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    lineHeight: 30,
  },
  missionAdaptiveTag: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  recoveryCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.card,
    gap: 8,
  },
  recoveryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  recoveryMessage: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  recoveryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  recoveryButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recoveryPrimary: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  recoveryPrimaryText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2e1f06',
  },
  recoverySecondaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  mainMissionCta: {
    borderRadius: 14,
    backgroundColor: colors.success,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  mainMissionCtaText: {
    color: '#052e20',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  mainMissionCtaSub: {
    marginTop: 4,
    color: '#134e3a',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  progressCard: {
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    gap: 6,
  },
  progressTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  progressLine: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  progressFeature: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  progressMode: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
  },
  coachCard: {
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.cardElevated,
    gap: 6,
  },
  coachEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  coachTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  coachText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  coachCta: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.primaryMuted,
  },
  coachCtaText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
  },
  coachSkip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  coachSkipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  quickCard: {
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  quickTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  moreToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moreToggleText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  quickActionsDailyRow: {
    gap: 10,
  },
  quickDailyButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
  },
  quickDailyButtonFeatured: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  quickDailyButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  quickDailyButtonTextFeatured: {
    color: colors.primary,
  },
  waterFeedback: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 4,
  },

  // HERO
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  heroLeft: { flex: 1 },
  greeting: {
    ...typography.title,
    fontSize: 24,
  },
  heroSubtitle: {
    ...typography.body,
    marginTop: 2,
  },
  streakBadge: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 56,
  },
  streakFire: { fontSize: 22 },
  streakNum: { fontSize: 20, fontWeight: '800', color: colors.warning, letterSpacing: -0.5 },
  streakLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase' },
  streakIdentity: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // XP CARD
  xpCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  xpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  xpLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  xpLevelBadge: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    fontSize: 12,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.3,
  },
  xpValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  xpPct: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  xpTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  xpFill: {
    height: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  xpHint: {
    ...typography.label,
    color: colors.textMuted,
  },

  // WORKOUT CARD
  workoutCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  workoutCardDone: {
    borderColor: colors.success,
    backgroundColor: colors.successMuted,
  },
  workoutCardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  workoutCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  workoutCardSub: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  mainCta: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  mainCtaText: {
    color: colors.textInverse,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  missionCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    gap: spacing.xs,
  },
  missionEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  missionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.2,
  },
  missionText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  missionSecondary: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  missionSecondaryText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '700',
  },

  // MACRO CARD
  macroCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  macroAction: { fontSize: 13, fontWeight: '700', color: colors.primary },
  calRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: spacing.xs,
  },
  calValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  calSep: { fontSize: 16, color: colors.textMuted },
  calTarget: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  calPct: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  calTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  calFill: {
    height: 6,
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
  },
  calFillOver: {
    backgroundColor: colors.danger,
  },
  macrosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    gap: 0,
  },
  macroDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.borderSubtle,
    marginHorizontal: 0,
  },

  // QUICK ACTIONS
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },

  // SECTION TITLES
  sectionTitle: {
    ...typography.sectionTitle,
  },
  sectionTitleStandalone: {
    ...typography.sectionTitle,
    marginBottom: -spacing.xs,
  },

  // SHORTCUTS GRID
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  shortcutItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  shortcutLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});
