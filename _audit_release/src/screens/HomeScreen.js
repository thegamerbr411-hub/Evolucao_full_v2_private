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
  const waterDebounceRef = useRef(null);

  const todayKey = useMemo(() => getTodayKey(), []);

  const streak = gamification?.streakDays || 0;
  const xp = gamification?.xp || 0;
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
    // Usa distribuição padrão: 30% proteína, 40% carbo, 30% gordura
    const protein = Math.round((caloriesPerDay * 0.30) / 4);
    const carbs = Math.round((caloriesPerDay * 0.40) / 4);
    return {
      calories: caloriesPerDay,
      protein,
      carbs,
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
  const userName = profile?.goal ? '' : '';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        testID="screen-home"
      >
        {/* ── HEADER HERO ── */}
        <View style={styles.hero}>
          <View style={styles.heroLeft}>
            <Text style={styles.greeting}>{greeting} 👋</Text>
            <Text style={styles.heroSubtitle}>Pronto para evoluir hoje?</Text>
          </View>
          <TouchableOpacity
            style={styles.streakBadge}
            onPress={() => navigation.navigate('Historico')}
          >
            <Text style={styles.streakFire}>🔥</Text>
            <Text style={styles.streakNum}>{streak}</Text>
            <Text style={styles.streakLabel}>dias</Text>
          </TouchableOpacity>
        </View>

        {/* ── XP LEVEL CARD ── */}
        <View testID="home-ready" style={styles.xpCard}>
          <View style={styles.xpRow}>
            <View style={styles.xpLeft}>
              <Text style={styles.xpLevelBadge}>Nv. {level}</Text>
              <Text style={styles.xpValue}>{xp} XP</Text>
            </View>
            <Text style={styles.xpPct}>{xpPct}%</Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${xpPct}%` }]} />
          </View>
          <Text style={styles.xpHint}>{XP_PER_LEVEL - xpInLevel} XP para o próximo nível</Text>
        </View>

        {/* ── TREINO DE HOJE ── */}
        <TouchableOpacity
          style={[styles.workoutCard, workoutDone && styles.workoutCardDone]}
          onPress={() => navigation.navigate('TreinoHoje')}
          activeOpacity={0.85}
        >
          <View style={styles.workoutCardLeft}>
            <Ionicons
              name={workoutDone ? 'checkmark-circle' : 'barbell-outline'}
              size={28}
              color={workoutDone ? colors.success : colors.primary}
            />
            <View style={{ marginLeft: spacing.sm }}>
              <Text style={styles.workoutCardTitle}>
                {workoutDone ? 'Treino concluído!' : 'Treino de hoje'}
              </Text>
              <Text style={styles.workoutCardSub}>
                {workoutDone
                  ? `${workoutSummary.guidedSets} séries registradas`
                  : todayWorkout.length > 0
                    ? `${todayWorkout.length} exercícios planejados`
                    : 'Toque para iniciar'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="home-main-cta"
          style={styles.mainCta}
          onPress={() => navigation.navigate('TreinoHoje')}
          activeOpacity={0.9}
        >
          <Ionicons name="flash" size={18} color={colors.textInverse} />
          <Text style={styles.mainCtaText}>{workoutDone ? 'VER TREINO DE HOJE' : 'COMEÇAR TREINO AGORA'}</Text>
        </TouchableOpacity>

        {/* ── PROGRESSO SEMANAL ── */}
        <WeeklyProgress
          streak={streak}
          onPress={() => navigation.navigate('Historico')}
        />

        {/* ── MACROS DO DIA ── */}
        <View style={styles.macroCard}>
          <View style={styles.macroHeader}>
            <Text style={styles.sectionTitle}>NUTRIÇÃO HOJE</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Scanner')}>
              <Text style={styles.macroAction}>+ Adicionar</Text>
            </TouchableOpacity>
          </View>

          {/* Barra de calorias */}
          <View style={styles.calRow}>
            <Text style={styles.calValue}>{todayCalories}</Text>
            <Text style={styles.calSep}>/</Text>
            <Text style={styles.calTarget}>{macroTargets.calories} kcal</Text>
            <View style={{ flex: 1 }} />
            <Text style={styles.calPct}>{caloriesPct}%</Text>
          </View>
          <View style={styles.calTrack}>
            <View
              style={[
                styles.calFill,
                { width: `${caloriesPct}%` },
                caloriesPct >= 100 && styles.calFillOver,
              ]}
            />
          </View>

          {/* Macros row */}
          <View style={styles.macrosRow}>
            <MacroRing
              label="Prot"
              value={Math.round(todayProtein)}
              target={macroTargets.protein}
              color={colors.secondary}
            />
            <View style={styles.macroDivider} />
            <MacroRing
              label="Carb"
              value={Math.round(todayCarbs)}
              target={macroTargets.carbs}
              color={colors.accent}
            />
            <View style={styles.macroDivider} />
            <MacroRing
              label="Gor"
              value={Math.round(todayLogs.reduce((a, l) => a + Number(l.fats || 0), 0))}
              target={Math.round(macroTargets.calories * 0.03)}
              color={colors.warning}
            />
          </View>
        </View>

        {/* ── AÇÕES RÁPIDAS ── */}
        <Text style={styles.sectionTitleStandalone}>ACESSOS ESSENCIAIS</Text>
        <View style={styles.quickActionsRow}>
          <QuickAction
            icon="restaurant"
            label="Registrar refeição"
            testID="home-quick-nutricao"
            onPress={() => navigation.navigate('Scanner')}
          />
          <QuickAction
            icon="chatbubbles"
            label="Coach"
            testID="home-quick-coach"
            onPress={() => navigation.navigate('Coach', {})}
          />
          <TouchableOpacity
            testID="btn-add-agua"
            style={qaStyles.btn}
            onPress={() => {
              if (waterDebounceRef.current) return;
              try { addWaterIntake?.(300); } catch { /* ignore */ }
              setWaterFeedback(true);
              waterDebounceRef.current = setTimeout(() => {
                setWaterFeedback(false);
                waterDebounceRef.current = null;
              }, 3000);
            }}
          >
            <Text style={[qaStyles.label, { fontSize: 20 }]}>💧</Text>
            <Text style={qaStyles.label}>+300ml</Text>
          </TouchableOpacity>
        </View>
        {waterFeedback && (
          <Text testID="feedback-add-agua" style={styles.waterFeedback}>+300ml adicionados 💧</Text>
        )}

        {/* ── ACESSO RÁPIDO ── */}
        <Text style={styles.sectionTitleStandalone}>OUTRAS OPÇÕES</Text>
        <View style={styles.shortcutsGrid}>
          <TouchableOpacity
            style={styles.shortcutItem}
            onPress={() => navigation.navigate('Historico')}
          >
            <Ionicons name="calendar-outline" size={22} color={colors.secondary} />
            <Text style={styles.shortcutLabel}>Histórico</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shortcutItem}
            onPress={() => navigation.navigate('Rotinas')}
          >
            <Ionicons name="repeat-outline" size={22} color={colors.accent} />
            <Text style={styles.shortcutLabel}>Rotinas</Text>
          </TouchableOpacity>
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl + spacing.lg,
    gap: spacing.md,
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
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  mainCtaText: {
    color: colors.textInverse,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
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
