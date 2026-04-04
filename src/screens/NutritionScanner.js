
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { trackEvent } from '../utils/analytics';

export default function NutritionScanner({ navigation }) {
  const { estimateNutritionFromText, estimateNutritionFromPhotoHint, saveNutritionEntry, hasFeatureAccess } = useApp();
  const [manualText, setManualText] = useState('');
  const [photoHintText, setPhotoHintText] = useState('');
  const [portionFactor, setPortionFactor] = useState(1);
  const [result, setResult] = useState(null);

  const useEstimateInDay = () => {
    if (!result?.ok) {
      return;
    }

    saveNutritionEntry({
      calories: result.totals.calories,
      protein: result.totals.protein,
      carbs: result.totals.carbs,
      fats: result.totals.fats,
    });

    trackEvent('food_logged', {
      calories: result.totals.calories,
      protein: result.totals.protein,
      carbs: result.totals.carbs,
      fats: result.totals.fats,
    });

    if (!hasFeatureAccess('weekly_macros')) {
      navigation.navigate('Paywall', {
        featureKey: 'weekly_macros',
        source: 'post_food',
        message: 'Voce registrou sua refeicao, mas ainda nao sabe se bateu sua meta semanal. Veja isso no PRO.',
      });
      return;
    }

    navigation.navigate('AnaliseDia', {
      prefillCalories: result.totals.calories,
      prefillProtein: result.totals.protein,
      prefillCarbs: result.totals.carbs,
      prefillFats: result.totals.fats,
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nutricao PRO</Text>
      <Text style={styles.subtitle}>Texto livre, fracao inteligente e foto beta conservadora.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Modo texto livre</Text>
        <TextInput
          value={manualText}
          onChangeText={setManualText}
          placeholder="Ex: 1 pao + 2 ovos + queijo"
          placeholderTextColor="#8AA2C7"
          multiline
          style={styles.inputArea}
        />

        <View style={styles.fractionRow}>
          {[0.5, 1 / 3, 2 / 3, 1, 2].map((value) => (
            <TouchableOpacity
              key={String(value)}
              style={[styles.fractionButton, portionFactor === value ? styles.fractionButtonActive : null]}
              onPress={() => setPortionFactor(value)}
            >
              <Text style={[styles.fractionText, portionFactor === value ? styles.fractionTextActive : null]}>
                {value === 0.5 ? '1/2' : value === 1 / 3 ? '1/3' : value === 2 / 3 ? '2/3' : `${value}x`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            const parsed = estimateNutritionFromText(manualText);
            if (parsed?.ok) {
              setResult({
                ...parsed,
                totals: {
                  calories: Math.round(parsed.totals.calories * portionFactor),
                  protein: Math.round(parsed.totals.protein * portionFactor),
                  carbs: Math.round(parsed.totals.carbs * portionFactor),
                  fats: Math.round(parsed.totals.fats * portionFactor),
                },
                message: `${parsed.message} Porcao aplicada: ${portionFactor}x.`,
              });
            } else {
              setResult(parsed);
            }
          }}
        >
          <Text style={styles.primaryButtonText}>Estimar macros por texto</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Foto do prato (beta)</Text>
        <TextInput
          value={photoHintText}
          onChangeText={setPhotoHintText}
          placeholder="Descreva o prato da foto: arroz, feijao, frango"
          placeholderTextColor="#8AA2C7"
          multiline
          style={styles.inputArea}
        />
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => {
            if (!hasFeatureAccess('photo_scanner')) {
              navigation.navigate('Paywall', { featureKey: 'photo_scanner', source: 'scanner_photo_button' });
              return;
            }

            setResult(estimateNutritionFromPhotoHint({ description: photoHintText, portionFactor }));
          }}
        >
          <Text style={styles.secondaryButtonText}>Estimar pela foto (conservador)</Text>
        </TouchableOpacity>
      </View>

      {result ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Resultado</Text>
          <Text style={styles.resultMessage}>{result.message}</Text>
          {result.ok ? (
            <>
              <Text style={styles.resultLine}>Calorias: {result.totals.calories} kcal</Text>
              <Text style={styles.resultLine}>Proteina: {result.totals.protein} g</Text>
              <Text style={styles.resultLine}>Carbo: {result.totals.carbs} g</Text>
              <Text style={styles.resultLine}>Gordura: {result.totals.fats} g</Text>
              <TouchableOpacity style={styles.useButton} onPress={useEstimateInDay}>
                <Text style={styles.useButtonText}>Usar na analise do dia</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0F172A',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 12,
    color: '#A8B7D3',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#111D35',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2B446D',
    padding: 12,
    marginBottom: 12,
  },
  cardTitle: {
    color: '#DCE8FF',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  inputArea: {
    borderWidth: 1,
    borderColor: '#4B6896',
    borderRadius: 10,
    backgroundColor: '#0F1D36',
    color: '#F2F7FF',
    padding: 10,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  fractionRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 10,
  },
  fractionButton: {
    borderWidth: 1,
    borderColor: '#4E6FA4',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  fractionButtonActive: {
    backgroundColor: '#EAF2FF',
    borderColor: '#EAF2FF',
  },
  fractionText: {
    color: '#AECBFF',
    fontWeight: '700',
    fontSize: 12,
  },
  fractionTextActive: {
    color: '#10386D',
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: '#2B6CB0',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: '#1F8B5B',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  resultCard: {
    backgroundColor: '#13294B',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#355B8E',
    padding: 12,
  },
  resultTitle: {
    color: '#EAF2FF',
    fontWeight: '800',
    marginBottom: 6,
  },
  resultMessage: {
    color: '#C4D7F8',
    marginBottom: 8,
  },
  resultLine: {
    color: '#F1F7FF',
    marginBottom: 3,
    fontWeight: '700',
  },
  useButton: {
    marginTop: 8,
    backgroundColor: '#29A56A',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 11,
  },
  useButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
