import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { parseWorkout } from '../services/aiBackendService';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';

export default function ImportWorkoutScreen({ navigation }) {
  const [input, setInput] = useState('');
  const { setWorkout, user } = useApp();

  const handleImport = async () => {
    const parsed = await parseWorkout({
      userId: user?.id,
      text: input,
      userAiUsageToday: Number(user?.aiUsage?.count || 0),
    });
    if (!parsed.exercises.length) {
      Alert.alert('Sem exercicios', 'Cole um treino com exercicios reconheciveis.');
      return;
    }

    setWorkout(parsed);
    Alert.alert('Treino importado', 'Treino aplicado com sucesso.');
    navigation.navigate('Workout');
  };

  return (
    <View style={styles.container}>
      <ScreenHeader title="Importar treino" subtitle="Cole texto livre e converta para treino estruturado." />
      <AppCard>
        <Text style={styles.label}>Entrada de treino</Text>
        <TextInput
          placeholder="Supino 4x10\nLeg press 4x12"
          placeholderTextColor={colors.textSecondary}
          value={input}
          onChangeText={setInput}
          multiline
          style={styles.input}
        />
        <PrimaryButton title="Importar treino" onPress={handleImport} />
        <SecondaryButton title="Voltar" onPress={() => navigation.goBack()} style={styles.secondary} />
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  label: {
    color: colors.textPrimary,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#141922',
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
    textAlignVertical: 'top',
  },
  secondary: {
    marginTop: spacing.sm,
  },
});
