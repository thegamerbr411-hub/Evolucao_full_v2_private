
import React, { useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNotifications, useNutrition } from '../hooks';
import { SCREENS, trackAppError, trackEvent } from '../utils/analytics';
import { AnimatedToast, AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';

const FAVORITES_STORAGE_KEY = 'nutrition.favorite.foods.v1';
const SHOW_PHOTO_BETA = false;

export default function NutritionScanner({ navigation, route }) {
  const {
    estimateNutritionFromText,
    estimateNutritionFromPhotoHint,
    searchFoodCatalog,
    addFoodLogEntriesBatch,
    removeFoodLogEntry,
    getTodayFoodLog,
    getDailyMacroTargets,
    getNutritionFeedback,
    getTopFoods,
    getPerformanceRecoveryInsight,
    evaluateMealQuality,
    nutritionLogs,
  } = useNutrition();
  const { hasFeatureAccess } = useNotifications();
  const [quickMealText, setQuickMealText] = useState('');
  const [quickMealItems, setQuickMealItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [manualText, setManualText] = useState('');
  const [photoHintText, setPhotoHintText] = useState('');
  const [portionFactor, setPortionFactor] = useState(1);
  const [result, setResult] = useState(null);
  const [selectedFood, setSelectedFood] = useState(null);
  const [mealFeedback, setMealFeedback] = useState('');
  const [toastMessage, setToastMessage] = useState('');
  const [foodSavedIndicatorVisible, setFoodSavedIndicatorVisible] = useState(false);
  const [mealDraftItems, setMealDraftItems] = useState([]);
  const [favoriteFoodKeys, setFavoriteFoodKeys] = useState([]);
  const proteinTargetPerMeal = 30;

  const showSuccessToast = (message) => {
    if (!message) {
      return;
    }

    setToastMessage(message);
  };

  const navigateWithTracking = (target, params, action) => {
    trackEvent('navigation_triggered', {
      screen: SCREENS.NUTRITION,
      meta: {
        domain: 'navigation',
        version: 1,
        action,
        from: SCREENS.NUTRITION,
        to: target,
      },
    });

    try {
      navigation.navigate(target, params);
    } catch (error) {
      trackAppError(error, {
        screen: SCREENS.NUTRITION,
        action: 'navigation.navigate',
        target,
        context: { navigationAction: action },
      });
    }
  };

  const COMMON_QUICK_ADDS = ['+2 ovos', '+150g frango', '+1 pao', '+1 whey'];

  React.useEffect(() => {
    const loadFavorites = async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
        if (!raw) {
          return;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setFavoriteFoodKeys(parsed);
        }
      } catch (error) {
        // Ignora cache local invalido.
      }
    };

    loadFavorites();
  }, []);

  React.useEffect(() => {
    AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteFoodKeys)).catch(() => {
      // Ignora falha local de persistencia para nao quebrar o fluxo.
    });
  }, [favoriteFoodKeys]);

  React.useEffect(() => {
    const suggested = String(route?.params?.prefillQuickMealText || '').trim();
    if (!suggested) {
      return;
    }

    setQuickMealText(suggested);
    setMealFeedback('Atalho inteligente aplicado. Toque em "Montar refeicao" para salvar mais rapido.');

    if (navigation?.setParams) {
      navigation.setParams({ prefillQuickMealText: undefined });
    }
  }, [route?.params?.prefillQuickMealText, navigation]);

  const foodOptions = useMemo(() => searchFoodCatalog(searchQuery), [searchFoodCatalog, searchQuery]);
  const todayFoodLog = getTodayFoodLog();
  const todayCalories = useMemo(
    () => todayFoodLog.reduce((acc, item) => acc + Number(item.calories || 0), 0),
    [todayFoodLog]
  );
  const dailyMacroTargets = useMemo(() => getDailyMacroTargets(), [getDailyMacroTargets]);
  const nutritionFeedback = getNutritionFeedback();
  const topFoodsSummary = useMemo(
    () => getTopFoods({ days: 7, limit: 5 }),
    [getTopFoods, nutritionLogs]
  );
  const recoveryInsight = useMemo(
    () => getPerformanceRecoveryInsight(),
    [getPerformanceRecoveryInsight, nutritionLogs]
  );
  const todayProtein = useMemo(
    () => todayFoodLog.reduce((acc, item) => acc + Number(item.protein || 0), 0),
    [todayFoodLog]
  );
  const proteinGapToday = useMemo(() => {
    const target = Number(dailyMacroTargets?.protein || 0);
    return Math.max(0, Math.round(target - todayProtein));
  }, [dailyMacroTargets?.protein, todayProtein]);

  const normalizeText = (value = '') =>
    String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const getFoodCategory = (food) => {
    const protein = Number(food?.protein || 0);
    const carbs = Number(food?.carbs || 0);
    const fats = Number(food?.fats || 0);
    const normalizedLabel = normalizeText(food?.label || '');

    if (normalizedLabel.includes('frango') || normalizedLabel.includes('ovo') || normalizedLabel.includes('atum') || normalizedLabel.includes('carne') || normalizedLabel.includes('whey')) {
      return 'proteina';
    }
    if (normalizedLabel.includes('arroz') || normalizedLabel.includes('feijao') || normalizedLabel.includes('pao') || normalizedLabel.includes('macarrao') || normalizedLabel.includes('batata')) {
      return 'carbo';
    }
    if (fats >= protein && fats >= carbs) {
      return 'gordura';
    }
    if (protein >= carbs) {
      return 'proteina';
    }
    return 'carbo';
  };

  const parseSegmentQuantity = (segment) => {
    const normalized = normalizeText(segment);
    const gramMatch = normalized.match(/(\d+[\.,]?\d*)\s*g\b/);
    if (gramMatch) {
      const grams = Number(String(gramMatch[1]).replace(',', '.'));
      if (Number.isFinite(grams) && grams > 0) {
        return Math.max(0.1, Number((grams / 100).toFixed(2)));
      }
    }

    const unitMatch = normalized.match(/(^|\s)(\d+[\.,]?\d*)\s*(x|un|unid|unidade|ovos?|pao|frango|whey)?\b/);
    if (unitMatch) {
      const qty = Number(String(unitMatch[2]).replace(',', '.'));
      if (Number.isFinite(qty) && qty > 0) {
        return Math.max(0.1, qty);
      }
    }

    return 1;
  };

  const parseSegmentLabel = (segment) => {
    return normalizeText(segment)
      .replace(/\d+[\.,]?\d*\s*g\b/g, ' ')
      .replace(/\d+[\.,]?\d*\s*(x|un|unid|unidade)\b/g, ' ')
      .replace(/\b(comi|comer|de|do|da|e)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const parseFoodText = (text) => {
    const segments = normalizeText(text)
      .split(/[,+;]|\se\s/g)
      .map((part) => part.trim())
      .filter(Boolean);

    const parsed = [];
    const seenKeys = new Set();

    segments.forEach((segment) => {
      const quantity = parseSegmentQuantity(segment);
      const labelHint = parseSegmentLabel(segment);
      const query = labelHint || segment;
      const options = searchFoodCatalog(query);
      if (!options.length) {
        return;
      }

      const exact = options.find((item) => normalizeText(item.label) === query || normalizeText(item.key) === query);
      const match = exact || options[0];
      if (!match) {
        return;
      }

      const identityKey = match.id || match.key;

      if (seenKeys.has(identityKey)) {
        parsed.forEach((item) => {
          if ((item.foodId && item.foodId === match.id) || item.foodKey === match.key) {
            item.quantity = Number((item.quantity + quantity).toFixed(2));
          }
        });
        return;
      }

      seenKeys.add(identityKey);
      parsed.push({
        id: `quick-${match.key}`,
        foodId: match.id,
        foodKey: match.key,
        label: match.label,
        category: getFoodCategory(match),
        quantity,
        calories: Number(match.calories || 0),
        protein: Number(match.protein || 0),
        carbs: Number(match.carbs || 0),
        fats: Number(match.fats || 0),
      });
    });

    return parsed;
  };

  const quickAutocomplete = useMemo(() => {
    const normalized = String(quickMealText || '').trim();
    if (!normalized) {
      return searchFoodCatalog('').slice(0, 8);
    }
    const tokens = normalized.split(/\s+/);
    const activeToken = tokens[tokens.length - 1] || normalized;
    return searchFoodCatalog(activeToken).slice(0, 8);
  }, [quickMealText, searchFoodCatalog]);

  const appendQuickFragment = (fragment) => {
    const current = String(quickMealText || '').trim();
    if (!current) {
      setQuickMealText(fragment);
      return;
    }
    if (current.endsWith('+')) {
      setQuickMealText(`${current} ${fragment}`.trim());
      return;
    }
    setQuickMealText(`${current} + ${fragment}`);
  };

  const applyAutocompleteToQuickText = (foodLabel) => {
    const current = String(quickMealText || '').trim();
    if (!current) {
      setQuickMealText(foodLabel);
      return;
    }

    const parts = current.split(/\s+/);
    parts[parts.length - 1] = foodLabel;
    setQuickMealText(parts.join(' '));
  };

  const quickMealTotals = useMemo(
    () =>
      quickMealItems.reduce(
        (acc, item) => ({
          calories: acc.calories + Number(item.calories || 0) * Number(item.quantity || 1),
          protein: acc.protein + Number(item.protein || 0) * Number(item.quantity || 1),
          carbs: acc.carbs + Number(item.carbs || 0) * Number(item.quantity || 1),
          fats: acc.fats + Number(item.fats || 0) * Number(item.quantity || 1),
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      ),
    [quickMealItems]
  );

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
        foodId: food.id,
        foodKey: food.key,
        label: food.label,
        quantity: safeQuantity,
      },
    ]);
  };

  const updateMealDraftItemQuantity = (itemId, nextQuantity) => {
    const safe = Math.max(0.1, Number(nextQuantity || 1));
    setMealDraftItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, quantity: safe } : item)));
  };

  const mealDraftTotals = useMemo(
    () =>
      mealDraftItems.reduce(
        (acc, item) => {
          const food = searchFoodCatalog(item.label).find(
            (entry) =>
              (item.foodId && entry.id === item.foodId)
              || (item.foodKey && entry.key === item.foodKey)
          ) || getFoodByLabel(item.label);
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

  const favoriteFoods = useMemo(() => {
    const baseCatalog = searchFoodCatalog('');
    return favoriteFoodKeys
      .map((key) => baseCatalog.find((item) => item.key === key))
      .filter(Boolean);
  }, [favoriteFoodKeys, searchFoodCatalog]);

  const latestMealGroup = useMemo(() => {
    const grouped = new Map();
    nutritionLogs.forEach((entry) => {
      const date = String(entry.date || '');
      const loggedAt = String(entry.loggedAt || '00:00');
      const groupKey = `${date} ${loggedAt}`;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey).push(entry);
    });

    const sorted = Array.from(grouped.keys()).sort((a, b) => String(b).localeCompare(String(a)));
    if (!sorted.length) {
      return null;
    }

    const latestKey = sorted[0];
    return {
      key: latestKey,
      items: grouped.get(latestKey) || [],
    };
  }, [nutritionLogs]);

  const toggleFavoriteFood = (foodKey) => {
    setFavoriteFoodKeys((prev) =>
      prev.includes(foodKey) ? prev.filter((key) => key !== foodKey) : [...prev, foodKey]
    );
  };

  const repeatLatestMeal = () => {
    if (!latestMealGroup?.items?.length) {
      return;
    }

    const now = new Date();
    const loggedAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const result = addFoodLogEntriesBatch({
      items: latestMealGroup.items.map((item) => ({
        foodId: item.foodId,
        foodKey: item.foodKey,
        label: item.label,
        quantity: Number(item.quantity || 1),
      })),
      loggedAt,
    });

    if (!result?.ok) {
      setMealFeedback('Nao foi possivel repetir a ultima refeicao.');
      return;
    }

    setMealFeedback(`Refeicao repetida com ${result.entries.length} item(ns).`);
    showSuccessToast('Refeicao salva ✅');
  };

  const pushResultItemsToDraft = () => {
    if (!result?.ok || !Array.isArray(result.items) || !result.items.length) {
      return;
    }

    result.items.forEach((item) => {
      const food = getFoodByLabel(item.label);
      if (food) {
        addItemToMealDraft(food, Number(item.quantity || 1));
      }
    });
  };

  const runPhotoEstimate = async (source) => {
    if (!hasFeatureAccess('photo_scanner')) {
      navigateWithTracking('Paywall', { featureKey: 'photo_scanner', source: 'scanner_photo_button' }, 'photo_scanner_paywall');
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

  const buildQuickMeal = () => {
    const parsed = parseFoodText(quickMealText);
    if (!parsed.length) {
      setMealFeedback('Nao identifiquei alimentos validos nesse texto.');
      return;
    }
    setQuickMealItems(parsed);
  };

  const saveQuickMeal = () => {
    if (!quickMealItems.length) {
      return;
    }

    const startedAt = Date.now();

    const now = new Date();
    const loggedAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const result = addFoodLogEntriesBatch({
      items: quickMealItems.map((item) => ({
        foodId: item.foodId,
        foodKey: item.foodKey,
        label: item.label,
        quantity: item.quantity,
      })),
      loggedAt,
    });

    if (!result?.ok) {
      trackEvent('quick_meal_save_failed', {
        screen: SCREENS.NUTRITION,
        meta: {
          domain: 'nutrition',
          version: 1,
          action: 'saveQuickMeal',
          reason: 'batch_save_failed',
          itemCount: quickMealItems.length,
          durationMs: Date.now() - startedAt,
        },
      });
      setMealFeedback('Nao foi possivel salvar a refeicao rapida.');
      return;
    }

    trackEvent('quick_meal_saved', {
      screen: SCREENS.NUTRITION,
      meta: {
        domain: 'nutrition',
        version: 1,
        action: 'saveQuickMeal',
        itemCount: quickMealItems.length,
        durationMs: Date.now() - startedAt,
      },
    });

    const proteinTarget = Number(dailyMacroTargets?.protein || 0);
    const projectedProtein = todayProtein + Number(quickMealTotals.protein || 0);
    const proteinGap = Math.max(0, Math.round(proteinTarget - projectedProtein));
    const projectedCalories = todayFoodLog.reduce((acc, item) => acc + Number(item.calories || 0), 0) + Number(quickMealTotals.calories || 0);
    const projectedFeedback = getNutritionFeedback({
      proteinConsumed: projectedProtein,
      caloriesConsumed: projectedCalories,
    });
    setMealFeedback(`🟢 Boa refeicao | +${Math.round(quickMealTotals.protein)}g proteina | faltam ${proteinGap}g hoje. ${projectedFeedback.suggestion}`);
    showSuccessToast('Refeicao salva ✅');
    setFoodSavedIndicatorVisible(true);
    setTimeout(() => setFoodSavedIndicatorVisible(false), 3000);
    setQuickMealItems([]);
    setQuickMealText('');
  };

  const saveMealDraft = () => {
    if (!mealDraftItems.length) {
      return;
    }

    const startedAt = Date.now();

    const now = new Date();
    const loggedAt = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const result = addFoodLogEntriesBatch({
      items: mealDraftItems,
      loggedAt,
    });

    if (!result?.ok) {
      trackEvent('meal_draft_save_failed', {
        screen: SCREENS.NUTRITION,
        meta: {
          domain: 'nutrition',
          version: 1,
          action: 'saveMealDraft',
          reason: 'batch_save_failed',
          itemCount: mealDraftItems.length,
          durationMs: Date.now() - startedAt,
        },
      });
      setMealFeedback('Nao foi possivel salvar a refeicao composta.');
      return;
    }

    if (result.quality) {
      const projectedFeedback = getNutritionFeedback();
      setMealFeedback(`${result.quality.emoji} ${result.quality.badge} - refeicao composta salva com sucesso. ${projectedFeedback.suggestion}`);
    }
    showSuccessToast('Refeicao salva ✅');

    trackEvent('meal_draft_saved', {
      screen: SCREENS.NUTRITION,
      meta: {
        domain: 'nutrition',
        version: 1,
        action: 'saveMealDraft',
        itemCount: mealDraftItems.length,
        durationMs: Date.now() - startedAt,
      },
    });

    trackEvent('food_logged', {
      calories: Math.round(mealDraftTotals.calories),
      protein: Math.round(mealDraftTotals.protein),
      carbs: Math.round(mealDraftTotals.carbs),
      fats: Math.round(mealDraftTotals.fats),
      compositionSize: mealDraftItems.length,
    });

    setMealDraftItems([]);

    if (!hasFeatureAccess('weekly_macros')) {
      navigateWithTracking('Paywall', {
        featureKey: 'weekly_macros',
        source: 'post_food',
        message: 'Voce registrou sua refeicao, mas ainda nao sabe se bateu sua meta semanal. Veja isso no PRO.',
      }, 'post_food_paywall');
      return;
    }

    navigateWithTracking('AnaliseDia', {
      prefillCalories: Math.round(mealDraftTotals.calories),
      prefillProtein: Math.round(mealDraftTotals.protein),
      prefillCarbs: Math.round(mealDraftTotals.carbs),
      prefillFats: Math.round(mealDraftTotals.fats),
    }, 'post_food_day_analysis');
  };

  return (
    <View style={styles.screen}>
      <AnimatedToast message={toastMessage} onHide={() => setToastMessage('')} />
      <ScrollView testID="screen-nutricao" contentContainerStyle={styles.container}>
      <ScreenHeader title="Nutricao" subtitle="Registre refeicoes com horario. Texto e foto ficam como apoio." />

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Coach nutricional do dia</Text>
        <Text testID="calorias-total-inline" style={styles.feedbackText}>Calorias hoje: {Math.round(todayCalories)} kcal</Text>
        <Text style={[styles.feedbackTitle, nutritionFeedback?.tone === 'warning' ? styles.feedbackWarning : nutritionFeedback?.tone === 'success' ? styles.feedbackSuccess : null]}>
          {nutritionFeedback?.title || 'Feedback indisponivel'}
        </Text>
        <Text style={styles.feedbackText}>{nutritionFeedback?.message || ''}</Text>
        <Text style={styles.feedbackSuggestion}>{nutritionFeedback?.suggestion || ''}</Text>
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Top fuel da semana</Text>
        <Text style={styles.foodsSummaryMeta}>
          {topFoodsSummary?.daysAnalyzed || 0} dia(s) analisados • {topFoodsSummary?.totalEntries || 0} registro(s)
        </Text>
        {topFoodsSummary?.topFood ? (
          <View style={styles.topFoodHero}>
            <Text style={styles.topFoodHeroTitle}>Mais relevante para proteína</Text>
            <Text style={styles.topFoodHeroName}>{topFoodsSummary.topFood.label}</Text>
            <Text style={styles.topFoodHeroMeta}>
              {topFoodsSummary.topFood.proteinTotal}g proteína • {topFoodsSummary.topFood.caloriesTotal} kcal
            </Text>
          </View>
        ) : (
          <Text style={styles.emptyLine}>Sem dados suficientes para ranking semanal.</Text>
        )}

        {Array.isArray(topFoodsSummary?.ranking) ? topFoodsSummary.ranking.slice(0, 5).map((item) => (
          <View key={`top-food-${item.foodId || item.label}`} style={styles.rankingRow}>
            <Text style={styles.rankingPosition}>#{item.rank}</Text>
            <View style={styles.rankingCenter}>
              <Text style={styles.rankingLabel}>{item.label}</Text>
              <Text style={styles.rankingMeta}>{item.entries}x | qty {item.quantityTotal}x</Text>
            </View>
            <View style={styles.rankingRight}>
              <Text style={styles.rankingProtein}>{item.proteinTotal}g P</Text>
              <Text style={styles.rankingCalories}>{item.caloriesTotal} kcal</Text>
            </View>
          </View>
        )) : null}
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Insight cruzado treino x recuperação</Text>
        <Text
          style={[
            styles.crossInsightTitle,
            recoveryInsight?.tone === 'warning'
              ? styles.crossInsightWarning
              : recoveryInsight?.tone === 'success'
              ? styles.crossInsightSuccess
              : null,
          ]}
        >
          {recoveryInsight?.title || 'Insight indisponível'}
        </Text>
        <Text style={styles.crossInsightText}>{recoveryInsight?.message || ''}</Text>
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Registro rapido (chat-first)</Text>
        <TextInput
          testID="input-alimento-nome"
          value={quickMealText}
          onChangeText={setQuickMealText}
          placeholder="Ex: 2 ovos + 150g frango + arroz"
          placeholderTextColor="#8AA2C7"
          style={styles.searchInput}
        />
        <View style={styles.chipsWrap}>
          {COMMON_QUICK_ADDS.map((entry) => (
            <TouchableOpacity key={`quick-add-${entry}`} style={styles.chipAction} onPress={() => appendQuickFragment(entry.replace(/^\+/, ''))}>
              <Text style={styles.chipActionText}>{entry}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.chipsWrap}>
          {quickAutocomplete.map((food) => (
            <TouchableOpacity key={`auto-${food.key}`} style={styles.chipAction} onPress={() => applyAutocompleteToQuickText(food.label)}>
              <Text style={styles.chipActionText}>{food.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <PrimaryButton testID="btn-adicionar-alimento" title="Montar refeicao" onPress={buildQuickMeal} style={styles.primaryButton} />
        <Text style={styles.gapHint}>Proteina hoje: {Math.round(todayProtein)}g • faltam {proteinGapToday}g</Text>

        {quickMealItems.length ? (
          <View style={styles.quickPreviewWrap}>
            {quickMealItems.map((item) => (
              <View key={item.id} style={styles.quickItemRow}>
                <View style={styles.quickItemLeft}>
                  <Text style={styles.logTitle}>{item.label}</Text>
                  <Text style={styles.logMeta}>{item.quantity}x • {item.calories} kcal | P {item.protein}g | C {item.carbs}g | G {item.fats}g</Text>
                </View>
                <Text style={[styles.categoryBadge, item.category === 'proteina' ? styles.categoryProtein : item.category === 'carbo' ? styles.categoryCarb : styles.categoryFat]}>
                  {item.category}
                </Text>
              </View>
            ))}

            <Text style={styles.logMeta}>
              Total: {Math.round(quickMealTotals.calories)} kcal | P {Math.round(quickMealTotals.protein)}g | C {Math.round(quickMealTotals.carbs)}g | G {Math.round(quickMealTotals.fats)}g
            </Text>

            <PrimaryButton testID="btn-salvar-alimento" title="Salvar refeicao" onPress={saveQuickMeal} style={styles.primaryButton} />
          </View>
        ) : null}
        {foodSavedIndicatorVisible ? (
          <Text testID="alimento-salvo-indicator" style={styles.mealFeedback}>Alimento salvo</Text>
        ) : null}
      </AppCard>

      <AppCard style={styles.card}>
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
              <View style={styles.foodHeaderRow}>
                <Text style={styles.foodLabel}>{food.label}</Text>
                <TouchableOpacity onPress={() => toggleFavoriteFood(food.key)}>
                  <Text style={styles.favoriteIcon}>{favoriteFoodKeys.includes(food.key) ? '★' : '☆'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.foodMeta}>{food.calories} kcal | P {food.protein}g</Text>
            </TouchableOpacity>
          ))}
        </View>

        {favoriteFoods.length ? (
          <View style={styles.chipsWrap}>
            {favoriteFoods.map((food) => (
              <TouchableOpacity key={`favorite-${food.key}`} style={styles.chipAction} onPress={() => setSelectedFood(food)}>
                <Text style={styles.chipActionText}>★ {food.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

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

        <PrimaryButton title="Adicionar alimento +" onPress={useEstimateInDay} style={styles.primaryButton} />
        <SecondaryButton
          title={latestMealGroup ? `Repetir ultima refeicao (${latestMealGroup.items.length})` : 'Repetir ultima refeicao'}
          onPress={repeatLatestMeal}
          style={styles.secondaryButton}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Composicao da refeicao</Text>
        {mealDraftItems.length === 0 ? <Text style={styles.emptyLine}>Adicione alimentos para montar a refeicao.</Text> : null}
        {mealDraftItems.map((item) => (
          <View key={item.id} style={styles.logRow}>
            <View>
              <Text style={styles.logTitle}>{item.label}</Text>
              <Text testID={`text-quantity-${item.id}`} style={styles.logMeta}>Quantidade: {item.quantity}x</Text>
              <View style={styles.qtyRow}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateMealDraftItemQuantity(item.id, Math.max(0.1, item.quantity - 0.5))}>
                  <Text style={styles.qtyBtnText}>-</Text>
                </TouchableOpacity>
                {[0.5, 1, 2].map((factor) => (
                  <TouchableOpacity key={`${item.id}-${factor}`} style={styles.qtyChip} onPress={() => updateMealDraftItemQuantity(item.id, factor)}>
                    <Text style={styles.qtyChipText}>{factor}x</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={styles.qtyBtn} onPress={() => updateMealDraftItemQuantity(item.id, item.quantity + 0.5)}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity onPress={() => setMealDraftItems((prev) => prev.filter((entry) => entry.id !== item.id))}>
              <Text style={styles.removeText}>Remover</Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.logMeta}>
          Totais: {Math.round(mealDraftTotals.calories)} kcal | P {Math.round(mealDraftTotals.protein)}g | C {Math.round(mealDraftTotals.carbs)}g | G {Math.round(mealDraftTotals.fats)}g
        </Text>

        <PrimaryButton testID="btn-save-meal" title="Salvar refeicao" onPress={saveMealDraft} style={styles.primaryButton} />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Hoje</Text>
        <Text testID="calorias-total" style={styles.logMeta}>{Math.round(todayCalories)} kcal</Text>
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
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Estimativa por texto</Text>
        <TextInput
          testID="text-input-food"
          value={manualText}
          onChangeText={setManualText}
          placeholder="Digite alimentos e quantidades (ex: 1 pao, 2 ovos, 100g frango)"
          placeholderTextColor="#8AA2C7"
          multiline
          style={styles.inputArea}
        />

        <View style={styles.fractionRow}>
          {[0.5, 1, 2].map((value) => (
            <TouchableOpacity
              key={String(value)}
              style={[styles.fractionButton, portionFactor === value ? styles.fractionButtonActive : null]}
              onPress={() => setPortionFactor(value)}
            >
              <Text style={[styles.fractionText, portionFactor === value ? styles.fractionTextActive : null]}>
                {value === 0.5 ? '1/2' : `${value}x`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <PrimaryButton
          testID="btn-estimate-text"
          title="Estimar por texto"
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
        />
        {result?.ok && Array.isArray(result.items) && result.items.length ? (
          <SecondaryButton title="Adicionar resultado ao draft" onPress={pushResultItemsToDraft} style={styles.secondaryButton} />
        ) : null}
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
      </AppCard>

      {SHOW_PHOTO_BETA ? (
      <AppCard style={styles.card}>
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
          <SecondaryButton title="Tirar foto" style={styles.secondaryButton} onPress={() => runPhotoEstimate('camera')} />
          <SecondaryButton title="Escolher da galeria" style={styles.secondaryButton} onPress={() => runPhotoEstimate('library')} />
        </View>
        {result?.ok && Array.isArray(result.items) && result.items.length ? (
          <SecondaryButton title="Adicionar resultado ao draft" onPress={pushResultItemsToDraft} style={styles.secondaryButton} />
        ) : null}
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
      </AppCard>
      ) : null}

      {result ? (
        <AppCard style={styles.resultCard}>
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
        </AppCard>
      ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flexGrow: 1,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  inputArea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#141922',
    color: colors.textPrimary,
    padding: 10,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#141922',
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  foodList: {
    marginTop: 10,
    gap: 6,
  },
  foodOption: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#141922',
  },
  foodOptionActive: {
    borderColor: colors.secondary,
    backgroundColor: '#1B2840',
  },
  foodLabel: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  foodHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  favoriteIcon: {
    color: '#FFE28A',
    fontSize: 18,
    fontWeight: '900',
  },
  foodMeta: {
    color: colors.textSecondary,
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
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  fractionButtonActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  fractionText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  fractionTextActive: {
    color: colors.textPrimary,
  },
  primaryButton: {
    marginTop: 10,
  },
  secondaryButton: {
    marginTop: 10,
    flex: 1,
  },
  resultCard: {
    marginBottom: spacing.md,
  },
  emptyLine: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  mealFeedback: {
    color: colors.textPrimary,
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '700',
  },
  logRow: {
    marginTop: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  logTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  logMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  removeText: {
    color: '#FCA5A5',
    fontWeight: '700',
    fontSize: 12,
  },
  qtyRow: {
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBtnText: {
    color: colors.textPrimary,
    fontWeight: '900',
  },
  qtyChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  qtyChipText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  mealBadge: {
    marginTop: 3,
    color: colors.textPrimary,
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
  gapHint: {
    marginTop: 8,
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '800',
  },
  quickPreviewWrap: {
    marginTop: spacing.sm,
  },
  quickItemRow: {
    marginTop: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickItemLeft: {
    flex: 1,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  categoryProtein: {
    color: '#9DE2C2',
    borderColor: '#2F7A5B',
    backgroundColor: '#123429',
  },
  categoryCarb: {
    color: '#FFE0A8',
    borderColor: '#A06A00',
    backgroundColor: '#3A2A12',
  },
  categoryFat: {
    color: '#FECACA',
    borderColor: '#B75A5A',
    backgroundColor: '#3A1C1C',
  },
  chipAction: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#141922',
  },
  chipActionText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  resultTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    marginBottom: 6,
  },
  resultMessage: {
    color: colors.textSecondary,
    marginBottom: 8,
  },
  resultLine: {
    color: colors.textPrimary,
    marginBottom: 3,
    fontWeight: '700',
  },
  coachLine: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '700',
  },
  feedbackTitle: {
    color: '#BFDBFE',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
  },
  feedbackWarning: {
    color: '#FCD34D',
  },
  feedbackSuccess: {
    color: '#86EFAC',
  },
  feedbackText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  feedbackSuggestion: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '800',
  },
  foodsSummaryMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  topFoodHero: {
    borderWidth: 1,
    borderColor: '#355E90',
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#14253F',
    marginBottom: 8,
  },
  topFoodHeroTitle: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  topFoodHeroName: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  topFoodHeroMeta: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#141922',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  rankingPosition: {
    width: 26,
    color: '#BFDBFE',
    fontSize: 13,
    fontWeight: '900',
  },
  rankingCenter: {
    flex: 1,
  },
  rankingLabel: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  rankingMeta: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  rankingRight: {
    alignItems: 'flex-end',
  },
  rankingProtein: {
    color: '#86EFAC',
    fontSize: 12,
    fontWeight: '900',
  },
  rankingCalories: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  crossInsightTitle: {
    color: '#BFDBFE',
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 6,
  },
  crossInsightWarning: {
    color: '#FCD34D',
  },
  crossInsightSuccess: {
    color: '#86EFAC',
  },
  crossInsightText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 19,
  },
});
