import React, { useMemo, useState, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { QA_ELEMENTS, QA_SCREENS, qaAliasProps, qaProps } from '../qa/selectorRegistry';
import {
  buildWaterQuickOptions,
  buildWaterRegisterCopy,
  validateWaterAmount,
  WATER_MAX_SINGLE_ML,
} from '../services/waterQuickAdd';
import { PrimaryButton, SecondaryButton } from '../components/ui';
import { resolveWorkoutContinueParams } from '../services/workoutActiveRoutine';

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

/** Compact horizontal bar for dashboard metrics (Home). */
function InlineMetricBar({ label, valueText, ratio, barColor }) {
  const pct = Math.max(0, Math.min(100, Math.round(Math.max(0, Math.min(1, ratio)) * 100)));
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 4,
        }}
      >
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.textPrimary }}>{label}</Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary }}>{valueText}</Text>
      </View>
      <View
        style={{
          height: 6,
          borderRadius: 3,
          backgroundColor: colors.border,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 3,
            backgroundColor: barColor,
          }}
        />
      </View>
    </View>
  );
}

function QuickAction({ icon, label, onPress, accent, testID, legacyId }) {
  return (
    <TouchableOpacity {...qaAliasProps(testID, legacyId)} onPress={onPress} style={[qaStyles.btn, accent && qaStyles.btnAccent]}>
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
  const nutritionLogs = useNutritionStore((state) => state.nutritionLogs);
  const history = useNutritionStore((state) => state.history);
  const plan = useNutritionStore((state) => state.plan);
  const hydration = useNutritionStore((state) => state.hydration);
  const { getTodayWorkout, getDailyState, addWaterIntake } = useApp();
  const [waterFeedback, setWaterFeedback] = useState(false);
  const [waterFeedbackMessage, setWaterFeedbackMessage] = useState('');
  const [showWaterQuickAddSheet, setShowWaterQuickAddSheet] = useState(false);
  const [waterSheetMode, setWaterSheetMode] = useState('quick');
  const [waterSelectedMl, setWaterSelectedMl] = useState(null);
  const [waterCustomMl, setWaterCustomMl] = useState('');
  const [waterSheetError, setWaterSheetError] = useState('');
  const [adaptiveConfig, setAdaptiveConfig] = useState(() => getAdaptiveHomeConfig());
  const [showMore, setShowMore] = useState(false);
  const [homeStateTick, setHomeStateTick] = useState(0);
  const lastCoachTrackedRef = useRef('');
  const waterDebounceRef = useRef(null);
  const waterQuickOptions = useMemo(() => buildWaterQuickOptions(), []);

  const closeWaterQuickAddSheet = React.useCallback(() => {
    setShowWaterQuickAddSheet(false);
    setWaterSheetMode('quick');
    setWaterSelectedMl(null);
    setWaterCustomMl('');
    setWaterSheetError('');
  }, []);

  const openWaterQuickAddSheet = React.useCallback(() => {
    if (waterDebounceRef.current) return;
    setWaterSheetMode('quick');
    setWaterSelectedMl(null);
    setWaterCustomMl('');
    setWaterSheetError('');
    setShowWaterQuickAddSheet(true);
  }, []);

  const registerWaterAmount = React.useCallback((amountMl) => {
    const validation = validateWaterAmount(amountMl);
    if (!validation.ok) {
      setWaterSheetError('Informe uma quantidade valida em ml.');
      return;
    }
    try {
      const result = addWaterIntake?.(validation.amountMl);
      if (result?.ok === false) {
        setWaterSheetError('Nao foi possivel registrar a agua.');
        return;
      }
    } catch (error) {
      if (__DEV__) {
        console.log('[WATER][REGISTER] error=', error?.message || error);
      }
      setWaterSheetError('Nao foi possivel registrar a agua.');
      return;
    }
    closeWaterQuickAddSheet();
    setWaterFeedbackMessage(buildWaterRegisterCopy(validation.amountMl));
    setWaterFeedback(true);
    setHomeStateTick((tick) => tick + 1);
    if (waterDebounceRef.current) {
      clearTimeout(waterDebounceRef.current);
    }
    waterDebounceRef.current = setTimeout(() => {
      setWaterFeedback(false);
      setWaterFeedbackMessage('');
      waterDebounceRef.current = null;
    }, 3000);
  }, [addWaterIntake, closeWaterQuickAddSheet]);

  const handleConfirmWaterQuickAdd = React.useCallback(() => {
    if (waterSheetMode === 'custom') {
      const validation = validateWaterAmount(waterCustomMl);
      if (!validation.ok) {
        if (validation.reason === 'absurd') {
          setWaterSheetError(`Use no maximo ${WATER_MAX_SINGLE_ML} ml por registro.`);
          return;
        }
        setWaterSheetError('Informe uma quantidade valida em ml.');
        return;
      }
      registerWaterAmount(validation.amountMl);
      return;
    }
    if (waterSelectedMl === null) {
      setWaterSheetError('Escolha uma quantidade ou use Personalizado.');
      return;
    }
    registerWaterAmount(waterSelectedMl);
  }, [waterSheetMode, waterCustomMl, waterSelectedMl, registerWaterAmount]);

  React.useEffect(() => {
    const refresh = () => {
      setAdaptiveConfig(getAdaptiveHomeConfig());
      setHomeStateTick((tick) => tick + 1);
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

  const dailyState = useMemo(() => {
    try { return getDailyState?.() || null; }
    catch { return null; }
  }, [getDailyState, gamification, nutritionLogs, history, hydration, plan, profile, homeStateTick]);

  const streak = dailyState?.streakDays ?? (gamification?.streakDays || 0);
  const xp = dailyState?.xpTotal ?? (gamification?.xp || 0);
  const isNewUser = xp === 0 && streak === 0;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const xpInLevel = xp % XP_PER_LEVEL;
  const xpPct = Math.round((xpInLevel / XP_PER_LEVEL) * 100);

  const todayLogs = useMemo(
    () => (nutritionLogs || []).filter((l) => l.date === todayKey),
    [nutritionLogs, todayKey],
  );

  const todayHistoryWaterMl = useMemo(
    () => Math.round(
      (history || [])
        .filter((entry) => entry.date === todayKey)
        .reduce((sum, entry) => sum + Number(entry.waterMl || 0), 0)
    ),
    [history, todayKey],
  );

  const todayCalories = useMemo(
    () => todayLogs.reduce((a, l) => a + Number(l.calories || 0), 0),
    [todayLogs],
  );
  const todayProteinFromLogs = useMemo(
    () => todayLogs.reduce((a, l) => a + Number(l.protein || 0), 0),
    [todayLogs],
  );
  const todayProtein = useMemo(() => {
    const fromDaily = Number(dailyState?.proteinToday ?? 0);
    return Math.max(fromDaily, todayProteinFromLogs);
  }, [dailyState?.proteinToday, todayProteinFromLogs]);
  const todayCarbs = useMemo(
    () => todayLogs.reduce((a, l) => a + Number(l.carbs || 0), 0),
    [todayLogs],
  );

  const macroTargets = dailyState?.macroTargets || { calories: 0, protein: 0, carbs: 0, fats: 0 };

  const caloriesPct = macroTargets.calories > 0
    ? Math.min(Math.round((todayCalories / macroTargets.calories) * 100), 100)
    : 0;

  const todayWorkout = useMemo(() => {
    try { return getTodayWorkout?.() || []; }
    catch { return []; }
  }, [getTodayWorkout]);

  const workoutSession = dailyState?.workoutSession;
  const workoutDone = workoutSession?.status === 'completed';

  const greeting = getGreeting();
  const waterTargetMl = dailyState?.waterTargetMl
    ?? Math.round(Number(hydration?.waterGoalMl || (Number(plan?.waterLitersPerDay || 3) * 1000)));
  const waterTodayMlComputed = useMemo(() => {
    const fromHydration = hydration?.dayKey === todayKey
      ? Number(hydration?.consumedMl || 0)
      : 0;
    return Math.round(Math.max(fromHydration, todayHistoryWaterMl));
  }, [hydration, todayKey, todayHistoryWaterMl]);
  const waterTodayMl = dailyState?.waterTodayMl ?? waterTodayMlComputed;

  React.useEffect(() => {
    if (!__DEV__) return;
    console.log(
      `[WATER][HOME_RENDER] value=${(waterTodayMl / 1000).toFixed(1)}L hydrationDay=${hydration?.dayKey || '-'} todayKey=${todayKey} consumedMl=${hydration?.consumedMl ?? '-'} historyMl=${todayHistoryWaterMl}`,
    );
  }, [waterTodayMl, hydration?.dayKey, hydration?.consumedMl, todayKey, todayHistoryWaterMl]);
  const proteinTarget = Math.round(Number(dailyState?.proteinTarget || macroTargets?.protein || 0));
  const missionTitle = todayWorkout.length > 0
    ? `Treino de hoje: ${todayWorkout[0]?.name || 'Sessao principal'}`
    : 'Treino de hoje: Sessao principal';

  const coachMessage = adaptiveConfig?.coach || null;
  const recovery = workoutDone ? null : (adaptiveConfig?.recovery || null);
  const highlightedFeature = String(adaptiveConfig?.highlightedFeature || 'workout');
  const isLightweightMode = Boolean(adaptiveConfig?.lightweightMode);

  const isContinueWorkout = Boolean(workoutSession?.isContinue);
  const primaryCtaLabel = workoutSession?.ctaLabel || (isContinueWorkout ? 'CONTINUAR TREINO' : 'INICIAR TREINO');
  const primaryCtaSubtitle = workoutSession?.ctaSubtitle || (isContinueWorkout
    ? 'Volte para o treino atual'
    : 'Comece agora');

  const orderedActions = useMemo(() => {
    const actionByKey = {
      insights: {
        key: 'insights',
        testID: 'btn_home_insights',
        legacyId: 'home-shortcut-insights',
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
        testID: 'btn_home_nutrition',
        legacyId: 'home-quick-nutricao',
        label: '+ Registrar refeição',
        onPress: () => navigation.navigate('Nutricao'),
      },
      workout: {
        key: 'workout',
        testID: QA_ELEMENTS.btnStartWorkout,
        legacyId: 'home-quick-workout',
        label: 'Retomar treino agora',
        onPress: async () => {
          const params = await resolveWorkoutContinueParams({ isContinue: true });
          navigation.navigate('TreinoHoje', params);
        },
      },
      water: {
        key: 'water',
        testID: 'btn_add_water',
        legacyId: 'btn-add-agua',
        label: '+ Beber água',
        onPress: () => {
          if (__DEV__) {
            console.log('[WATER][TAP] source=home open_sheet');
          }
          openWaterQuickAddSheet();
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
  }, [adaptiveConfig, navigation, openWaterQuickAddSheet]);

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
        {...qaAliasProps(QA_SCREENS.home, 'screen-home')}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View {...qaAliasProps('home_screen_anchor', 'home-screen')} style={{ width: 1, height: 1 }} />
        <View style={styles.dailyTopCard}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text style={styles.dailyTopTitle}>🔥 {dailyState?.streakLabel || `Dia ${streak} de sequencia`}</Text>
          <Text style={styles.dailyTopXp}>+{Math.max(0, Number(dailyState?.xpToday || 0))} XP hoje</Text>
        </View>

        <TouchableOpacity
          {...qaAliasProps('btn_home_main_cta', 'home-main-cta')}
          style={styles.mainMissionCta}
          onPress={() => {
            if (recovery) {
              dismissDropRecoveryCandidate();
              logEvent('workout_recovery', {
                screen: 'HomeScreen',
                source: 'main_cta',
              });
            }
            resolveWorkoutContinueParams({ isContinue: isContinueWorkout }).then((params) => {
              navigation.navigate('TreinoHoje', params);
            });
          }}
          activeOpacity={0.92}
        >
          <Text style={styles.mainMissionCtaText}>{`▶ ${primaryCtaLabel}`}</Text>
          <Text style={styles.mainMissionCtaSub}>{primaryCtaSubtitle}</Text>
        </TouchableOpacity>

        <View {...qaAliasProps('home_ready', 'home-ready')} style={styles.progressCard}>
          <Text style={styles.progressTitle}>Resumo de hoje</Text>
          <Text style={styles.progressLine}>{missionTitle}</Text>
          <InlineMetricBar
            label="Treino"
            valueText={workoutSession?.label || (workoutDone ? 'Concluido' : 'Pendente')}
            ratio={workoutDone ? 1 : (dailyState?.completionRate || 0.08)}
            barColor={workoutDone ? colors.success : colors.textMuted}
          />
          <InlineMetricBar
            label="Proteína"
            valueText={`${Math.round(todayProtein)} / ${proteinTarget} g`}
            ratio={proteinTarget > 0 ? todayProtein / proteinTarget : 0}
            barColor={colors.primary}
          />
          <InlineMetricBar
            label="Água"
            valueText={`${(waterTodayMl / 1000).toFixed(1)} / ${(waterTargetMl / 1000).toFixed(1)} L`}
            ratio={waterTargetMl > 0 ? waterTodayMl / waterTargetMl : 0}
            barColor={colors.secondary}
          />
          <Text style={styles.progressFeature}>Prioridade atual: {highlightedFeature}</Text>
          {recovery ? <Text style={styles.progressMode}>{recovery.message}</Text> : null}
          {isLightweightMode ? (
            <Text style={styles.progressMode}>Modo leve ativo para reduzir telas lentas.</Text>
          ) : null}
        </View>

        <View style={styles.quickCard}>
          <Text style={styles.quickTitle}>Ações rápidas</Text>
          <View style={styles.quickActionsDailyRow}>
            {secondaryActions.slice(0, 2).map((action, index) => (
              <TouchableOpacity
                key={action.key}
                {...qaAliasProps(action.testID, action.legacyId)}
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
            {...qaAliasProps('btn_home_toggle_more', 'home-more-toggle')}
            style={styles.moreToggle}
            onPress={() => setShowMore((prev) => !prev)}
          >
            <Text style={styles.quickTitle}>Mais opções</Text>
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
                    {...qaAliasProps('btn_home_coach_cta', 'home-coach-cta')}
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
                    {...qaAliasProps(action.testID, action.legacyId)}
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

          {waterFeedback && waterFeedbackMessage ? (
            <Text {...qaAliasProps('feedback_add_water', 'feedback-add-agua')} style={styles.waterFeedback}>
              {waterFeedbackMessage}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        visible={showWaterQuickAddSheet}
        transparent
        animationType="slide"
        onRequestClose={closeWaterQuickAddSheet}
      >
        <View style={styles.waterModalBackdrop} testID="water-quick-add-sheet">
          <View style={styles.waterBottomSheet}>
            <Text style={styles.waterSheetTitle}>Registrar agua</Text>
            <Text style={styles.waterSheetSubtitle}>Quanto voce bebeu agora?</Text>

            <View style={styles.waterOptionsRow}>
              {waterQuickOptions.map((amount) => (
                <TouchableOpacity
                  key={`water-${amount}`}
                  testID={`water-option-${amount}`}
                  style={[
                    styles.waterOptionChip,
                    waterSheetMode === 'quick' && waterSelectedMl === amount ? styles.waterOptionChipSelected : null,
                  ]}
                  onPress={() => {
                    setWaterSheetMode('quick');
                    setWaterSelectedMl(amount);
                    setWaterSheetError('');
                  }}
                >
                  <Text
                    style={[
                      styles.waterOptionChipText,
                      waterSheetMode === 'quick' && waterSelectedMl === amount ? styles.waterOptionChipTextSelected : null,
                    ]}
                  >
                    {amount} ml
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                testID="water-option-custom"
                style={[
                  styles.waterOptionChip,
                  waterSheetMode === 'custom' ? styles.waterOptionChipSelected : null,
                ]}
                onPress={() => {
                  setWaterSheetMode('custom');
                  setWaterSelectedMl(null);
                  setWaterSheetError('');
                }}
              >
                <Text
                  style={[
                    styles.waterOptionChipText,
                    waterSheetMode === 'custom' ? styles.waterOptionChipTextSelected : null,
                  ]}
                >
                  Personalizado
                </Text>
              </TouchableOpacity>
            </View>

            {waterSheetMode === 'custom' ? (
              <TextInput
                testID="water-custom-input"
                value={waterCustomMl}
                onChangeText={(text) => {
                  setWaterCustomMl(text);
                  setWaterSheetError('');
                }}
                placeholder="Quantidade em ml"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                style={styles.waterCustomInput}
              />
            ) : null}

            {waterSheetError ? <Text style={styles.waterSheetError}>{waterSheetError}</Text> : null}

            <View style={styles.waterSheetActions}>
              <SecondaryButton
                testID="btn-cancel-water"
                title="Cancelar"
                onPress={closeWaterQuickAddSheet}
                style={styles.waterSheetSecondaryButton}
              />
              <PrimaryButton
                testID="btn-confirm-water"
                title="Registrar"
                onPress={handleConfirmWaterQuickAdd}
                style={styles.waterSheetPrimaryButton}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  waterModalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  waterBottomSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  waterSheetTitle: {
    ...typography.title,
    fontSize: 20,
  },
  waterSheetSubtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  waterOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  waterOptionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  waterOptionChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  waterOptionChipText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  waterOptionChipTextSelected: {
    color: colors.primary,
  },
  waterCustomInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    marginTop: spacing.xs,
  },
  waterSheetError: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  waterSheetActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  waterSheetSecondaryButton: {
    flex: 1,
  },
  waterSheetPrimaryButton: {
    flex: 1,
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
