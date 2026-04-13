import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton, AppCard } from '../components/ui';
import { useNutrition } from '../hooks/useNutrition';

export default function HomeScreen({ navigation }) {
  const nutrition = useNutrition();

  const handleAddWater = () => {
    const addWaterIntake = nutrition && typeof nutrition.addWaterIntake === 'function'
      ? nutrition.addWaterIntake
      : null;

    if (addWaterIntake) {
      try {
        addWaterIntake(300);
      } catch (_error) {
        // Fallback screen intentionally swallows non-critical home hydration errors.
      }
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} testID="screen-home">
        <AppCard>
          <Text style={styles.title}>Home</Text>
          <Text style={styles.subtitle} testID="home-ready">
            Tela inicial carregada com sucesso.
          </Text>
        </AppCard>

        <View style={styles.actions}>
          <PrimaryButton
            testID="btn-start-workout-today"
            title="Ir para treino"
            onPress={() => navigation.navigate('TreinoHoje')}
          />
          <PrimaryButton
            testID="btn-open-nutrition-scanner"
            title="Abrir nutricao"
            onPress={() => navigation.navigate('Scanner')}
          />
          <PrimaryButton
            testID="btn-add-agua"
            title="Adicionar agua (+300ml)"
            onPress={handleAddWater}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    padding: 16,
    gap: 12,
  },
  title: {
    color: '#f8fafc',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 15,
  },
  actions: {
    gap: 10,
  },
});
