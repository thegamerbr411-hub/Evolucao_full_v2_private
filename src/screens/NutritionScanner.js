
import React, { useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { trackEvent } from '../utils/analytics';

export default function NutritionScanner({ navigation }) {
  const {
    estimateNutritionFromText,
    estimateNutritionFromPhotoHint,
    searchFoodCatalog,
    addFoodLogEntry,
    removeFoodLogEntry,
    getTodayFoodLog,
    evaluateMealQuality,
    hasFeatureAccess,
  } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [manualText, setManualText] = useState('');
  const [photoHintText, setPhotoHintText] = useState('');
  const [portionFactor, setPortionFactor] = useState(1);
  const [result, setResult] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  const [mealFeedback, setMealFeedback] = useState('');
  const [mealDraftItems, setMealDraftItems] = useState([]);
  const proteinTargetPerMeal = 30;

  const foodOptions = useMemo(() => searchFoodCatalog(searchQuery), [searchFoodCatalog, searchQuery]);
  const todayFoodLog = getTodayFoodLog();

  const getMacroStatus = (totals) => {
    const protein = Number(totals?.protein || 0);
    const carbs = Number(totals?.carbs || 0);
    const fats = Number(totals?.fats || 0);
    return {
      protein: protein < 20 ? 'baixo' : protein > 45 ? 'alto' : 'ok',
      carbs: carbs < 25 ? 'baixo' : carbs > 70 ? 'alto' : 'ok',
      fats: fats < 8 ? 'baixo' : fats > 25 ? 'alto' : 'ok',
    };
  };

  const getFoodByLabel = (label) => {
    const safeLabel = String(label || '').trim();
    if (!safeLabel) {
      return null;
    }

    const options = searchFoodCatalog(safeLabel);
    return options.find((item) => String(item.label).toLowerCase() === safeLabel.toLowerCase()) || options[0] || null;
  };

  const addItemToMealDraft = (food, quantity = portionFactor) => {
    if (!food) {
      return;
    }

    const safeQuantity = Math.max(0.1, Number(quantity || 1));
    setMealDraftItems((prev) => [
      ...prev,
      {
        id: `meal-item-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        foodKey: food.key,
        label: food.label,
        quantity: safeQuantity,
      },
    ]);
  };

  const mealDraftTotals = useMemo(
    () =>
      mealDraftItems.reduce(
        (acc, item) => {
          const food = searchFoodCatalog(item.label).find((entry) => entry.key === item.foodKey) || getFoodByLabel(item.label);
          if (!food) {
            return acc;
          }
          return {
            calories: acc.calories + Number(food.calories || 0) * Number(item.quantity || 1),
            protein: acc.protein + Number(food.protein || 0) * Number(item.quantity || 1),
            carbs: acc.carbs + Number(food.carbs || 0) * Number(item.quantity || 1),
            fats: acc.fats + Number(food.fats || 0) * Number(item.quantity || 1),
          };
        },
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      ),
    [mealDraftItems, searchFoodCatalog]
  );

  const runPhotoEstimate = async (source) => {
    if (!hasFeatureAccess('photo_scanner')) {
      navigation.navigate('Paywall', { featureKey: 'photo_scanner', source: 'scanner_photo_button' });
      return;
    }

    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setResult({ ok: false, message: 'Permissao da camera negada.' });
        return;
      }

      const cameraResult = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
      if (cameraResult.canceled) {
        return;
      }
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setResult({ ok: false, message: 'Permissao da galeria negada.' });
        return;
      }

      const libraryResult = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true });
      if (libraryResult.canceled) {
        return;
      }
    }

    const normalizedHint = String(photoHintText || '').trim();
    if (!normalizedHint) {
      const factor = Number(portionFactor || 1);
      setResult({
        ok: true,
        source: 'foto_estimada',
        totals: {
          calories: Math.round(350 * factor),
          protein: Math.round(25 * factor),
          carbs: Math.round(40 * factor),
          fats: Math.round(10 * factor),
        },
        message: 'Estimativa rapida aplicada a partir da foto (beta).',
      });
      return;
    }

    setResult(estimateNutritionFromPhotoHint({ description: normalizedHint, portionFactor }));
  };

  const useEstimateInDay = () => {
    if (!selectedFood) {
      return;
    }

    addItemToMealDraft(selectedFood, portionFactor);
  };

  const saveMealDraft = () => {
    if (!mealDraftItems.length) {
      return;
    }

    const now = new Date();
    const loggedAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    let lastQuality = null;
    mealDraftItems.forEach((item) => {
      const result = addFoodLogEntry({
        foodKey: item.foodKey,
        label: item.label,
        quantity: item.quantity,
        loggedAt,
      });
      if (result?.quality) {
        lastQuality = result.quality;
      }
    });

    if (lastQuality) {
      setMealFeedback(`${lastQuality.emoji} ${lastQuality.badge} - refeicao composta salva com sucesso.`);
    }

    trackEvent('food_logged', {
      calories: Math.round(mealDraftTotals.calories),
      protein: Math.round(mealDraftTotals.protein),
      carbs: Math.round(mealDraftTotals.carbs),
      fats: Math.round(mealDraftTotals.fats),
      compositionSize: mealDraftItems.length,
    });

    setMealDraftItems([]);

    if (!hasFeatureAccess('weekly_macros')) {
      navigation.navigate('Paywall', {
        featureKey: 'weekly_macros',
        source: 'post_food',
        message: 'Voce registrou sua refeicao, mas ainda nao sabe se bateu sua meta semanal. Veja isso no PRO.',
      });
      return;
    }

    navigation.navigate('AnaliseDia', {
      prefillCalories: Math.round(mealDraftTotals.calories),
      prefillProtein: Math.round(mealDraftTotals.protein),
      prefillCarbs: Math.round(mealDraftTotals.carbs),
      prefillFats: Math.round(mealDraftTotals.fats),
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Nutricao</Text>
      <Text style={styles.subtitle}>Registre refeicoes com horario. Texto e foto ficam como apoio.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Catalogo local</Text>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Busque por alimento"
          placeholderTextColor="#8AA2C7"
          style={styles.searchInput}
        />

        <View style={styles.foodList}>
          {foodOptions.slice(0, 6).map((food) => (
            <TouchableOpacity
              key={food.key}
              style={[styles.foodOption, selectedFood?.key === food.key ? styles.foodOptionActive : null]}
              onPress={() => setSelectedFood(food)}
            >
              <Text style={styles.foodLabel}>{food.label}</Text>
              <Text style={styles.foodMeta}>{food.calories} kcal | P {food.protein}g</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.fractionRow}>
          {[0.5, 1, 1.5, 2].map((value) => (
            <TouchableOpacity
              key={String(value)}
              style={[styles.fractionButton, portionFactor === value ? styles.fractionButtonActive : null]}
              onPress={() => setPortionFactor(value)}
            >
              <Text style={[styles.fractionText, portionFactor === value ? styles.fractionTextActive : null]}>
                {value}x
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={useEstimateInDay}>
          <Text style={styles.primaryButtonText}>Adicionar na refeicao</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Composicao da refeicao</Text>
        {mealDraftItems.length === 0 ? <Text style={styles.emptyLine}>Adicione alimentos para montar a refeicao.</Text> : null}
        {mealDraftItems.map((item) => (
          <View key={item.id} style={styles.logRow}>
            <View>
              <Text style={styles.logTitle}>{item.label}</Text>
              <Text style={styles.logMeta}>Quantidade: {item.quantity}x</Text>
            </View>
            <TouchableOpacity onPress={() => setMealDraftItems((prev) => prev.filter((entry) => entry.id !== item.id))}>
              <Text style={styles.removeText}>Remover</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.logMeta}>
          Totais: {Math.round(mealDraftTotals.calories)} kcal | P {Math.round(mealDraftTotals.protein)}g | C {Math.round(mealDraftTotals.carbs)}g | G {Math.round(mealDraftTotals.fats)}g
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={saveMealDraft}>
          <Text style={styles.primaryButtonText}>Salvar refeicao completa</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Hoje</Text>
        {mealFeedback ? <Text style={styles.mealFeedback}>{mealFeedback}</Text> : null}
        {todayFoodLog.length === 0 ? <Text style={styles.emptyLine}>Nenhum registro ainda.</Text> : null}
        {todayFoodLog.slice(0, 8).map((item) => (
          <View key={item.id} style={styles.logRow}>
            <View>
              <Text style={styles.logTitle}>{item.loggedAt} · {item.label}</Text>
              <Text style={styles.logMeta}>{item.calories} kcal | P {item.protein}g</Text>
              <Text style={styles.mealBadge}>{item.quality?.emoji || '🟡'} {item.quality?.badge || 'Ok'}</Text>
            </View>
            <TouchableOpacity onPress={() => removeFoodLogEntry(item.id)}>
              <Text style={styles.removeText}>Remover</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estimativa por texto</Text>
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
        {result?.ok && Array.isArray(result.items) && result.items.length ? (
          <View style={styles.chipsWrap}>
            {result.items.map((item, index) => (
              <TouchableOpacity
                key={`${item.label}-${index}`}
                style={styles.chipAction}
                onPress={() => {
                  const food = getFoodByLabel(item.label);
                  if (food) {
                    addItemToMealDraft(food, Number(item.quantity || 1));
                  }
                }}
              >
                <Text style={styles.chipActionText}>+ {item.label} ({item.quantity || 1}x)</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
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
        <View style={styles.photoButtonRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => runPhotoEstimate('camera')}>
            <Text style={styles.secondaryButtonText}>Tirar foto</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => runPhotoEstimate('library')}>
            <Text style={styles.secondaryButtonText}>Escolher da galeria</Text>
          </TouchableOpacity>
        </View>
        {result?.ok && Array.isArray(result.items) && result.items.length ? (
          <View style={styles.chipsWrap}>
            {result.items.map((item, index) => (
              <TouchableOpacity
                key={`photo-${item.label}-${index}`}
                style={styles.chipAction}
                onPress={() => {
                  const food = getFoodByLabel(item.label);
                  if (food) {
                    addItemToMealDraft(food, Number(item.quantity || 1));
                  }
                }}
              >
                <Text style={styles.chipActionText}>+ {item.label} ({item.quantity || 1}x)</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </View>

      {result ? (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Resultado</Text>
          <Text style={styles.resultMessage}>{result.message}</Text>
          {result.ok ? (
            <>
              <Text style={styles.mealBadge}>
                {evaluateMealQuality(result.totals).emoji} {evaluateMealQuality(result.totals).badge}
              </Text>
              <Text style={styles.resultLine}>Calorias: {result.totals.calories} kcal</Text>
              <Text style={styles.resultLine}>Proteina: {result.totals.protein} g ({getMacroStatus(result.totals).protein})</Text>
              <Text style={styles.resultLine}>Carbo: {result.totals.carbs} g ({getMacroStatus(result.totals).carbs})</Text>
              <Text style={styles.resultLine}>Gordura: {result.totals.fats} g ({getMacroStatus(result.totals).fats})</Text>
              <Text style={styles.coachLine}>
                Meta por refeicao: ~{proteinTargetPerMeal}g proteina -> {result.totals.protein >= proteinTargetPerMeal ? 'faixa boa' : 'abaixo do ideal'}
              </Text>
              <Text style={styles.coachLine}>Dica: use o catalogo acima para salvar no diario com horario.</Text>
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
  searchInput: {
    borderWidth: 1,
    borderColor: '#4B6896',
    borderRadius: 10,
    backgroundColor: '#0F1D36',
    color: '#F2F7FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  foodList: {
    marginTop: 10,
    gap: 6,
  },
  foodOption: {
    borderWidth: 1,
    borderColor: '#35507D',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#102140',
  },
  foodOptionActive: {
    borderColor: '#AECBFF',
    backgroundColor: '#143057',
  },
  foodLabel: {
    color: '#F1F7FF',
    fontWeight: '700',
  },
  foodMeta: {
    color: '#BDD2F1',
    fontSize: 12,
    marginTop: 2,
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
    flex: 1,
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
  emptyLine: {
    color: '#A8B7D3',
    fontSize: 13,
  },
  mealFeedback: {
    color: '#CFE4FF',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '700',
  },
  logRow: {
    marginTop: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2A4168',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  logTitle: {
    color: '#F1F7FF',
    fontWeight: '700',
  },
  logMeta: {
    color: '#BDD2F1',
    fontSize: 12,
  },
  removeText: {
    color: '#FCA5A5',
    fontWeight: '700',
    fontSize: 12,
  },
  mealBadge: {
    marginTop: 3,
    color: '#E2ECFF',
    fontSize: 12,
    fontWeight: '800',
  },
  photoButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chipsWrap: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chipAction: {
    borderWidth: 1,
    borderColor: '#4B6896',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#0F1D36',
  },
  chipActionText: {
    color: '#D5E6FF',
    fontSize: 12,
    fontWeight: '700',
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
  coachLine: {
    marginTop: 6,
    color: '#BEE3F8',
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
});
