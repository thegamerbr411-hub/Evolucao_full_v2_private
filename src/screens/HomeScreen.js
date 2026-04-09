import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useInsights, useWorkout, useNutrition } from '../hooks';
import { trackEvent } from '../utils/analytics';
import { AnimatedToast, AppCard, MetricText, PrimaryButton, ProgressItem, ScreenHeader } from '../components/ui';
import { colors, radius, spacing } from '../theme';

export default function HomeScreen({ navigation }) {
  const { getDailyMacroTargets, getNutritionFeedback, history, plan, addWaterIntake } = useNutrition();
  const { gamification, getSmartWorkoutRecommendation, workoutLogs } = useWorkout();
  const { getPerformanceRecoveryInsight } = useInsights();
  const [quickActionFeedback, setQuickActionFeedback] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const scoreProgressAnim = useRef(new Animated.Value(0)).current;
  const proteinProgressAnim = useRef(new Animated.Value(0)).current;
  const waterProgressAnim = useRef(new Animated.Value(0)).current;
  const trainingProgressAnim = useRef(new Animated.Value(0)).current;
  const entryAnimValues = useRef(Array.from({ length: 8 }, () => new Animated.Value(0))).current;

  const showSuccessToast = (message) => {
    if (!message) {
      return;
    }

    setToastMessage(message);
  };

  const safeHistory = Array.isArray(history) ? history : [];
  const safeWorkoutLogs = Array.isArray(workoutLogs) ? workoutLogs : [];

  const today = useMemo(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const smartWorkout = useMemo(() => {
    try {
      return getSmartWorkoutRecommendation();
    } catch (_error) {
      return {
        title: 'Treino do dia',
        justification: 'Nao foi possivel carregar recomendacao agora. Use o treino livre enquanto sincronizamos.',
      };
    }
  }, [getSmartWorkoutRecommendation]);
  const macroTargets = useMemo(() => getDailyMacroTargets(), [getDailyMacroTargets]);

  const todayHistory = safeHistory.find((item) => item.date === today) || null;
  const proteinToday = Number(todayHistory?.protein || 0);
  const proteinTarget = Number(macroTargets?.protein || 0);
  const waterToday = Number(todayHistory?.waterMl || 0);
  const waterTarget = Number((plan?.waterLitersPerDay || 0) * 1000);
  const waterPercent = waterTarget > 0 ? Math.min(1, waterToday / waterTarget) : 0;
  const proteinRemaining = Math.max(0, proteinTarget - proteinToday);
  const trainedToday = safeWorkoutLogs.some((item) => item.date === today);
  const nutritionFeedback = useMemo(
    () => getNutritionFeedback({ proteinConsumed: proteinToday, caloriesConsumed: Number(todayHistory?.calories || 0), trainedToday }),
    [getNutritionFeedback, proteinToday, todayHistory?.calories, trainedToday]
  );
  const recoveryInsight = useMemo(
    () => getPerformanceRecoveryInsight(),
    [getPerformanceRecoveryInsight, history, workoutLogs]
  );
  const waterRemaining = Math.max(0, waterTarget - waterToday);
  const proteinRatio = proteinTarget > 0 ? Math.min(1, proteinToday / proteinTarget) : 0;
  const trainingProgress = trainedToday ? 1 : 0;
  const dayScore = Math.round(trainingProgress * 35 + proteinRatio * 40 + waterPercent * 25);
  const dayScoreStatus = {
    training: trainedToday ? 'ok' : 'pending',
    protein: proteinRatio >= 1 ? 'ok' : 'pending',
    water: waterPercent >= 1 ? 'ok' : 'pending',
  };

  const getScoreByDate = (dateKey) => {
    const dayHistory = safeHistory.find((item) => item.date === dateKey) || null;
    const dayProtein = Number(dayHistory?.protein || 0);
    const dayWater = Number(dayHistory?.waterMl || 0);
    const dayTrained = safeWorkoutLogs.some((item) => String(item.date || '') === String(dateKey));
    const dayProteinRatio = proteinTarget > 0 ? Math.min(1, dayProtein / proteinTarget) : 0;
    const dayWaterRatio = waterTarget > 0 ? Math.min(1, dayWater / waterTarget) : 0;
    const dayTrainingRatio = dayTrained ? 1 : 0;

    return Math.round(dayTrainingRatio * 35 + dayProteinRatio * 40 + dayWaterRatio * 25);
  };

  const scoreTrendRows = useMemo(() => {
    const dateSet = new Set(safeHistory.map((item) => String(item.date || '')).filter(Boolean));
    dateSet.add(today);

    const sorted = Array.from(dateSet)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .slice(-7);

    if (!sorted.length) {
      return [];
    }

    const rows = sorted.map((dateKey) => ({
      date: dateKey,
      score: getScoreByDate(dateKey),
    }));

    const maxScore = Math.max(1, ...rows.map((item) => item.score));
    return rows.map((item) => ({
      ...item,
      scorePct: Math.max(5, Math.round((item.score / maxScore) * 100)),
    }));
  }, [safeHistory, today, safeWorkoutLogs, proteinTarget, waterTarget]);

  const scoreStats = useMemo(() => {
    if (!scoreTrendRows.length) {
      return { avg: 0, best: 0 };
    }

    const total = scoreTrendRows.reduce((acc, item) => acc + Number(item.score || 0), 0);
    return {
      avg: Math.round(total / scoreTrendRows.length),
      best: Math.max(...scoreTrendRows.map((item) => Number(item.score || 0))),
    };
  }, [scoreTrendRows]);

  useEffect(() => {
    if (!quickActionFeedback) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setQuickActionFeedback('');
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [quickActionFeedback]);

  useEffect(() => {
    entryAnimValues.forEach((value) => value.setValue(0));

    const animations = entryAnimValues.map((value) => (
      Animated.timing(value, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    ));

    Animated.stagger(70, animations).start();
  }, [entryAnimValues, dayScore, proteinToday, waterToday]);

  const handleChecklistPress = (type) => {
    if (type === 'training') {
      showSuccessToast('Treino iniciado 🏋️');
      navigation.navigate('TreinoHoje');
      return;
    }

    if (type === 'protein') {
      navigation.navigate('Scanner', {
        prefillQuickMealText: '150g frango + 1 whey',
        source: 'home_score_protein',
      });
      return;
    }

    if (type === 'water') {
      let result;
      if (typeof addWaterIntake === 'function') {
        result = addWaterIntake(300);
      } else {
        console.warn('⚠️ addWaterIntake undefined no HomeScreen');
        result = { ok: false };
      }
      if (result?.ok) {
        setQuickActionFeedback('+300ml de agua adicionados');
        showSuccessToast('+300ml adicionados 💧');
      }
    }
  };

  const openWorkoutFromHome = () => {
    showSuccessToast('Treino iniciado 🏋️');
    navigation.navigate('TreinoHoje');
  };

  const openNutritionFromHome = () => {
    navigation.navigate('Scanner', {
      prefillQuickMealText: '150g frango + 1 whey',
      source: 'home_focus_nutrition',
    });
  };

  const addWaterFromHome = () => {
    let result;
    if (typeof addWaterIntake === 'function') {
      result = addWaterIntake(300);
    } else {
      console.warn('⚠️ addWaterIntake undefined no HomeScreen');
      result = { ok: false };
    }
    if (result?.ok) {
      setQuickActionFeedback('+300ml de agua adicionados');
      showSuccessToast('+300ml adicionados 💧');
    }
  };
  const monthPrefix = today.slice(0, 7);
  const monthlyWorkoutDays = new Set(
    safeWorkoutLogs
      .filter((item) => String(item.date || '').startsWith(monthPrefix))
      .map((item) => item.date)
  ).size;

  const parseDateKey = (dateKey) => {
    if (!dateKey || typeof dateKey !== 'string') {
      return null;
    }

    const [year, month, day] = dateKey.split('-').map((value) => Number(value));
    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
  };

  const calculateWorkoutStreak = (logs, dateKey) => {
    const uniqueDays = new Set(
      (Array.isArray(logs) ? logs : [])
        .map((item) => String(item?.date || ''))
        .filter(Boolean)
    );

    if (!uniqueDays.size) {
      return 0;
    }

    const formatDate = (value) => {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };

    const cursor = parseDateKey(dateKey);
    if (!cursor) {
      return 0;
    }

    if (!uniqueDays.has(formatDate(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }

    let streak = 0;
    while (uniqueDays.has(formatDate(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return streak;
  };

  const streakDays = useMemo(() => {
    const calculated = calculateWorkoutStreak(safeWorkoutLogs, today);
    return Math.max(calculated, Number(gamification?.streakDays || 0));
  }, [safeWorkoutLogs, today, gamification?.streakDays]);

  const weekDates = useMemo(
    () => Array.from(new Set(safeHistory.slice(0, 7).map((item) => String(item.date || '')).filter(Boolean)))
      .sort((a, b) => String(a).localeCompare(String(b))),
    [safeHistory]
  );

  const weeklyTrendRows = useMemo(() => {
    if (!weekDates.length) {
      return [];
    }

    const rows = weekDates.map((date) => {
      const dayHistory = safeHistory.find((item) => item.date === date) || {};
      const protein = Number(dayHistory.protein || 0);
      const trainingLoad = safeWorkoutLogs
        .filter((item) => String(item.date || '') === date)
        .reduce((acc, item) => acc + Number(item.weight || 0) * Number(item.reps || 0), 0);

      return {
        date,
        protein,
        trainingLoad,
      };
    });

    const maxProtein = Math.max(1, ...rows.map((item) => item.protein));
    const maxLoad = Math.max(1, ...rows.map((item) => item.trainingLoad));

    return rows.map((item) => ({
      ...item,
      proteinPct: Math.max(4, Math.round((item.protein / maxProtein) * 100)),
      loadPct: Math.max(4, Math.round((item.trainingLoad / maxLoad) * 100)),
    }));
  }, [weekDates, safeHistory, safeWorkoutLogs]);

  const focusCard = useMemo(() => {
    if (!trainedToday) {
      return {
        label: 'Prioridade de hoje',
        title: 'Voce ainda nao treinou. Comeca agora.',
        subtitle: '',
        buttonTitle: 'Iniciar treino',
        onPress: openWorkoutFromHome,
        testID: 'btn-start-workout',
      };
    }

    if (proteinRemaining > 0) {
      return {
        label: 'Prioridade de hoje',
        title: 'Fechar proteína do dia',
        subtitle: `Faltam ${proteinRemaining}g para bater sua meta.`,
        buttonTitle: 'Registrar refeicao',
        onPress: openNutritionFromHome,
        testID: 'btn-focus-nutrition',
      };
    }

    if (waterRemaining > 0) {
      return {
        label: 'Prioridade de hoje',
        title: 'Hidratacao pendente',
        subtitle: `Faltam ${waterRemaining}ml para fechar a meta de agua.`,
        buttonTitle: 'Adicionar 300ml',
        onPress: addWaterFromHome,
        testID: 'btn-focus-water',
      };
    }

    return {
      label: 'Prioridade de hoje',
      title: 'Dia sob controle',
      subtitle: 'Tudo em dia. Aproveite para revisar seus insights e manter consistencia.',
      buttonTitle: 'Ver insights',
      onPress: () => navigation.navigate('Insights'),
      testID: 'btn-focus-insights',
    };
  }, [trainedToday, smartWorkout?.title, proteinRemaining, waterRemaining, navigation]);

  useEffect(() => {
    const run = Animated.parallel([
      Animated.timing(scoreProgressAnim, {
        toValue: Math.max(0.04, Math.min(1, dayScore / 100)),
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(proteinProgressAnim, {
        toValue: proteinRatio,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(waterProgressAnim, {
        toValue: waterPercent,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(trainingProgressAnim, {
        toValue: trainingProgress,
        duration: 350,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]);

    run.start();
  }, [dayScore, proteinRatio, waterPercent, trainingProgress, scoreProgressAnim, proteinProgressAnim, waterProgressAnim, trainingProgressAnim]);

  const scoreFillWidth = scoreProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const proteinFillWidth = proteinProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const waterFillWidth = waterProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });
  const trainingFillWidth = trainingProgressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const getEntryStyle = (index) => {
    const value = entryAnimValues[Math.min(index, entryAnimValues.length - 1)] || entryAnimValues[0];
    return {
      opacity: value,
      transform: [{
        translateY: value.interpolate({
          inputRange: [0, 1],
          outputRange: [26, 0],
        }),
      }],
    };
  };

  const handleFocusPrimaryPress = () => {
    trackEvent('coach_action_clicked', {
      screen: 'home',
      action: focusCard?.testID || 'unknown',
      title: focusCard?.title || '',
    });
    focusCard.onPress();
  };

  const currentActionLabel = focusCard?.buttonTitle || 'Iniciar treino';
  const progressPct = Math.max(0, Math.min(100, dayScore));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AnimatedToast message={toastMessage} onHide={() => setToastMessage('')} />
      <ScrollView testID="screen-home" contentContainerStyle={styles.container}>
      <ScreenHeader title="Hoje" subtitle="Prioridades do dia em um so lugar." />

      <Animated.View style={getEntryStyle(0)}>
      <AppCard style={focusCard.testID === 'btn-start-workout' ? styles.priorityCard : null}>
        <Text style={styles.cardLabel}>{focusCard.label}</Text>
        <View style={styles.topKpiRow}>
          <Text style={styles.topKpiText}>🔥 Streak: {streakDays}</Text>
          <Text style={styles.topKpiText}>Progresso: {progressPct}%</Text>
        </View>
        <Text style={styles.currentActionText}>Acao atual: {currentActionLabel}</Text>
        <Text style={styles.cardMain}>{focusCard.title}</Text>
        {focusCard.subtitle ? <Text style={styles.cardSub}>{focusCard.subtitle}</Text> : null}
        <PrimaryButton testID={focusCard.testID} title={focusCard.testID === 'btn-start-workout' ? 'COMEÇAR AGORA' : focusCard.buttonTitle} onPress={handleFocusPrimaryPress} style={styles.primaryButton} />
      </AppCard>
      </Animated.View>

      <View style={styles.secondarySection}>
      <Text style={styles.secondarySectionTitle}>Resumo do dia</Text>

      <Animated.View style={getEntryStyle(1)}>
      <AppCard testID="home-ready">
        <Text style={styles.cardLabel}>Progresso diario</Text>
        <View style={styles.scoreHeaderRow}>
          <Text style={styles.scoreValue}>{dayScore}/100</Text>
          <Text style={styles.scoreHint}>
            {dayScore >= 85
              ? 'Dia forte. Mantenha consistência.'
              : dayScore >= 65
              ? 'Bom ritmo. Falta pouco para fechar.'
              : 'Voce ainda pode fechar bem o dia.'}
          </Text>
        </View>
        <View style={styles.scoreTrack}>
          <Animated.View style={[styles.scoreFill, { width: scoreFillWidth }]} />
        </View>
        <View style={styles.scoreChecklist}>
          <ProgressItem
            label="Treino"
            value={dayScoreStatus.training === 'ok' ? 'OK' : 'Pendente'}
            status={dayScoreStatus.training}
            onPress={() => handleChecklistPress('training')}
            testID="status-training"
            fillWidth={trainingFillWidth}
            fillColor="#60A5FA"
          />
          <ProgressItem
            label="Proteína"
            value={`${proteinToday}g / ${proteinTarget}g • ${dayScoreStatus.protein === 'ok' ? 'OK' : 'Pendente'}`}
            status={dayScoreStatus.protein}
            onPress={() => handleChecklistPress('protein')}
            testID="status-protein"
            fillWidth={proteinFillWidth}
            fillColor="#4ADE80"
          />
          <ProgressItem
            label="Água"
            value={`${waterToday}ml / ${waterTarget || 0}ml • ${dayScoreStatus.water === 'ok' ? 'OK' : 'Pendente'}`}
            status={dayScoreStatus.water}
            onPress={() => handleChecklistPress('water')}
            testID="btn-add-agua"
            fillWidth={waterFillWidth}
            fillColor="#22D3EE"
          />
        </View>
        {quickActionFeedback ? <Text testID="feedback-add-agua" style={styles.quickActionFeedback}>{quickActionFeedback}</Text> : null}
        {scoreTrendRows.length > 1 ? (
        <View style={styles.scoreTrendWrap}>
          <Text style={styles.scoreTrendTitle}>Tendência 7 dias</Text>
          <Text style={styles.scoreTrendMeta}>Média {scoreStats.avg} • Melhor {scoreStats.best}</Text>
          <View style={styles.scoreTrendRows}>
            {scoreTrendRows.map((item) => (
              <View key={`score-${item.date}`} style={styles.scoreTrendRow}>
                <Text style={styles.scoreTrendDate}>{item.date.slice(5)}</Text>
                <View style={styles.scoreTrendTrack}>
                  <View style={[styles.scoreTrendFill, { width: `${item.scorePct}%` }]} />
                </View>
                <Text style={styles.scoreTrendValue}>{item.score}</Text>
              </View>
            ))}
          </View>
        </View>
        ) : null}
      </AppCard>
      </Animated.View>

      {recoveryInsight?.title && recoveryInsight?.message ? (
      <Animated.View style={getEntryStyle(2)}>
      <AppCard style={styles.heroCard}>
        <Text style={styles.cardLabel}>Insight de performance</Text>
        <Text style={[
          styles.heroTitle,
          recoveryInsight?.tone === 'warning'
            ? styles.heroTitleWarning
            : recoveryInsight?.tone === 'success'
            ? styles.heroTitleSuccess
            : null,
        ]}>
          {recoveryInsight.title}
        </Text>
        <Text style={styles.cardSub}>{recoveryInsight.message}</Text>
      </AppCard>
      </Animated.View>
      ) : null}

      <Animated.View style={getEntryStyle(3)}>
      <AppCard>
        <Text style={styles.cardLabel}>Progresso</Text>
        <MetricText value={`🔥 ${streakDays} dias`} label="Streak atual" />
        <Text style={styles.streakCopy}>
          {streakDays <= 0
            ? 'Comece hoje: 1 treino ja inicia seu streak. 🔥'
            : trainedToday
            ? `🔥 ${streakDays} dias seguidos. Mantenha amanha para subir.`
            : `💪 ${streakDays} dias seguidos. Treine hoje para nao quebrar.`}
        </Text>
        <Text style={styles.cardSub}>📈 {monthlyWorkoutDays} dias treinados no mes</Text>
      </AppCard>
      </Animated.View>

      {weeklyTrendRows.length > 1 ? (
      <Animated.View style={getEntryStyle(4)}>
      <AppCard>
        <Text style={styles.cardLabel}>Trend proteína x treino</Text>
        <Text style={styles.cardSub}>Comparativo dos ultimos {weeklyTrendRows.length || 0} dias</Text>
        <View style={styles.trendWrap}>
          {weeklyTrendRows.map((row) => (
            <View key={`trend-${row.date}`} style={styles.trendRow}>
              <Text style={styles.trendDate}>{row.date.slice(5)}</Text>
              <View style={styles.trendBars}>
                <View style={styles.trendTrack}>
                  <View style={[styles.trendProtein, { width: `${row.proteinPct}%` }]} />
                </View>
                <View style={styles.trendTrack}>
                  <View style={[styles.trendLoad, { width: `${row.loadPct}%` }]} />
                </View>
              </View>
              <View style={styles.trendMetaWrap}>
                <Text style={styles.trendMeta}>{Math.round(row.protein)}g</Text>
                <Text style={styles.trendMeta}>{Math.round(row.trainingLoad)}kg</Text>
              </View>
            </View>
          ))}
          <View style={styles.trendLegend}>
            <Text style={styles.legendProtein}>Proteína</Text>
            <Text style={styles.legendLoad}>Volume treino</Text>
          </View>
        </View>
      </AppCard>
      </Animated.View>
      ) : null}

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
    flexGrow: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  cardLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  cardMain: {
    color: colors.textPrimary,
    fontSize: 21,
    fontWeight: '800',
  },
  cardSub: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
    fontWeight: '600',
  },
  heroCard: {
    borderWidth: 1,
    borderColor: '#3F6CA0',
    backgroundColor: '#122238',
  },
  heroTitle: {
    color: '#BFDBFE',
    fontSize: 17,
    fontWeight: '900',
  },
  heroTitleWarning: {
    color: '#FCD34D',
  },
  heroTitleSuccess: {
    color: '#86EFAC',
  },
  priorityCard: {
    borderWidth: 1,
    borderColor: '#2F7A5B',
    backgroundColor: '#0F221A',
  },
  streakCopy: {
    marginTop: spacing.xs,
    color: colors.warning,
    fontSize: 12,
    fontWeight: '800',
  },
  proteinHighUrgency: {
    color: '#FCD34D',
    fontWeight: '800',
  },
  proteinMediumUrgency: {
    color: '#BFDBFE',
    fontWeight: '800',
  },
  primaryButton: {
    marginTop: spacing.sm,
  },
  topKpiRow: {
    marginTop: 2,
    marginBottom: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  topKpiText: {
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '800',
  },
  currentActionText: {
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  progressTrack: {
    marginTop: spacing.sm,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.success,
  },
  trendWrap: {
    marginTop: spacing.sm,
    gap: 8,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendDate: {
    width: 42,
    color: '#AFC6E6',
    fontSize: 11,
    fontWeight: '800',
  },
  trendBars: {
    flex: 1,
    gap: 4,
  },
  trendTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: '#223047',
    overflow: 'hidden',
  },
  trendProtein: {
    height: '100%',
    backgroundColor: '#4ADE80',
    borderRadius: radius.pill,
  },
  trendLoad: {
    height: '100%',
    backgroundColor: '#60A5FA',
    borderRadius: radius.pill,
  },
  trendMetaWrap: {
    width: 62,
    alignItems: 'flex-end',
  },
  trendMeta: {
    color: '#D8E7FF',
    fontSize: 10,
    fontWeight: '700',
  },
  trendLegend: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendProtein: {
    color: '#86EFAC',
    fontSize: 11,
    fontWeight: '800',
  },
  legendLoad: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '800',
  },
  scoreHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  scoreValue: {
    color: '#F8FAFC',
    fontSize: 32,
    fontWeight: '900',
  },
  scoreHint: {
    flex: 1,
    textAlign: 'right',
    color: '#BFDBFE',
    fontSize: 12,
    fontWeight: '700',
  },
  scoreTrack: {
    marginTop: 8,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: '#223047',
    overflow: 'hidden',
  },
  scoreFill: {
    height: '100%',
    backgroundColor: '#FCD34D',
    borderRadius: radius.pill,
  },
  scoreChecklist: {
    marginTop: 10,
    gap: 6,
  },
  quickActionFeedback: {
    marginTop: 8,
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: '800',
  },
  scoreTrendWrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#324A6E',
    borderRadius: 10,
    padding: 8,
    backgroundColor: '#111B2A',
  },
  scoreTrendTitle: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  scoreTrendMeta: {
    color: '#9FB8DB',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 6,
  },
  scoreTrendRows: {
    gap: 6,
  },
  scoreTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreTrendDate: {
    width: 42,
    color: '#D3E3FA',
    fontSize: 10,
    fontWeight: '800',
  },
  scoreTrendTrack: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: '#223047',
    overflow: 'hidden',
  },
  scoreTrendFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: '#FCD34D',
  },
  scoreTrendValue: {
    width: 28,
    textAlign: 'right',
    color: '#F8FAFC',
    fontSize: 10,
    fontWeight: '900',
  },
  secondarySection: {
    marginTop: spacing.md,
  },
  secondarySectionTitle: {
    marginBottom: spacing.xs,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});
