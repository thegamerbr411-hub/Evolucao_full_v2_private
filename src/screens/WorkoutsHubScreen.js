import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';

export default function WorkoutsHubScreen({ navigation }) {
  const { getTodayWorkoutSummary, getTodayWorkout } = useApp();
  const summary = getTodayWorkoutSummary();
  const todayWorkout = getTodayWorkout();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Treinos</Text>
      <Text style={styles.subtitle}>Planeje, execute e ajuste o treino do dia.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hoje</Text>
        <Text style={styles.cardLine}>Exercicios planejados: {todayWorkout.length}</Text>
        <Text style={styles.cardLine}>Series registradas: {summary.guidedSets}</Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('TreinoHoje')}>
        <Text style={styles.primaryText}>Iniciar treino recomendado</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('TreinoLivre')}>
        <Text style={styles.secondaryText}>Treino livre</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FC',
    paddingTop: 56,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: '#111827',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 12,
    color: '#4B5563',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D9E1EF',
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  cardLine: {
    color: '#334155',
    fontSize: 14,
    marginBottom: 4,
    fontWeight: '600',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  primaryText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryButton: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#AAB7CF',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
});
