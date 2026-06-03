import { createAsyncStorageStub, isNodePureTest } from './runtimeEnv.js';
import { fireAndForgetQaPost } from './qaTransport.js';

const AsyncStorage = isNodePureTest()
  ? createAsyncStorageStub()
  : (await import('@react-native-async-storage/async-storage')).default;
import { APP_VERSION } from './appVersion.js';

const metrics = {
  paywall_open: 0,
  trial_start: 0,
  pro_activated: 0,
};

const durationStats = {};
const recentEvents = [];

const ANALYTICS_SESSION_KEY = 'evolucao.analytics.session.v1';
const ANALYTICS_LAST_OPEN_DAY_KEY = 'evolucao.analytics.last_open_day.v1';
const ANALYTICS_SNAPSHOT_HISTORY_KEY = 'evolucao.analytics.snapshot_history.v1';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const EVENT_MIN_INTERVAL_MS = 250;
const DURATION_SAMPLE_LIMIT = 300;
const EVENT_HISTORY_LIMIT = 500;
const EVENT_HISTORY_TRIM_TO = 300;
const SNAPSHOT_HISTORY_LIMIT = 30;

export const SCREENS = {
  APP: 'App',
  CONTEXT: 'AppContext',
  WORKOUT: 'WorkoutScreen',
  NUTRITION: 'NutritionScanner',
};

