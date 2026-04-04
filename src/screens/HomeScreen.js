import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';

export default function HomeScreen({ navigation }) {
  const {
    plan,
    history,
    workoutLogs,
    gamification,
    getSmartWorkoutRecommendation,
    getDailyMacroTargets,
  } = useApp();

  const today = useMemo(() => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const smartWorkout = useMemo(() => getSmartWorkoutRecommendation(), [getSmartWorkoutRecommendation]);
  const macroTargets = useMemo(() => getDailyMacroTargets(), [getDailyMacroTargets]);

  const todayHistory = history.find((item) => item.date === today) || null;
  const proteinToday = Number(todayHistory?.protein || 0);
  const proteinTarget = Number(macroTargets?.protein || 0);
  const waterToday = Number(todayHistory?.waterMl || 0);
  const waterTarget = Number((plan?.waterLitersPerDay || 0) * 1000);
  const waterPercent = waterTarget > 0 ? Math.min(1, waterToday / waterTarget) : 0;
  const proteinRemaining = Math.max(0, proteinTarget - proteinToday);
  const waterRemaining = Math.max(0, waterTarget - waterToday);
  const monthPrefix = today.slice(0, 7);
  const monthlyWorkouts = workoutLogs.filter((item) => String(item.date || '').startsWith(monthPrefix)).length;
  const streakDays = Number(gamification?.streakDays || 0);
  const trainedToday = workoutLogs.some((item) => item.date === today);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Hoje</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Treino do dia</Text>
        <Text style={styles.cardMain}>{smartWorkout?.title}</Text>
        <Text style={styles.cardSub}>{smartWorkout?.justification}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('TreinoHoje')}>
          <Text style={styles.primaryButtonText}>Iniciar treino</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Proteina</Text>
        <Text style={styles.kpi}>{proteinToday} / {proteinTarget}g</Text>
        <Text style={styles.cardSub}>
          {proteinRemaining > 0
            ? `Faltam ${proteinRemaining}g de proteina - bora fechar isso hoje.`
            : 'Meta de proteina fechada hoje. Excelente consistencia.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Agua</Text>
        <Text style={styles.kpi}>{waterToday} / {waterTarget || 0}ml</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(waterPercent * 100)}%` }]} />
        </View>
        <Text style={styles.cardSub}>
          {waterRemaining > 0
            ? `Faltam ${waterRemaining}ml de agua - mais um copo e voce avanca.`
            : 'Meta de hidratacao batida. Mantenha o ritmo.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Progresso</Text>
        <Text style={styles.kpi}>🔥 {streakDays} dias seguidos</Text>
        <Text style={styles.streakCopy}>
          {streakDays > 0 && !trainedToday
            ? 'Se nao fizer hoje, zera.'
            : 'Continue amanha para nao quebrar.'}
        </Text>
        <Text style={styles.cardSub}>📈 {monthlyWorkouts} treinos no mes</Text>
      </View>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Historico')}>
        <Text style={styles.secondaryButtonText}>Ver detalhes</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0B0F14',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#121821',
    borderWidth: 1,
    borderColor: '#263040',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardLabel: {
    color: '#B8C4D6',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardMain: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },
  cardSub: {
    color: '#C4D1E4',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    fontWeight: '600',
  },
  kpi: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  streakCopy: {
    marginTop: 3,
    color: '#FFD699',
    fontSize: 12,
    fontWeight: '800',
  },
  primaryButton: {
    marginTop: 10,
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  progressTrack: {
    marginTop: 8,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#233042',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2A9E66',
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#36506D',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F1722',
  },
  secondaryButtonText: {
    color: '#DCE8FF',
    fontWeight: '700',
  },
});
