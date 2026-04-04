import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';

const GOALS = [
  { key: 'emagrecer', label: 'Perda de gordura' },
  { key: 'ganhar_massa', label: 'Ganho de massa' },
  { key: 'recomposicao', label: 'Recomposicao corporal' },
];

const LEVELS = [
  { key: 'iniciante', label: 'Iniciante' },
  { key: 'intermediario', label: 'Intermediario' },
  { key: 'avancado', label: 'Avancado' },
];

export default function ProfileScreen() {
  const {
    profile,
    plan,
    history,
    userRoutines,
    getWorkoutGamification,
    updateProfileSettings,
  } = useApp();

  const [goal, setGoal] = useState(profile?.goal || 'recomposicao');
  const [level, setLevel] = useState(profile?.level || 'iniciante');
  const [trainingDays, setTrainingDays] = useState(String(profile?.trainingDaysPerWeek || 3));
  const [currentWeight, setCurrentWeight] = useState(String(profile?.currentWeight || 70));
  const [targetWeight, setTargetWeight] = useState(String(profile?.targetWeight || 70));

  const gamification = getWorkoutGamification();

  const historySummary = useMemo(() => {
    const recent = history.slice(0, 7);
    const trainedDays = recent.filter((item) => item.trained).length;
    const avgProtein = recent.length
      ? Math.round(recent.reduce((acc, item) => acc + Number(item.protein || 0), 0) / recent.length)
      : 0;

    return {
      days: recent.length,
      trainedDays,
      avgProtein,
    };
  }, [history]);

  const saveProfile = () => {
    const result = updateProfileSettings({
      goal,
      level,
      trainingDaysPerWeek: Number(trainingDays || 3),
      currentWeight: Number(currentWeight || 0),
      targetWeight: Number(targetWeight || 0),
    });

    if (!result.ok) {
      Alert.alert('Nao foi possivel salvar', result.message);
      return;
    }

    Alert.alert('Perfil atualizado', 'Suas configuracoes ja estao valendo no coach e nas rotinas.');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Perfil</Text>
      <Text style={styles.subtitle}>Centro de controle da sua estrategia e evolucao.</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Meta principal</Text>
        <View style={styles.chipsRow}>
          {GOALS.map((item) => (
            <TouchableOpacity key={item.key} style={[styles.chip, goal === item.key ? styles.chipActive : null]} onPress={() => setGoal(item.key)}>
              <Text style={[styles.chipText, goal === item.key ? styles.chipTextActive : null]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Nivel</Text>
        <View style={styles.chipsRow}>
          {LEVELS.map((item) => (
            <TouchableOpacity key={item.key} style={[styles.chip, level === item.key ? styles.chipActive : null]} onPress={() => setLevel(item.key)}>
              <Text style={[styles.chipText, level === item.key ? styles.chipTextActive : null]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Frequencia semanal</Text>
        <TextInput value={trainingDays} onChangeText={setTrainingDays} keyboardType="numeric" style={styles.input} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Peso atual (kg)</Text>
        <TextInput value={currentWeight} onChangeText={setCurrentWeight} keyboardType="numeric" style={styles.input} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Peso alvo (kg)</Text>
        <TextInput value={targetWeight} onChangeText={setTargetWeight} keyboardType="numeric" style={styles.input} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Historico recente</Text>
        <Text style={styles.metric}>Dias com registro: {historySummary.days}</Text>
        <Text style={styles.metric}>Dias treinados: {historySummary.trainedDays}</Text>
        <Text style={styles.metric}>Proteina media: {historySummary.avgProtein}g</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Evolucao e social (base)</Text>
        <Text style={styles.metric}>Nivel {gamification.level} · XP {gamification.xp}</Text>
        <Text style={styles.metric}>Streak: {gamification.streakDays} dias</Text>
        <Text style={styles.metric}>Rotinas salvas: {Array.isArray(userRoutines) ? userRoutines.length : 0}</Text>
        <Text style={styles.metric}>Ranking/Amigos: pronto para acoplar na proxima sprint.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>Plano atual</Text>
        <Text style={styles.metric}>Calorias alvo: {Number(plan?.caloriesPerDay || 0)} kcal/dia</Text>
        <Text style={styles.metric}>Agua alvo: {Number(plan?.waterLitersPerDay || 0)}L/dia</Text>
        <Text style={styles.metric}>Estrategia: {String(plan?.strategy || 'recomposicao')}</Text>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
        <Text style={styles.saveButtonText}>Salvar perfil</Text>
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
    marginBottom: 6,
  },
  subtitle: {
    color: '#B8C4D6',
    fontSize: 13,
    marginBottom: 12,
    fontWeight: '600',
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
    color: '#AFC1D9',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderColor: '#476A9C',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: '#DBEAFE',
  },
  chipText: {
    color: '#B9D8FF',
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: '#0F3B7A',
  },
  input: {
    borderWidth: 1,
    borderColor: '#4B6896',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: '#F2F7FF',
    backgroundColor: '#0F1D36',
  },
  metric: {
    color: '#D6E4F8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