const runtimeContext = {
  userId: 'anonymous',
  screen: 'unknown',
  sessionId: `session-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  flowId: `flow-${Date.now()}-${Math.random().toString(16).slice(2)}`,
};

const lastEventAtByKey = new Map();

function toSafeObject(value) {
  return value && typeof value === 'object' ? value : {};
}

function buildSessionId() {
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildEventId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getTodayKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function inferCategory(name, meta = {}) {
  if (meta?.domain) {
    return String(meta.domain);
  }
  if (String(name).includes('navigation')) {
    return 'navigation';
  }
  if (String(name).includes('error') || String(name).includes('failed')) {
    return 'system';
  }
  return 'system';
}

function buildPayload(name, data = {}) {
  const safeData = toSafeObject(data);
  const { userId, screen, sessionId, eventId, flowId, meta, ...rest } = safeData;
  const timestamp = Date.now();
  const safeMeta = toSafeObject(meta);
  const category = inferCategory(name, safeMeta);

  return {
    event: name,
    eventId: String(eventId || buildEventId()),
    appVersion: APP_VERSION,
    category,
    userId: String(userId || runtimeContext.userId || 'anonymous'),
    timestamp,
    timestampIso: new Date(timestamp).toISOString(),
    screen: String(screen || runtimeContext.screen || 'unknown'),
    sessionId: String(sessionId || runtimeContext.sessionId),
    flowId: String(flowId || runtimeContext.flowId || runtimeContext.sessionId),
    meta: {
      ...safeMeta,
      category,
      ...rest,
    },
  };
}

export const setAnalyticsContext = (partial = {}) => {
  const safe = toSafeObject(partial);
  runtimeContext.userId = String(safe.userId || runtimeContext.userId || 'anonymous');
  runtimeContext.screen = String(safe.screen || runtimeContext.screen || 'unknown');
  runtimeContext.sessionId = String(safe.sessionId || runtimeContext.sessionId);
  runtimeContext.flowId = String(safe.flowId || runtimeContext.flowId || runtimeContext.sessionId);
  return { ...runtimeContext };
};

export const getAnalyticsContext = () => ({ ...runtimeContext });

export const initializeAnalyticsSession = async () => {
  try {
    const raw = await AsyncStorage.getItem(ANALYTICS_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const startedAt = Number(parsed?.startedAt || 0);
      const isValid = Number.isFinite(startedAt) && Date.now() - startedAt < SESSION_TTL_MS;
      if (isValid && parsed?.sessionId) {
        runtimeContext.sessionId = String(parsed.sessionId);
        runtimeContext.flowId = String(parsed.sessionId);
        return runtimeContext.sessionId;
      }
    }
  } catch {
    // Ignore corrupted local session and regenerate.
  }

  const nextSessionId = buildSessionId();
  runtimeContext.sessionId = nextSessionId;
  runtimeContext.flowId = nextSessionId;

  try {
    await AsyncStorage.setItem(
      ANALYTICS_SESSION_KEY,
      JSON.stringify({
        sessionId: nextSessionId,
        startedAt: Date.now(),
      })
    );
  } catch {
    // Ignore storage failures and keep in-memory session.
  }

  return nextSessionId;
};

export const getAppOpenSessionMeta = async () => {
  const dayKey = getTodayKey();
  let isFirstOpenOfDay = false;

  try {
    const lastOpenDay = await AsyncStorage.getItem(ANALYTICS_LAST_OPEN_DAY_KEY);
    isFirstOpenOfDay = lastOpenDay !== dayKey;
    if (isFirstOpenOfDay) {
      await AsyncStorage.setItem(ANALYTICS_LAST_OPEN_DAY_KEY, dayKey);
    }
  } catch {
    // Keep analytics resilient and return conservative metadata.
  }

  return {
    dayKey,
    isFirstOpenOfDay,
  };
};

export const trackEvent = (name, data = {}) => {
  const payload = buildPayload(name, data);
  const throttleKey = [payload.event, payload.screen, payload.meta?.action || ''].join('|');
  const lastAt = Number(lastEventAtByKey.get(throttleKey) || 0);
  const allowBurst = Boolean(payload.meta?.allowBurst);

  if (!allowBurst && payload.timestamp - lastAt < EVENT_MIN_INTERVAL_MS) {
    return {
      ...payload,
      dropped: true,
      dropReason: 'sampling_guard',
    };
  }

  lastEventAtByKey.set(throttleKey, payload.timestamp);
  metrics[name] = (metrics[name] || 0) + 1;

  const durationMs = Number(payload?.meta?.durationMs);
  if (Number.isFinite(durationMs) && durationMs >= 0) {
    const current = durationStats[name] || {
      totalMs: 0,
      count: 0,
      min: durationMs,
      max: durationMs,
      samples: [],
    };
    const nextSamples = Array.isArray(current.samples) ? [...current.samples, durationMs] : [durationMs];
    if (nextSamples.length > DURATION_SAMPLE_LIMIT) {
      nextSamples.shift();
    }
    durationStats[name] = {
      totalMs: current.totalMs + durationMs,
      count: current.count + 1,
      min: Math.min(Number(current.min || durationMs), durationMs),
      max: Math.max(Number(current.max || durationMs), durationMs),
      samples: nextSamples,
    };
  }

  const dayKey = String(payload?.meta?.dayKey || getTodayKey());
  recentEvents.push({
    name: payload.event,
    userId: String(payload.userId || 'anonymous'),
    source: String(payload?.meta?.source || 'unknown'),
    dayKey,
    timestamp: Number(payload.timestamp || Date.now()),
  });
  if (recentEvents.length > EVENT_HISTORY_LIMIT) {
    const tail = recentEvents.slice(-EVENT_HISTORY_TRIM_TO);
    recentEvents.length = 0;
    recentEvents.push(...tail);
  }

  const isDev = typeof __DEV__ !== 'undefined' && Boolean(__DEV__);
  if (isDev) {
    console.log('[ANALYTICS]', payload.event, payload);
  }

  fireAndForgetQaPost('/api/events', payload);
  return payload;
};

export const trackAppError = (error, context = {}) => {
  const safeError = error || {};
  return trackEvent('app_error', {
    screen: context.screen || 'unknown',
    ...toSafeObject(context),
    meta: {
      errorCode: safeError.code || 'APP_ERROR',
      reason: safeError.code || 'APP_ERROR',
      message: safeError.message || 'Unknown app error',
      stack: safeError.stack || null,
      context: toSafeObject(context),
    },
  });
};

export const trackUnknownErrorWithContext = (error, context = {}) => {
  const safeError = error || {};
  return trackEvent('unknown_error_with_context', {
    screen: context.screen || 'unknown',
    ...toSafeObject(context),
    meta: {
      errorCode: 'UNKNOWN_ERROR',
      reason: safeError.code || 'UNKNOWN',
      message: safeError.message || 'Unknown error',
      stack: safeError.stack || null,
      context: toSafeObject(context),
    },
  });
};

export const getAnalyticsMetrics = () => {
  return { ...metrics };
};

function percent(part, total) {
  if (!total) {
    return 0;
  }
  return (Number(part || 0) / Number(total || 0)) * 100;
}

function avgDuration(eventName) {
  const stats = durationStats[eventName];
  if (!stats || !stats.count) {
    return 0;
  }
  return Math.round(stats.totalMs / stats.count);
}

function percentile50(values = []) {
  if (!values.length) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return Math.round(sorted[middle]);
}

function getDurationSummary(eventName) {
  const stats = durationStats[eventName];
  if (!stats || !stats.count) {
    return { avg: 0, min: 0, p50: 0, max: 0, count: 0 };
  }
  return {
    avg: Math.round(stats.totalMs / stats.count),
    min: Number(stats.min || 0),
    p50: percentile50(stats.samples || []),
    max: Number(stats.max || 0),
    count: Number(stats.count || 0),
  };
}

function getEventsByDay(dayKey) {
  return recentEvents.filter((event) => event.dayKey === dayKey);
}

function getUsersForEvent(events, eventName) {
  const userSet = new Set();
  events.forEach((event) => {
    if (event.name === eventName) {
      userSet.add(event.userId);
    }
  });
  return userSet;
}

function countUsersInSequence(events, sequence = []) {
  if (!sequence.length) {
    return 0;
  }

  const byUser = new Map();
  events.forEach((event) => {
    if (!byUser.has(event.userId)) {
      byUser.set(event.userId, []);
    }
    byUser.get(event.userId).push(event);
  });

  let usersReached = 0;
  byUser.forEach((userEvents) => {
    const ordered = [...userEvents].sort((a, b) => a.timestamp - b.timestamp);
    let cursor = 0;
    ordered.forEach((event) => {
      if (event.name === sequence[cursor]) {
        cursor += 1;
      }
    });
    if (cursor >= sequence.length) {
      usersReached += 1;
    }
  });

  return usersReached;
}

function buildPaywallBySource(events = []) {
  const map = new Map();
  const ensure = (key) => {
    if (!map.has(key)) {
      map.set(key, {
        source: key,
        viewed: 0,
        clicked: 0,
        converted: 0,
      });
    }
    return map.get(key);
  };

  events.forEach((event) => {
    const sourceKey = String(event?.source || 'unknown');
    const row = ensure(sourceKey);

    if (event.name === 'paywall_open' || event.name === 'paywall_viewed') {
      row.viewed += 1;
    }
    if (event.name === 'paywall_clicked') {
      row.clicked += 1;
    }
    if (event.name === 'paywall_converted' || event.name === 'pro_activated') {
      row.converted += 1;
    }
  });

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      viewToClickRate: Number(percent(row.clicked, row.viewed).toFixed(2)),
      clickToConvertRate: Number(percent(row.converted, row.clicked).toFixed(2)),
    }))
    .sort((a, b) => b.viewed - a.viewed);
}

export const getConversionRates = () => {
  const snapshot = getAnalyticsMetrics();

  const trialRate = snapshot.paywall_open
    ? (snapshot.trial_start / snapshot.paywall_open) * 100
    : 0;

  const proRate = snapshot.trial_start
    ? (snapshot.pro_activated / snapshot.trial_start) * 100
    : 0;

  return {
    trialRate: trialRate.toFixed(1),
    proRate: proRate.toFixed(1),
  };
};

export const resetAnalyticsMetrics = () => {
  Object.keys(metrics).forEach((key) => {
    metrics[key] = 0;
  });
  Object.keys(durationStats).forEach((key) => {
    delete durationStats[key];
  });
  lastEventAtByKey.clear();
  recentEvents.length = 0;
};

export const getAnalyticsSnapshot = () => {
  return {
    timestamp: new Date().toISOString(),
    context: getAnalyticsContext(),
    metrics: getAnalyticsMetrics(),
    conversion: getConversionRates(),
  };
};

export const getProductMetricsSnapshot = () => {
  const m = getAnalyticsMetrics();
  const dayKey = getTodayKey();
  const todayEvents = getEventsByDay(dayKey);

  const activeUserSet = getUsersForEvent(todayEvents, 'app_opened');
  const workoutCompletedUsers = getUsersForEvent(todayEvents, 'workout_completed');
  const nutritionCompletedUsers = getUsersForEvent(todayEvents, 'nutrition_day_completed');
  const bothCompletedUsers = new Set(
    [...workoutCompletedUsers].filter((userId) => nutritionCompletedUsers.has(userId))
  );

  const activeUsersApprox = Number(m.app_opened || 0);
  const dau = activeUserSet.size;
  const workoutCompleted = Number(m.workout_completed || 0);
  const nutritionCompleted = Number(m.nutrition_day_completed || 0);
  const bothCompletedApprox = Math.min(workoutCompleted, nutritionCompleted);

  const workoutStarted = Number(m.workout_started || 0);
  const workoutSetSaved = Number(m.workout_set_saved || 0);

  const mealLogged = Number(m.meal_logged || 0);
  const nutritionDaySaved = Number(m.nutrition_day_saved || 0);

  const paywallViewed = Number(m.paywall_viewed || m.paywall_open || 0);
  const paywallClicked = Number(m.paywall_clicked || 0);
  const paywallConverted = Number(m.paywall_converted || m.pro_activated || 0);

  const workoutSaveFailed = Number(m.workout_set_save_failed || 0);
  const foodSaveFailed = Number(m.food_log_save_failed || 0)
    + Number(m.quick_meal_save_failed || 0)
    + Number(m.meal_draft_save_failed || 0);
  const missedDay = Number(m.missed_day || 0);

  const workoutFunnelUsers = {
    opened: activeUserSet.size,
    started: getUsersForEvent(todayEvents, 'workout_started').size,
    setSaved: getUsersForEvent(todayEvents, 'workout_set_saved').size,
    completed: workoutCompletedUsers.size,
    openedToCompletedSequential: countUsersInSequence(todayEvents, ['app_opened', 'workout_started', 'workout_completed']),
  };

  const nutritionFunnelUsers = {
    mealSaved: getUsersForEvent(todayEvents, 'quick_meal_saved').size + getUsersForEvent(todayEvents, 'meal_draft_saved').size,
    daySaved: getUsersForEvent(todayEvents, 'nutrition_day_saved').size,
    completed: nutritionCompletedUsers.size,
    savedToCompletedSequential: countUsersInSequence(todayEvents, ['nutrition_day_saved', 'nutrition_day_completed']),
  };
  const paywallBySource = buildPaywallBySource(todayEvents);

  const alertItems = [
    {
      type: 'error_rate',
      severity: workoutSaveFailed >= 8 ? 'high' : workoutSaveFailed >= 4 ? 'medium' : 'low',
      active: workoutSaveFailed >= 4,
      message: 'Falhas de save de treino acima do esperado.',
    },
    {
      type: 'nutrition_error_rate',
      severity: foodSaveFailed >= 8 ? 'high' : foodSaveFailed >= 4 ? 'medium' : 'low',
      active: foodSaveFailed >= 4,
      message: 'Falhas de save de nutricao acima do esperado.',
    },
    {
      type: 'workout_dropoff',
      severity: workoutStarted >= 5 && percent(workoutCompleted, workoutStarted) < 40 ? 'high' : 'medium',
      active: workoutStarted >= 3 && percent(workoutCompleted, workoutStarted) < 50,
      message: 'Dropoff alto entre inicio e conclusao de treino.',
    },
    {
      type: 'missed_day_spike',
      severity: missedDay >= 8 ? 'high' : missedDay >= 5 ? 'medium' : 'low',
      active: missedDay >= 5,
      message: 'Aumento relevante de quebra de streak.',
    },
  ];

  return {
    timestamp: new Date().toISOString(),
    dayKey,
    context: getAnalyticsContext(),
    users: {
      dau,
      activeUsersApprox,
      usersCompletedBoth: bothCompletedUsers.size,
      usersCompletedBothApprox: bothCompletedApprox,
    },
    northStar: {
      name: 'daily_dual_adherence_rate',
      description: '% aproximada de usuarios ativos que completaram treino e nutricao no dia',
      usersCompletedBothApprox: bothCompletedApprox,
      activeUsersApprox,
      value: Number(percent(bothCompletedApprox, activeUsersApprox).toFixed(2)),
      userBasedValue: Number(percent(bothCompletedUsers.size, dau).toFixed(2)),
    },
    funnels: {
      workout: {
        appOpened: activeUsersApprox,
        workoutStarted,
        workoutSetSaved,
        workoutCompleted,
        openToStartRate: Number(percent(workoutStarted, activeUsersApprox).toFixed(2)),
        startToSetRate: Number(percent(workoutSetSaved, workoutStarted).toFixed(2)),
        startToCompleteRate: Number(percent(workoutCompleted, workoutStarted).toFixed(2)),
        users: workoutFunnelUsers,
      },
      nutrition: {
        mealLogged,
        nutritionDaySaved,
        nutritionDayCompleted: nutritionCompleted,
        mealToDaySavedRate: Number(percent(nutritionDaySaved, mealLogged).toFixed(2)),
        daySavedToCompletedRate: Number(percent(nutritionCompleted, nutritionDaySaved).toFixed(2)),
        users: nutritionFunnelUsers,
      },
      paywall: {
        paywallViewed,
        paywallClicked,
        paywallConverted,
        viewToClickRate: Number(percent(paywallClicked, paywallViewed).toFixed(2)),
        clickToConvertRate: Number(percent(paywallConverted, paywallClicked).toFixed(2)),
        bySource: paywallBySource,
      },
    },
    retention: {
      streakUpdated: Number(m.streak_updated || 0),
      missedDay,
      streakToMissedRatio: Number(percent(missedDay, Number(m.streak_updated || 0)).toFixed(2)),
    },
    friction: {
      workoutSetSave: getDurationSummary('workout_set_saved'),
      quickMealSave: getDurationSummary('quick_meal_saved'),
      mealDraftSave: getDurationSummary('meal_draft_saved'),
      workoutCompletion: getDurationSummary('workout_completed'),
      avgWorkoutSetSaveMs: avgDuration('workout_set_saved'),
      avgQuickMealSaveMs: avgDuration('quick_meal_saved'),
      avgMealDraftSaveMs: avgDuration('meal_draft_saved'),
      avgWorkoutCompletionMs: avgDuration('workout_completed'),
    },
    quality: {
      workoutSaveFailed,
      foodSaveFailed,
      workoutSaveFailureRate: Number(percent(workoutSaveFailed, workoutSetSaved + workoutSaveFailed).toFixed(2)),
      foodSaveFailureRate: Number(percent(foodSaveFailed, mealLogged + foodSaveFailed).toFixed(2)),
    },
    alerts: {
      highWorkoutFailures: workoutSaveFailed >= 5,
      highFoodFailures: foodSaveFailed >= 5,
      workoutCompletionDropRisk: workoutStarted >= 3 && percent(workoutCompleted, workoutStarted) < 50,
      missedDaySpike: missedDay >= 5,
    },
    alertsDetailed: alertItems,
    notes: [
      'activeUsersApprox e usersCompletedBothApprox sao aproximacoes baseadas em contagem de eventos.',
      'Para DAU e north star exatos por usuario, usar agregacao no backend/data warehouse por userId + dayKey.',
      'users e userBasedValue usam dedupe local de eventos em memoria da sessao.',
    ],
  };
};

export const saveProductMetricsSnapshot = async (snapshot) => {
  const safeSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : getProductMetricsSnapshot();
  const compactSnapshot = {
    ts: Number(Date.now()),
    iso: new Date().toISOString(),
    dayKey: safeSnapshot?.dayKey || getTodayKey(),
    northStar: Number(safeSnapshot?.northStar?.userBasedValue || 0),
    workoutCompletion: Number(safeSnapshot?.funnels?.workout?.startToCompleteRate || 0),
    nutritionCompletion: Number(safeSnapshot?.funnels?.nutrition?.daySavedToCompletedRate || 0),
    alerts: Array.isArray(safeSnapshot?.alertsDetailed)
      ? safeSnapshot.alertsDetailed.filter((item) => item && item.active)
      : [],
  };

  try {
    const raw = await AsyncStorage.getItem(ANALYTICS_SNAPSHOT_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const safeList = Array.isArray(parsed) ? parsed : [];
    const sortedByTimeAsc = [...safeList].sort((a, b) => Number(a?.ts || 0) - Number(b?.ts || 0));
    const hardCappedExisting = sortedByTimeAsc.slice(-SNAPSHOT_HISTORY_LIMIT);
    const merged = [...hardCappedExisting, compactSnapshot];
    const hardCappedMerged = merged.slice(-SNAPSHOT_HISTORY_LIMIT);
    const next = [...hardCappedMerged].sort((a, b) => Number(b?.ts || 0) - Number(a?.ts || 0));
    await AsyncStorage.setItem(ANALYTICS_SNAPSHOT_HISTORY_KEY, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
};

export const getProductMetricsSnapshotHistory = async () => {
  try {
    const raw = await AsyncStorage.getItem(ANALYTICS_SNAPSHOT_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
