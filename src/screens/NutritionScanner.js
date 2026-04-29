
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../hooks';
import { useApp } from '../context/AppContext';
import { SCREENS, trackAppError, trackEvent } from '../utils/analytics';
import { AnimatedToast, AppCard, AppInput, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';
import { createFoodFromText, parseNutritionLabel } from '../services/nutritionIntelligence';
import { matchNutritionToken } from '../data/nutritionDatabase.js';
import { logError } from '../utils/errorLogger';

const FAVORITES_STORAGE_KEY = 'nutrition.favorite.foods.v1';
const SHOW_PHOTO_BETA = true;
const SHOW_ADVANCED_NUTRITION = true;
const NUTRITION_ONE_TAP_CLOSE_EXPERIMENT_KEY = 'exp_nutrition_one_tap_close_v1';
const PAYWALL_TIMING_EXPERIMENT_KEY = 'exp_paywall_timing_v1';

function resolveExperimentVariant(seed = '') {
  const source = String(seed || 'anonymous');
  let acc = 0;
  for (let i = 0; i < source.length; i += 1) {
    acc = (acc + source.charCodeAt(i) * (i + 1)) % 9973;
  }
  return acc % 2 === 0 ? 'A' : 'B';
}

function formatQuantityLabel(quantity = 1, unit = 'x') {
  const safeQty = Number(quantity || 1);
  const safeUnit = String(unit || 'x').toLowerCase();

  if (safeUnit === 'g' || safeUnit === 'ml') {
    return `${safeQty}${safeUnit}`;
  }

  if (safeUnit === 'un' || safeUnit === 'unid' || safeUnit === 'unidade') {
    return `${safeQty}un`;
  }

  return `${safeQty}x`;
}

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
    user,
  } = useApp();
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
  const simpleNutritionMode = false;
  const [foodSavedIndicatorVisible, setFoodSavedIndicatorVisible] = useState(false);
  const [mealDraftItems, setMealDraftItems] = useState([]);
  const [favoriteFoodKeys, setFavoriteFoodKeys] = useState([]);
  const [lastClosedDayKey, setLastClosedDayKey] = useState('');
  const closeDayCtaSeenRef = useRef('');
  const proteinTargetPerMeal = 30;

  // Reseta estado transitório quando o usuário sai da tela (troca de aba ou navega).
  useFocusEffect(
    useCallback(() => {
      return () => {
        setMealDraftItems([]);
        setQuickMealItems([]);
        setQuickMealText('');
        setResult(null);
        setSelectedFood(null);
        setMealFeedback('');
        setManualText('');
        setPhotoHintText('');
        setPortionFactor(1);
        setSearchQuery('');
      };
    }, [])
  );

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

  const COMMON_QUICK_ADDS = ['+2 ovos', '+150g frango', '+1 pão', '+1 whey'];

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

  const safeSearchFoodCatalog = typeof searchFoodCatalog === 'function'
    ? searchFoodCatalog
    : () => [];
  const safeGetTodayFoodLog = typeof getTodayFoodLog === 'function'
    ? getTodayFoodLog
    : () => [];
  const safeGetDailyMacroTargets = typeof getDailyMacroTargets === 'function'
    ? getDailyMacroTargets
    : () => ({ calories: 0, protein: 0, carbs: 0, fats: 0 });
  const safeGetNutritionFeedback = typeof getNutritionFeedback === 'function'
    ? getNutritionFeedback
    : () => ({ status: 'ok', message: '', nextAction: '' });
  const safeGetTopFoods = typeof getTopFoods === 'function'
    ? getTopFoods
    : () => [];
  const safeGetPerformanceRecoveryInsight = typeof getPerformanceRecoveryInsight === 'function'
    ? getPerformanceRecoveryInsight
    : () => ({ status: 'stable', summary: '', focus: '' });
  const safeHasFeatureAccess = typeof hasFeatureAccess === 'function'
    ? hasFeatureAccess
    : () => false;

  const foodOptions = useMemo(() => safeSearchFoodCatalog(searchQuery), [safeSearchFoodCatalog, searchQuery]);
  const todayFoodLog = useMemo(() => {
    const logs = safeGetTodayFoodLog();
    return Array.isArray(logs) ? logs : [];
  }, [safeGetTodayFoodLog, nutritionLogs]);
  const todayCalories = useMemo(
    () => todayFoodLog.reduce((acc, item) => acc + Number(item.calories || 0), 0),
    [todayFoodLog]
  );
  const dailyMacroTargets = useMemo(() => safeGetDailyMacroTargets(), [safeGetDailyMacroTargets]);
  const nutritionFeedback = useMemo(() => safeGetNutritionFeedback(), [safeGetNutritionFeedback, nutritionLogs]);
  const topFoodsSummary = useMemo(
    () => safeGetTopFoods({ days: 7, limit: 5 }),
    [safeGetTopFoods, nutritionLogs]
  );
  const recoveryInsight = useMemo(
    () => safeGetPerformanceRecoveryInsight(),
    [safeGetPerformanceRecoveryInsight, nutritionLogs]
  );
  const todayProtein = useMemo(
    () => todayFoodLog.reduce((acc, item) => acc + Number(item.protein || 0), 0),
    [todayFoodLog]
  );
  const todayCarbs = useMemo(
    () => todayFoodLog.reduce((acc, item) => acc + Number(item.carbs || 0), 0),
    [todayFoodLog]
  );
  const todayFats = useMemo(
    () => todayFoodLog.reduce((acc, item) => acc + Number(item.fats || 0), 0),
    [todayFoodLog]
  );
  const proteinGapToday = useMemo(() => {
    const target = Number(dailyMacroTargets?.protein || 0);
    return Math.max(0, Math.round(target - todayProtein));
  }, [dailyMacroTargets?.protein, todayProtein]);
  const todayDateKey = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);
  const closeDayVariant = useMemo(
    () => resolveExperimentVariant(String(user?.id || 'anonymous')),
    [user?.id]
  );
  const paywallTimingVariant = useMemo(
    () => resolveExperimentVariant(`${PAYWALL_TIMING_EXPERIMENT_KEY}:${String(user?.id || 'anonymous')}`),
    [user?.id]
  );
  const canCloseDay = useMemo(() => {
    const caloriesTarget = Number(dailyMacroTargets?.calories || 0);
    const proteinTarget = Number(dailyMacroTargets?.protein || 0);
    const minCalories = caloriesTarget > 0 ? Math.max(300, Math.round(caloriesTarget * 0.35)) : 300;
    const minProtein = proteinTarget > 0 ? Math.max(25, Math.round(proteinTarget * 0.4)) : 25;
    return todayFoodLog.length > 0 && (todayCalories >= minCalories || todayProtein >= minProtein);
  }, [dailyMacroTargets?.calories, dailyMacroTargets?.protein, todayCalories, todayFoodLog.length, todayProtein]);

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
      const options = safeSearchFoodCatalog(query);
      let match = null;
      if (options.length) {
        const exact = options.find((item) => normalizeText(item.label) === query || normalizeText(item.key) === query);
        match = exact || options[0];
      } else {
        // Fallback: tenta match por token individual para tolerar erros de digitação.
        const tokenMatch = matchNutritionToken(segment);
        if (tokenMatch) {
          match = tokenMatch;
        }
      }
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
      return safeSearchFoodCatalog('').slice(0, 8);
    }
    const tokens = normalized.split(/\s+/);
    const activeToken = tokens[tokens.length - 1] || normalized;
    return safeSearchFoodCatalog(activeToken).slice(0, 8);
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

    const options = safeSearchFoodCatalog(safeLabel);
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
          const food = safeSearchFoodCatalog(item.label).find(
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
    const baseCatalog = safeSearchFoodCatalog('');
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

  useEffect(() => {
    const viewKey = `${todayDateKey}:${closeDayVariant}`;
    if (!canCloseDay || closeDayCtaSeenRef.current === viewKey) {
      return;
    }

    closeDayCtaSeenRef.current = viewKey;
    trackEvent('nutrition_close_day_cta_viewed', {
      screen: SCREENS.NUTRITION,
      meta: {
        domain: 'nutrition',
        version: 1,
        experimentKey: NUTRITION_ONE_TAP_CLOSE_EXPERIMENT_KEY,
        variant: closeDayVariant,
      },
    });
  }, [canCloseDay, closeDayVariant, todayDateKey]);

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
      logError(new Error('nutrition_repeat_latest_meal_failed'), {
        screen: SCREENS.NUTRITION,
        severity: 'low',
        extra: { itemCount: latestMealGroup.items.length },
      });
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
    if (!safeHasFeatureAccess('photo_scanner')) {
      navigateWithTracking('Paywall', { featureKey: 'photo_scanner', source: 'scanner_photo_button' }, 'photo_scanner_paywall');
      return;
    }

    let selectedAsset = null;

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
      selectedAsset = cameraResult.assets?.[0] || null;
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
      selectedAsset = libraryResult.assets?.[0] || null;
    }

    const normalizedHint = String(photoHintText || '').trim();
    const parsedLabel = parseNutritionLabel({
      uri: selectedAsset?.uri,
      ocrText: normalizedHint,
    });

    if (parsedLabel.insufficientData) {
      setResult({
        ok: false,
        source: 'photo_ocr',
        message: 'Nao consegui ler dados suficientes da tabela. Envie mais texto da tabela (kcal, carboidratos, proteina e gorduras) para estimativa confiavel.',
      });
      return;
    }

    const factor = Number(portionFactor || 1);
    const totals = {
      calories: Math.round(Number(parsedLabel.calories || 0) * factor),
      protein: Math.round(Number(parsedLabel.protein || 0) * factor),
      carbs: Math.round(Number(parsedLabel.carbs || 0) * factor),
      fats: Math.round(Number(parsedLabel.fat || 0) * factor),
    };

    const confidenceLabel = parsedLabel.confidence === 'high'
      ? 'alta'
      : parsedLabel.confidence === 'medium'
      ? 'media'
      : 'baixa';

    const message = `Tabela nutricional lida com confianca ${confidenceLabel}.`; 

    setResult({
      ok: true,
      source: 'photo_ocr',
      totals,
      items: [
        {
          label: parsedLabel.productName || normalizedHint || 'Alimento escaneado',
          quantity: 1,
        },
      ],
      message,
    });
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
      logError(new Error('nutrition_quick_meal_unrecognized'), {
        screen: SCREENS.NUTRITION,
        severity: 'low',
        extra: { quickMealText },
      });
      // Mostra sugestões do catálogo com base no texto informado para ajudar o usuário.
      const normalized = String(quickMealText || '').trim();
      const fallbackHint = normalized ? safeSearchFoodCatalog(normalized.split(/\s+/)[0]).slice(0, 3) : [];
      const suggestionText = fallbackHint.length
        ? `Sugestoes: ${fallbackHint.map((f) => f.label).join(', ')}`
        : 'Tente nomes como "arroz", "frango", "ovo", "pao".';
      setMealFeedback(`Nao identifiquei alimentos. ${suggestionText}`);
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
        calories: Math.round(Number(item.calories || 0) * Number(item.quantity || 1)),
        protein: Math.round(Number(item.protein || 0) * Number(item.quantity || 1)),
        carbs: Math.round(Number(item.carbs || 0) * Number(item.quantity || 1)),
        fats: Math.round(Number(item.fats || 0) * Number(item.quantity || 1)),
      })),
      loggedAt,
    });

    if (!result?.ok) {
      logError(new Error('nutrition_quick_meal_save_failed'), {
        screen: SCREENS.NUTRITION,
        severity: 'low',
        extra: { itemCount: quickMealItems.length },
      });
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
    const projectedFeedback = safeGetNutritionFeedback({
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

    const resolvedDraftItems = mealDraftItems.map((item) => {
      const food = safeSearchFoodCatalog(item.label).find(
        (entry) =>
          (item.foodId && entry.id === item.foodId) ||
          (item.foodKey && entry.key === item.foodKey)
      ) || getFoodByLabel(item.label);
      const qty = Number(item.quantity || 1);
      return {
        foodId: item.foodId,
        foodKey: item.foodKey,
        label: item.label,
        quantity: qty,
        calories: Math.round(Number(food?.calories || 0) * qty),
        protein: Math.round(Number(food?.protein || 0) * qty),
        carbs: Math.round(Number(food?.carbs || 0) * qty),
        fats: Math.round(Number(food?.fats || 0) * qty),
      };
    });

    const result = addFoodLogEntriesBatch({
      items: resolvedDraftItems,
      loggedAt,
    });

    if (!result?.ok) {
      logError(new Error('nutrition_meal_draft_save_failed'), {
        screen: SCREENS.NUTRITION,
        severity: 'low',
        extra: { itemCount: mealDraftItems.length },
      });
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
      const projectedFeedback = safeGetNutritionFeedback();
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

    const analysisPayload = {
      prefillCalories: Math.round(mealDraftTotals.calories),
      prefillProtein: Math.round(mealDraftTotals.protein),
      prefillCarbs: Math.round(mealDraftTotals.carbs),
      prefillFats: Math.round(mealDraftTotals.fats),
    };

    navigateWithTracking('AnaliseDia', analysisPayload, 'post_food_day_analysis');
  };

  const closeNutritionDayOneTap = () => {
    if (!canCloseDay) {
      return;
    }

    const closeKey = `${todayDateKey}:${closeDayVariant}`;
    if (lastClosedDayKey === closeKey) {
      setMealFeedback('Dia ja fechado hoje. Se quiser, ajuste com nova refeicao.');
      return;
    }

    trackEvent('nutrition_day_completed', {
      screen: SCREENS.NUTRITION,
      meta: {
        domain: 'nutrition',
        version: 1,
        source: 'one_tap_close',
        dayKey: todayDateKey,
        calories: Math.round(todayCalories),
        protein: Math.round(todayProtein),
        carbs: Math.round(todayCarbs),
        fats: Math.round(todayFats),
        experimentKey: NUTRITION_ONE_TAP_CLOSE_EXPERIMENT_KEY,
        variant: closeDayVariant,
      },
    });

    setLastClosedDayKey(closeKey);
    setMealFeedback('Dia fechado com 1 toque ✅');
    showSuccessToast('Dia de nutricao fechado ✅');
    navigateWithTracking('AnaliseDia', {
      prefillCalories: Math.round(todayCalories),
      prefillProtein: Math.round(todayProtein),
      prefillCarbs: Math.round(todayCarbs),
      prefillFats: Math.round(todayFats),
      source: 'one_tap_close',
    }, 'nutrition_one_tap_close');
  };

  const proteinProgress = Number(dailyMacroTargets?.protein || 0) > 0
    ? Math.min(1, Number(todayProtein || 0) / Number(dailyMacroTargets?.protein || 1))
    : 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <AnimatedToast message={toastMessage} onHide={() => setToastMessage('')} />
      <ScrollView testID="screen-nutricao" contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ScreenHeader title="Nutrição" subtitle="Registre em 5 segundos." />

      <Text style={styles.sectionSeparator}>O que você comeu?</Text>
      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Registro rápido</Text>
        <AppInput
          testID="input-alimento-nome"
          value={quickMealText}
          onChangeText={setQuickMealText}
          placeholder="Ex: arroz e frango"
          autoCapitalize="sentences"
        />
        <View style={styles.chipsWrap}>
          {COMMON_QUICK_ADDS.map((entry) => (
            <TouchableOpacity key={`quick-add-${entry}`} style={styles.chipAction} onPress={() => appendQuickFragment(entry.replace(/^\+/, ''))}>
              <Text style={styles.chipActionText}>{entry}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <PrimaryButton testID="btn-adicionar-alimento" title="Montar refeição" onPress={buildQuickMeal} style={styles.primaryButton} />

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

            <PrimaryButton testID="btn-salvar-alimento" title="Salvar refeição" onPress={saveQuickMeal} style={styles.primaryButton} />
          </View>
        ) : null}
        {foodSavedIndicatorVisible ? (
          <Text testID="alimento-salvo-indicator" style={styles.mealFeedback}>Alimento salvo</Text>
        ) : null}
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Progresso de proteína</Text>
        <View style={styles.simpleMacroTrack}>
          <View style={[styles.simpleMacroFill, { width: `${Math.round(proteinProgress * 100)}%` }]} />
        </View>
        <Text style={styles.simpleMacroText}>{Math.round(todayProtein)}g / {Math.round(Number(dailyMacroTargets?.protein || 120))}g</Text>
      </AppCard>

      {!simpleNutritionMode ? (
      <>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Coach nutricional do dia</Text>
        <Text testID="calorias-total-inline" style={styles.feedbackText}>Calorias hoje: {Math.round(todayCalories)} kcal</Text>
        <Text style={[styles.feedbackTitle, nutritionFeedback?.tone === 'warning' ? styles.feedbackWarning : nutritionFeedback?.tone === 'success' ? styles.feedbackSuccess : null]}>
          {nutritionFeedback?.title || 'Feedback indisponivel'}
        </Text>
        <Text style={styles.feedbackText}>{nutritionFeedback?.message || ''}</Text>
        <Text style={styles.feedbackSuggestion}>{nutritionFeedback?.suggestion || ''}</Text>
      </AppCard>

      {canCloseDay ? (
        <AppCard style={styles.card}>
          <Text style={styles.cardTitle}>Fechar dia com 1 toque</Text>
          <Text style={styles.feedbackText}>Pronto para concluir: {Math.round(todayCalories)} kcal • P {Math.round(todayProtein)}g</Text>
          <PrimaryButton testID="btn-fechar-dia-nutricao" title="Fechar dia" onPress={closeNutritionDayOneTap} style={styles.primaryButton} />
        </AppCard>
      ) : null}

      {/* ── SEÇÃO 2: RESUMO DO DIA ── */}
      <Text style={styles.sectionSeparator}>2 — HOJE</Text>
      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Hoje</Text>
        <Text testID="calorias-total" style={styles.logMeta}>{Math.round(todayCalories)} kcal</Text>
        {mealFeedback ? <Text style={styles.mealFeedback}>{mealFeedback}</Text> : null}
        {todayFoodLog.length === 0 ? (
          <View style={styles.emptyStateMini}>
            <Ionicons name="restaurant-outline" size={28} color={colors.primary} />
            <Text style={styles.emptyStateMiniTitle}>Nenhuma refeição registrada</Text>
            <Text style={styles.emptyStateMiniText}>Registre sua primeira refeição do dia acima para começar a acompanhar seus macros.</Text>
          </View>
        ) : null}
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

      {SHOW_ADVANCED_NUTRITION ? (
      <>
      {/* ── SEÇÃO 3: MONTAGEM E CATÁLOGO ── */}
      <Text style={styles.sectionSeparator}>3 — BUSCA E MONTAGEM</Text>
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
        <Text style={styles.cardTitle}>Catalogo local</Text>
        <AppInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Busque por alimento"
          autoCapitalize="none"
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

        <PrimaryButton testID="btn-add-selected-food" title="Adicionar alimento +" onPress={useEstimateInDay} style={styles.primaryButton} />
        <SecondaryButton
          testID="btn-repeat-last-meal"
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

        <PrimaryButton testID="btn-save-meal" title="Salvar refeição" onPress={saveMealDraft} style={styles.primaryButton} />
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Estimativa por texto</Text>
        <AppInput
          testID="text-input-food"
          value={manualText}
          onChangeText={setManualText}
          placeholder="Digite alimentos e quantidades (ex: 1 pão, 2 ovos, 100g frango)"
          multiline
          autoCapitalize="sentences"
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
            const parsedFromFreeText = createFoodFromText(manualText);
            if (parsedFromFreeText?.items?.length) {
              setResult({
                ok: true,
                source: 'free_text',
                items: parsedFromFreeText.items,
                totals: {
                  calories: Math.round(parsedFromFreeText.totals.calories * portionFactor),
                  protein: Math.round(parsedFromFreeText.totals.protein * portionFactor),
                  carbs: Math.round(parsedFromFreeText.totals.carbs * portionFactor),
                  fats: Math.round(parsedFromFreeText.totals.fats * portionFactor),
                },
                message: `Texto livre processado com sucesso. Porcao aplicada: ${portionFactor}x.`,
              });
              return;
            }

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
          <SecondaryButton testID="btn-add-estimate-result" title="Adicionar resultado ao draft" onPress={pushResultItemsToDraft} style={styles.secondaryButton} />
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
                <Text style={styles.chipActionText}>+ {item.label} ({formatQuantityLabel(item.quantity || 1, item.quantityUnit)})</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </AppCard>

      {SHOW_PHOTO_BETA ? (
      <AppCard style={styles.card}>
        <Text style={styles.cardTitle}>Foto do prato (beta)</Text>
        <AppInput
          value={photoHintText}
          onChangeText={setPhotoHintText}
          placeholder="Descreva o prato da foto: arroz, feijao, frango"
          multiline
          autoCapitalize="sentences"
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
                <Text style={styles.chipActionText}>+ {item.label} ({formatQuantityLabel(item.quantity || 1, item.quantityUnit)})</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}
      </AppCard>
      ) : null}

      {result ? (
        <AppCard testID="nutrition-result-card" style={styles.resultCard}>
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
                Meta por refeicao: ~{proteinTargetPerMeal}g proteina | {result.totals.protein >= proteinTargetPerMeal ? 'faixa boa' : 'abaixo do ideal'}
              </Text>
              <Text style={styles.coachLine}>Dica: use o catalogo acima para salvar no diario com horario.</Text>
            </>
          ) : null}
        </AppCard>
      ) : null}
      </>
      ) : null}
      </>
      ) : null}
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
    flexGrow: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    marginBottom: spacing.md,
  },
  sectionSeparator: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    paddingLeft: 2,
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
    backgroundColor: colors.success,
    borderColor: colors.success,
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
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  logTitle: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: -0.3,
  },
  logMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 3,
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
  simpleMacroTrack: {
    marginTop: 10,
    height: 16,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  simpleMacroFill: {
    height: 16,
    borderRadius: 999,
    backgroundColor: colors.success,
  },
  simpleMacroText: {
    marginTop: 10,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  quickPreviewWrap: {
    marginTop: spacing.sm,
  },
  quickItemRow: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
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
  emptyStateMini: {
    marginVertical: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateMiniTitle: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginTop: spacing.xs,
    letterSpacing: -0.3,
  },
  emptyStateMiniText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: '90%',
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
