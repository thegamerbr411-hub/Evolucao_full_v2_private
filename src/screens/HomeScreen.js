import React, { useEffect, useMemo, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { trackEvent } from '../utils/analytics';

function getCurrentMonthPrefix() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export default function HomeScreen({ navigation }) {
  const {
    profile,
    plan,
    history,
    workoutLogs,
    gamification,
    getTodayWorkout,
    getDailyMacroTargets,
    resetQuestionnaire,
    hasFeatureAccess,
    getSubscriptionStatus,
  } = useApp();

  const today = useMemo(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const monthPrefix = useMemo(() => getCurrentMonthPrefix(), []);
  const todaysWorkout = useMemo(() => getTodayWorkout(), [getTodayWorkout]);
  const macroTargets = useMemo(() => getDailyMacroTargets(), [getDailyMacroTargets]);
  const subscription = useMemo(() => getSubscriptionStatus(), [getSubscriptionStatus]);
  const trialLastDayAlertShownRef = useRef(false);

  const todayHistory = history.find((item) => item.date === today) || null;
  const proteinToday = Number(todayHistory?.protein || 0);
  const caloriesToday = Number(todayHistory?.calories || 0);
  const proteinTarget = Number(macroTargets?.protein || 0);
  const caloriesTarget = Number(plan?.caloriesPerDay || 0);
  const proteinRemaining = Math.max(0, proteinTarget - proteinToday);

  const monthlyWorkouts = workoutLogs.filter((item) => String(item.date || '').startsWith(monthPrefix)).length;
  const streakDays = Number(gamification?.streakDays || 0);

  const greetingName = 'Atleta';
  const trainingLabel = plan?.trainingSplit || 'Treino do dia';

  const premiumStatus = subscription.isPro
    ? 'PRO ativo'
    : subscription.source === 'trial'
    ? `Teste PRO (${subscription.trialRemainingDays}d)`
    : 'Plano gratis';

  useEffect(() => {
    trackEvent('home_open', {
      plan: subscription.isPro ? 'pro' : subscription.source,
      trialRemainingDays: subscription.trialRemainingDays,
    });
  }, [subscription.isPro, subscription.source, subscription.trialRemainingDays]);

  useEffect(() => {
    if (subscription.source !== 'trial' || subscription.trialRemainingDays !== 1) {
      return;
    }

    if (trialLastDayAlertShownRef.current) {
      return;
    }

    trialLastDayAlertShownRef.current = true;
    Alert.alert(
      'Ultimo dia do PRO',
      'Seu teste termina hoje. Voce vai perder acesso ao Auto Coach e macros semanais premium.'
    );
  }, [subscription.source, subscription.trialRemainingDays]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.greeting}>Ola, {greetingName}</Text>

      <View style={styles.heroCard}>
        <Text style={styles.heroTitle}>Treino de hoje</Text>
        <Text style={styles.heroSub}>{trainingLabel}</Text>
        <Text style={styles.heroHint}>{todaysWorkout.length} exercicios prontos para executar</Text>
        <TouchableOpacity style={styles.heroButton} onPress={() => navigation.navigate('TreinoHoje')}>
          <Text style={styles.heroButtonText}>Iniciar treino</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Nutricao</Text>
        <Text style={styles.metricLine}>Proteina: {proteinToday} / {proteinTarget}g</Text>
        <Text style={styles.metricLine}>Calorias: {caloriesToday} / {caloriesTarget} kcal</Text>
        <Text style={styles.warningLine}>
          {proteinRemaining > 0
            ? `Faltam ${proteinRemaining}g de proteina hoje`
            : 'Meta de proteina do dia batida. Excelente!'}
        </Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Progresso</Text>
        <Text style={styles.metricLine}>🔥 {streakDays} dias seguidos</Text>
        <Text style={styles.metricLine}>🏋️ {monthlyWorkouts} treinos no mes</Text>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Acoes rapidas</Text>
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickButton} onPress={() => navigation.navigate('Scanner')}>
            <Text style={styles.quickButtonText}>Registrar comida</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickButton} onPress={() => navigation.navigate('TreinoHoje')}>
            <Text style={styles.quickButtonText}>Iniciar treino</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.quickButtonSingle}
          onPress={() => Alert.alert('Registro de agua', 'Atalho de agua entra na proxima release.')}
        >
          <Text style={styles.quickButtonText}>Registrar agua</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.proCard}>
        <View style={styles.proHeader}>
          <Text style={styles.proTitle}>Evolucao PRO</Text>
          <Text style={styles.proStatus}>{premiumStatus}</Text>
        </View>

        <TouchableOpacity
          style={styles.proActionButton}
          onPress={() => {
            if (!hasFeatureAccess('weekly_macros')) {
              navigation.navigate('Paywall', { featureKey: 'weekly_macros', source: 'home_pro_weekly' });
              return;
            }
            navigation.navigate('MacroSemanal');
          }}
        >
          <Text style={styles.proActionText}>Ver macros semanais</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.proActionButton}
          onPress={() => {
            if (!hasFeatureAccess('auto_coach')) {
              navigation.navigate('Paywall', { featureKey: 'auto_coach', source: 'home_pro_coach' });
              return;
            }
            navigation.navigate('AutoCoach');
          }}
        >
          <Text style={styles.proActionText}>Auto Coach IA</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => {
          resetQuestionnaire();
          navigation.reset({ index: 0, routes: [{ name: 'Questionario' }] });
        }}
      >
        <Text style={styles.secondaryButtonText}>Refazer questionario</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#F5F7FC',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
    marginBottom: 12,
  },
  heroCard: {
    backgroundColor: '#101D36',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#264A7D',
  },
  heroTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  heroSub: {
    color: '#C7D8F4',
    marginTop: 4,
    fontSize: 14,
    fontWeight: '600',
  },
  heroHint: {
    color: '#99B4DE',
    marginTop: 4,
    fontSize: 12,
  },
  heroButton: {
    marginTop: 12,
    backgroundColor: '#2A9E66',
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  heroButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E1EF',
    padding: 14,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  metricLine: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  warningLine: {
    marginTop: 4,
    color: '#9A3412',
    fontSize: 13,
    fontWeight: '700',
  },
  quickRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickButton: {
    flex: 1,
    backgroundColor: '#E8F1FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B8CDF2',
    alignItems: 'center',
    paddingVertical: 12,
  },
  quickButtonSingle: {
    marginTop: 8,
    backgroundColor: '#EAF7EF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#B8E3C7',
    alignItems: 'center',
    paddingVertical: 12,
  },
  quickButtonText: {
    color: '#1E3A62',
    fontSize: 13,
    fontWeight: '800',
  },
  proCard: {
    marginTop: 2,
    backgroundColor: '#111827',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 12,
  },
  proHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  proTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '800',
  },
  proStatus: {
    color: '#FDBA74',
    fontSize: 12,
    fontWeight: '700',
  },
  proActionButton: {
    backgroundColor: '#1F2937',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4B5563',
    paddingVertical: 11,
    alignItems: 'center',
    marginTop: 8,
  },
  proActionText: {
    color: '#E5E7EB',
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C8D1E3',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#2B3347',
    fontSize: 14,
    fontWeight: '600',
  },
});
