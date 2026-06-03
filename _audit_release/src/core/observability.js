import AsyncStorage from '@react-native-async-storage/async-storage';

const EVENT_LIMIT = 500;
const ERROR_LIMIT = 120;
const SESSION_LIMIT = 80;
const REPORT_LIMIT = 45;
const WEEKLY_INSIGHT_LIMIT = 24;
const SCREEN_SLOW_THRESHOLD_MS = 1500;
const OBSERVABILITY_STORAGE_KEY = 'observability.runtime.v2';
const INACTIVITY_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const DROP_RECOVERY_TTL_MS = 12 * 60 * 60 * 1000;
const LIGHTWEIGHT_SLOW_THRESHOLD = 3;
const LIGHTWEIGHT_WINDOW_MS = 24 * 60 * 60 * 1000;
const TESTING_PHASE_ACTIVE = true;
const FEEDBACK_PROMPT_COOLDOWN_MS = 48 * 60 * 60 * 1000;
const FEEDBACK_MAX_PROMPTS_PER_WEEK = 3;
const COACH_INTERRUPT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const QUICK_BACK_THRESHOLD_MS = 5000;
const REPEATED_CLICK_WINDOW_MS = 2500;
const REPEATED_CLICK_THRESHOLD = 3;

// ─── UX Decision System ───────────────────────────────────────────────────────
const UX_THRESHOLDS = {
  drop_rate: 0.25,           // > 25% → fluxo com problema
  repeated_click_pct: 0.10,  // > 10% → botão confuso
  quick_back_pct: 0.15,      // > 15% → tela confusa
  empty_state_pct: 0.20,     // > 20% → falta conteúdo
  cta_primary_min_pct: 60,   // < 60% → hierarquia ruim
};
const RELEASE_BLOCK_MAIN_FLOW_MIN_SCORE = 70;
const RELEASE_BLOCK_DROP_RATE_MAX = 0.30;
const SCREEN_SCORE_CRITICAL = 60;
const SCREEN_SCORE_WARNING = 80;
// ─────────────────────────────────────────────────────────────────────────────

const FLOW_DEFINITIONS = [
  {
    key: 'daily_core',
    steps: ['home', 'treino', 'nutricao'],
  },
  {
    key: 'full_app_loop',
    steps: ['home', 'treino', 'nutricao', 'coach', 'social', 'profile'],
  },
];

const store = {
  events: [],
  errors: [],
  screenSessions: new Map(),
  lastSessionState: null,
  lightweightMode: false,
  autoFixReason: null,
  lastActivityAt: null,
  hydrated: false,
  hydrationPromise: null,
  persistTimer: null,
  testingMode: {
    testing_phase: TESTING_PHASE_ACTIVE,
    userId: null,
    sessionSeed: null,
    variants: null,
  },
  sessions: [],
  currentSession: null,
  dailyReports: [],
  weeklyInsights: [],
  feedback: {
    responses: [],
    lastPromptAt: null,
    promptCountWindow: [],
  },
  coachControl: {
    lastInterruptAt: null,
  },
  interactionSignals: {
    lastNavigation: null,
    repeatedClicks: new Map(),
  },
};

function nowIso() {
  return new Date().toISOString();
}

function safeDateMs(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function createId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function pruneRecentDates(list = [], windowMs) {
  const threshold = Date.now() - windowMs;
  return list.filter((iso) => safeDateMs(iso) >= threshold);
}

function hashText(value = '') {
  const text = String(value || '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function ensureTestingIdentity() {
  if (!store.testingMode.userId) {
    store.testingMode.userId = `anon_${createId('user')}`;
  }

  if (!store.testingMode.sessionSeed) {
    store.testingMode.sessionSeed = createId('seed');
  }

  if (!store.testingMode.variants) {
    const hash = hashText(store.testingMode.userId);
    store.testingMode.variants = {
      adaptive_home: hash % 2 === 0 ? 'A' : 'B',
      coach_active: hash % 3 === 0 ? 'A' : 'B',
      smart_empty_state: hash % 5 < 2 ? 'A' : 'B',
    };
  }

  return store.testingMode;
}

function withTestingMetadata(payload = {}) {
  const safePayload = payload && typeof payload === 'object' ? payload : { value: payload };
  const testingMode = ensureTestingIdentity();
  const sessionId = store.currentSession?.session_id || null;

  return {
    ...safePayload,
    session_id: sessionId,
    user_id: testingMode.userId,
    testing_phase: TESTING_PHASE_ACTIVE,
    variant: testingMode.variants,
    timestamp: nowIso(),
  };
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function clampPush(list, value, limit) {
  list.push(value);
  if (list.length > limit) {
    list.splice(0, list.length - limit);
  }
}

function safeString(value, fallback = 'unknown') {
  const raw = String(value == null ? '' : value).trim();
  return raw || fallback;
}

function normalizeScreen(screenName = '') {
  const safe = safeString(screenName, 'unknown').toLowerCase();
  return safe
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function inferStepFromScreen(screenName = '') {
  const safe = normalizeScreen(screenName);
  if (safe.includes('home')) {
    return 'home';
  }
  if (safe.includes('treino') || safe.includes('workout') || safe.includes('rotina')) {
    return 'treino';
  }
  if (safe.includes('nutri') || safe.includes('scanner') || safe.includes('meal')) {
    return 'nutricao';
  }
  if (safe.includes('coach') || safe.includes('insight')) {
    return 'coach';
  }
  if (safe.includes('social') || safe.includes('challenge') || safe.includes('ranking')) {
    return 'social';
  }
  if (safe.includes('profile') || safe.includes('perfil') || safe.includes('account')) {
    return 'profile';
  }
  return 'other';
}

function schedulePersist() {
  if (store.persistTimer) {
    clearTimeout(store.persistTimer);
  }

  store.persistTimer = setTimeout(() => {
    store.persistTimer = null;
    const payload = {
      events: store.events,
      errors: store.errors,
      lastSessionState: store.lastSessionState,
      lightweightMode: store.lightweightMode,
      autoFixReason: store.autoFixReason,
      lastActivityAt: store.lastActivityAt,
      testingMode: store.testingMode,
      sessions: store.sessions,
      currentSession: store.currentSession,
      dailyReports: store.dailyReports,
      weeklyInsights: store.weeklyInsights,
      feedback: store.feedback,
      coachControl: store.coachControl,
      updatedAt: nowIso(),
    };

    AsyncStorage.setItem(OBSERVABILITY_STORAGE_KEY, JSON.stringify(payload)).catch(() => {
      // Best effort persistence: runtime insights continuam funcionando em memoria.
    });
  }, 160);
}

function setLastActivity(timestamp = nowIso()) {
  store.lastActivityAt = timestamp;
}

async function hydrateObservabilityStore() {
  try {
    const raw = await AsyncStorage.getItem(OBSERVABILITY_STORAGE_KEY);
    if (!raw) {
      store.hydrated = true;
      return;
    }

    const parsed = JSON.parse(raw);
    store.events = Array.isArray(parsed?.events) ? parsed.events.slice(-EVENT_LIMIT) : [];
    store.errors = Array.isArray(parsed?.errors) ? parsed.errors.slice(-ERROR_LIMIT) : [];
    store.lastSessionState = parsed?.lastSessionState && typeof parsed.lastSessionState === 'object'
      ? parsed.lastSessionState
      : null;
    store.lightweightMode = Boolean(parsed?.lightweightMode);
    store.autoFixReason = parsed?.autoFixReason || null;
    store.lastActivityAt = parsed?.lastActivityAt || null;
    store.testingMode = parsed?.testingMode && typeof parsed.testingMode === 'object'
      ? {
          testing_phase: TESTING_PHASE_ACTIVE,
          userId: parsed.testingMode.userId || null,
          sessionSeed: parsed.testingMode.sessionSeed || null,
          variants: parsed.testingMode.variants || null,
        }
      : store.testingMode;
    store.sessions = safeArray(parsed?.sessions).slice(-SESSION_LIMIT);
    store.currentSession = parsed?.currentSession && typeof parsed.currentSession === 'object'
      ? parsed.currentSession
      : null;
    store.dailyReports = safeArray(parsed?.dailyReports).slice(-REPORT_LIMIT);
    store.weeklyInsights = safeArray(parsed?.weeklyInsights).slice(-WEEKLY_INSIGHT_LIMIT);
    store.feedback = parsed?.feedback && typeof parsed.feedback === 'object'
      ? {
          responses: safeArray(parsed.feedback.responses).slice(-120),
          lastPromptAt: parsed.feedback.lastPromptAt || null,
          promptCountWindow: safeArray(parsed.feedback.promptCountWindow).slice(-30),
        }
      : store.feedback;
    store.coachControl = parsed?.coachControl && typeof parsed.coachControl === 'object'
      ? {
          lastInterruptAt: parsed.coachControl.lastInterruptAt || null,
        }
      : store.coachControl;
    store.hydrated = true;
    ensureTestingIdentity();
  } catch {
    store.hydrated = true;
    ensureTestingIdentity();
  }
}

function ensureHydrated() {
  if (store.hydrated) {
    return Promise.resolve();
  }

  if (!store.hydrationPromise) {
    store.hydrationPromise = hydrateObservabilityStore().finally(() => {
      store.hydrationPromise = null;
    });
  }

  return store.hydrationPromise;
}

function findLatestEventBy(predicate) {
  for (let index = store.events.length - 1; index >= 0; index -= 1) {
    const item = store.events[index];
    if (predicate(item)) {
      return item;
    }
  }
  return null;
}

function inferFeatureNameFromText(value = '') {
  const safe = normalizeScreen(value);
  if (!safe) {
    return 'general';
  }

  if (
    safe.includes('treino') ||
    safe.includes('workout') ||
    safe.includes('rotina') ||
    safe.includes('exercise')
  ) {
    return 'workout';
  }

  if (
    safe.includes('nutri') ||
    safe.includes('meal') ||
    safe.includes('scanner') ||
    safe.includes('agua')
  ) {
    return 'nutrition';
  }

  if (safe.includes('coach') || safe.includes('insight')) {
    return 'coach';
  }

  if (safe.includes('social') || safe.includes('ranking') || safe.includes('challenge')) {
    return 'social';
  }

  return 'general';
}

function inferFeatureFromEvent(event) {
  if (!event || typeof event !== 'object') {
    return 'general';
  }

  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
  const id = safeString(payload.id || '', '');
  const source = safeString(payload.source || '', '');
  const screen = safeString(payload.screen || '', '');
  const type = safeString(event.type || '', '');
  const combined = `${id}_${source}_${screen}_${type}`;
  return inferFeatureNameFromText(combined);
}

function getSlowScreensInWindow(windowMs = LIGHTWEIGHT_WINDOW_MS) {
  const thresholdMs = Date.now() - windowMs;
  return store.events.filter((item) => {
    if (item?.type !== 'slow_screen') {
      return false;
    }

    return safeDateMs(item.timestamp) >= thresholdMs;
  });
}

function maybeEnableLightweightMode() {
  const slowScreens = getSlowScreensInWindow();
  if (slowScreens.length < LIGHTWEIGHT_SLOW_THRESHOLD || store.lightweightMode) {
    return;
  }

  store.lightweightMode = true;
  store.autoFixReason = `slow_screen_repetition_${slowScreens.length}`;
  clampPush(store.events, {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: 'lightweight_mode_auto_enabled',
    payload: {
      source: 'slow_screen_detector',
      repeatedSlowScreens: slowScreens.length,
      windowMs: LIGHTWEIGHT_WINDOW_MS,
    },
    timestamp: nowIso(),
  }, EVENT_LIMIT);
}

function getLatestActivityIso() {
  if (store.lastActivityAt) {
    return store.lastActivityAt;
  }

  const latestEventIso = store.events.length ? store.events[store.events.length - 1]?.timestamp : null;
  const latestErrorIso = store.errors.length ? store.errors[store.errors.length - 1]?.timestamp : null;
  const eventMs = safeDateMs(latestEventIso);
  const errorMs = safeDateMs(latestErrorIso);

  if (eventMs === 0 && errorMs === 0) {
    return null;
  }

  return eventMs >= errorMs ? latestEventIso : latestErrorIso;
}

function getInactivityHours() {
  const latest = getLatestActivityIso();
  if (!latest) {
    return 999;
  }

  const deltaMs = Math.max(0, Date.now() - safeDateMs(latest));
  return Number((deltaMs / (60 * 60 * 1000)).toFixed(1));
}

function summarizeSession(session) {
  const opened = safeDateMs(session?.startedAt);
  const closed = safeDateMs(session?.endedAt || nowIso());
  const duration = Math.max(0, closed - opened);
  const actionsCount = Number(session?.actions_count || 0);
  const errorsCount = Number(session?.errors_count || 0);
  const completedActions = safeArray(session?.completed_actions);
  const droppedActions = safeArray(session?.dropped_actions);

  return {
    duration,
    actions_count: actionsCount,
    errors_count: errorsCount,
    completed_actions: completedActions,
    dropped_actions: droppedActions,
  };
}

function getSessionSummary() {
  return safeArray(store.sessions).map((session) => ({
    session_id: session.session_id,
    user_id: session.user_id,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    screens_visited: safeArray(session.screens_visited),
    actions_performed: safeArray(session.actions_performed),
    errors_triggered: safeArray(session.errors_triggered),
    session_summary: summarizeSession(session),
  }));
}

function getRecentEvents(windowMs = 7 * 24 * 60 * 60 * 1000) {
  const threshold = Date.now() - windowMs;
  return store.events.filter((event) => safeDateMs(event?.timestamp) >= threshold);
}

function getRecentErrors(windowMs = 7 * 24 * 60 * 60 * 1000) {
  const threshold = Date.now() - windowMs;
  return store.errors.filter((item) => safeDateMs(item?.timestamp) >= threshold);
}

function computeRecoveryRate(events) {
  const drops = events.filter((item) => safeString(item?.type || '').startsWith('drop_workout')).length;
  const recoveries = events.filter((item) => safeString(item?.type || '') === 'workout_recovery').length;
  if (drops === 0) {
    return recoveries > 0 ? 1 : 0;
  }
  return Number((recoveries / drops).toFixed(3));
}

export function getKeyProductMetrics(windowMs = 7 * 24 * 60 * 60 * 1000) {
  ensureHydrated();
  const events = getRecentEvents(windowMs);
  const sessions = safeArray(store.sessions).filter((session) => safeDateMs(session?.endedAt || session?.startedAt) >= Date.now() - windowMs);
  const users = new Set(sessions.map((session) => session?.user_id).filter(Boolean));

  const workoutStarted = events.filter((item) => ['workout_start', 'workout_started'].includes(item?.type)).length;
  const workoutCompleted = events.filter((item) => ['workout_finish', 'workout_completed'].includes(item?.type)).length;
  const workoutDropped = events.filter((item) => safeString(item?.type || '').startsWith('drop_workout')).length;

  const nutritionFoodsLogged = events.filter((item) => {
    const type = safeString(item?.type || '');
    return type.includes('nutrition') || type.includes('food_logged') || type.includes('meal_logged');
  }).length;
  const nutritionSessionsCompleted = events.filter((item) => safeString(item?.type || '') === 'nutrition_session_completed').length;

  const coachMessagesSent = events.filter((item) => safeString(item?.type || '') === 'coach_message_sent').length;
  const coachSuggestionAccepted = events.filter((item) => safeString(item?.type || '') === 'coach_suggestion_accepted').length;
  const coachSuggestionIgnored = events.filter((item) => safeString(item?.type || '') === 'coach_suggestion_ignored').length;

  const homeCtaClicks = events.filter((item) => {
    if (safeString(item?.type || '') !== 'button_click') {
      return false;
    }
    return normalizeScreen(item?.payload?.screen || '').includes('home');
  }).length;

  const featureUsageDistribution = events.reduce((acc, event) => {
    const feature = inferFeatureFromEvent(event);
    acc[feature] = Number(acc[feature] || 0) + 1;
    return acc;
  }, {});

  return {
    users_in_window: users.size,
    workout: {
      started: workoutStarted,
      completed: workoutCompleted,
      dropped: workoutDropped,
      recovery_rate: computeRecoveryRate(events),
      completion_rate: workoutStarted > 0 ? Number((workoutCompleted / workoutStarted).toFixed(3)) : 0,
    },
    nutrition: {
      foods_logged: nutritionFoodsLogged,
      sessions_completed: nutritionSessionsCompleted,
    },
    coach: {
      messages_sent: coachMessagesSent,
      suggestions_accepted: coachSuggestionAccepted,
      suggestions_ignored: coachSuggestionIgnored,
      acceptance_rate: coachMessagesSent > 0 ? Number((coachSuggestionAccepted / coachMessagesSent).toFixed(3)) : 0,
    },
    home: {
      cta_clicks: homeCtaClicks,
      feature_usage_distribution: featureUsageDistribution,
    },
  };
}

function computeDailyReport() {
  const sessions = safeArray(store.sessions);
  const keyMetrics = getKeyProductMetrics(24 * 60 * 60 * 1000);
  const events24h = getRecentEvents(24 * 60 * 60 * 1000);
  const errors24h = getRecentErrors(24 * 60 * 60 * 1000);

  const uniqueUsers = new Set(sessions.map((item) => item?.user_id).filter(Boolean));
  const activeUsers = new Set(
    sessions
      .filter((item) => safeDateMs(item?.endedAt || item?.startedAt) >= Date.now() - 24 * 60 * 60 * 1000)
      .map((item) => item?.user_id)
      .filter(Boolean)
  );

  const sessionDurations = sessions
    .map((session) => Number(summarizeSession(session).duration || 0))
    .filter((value) => value > 0);
  const avgSessionTime = sessionDurations.length
    ? Number((sessionDurations.reduce((sum, value) => sum + value, 0) / sessionDurations.length).toFixed(0))
    : 0;

  const rankedFeatures = getFeaturePriorityRanking(8);
  const worstFeature = [...rankedFeatures].sort((a, b) => a.score - b.score)[0] || null;
  const emptyStateFrequency = events24h.filter((item) => ['empty_state', 'empty_exercise_list'].includes(item?.type)).length;

  return {
    generatedAt: nowIso(),
    total_users: uniqueUsers.size,
    active_users: activeUsers.size,
    avg_session_time: avgSessionTime,
    workout_completion_rate: keyMetrics.workout.completion_rate,
    drop_rate: keyMetrics.workout.started > 0
      ? Number((keyMetrics.workout.dropped / keyMetrics.workout.started).toFixed(3))
      : 0,
    recovery_rate: keyMetrics.workout.recovery_rate,
    most_used_feature: rankedFeatures[0]?.feature || 'general',
    most_failed_feature: worstFeature?.feature || 'general',
    top_errors: buildTopErrors(5),
    empty_state_frequency: emptyStateFrequency,
    errors_24h: errors24h.length,
  };
}

function computeWeeklyInsight() {
  const keyMetrics = getKeyProductMetrics(7 * 24 * 60 * 60 * 1000);
  const topDrops = buildTopDropPoints(4);
  const rankedFeatures = getFeaturePriorityRanking(8);
  const ignoredFeature = rankedFeatures.length ? [...rankedFeatures].sort((a, b) => a.usage - b.usage)[0] : null;
  const retentionFeature = rankedFeatures[0] || null;
  const topUxProblems = [
    ...topDrops.map((item) => `Drop alto em ${item.point}`),
    ...buildTopErrors(3).map((item) => `Erro recorrente: ${item.message}`),
  ].slice(0, 3);

  const recommendedActions = [];
  if (topDrops.some((item) => normalizeScreen(item.point).includes('workout'))) {
    recommendedActions.push('Improve workout input flow');
  }
  if (store.events.some((item) => item?.type === 'empty_exercise_list')) {
    recommendedActions.push('Fix empty exercise filters');
  }
  if (keyMetrics.nutrition.foods_logged === 0 || keyMetrics.nutrition.sessions_completed === 0) {
    recommendedActions.push('Simplify nutrition entry');
  }
  if (!recommendedActions.length) {
    recommendedActions.push('Tune coach prompts based on friction hotspots');
  }

  return {
    generatedAt: nowIso(),
    where_users_drop_most: topDrops,
    retention_driver_feature: retentionFeature?.feature || 'general',
    ignored_feature: ignoredFeature?.feature || 'general',
    top_3_ux_problems: topUxProblems,
    recommended_actions: recommendedActions.slice(0, 3),
  };
}

function buildSessionFlowStatus(session) {
  const visitedSteps = new Set(
    safeArray(session?.screens_visited).map((screen) => inferStepFromScreen(screen)).filter((step) => step !== 'other')
  );

  return FLOW_DEFINITIONS.map((flow) => {
    const visited = flow.steps.filter((step) => visitedSteps.has(step));
    const missing = flow.steps.filter((step) => !visitedSteps.has(step));
    const completionRate = flow.steps.length
      ? Number((visited.length / flow.steps.length).toFixed(3))
      : 0;

    return {
      flow: flow.key,
      visited_steps: visited,
      missing_steps: missing,
      visited_count: visited.length,
      total_steps: flow.steps.length,
      completion_rate: completionRate,
      completed: missing.length === 0,
      started: visited.length > 0,
    };
  });
}

function trackFlowEventsAtSessionEnd(session, reason = 'session_end') {
  const flowStatus = buildSessionFlowStatus(session);
  flowStatus.forEach((flow) => {
    if (!flow.started) {
      return;
    }

    if (flow.completed) {
      logEvent('flow_completed', {
        flow: flow.flow,
        completionRate: flow.completion_rate,
        visitedSteps: flow.visited_steps,
        reason,
      });
      return;
    }

    logEvent('drop_flow_midway', {
      flow: flow.flow,
      completionRate: flow.completion_rate,
      visitedSteps: flow.visited_steps,
      missingSteps: flow.missing_steps,
      reason,
    });
  });
}

function getAverageFlowTime(windowMs = 7 * 24 * 60 * 60 * 1000) {
  const threshold = Date.now() - windowMs;
  const sessions = safeArray(store.sessions).filter((session) => {
    const endedAt = safeDateMs(session?.endedAt || session?.startedAt);
    return endedAt >= threshold;
  });

  const flowMap = new Map();
  sessions.forEach((session) => {
    const summary = summarizeSession(session);
    const durationMs = Number(summary.duration || 0);
    if (!durationMs) {
      return;
    }

    const flowStatus = buildSessionFlowStatus(session);
    flowStatus.forEach((flow) => {
      if (!flow.started) {
        return;
      }

      const current = flowMap.get(flow.flow) || {
        flow: flow.flow,
        totalDurationMs: 0,
        sessions: 0,
        completedSessions: 0,
      };

      current.totalDurationMs += durationMs;
      current.sessions += 1;
      if (flow.completed) {
        current.completedSessions += 1;
      }

      flowMap.set(flow.flow, current);
    });
  });

  return Array.from(flowMap.values())
    .map((item) => ({
      flow: item.flow,
      avgDurationMs: item.sessions ? Math.round(item.totalDurationMs / item.sessions) : 0,
      sessions: item.sessions,
      completedSessions: item.completedSessions,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

function buildIgnoredActions(limit = 8) {
  const map = new Map();

  store.events.forEach((event) => {
    const type = safeString(event?.type || '');
    if (type !== 'action_ignored' && type !== 'friction_open_no_action') {
      return;
    }

    const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
    const key = safeString(payload?.id || payload?.screen || payload?.reason || 'unknown', 'unknown');
    const current = map.get(key) || { action: key, count: 0 };
    current.count += 1;
    map.set(key, current);
  });

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function buildSilentErrors(limit = 6) {
  return buildTopErrors(limit).map((error) => ({
    ...error,
    silent: true,
  }));
}

function buildCtaBehaviorSummary(windowMs = 7 * 24 * 60 * 60 * 1000) {
  const threshold = Date.now() - windowMs;
  const events = store.events.filter((event) => safeDateMs(event?.timestamp) >= threshold);

  let primaryClicks = 0;
  let secondaryClicks = 0;
  const byScreen = new Map();

  events.forEach((event) => {
    if (safeString(event?.type || '') !== 'button_click') {
      return;
    }

    const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
    const buttonId = normalizeScreen(payload?.id || payload?.label || '');
    const screen = safeString(payload?.screen || 'unknown', 'unknown');
    const bucket = byScreen.get(screen) || { screen, primary: 0, secondary: 0 };

    const isPrimary =
      buttonId.includes('main') ||
      buttonId.includes('primary') ||
      buttonId.includes('cta') ||
      buttonId.includes('iniciar') ||
      buttonId.includes('comecar') ||
      buttonId.includes('start');

    if (isPrimary) {
      primaryClicks += 1;
      bucket.primary += 1;
    } else {
      secondaryClicks += 1;
      bucket.secondary += 1;
    }

    byScreen.set(screen, bucket);
  });

  const total = primaryClicks + secondaryClicks;
  return {
    primary_clicks: primaryClicks,
    secondary_clicks: secondaryClicks,
    primary_share_pct: total ? Number(((primaryClicks / total) * 100).toFixed(1)) : 0,
    by_screen: Array.from(byScreen.values()).sort((a, b) => (b.primary + b.secondary) - (a.primary + a.secondary)),
  };
}

function buildRealUsageReport(windowMs = 7 * 24 * 60 * 60 * 1000) {
  return {
    generatedAt: nowIso(),
    most_abandoned_screens: buildTopDropPoints(8),
    most_used_actions: buildMostUsedActions(10),
    ignored_actions: buildIgnoredActions(10),
    avg_time_per_flow: getAverageFlowTime(windowMs),
    silent_errors: buildSilentErrors(8),
    cta_behavior: buildCtaBehaviorSummary(windowMs),
  };
}

function maybeGeneratePeriodicReports() {
  const nowMs = Date.now();
  const lastDaily = store.dailyReports.length ? safeDateMs(store.dailyReports[store.dailyReports.length - 1]?.generatedAt) : 0;
  if (!lastDaily || nowMs - lastDaily >= 24 * 60 * 60 * 1000) {
    clampPush(store.dailyReports, computeDailyReport(), REPORT_LIMIT);
  }

  const lastWeekly = store.weeklyInsights.length ? safeDateMs(store.weeklyInsights[store.weeklyInsights.length - 1]?.generatedAt) : 0;
  if (!lastWeekly || nowMs - lastWeekly >= 7 * 24 * 60 * 60 * 1000) {
    clampPush(store.weeklyInsights, computeWeeklyInsight(), WEEKLY_INSIGHT_LIMIT);
  }
}

export function startUserSession(reason = 'app_open') {
  ensureHydrated();
  ensureTestingIdentity();

  if (store.currentSession) {
    return store.currentSession;
  }

  const current = {
    session_id: createId('session'),
    user_id: store.testingMode.userId,
    startedAt: nowIso(),
    endedAt: null,
    reason,
    screens_visited: [],
    actions_performed: [],
    errors_triggered: [],
    actions_count: 0,
    errors_count: 0,
    completed_actions: [],
    dropped_actions: [],
  };

  store.currentSession = current;
  schedulePersist();
  logEvent('session_start', { reason });
  return current;
}

export function endUserSession(reason = 'app_background') {
  ensureHydrated();
  const current = store.currentSession;
  if (!current) {
    return null;
  }

  current.endedAt = nowIso();
  const summary = summarizeSession(current);
  const finalized = {
    ...current,
    end_reason: reason,
    flow_status: buildSessionFlowStatus(current),
    session_summary: summary,
  };

  trackFlowEventsAtSessionEnd(current, reason);

  logEvent('user_flow_summary', {
    reason,
    screensVisited: safeArray(current.screens_visited),
    actionsCount: summary.actions_count,
    durationMs: summary.duration,
  });

  logEvent('session_end', {
    reason,
    duration: summary.duration,
    actions_count: summary.actions_count,
    errors_count: summary.errors_count,
  });

  clampPush(store.sessions, finalized, SESSION_LIMIT);
  store.currentSession = null;
  maybeGeneratePeriodicReports();
  schedulePersist();
  return finalized;
}

function touchSessionWithEvent(entry) {
  const current = store.currentSession;
  if (!current) {
    return;
  }

  const eventType = safeString(entry?.type || 'unknown_event', 'unknown_event');
  const payload = entry?.payload && typeof entry.payload === 'object' ? entry.payload : {};
  const screen = safeString(payload?.screen || payload?.route || '', '');

  if (screen && !current.screens_visited.includes(screen)) {
    current.screens_visited.push(screen);
  }

  current.actions_count += 1;
  current.actions_performed.push(eventType);
  if (eventType.startsWith('drop_')) {
    current.dropped_actions.push(eventType);
  }
  if (['workout_finish', 'workout_completed', 'nutrition_session_completed'].includes(eventType)) {
    current.completed_actions.push(eventType);
  }
}

function touchSessionWithError(errorEntry) {
  const current = store.currentSession;
  if (!current) {
    return;
  }

  current.errors_count += 1;
  current.errors_triggered.push(safeString(errorEntry?.message || 'unknown_error', 'unknown_error'));
}

export function shouldShowInAppFeedbackPrompt() {
  ensureHydrated();
  const recentPrompts = pruneRecentDates(store.feedback.promptCountWindow, 7 * 24 * 60 * 60 * 1000);
  store.feedback.promptCountWindow = recentPrompts;

  if (recentPrompts.length >= FEEDBACK_MAX_PROMPTS_PER_WEEK) {
    return false;
  }

  const lastPromptMs = safeDateMs(store.feedback.lastPromptAt);
  if (lastPromptMs && Date.now() - lastPromptMs < FEEDBACK_PROMPT_COOLDOWN_MS) {
    return false;
  }

  const randomGate = Math.random() < 0.22;
  return randomGate;
}

export function markFeedbackPromptShown() {
  ensureHydrated();
  const iso = nowIso();
  store.feedback.lastPromptAt = iso;
  store.feedback.promptCountWindow = pruneRecentDates([...store.feedback.promptCountWindow, iso], 7 * 24 * 60 * 60 * 1000);
  schedulePersist();
}

export function submitInAppFeedback(answer, question) {
  ensureHydrated();
  const safeAnswer = answer === 'up' ? 'up' : 'down';
  const entry = {
    id: createId('feedback'),
    answer: safeAnswer,
    question: safeString(question, 'generic_feedback'),
    timestamp: nowIso(),
    session_id: store.currentSession?.session_id || null,
    user_id: ensureTestingIdentity().userId,
  };
  clampPush(store.feedback.responses, entry, 120);
  logEvent('in_app_feedback_response', {
    answer: safeAnswer,
    question: entry.question,
  });
  schedulePersist();
  return entry;
}

export function markCoachInterruption() {
  ensureHydrated();
  store.coachControl.lastInterruptAt = nowIso();
  schedulePersist();
}

export function canInterruptCoach() {
  ensureHydrated();
  const last = safeDateMs(store.coachControl.lastInterruptAt);
  if (!last) {
    return true;
  }
  return Date.now() - last >= COACH_INTERRUPT_COOLDOWN_MS;
}

export function getLatestDailyReport() {
  ensureHydrated();
  maybeGeneratePeriodicReports();
  return store.dailyReports[store.dailyReports.length - 1] || null;
}

export function getLatestWeeklyInsight() {
  ensureHydrated();
  maybeGeneratePeriodicReports();
  return store.weeklyInsights[store.weeklyInsights.length - 1] || null;
}

export async function exportObservabilityReportToFile() {
  ensureHydrated();
  maybeGeneratePeriodicReports();

  const payload = {
    exportedAt: nowIso(),
    testing_mode: store.testingMode,
    sessions: getSessionSummary(),
    metrics: getKeyProductMetrics(),
    daily_report: getLatestDailyReport(),
    weekly_insight: getLatestWeeklyInsight(),
    insights: getObservabilityInsights(),
    events: store.events,
    errors: store.errors,
    feedback: store.feedback,
  };

  try {
    const FileSystem = await import('expo-file-system');
    const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
    if (!dir) {
      return { ok: false, error: 'no_writable_directory' };
    }

    const fileUri = `${dir}observability-report-${Date.now()}.json`;
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2));
    return { ok: true, fileUri };
  } catch (error) {
    return {
      ok: false,
      error: safeString(error?.message || error, 'export_failed'),
    };
  }
}

function inferDropEventName(screenName = '') {
  const normalized = normalizeScreen(screenName);
  if (!normalized) {
    return 'drop_unknown';
  }

  if (normalized.includes('treino') || normalized.includes('workout')) {
    return 'drop_workout';
  }

  return `drop_${normalized}`;
}

export function logEvent(name, payload = {}) {
  ensureHydrated();
  if (!store.currentSession) {
    startUserSession('implicit_event');
  }
  const eventName = safeString(name, 'unknown_event');
  const entry = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: eventName,
    payload: withTestingMetadata(payload),
    timestamp: nowIso(),
  };

  clampPush(store.events, entry, EVENT_LIMIT);
  setLastActivity(entry.timestamp);
  touchSessionWithEvent(entry);

  if (eventName === 'slow_screen') {
    maybeEnableLightweightMode();
  }

  if (eventName === 'workout_recovery') {
    markWorkoutSessionState({
      routeName: 'TreinoHoje',
      screen: 'TreinoHoje',
      reason: 'recovered',
      resumable: false,
    });
  }

  maybeGeneratePeriodicReports();
  schedulePersist();
  console.log('[OBS_EVENT]', eventName, entry.payload);
  return entry;
}

export function logRuntimeError(error, context = {}) {
  ensureHydrated();
  if (!store.currentSession) {
    startUserSession('implicit_error');
  }
  const message = safeString(error?.message || error, 'unknown_error');
  const entry = {
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    message,
    stack: safeString(error?.stack || '', ''),
    context: withTestingMetadata(context && typeof context === 'object' ? context : { context }),
    timestamp: nowIso(),
  };

  clampPush(store.errors, entry, ERROR_LIMIT);
  touchSessionWithError(entry);
  setLastActivity(entry.timestamp);
  schedulePersist();
  logEvent('error', {
    message,
    screen: context?.screen || 'unknown',
    source: context?.source || context?.action || 'runtime',
    severity: context?.severity || 'high',
  });
  console.error('[OBS_ERROR]', message, entry.context);
  return entry;
}

export function trackApiFailure(payload = {}) {
  ensureHydrated();
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  return logRuntimeError(new Error(safeString(safePayload.error, 'api_failure')), {
    source: 'api',
    action: safeString(safePayload.method, 'request'),
    endpoint: safePayload.endpoint || 'unknown',
    url: safePayload.url || 'unknown',
    screen: safePayload.screen || 'unknown',
    severity: 'medium',
  });
}

export function trackScreenOpen(screenName, payload = {}) {
  ensureHydrated();
  const screen = safeString(screenName, 'unknown');
  store.screenSessions.set(screen, {
    openedAt: Date.now(),
    actions: 0,
    lastActionAt: null,
  });

  return logEvent('screen_open', {
    screen,
    ...payload,
  });
}

export function trackScreenAction(screenName, actionName = 'action', payload = {}) {
  ensureHydrated();
  const screen = safeString(screenName, 'unknown');
  const current = store.screenSessions.get(screen) || {
    openedAt: Date.now(),
    actions: 0,
    lastActionAt: null,
  };

  current.actions += 1;
  current.lastActionAt = Date.now();
  store.screenSessions.set(screen, current);

  return logEvent(safeString(actionName, 'screen_action'), {
    screen,
    ...payload,
  });
}

export function trackScreenClose(screenName, payload = {}) {
  ensureHydrated();
  const screen = safeString(screenName, 'unknown');
  const current = store.screenSessions.get(screen);
  if (!current) {
    return null;
  }

  const durationMs = Math.max(0, Date.now() - Number(current.openedAt || Date.now()));
  const actions = Number(current.actions || 0);

  if (actions === 0) {
    const dropType = inferDropEventName(screen);
    logEvent('friction_open_no_action', {
      screen,
      durationMs,
      reason: 'open_without_action',
      ...payload,
    });

    logEvent('action_ignored', {
      screen,
      id: `${normalizeScreen(screen)}_primary_action`,
      reason: 'no_action_before_exit',
      durationMs,
      ...payload,
    });

    logEvent(dropType, {
      screen,
      durationMs,
      ...payload,
    });

    if (dropType === 'drop_workout') {
      markWorkoutSessionState({
        routeName: 'TreinoHoje',
        screen,
        reason: 'drop_workout',
        resumable: true,
        nextScreen: payload?.nextScreen || null,
      });
    }
  }

  store.screenSessions.delete(screen);
  return {
    screen,
    durationMs,
    actions,
  };
}

export function trackScreenRenderDuration(screenName, renderMs, payload = {}) {
  ensureHydrated();
  const screen = safeString(screenName, 'unknown');
  const durationMs = Number(renderMs || 0);
  if (!Number.isFinite(durationMs) || durationMs <= SCREEN_SLOW_THRESHOLD_MS) {
    return null;
  }

  return logEvent('slow_screen', {
    screen,
    durationMs: Math.round(durationMs),
    thresholdMs: SCREEN_SLOW_THRESHOLD_MS,
    ...payload,
  });
}

export function trackEmptyState(payload = {}) {
  ensureHydrated();
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  return logEvent('empty_state', safePayload);
}

export function trackButtonClick(payload = {}) {
  ensureHydrated();
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  const screen = safeString(safePayload.screen || 'unknown', 'unknown');
  const buttonId = safeString(safePayload.id || safePayload.label || 'unknown_button', 'unknown_button');
  const clickKey = `${screen}::${buttonId}`;
  const nowMs = Date.now();
  const recent = safeArray(store.interactionSignals.repeatedClicks.get(clickKey)).filter(
    (timestamp) => Number(timestamp) >= nowMs - REPEATED_CLICK_WINDOW_MS
  );
  recent.push(nowMs);
  store.interactionSignals.repeatedClicks.set(clickKey, recent);

  if (recent.length >= REPEATED_CLICK_THRESHOLD) {
    logEvent('friction_repeated_click', {
      screen,
      id: buttonId,
      clicksInWindow: recent.length,
      windowMs: REPEATED_CLICK_WINDOW_MS,
    });
  }

  const result = logEvent('button_click', safePayload);
  trackScreenAction(screen, 'screen_action', {
    source: 'button_click',
    id: safePayload.id || 'unknown_button',
  });
  return result;
}

export function trackNavigationTransition(previousScreen, currentScreen, payload = {}) {
  ensureHydrated();
  const previous = safeString(previousScreen || 'unknown', 'unknown');
  const current = safeString(currentScreen || 'unknown', 'unknown');
  const nowMs = Date.now();

  const transitionEvent = logEvent('navigation_transition', {
    previousScreen: previous,
    currentScreen: current,
    ...payload,
  });

  const last = store.interactionSignals.lastNavigation;
  if (
    last &&
    safeString(last.previousScreen || '') === current &&
    safeString(last.currentScreen || '') === previous &&
    nowMs - Number(last.at || 0) <= QUICK_BACK_THRESHOLD_MS
  ) {
    logEvent('friction_quick_back', {
      fromScreen: previous,
      toScreen: current,
      reboundTo: previous,
      deltaMs: nowMs - Number(last.at || 0),
      thresholdMs: QUICK_BACK_THRESHOLD_MS,
    });
  }

  store.interactionSignals.lastNavigation = {
    previousScreen: previous,
    currentScreen: current,
    at: nowMs,
  };

  return transitionEvent;
}

export function markWorkoutSessionState(payload = {}) {
  ensureHydrated();
  const safePayload = payload && typeof payload === 'object' ? payload : {};
  store.lastSessionState = {
    routeName: safeString(safePayload.routeName || safePayload.screen || 'TreinoHoje', 'TreinoHoje'),
    screen: safeString(safePayload.screen || 'TreinoHoje', 'TreinoHoje'),
    reason: safeString(safePayload.reason || 'manual_progress', 'manual_progress'),
    resumable: safePayload.resumable !== false,
    draft: safePayload.draft && typeof safePayload.draft === 'object' ? safePayload.draft : null,
    timestamp: nowIso(),
  };
  schedulePersist();
  return store.lastSessionState;
}

export function getDropRecoveryCandidate(options = {}) {
  ensureHydrated();
  const maxAgeMs = Number(options?.maxAgeMs || DROP_RECOVERY_TTL_MS);
  const state = store.lastSessionState;
  if (!state || state.resumable === false) {
    return null;
  }

  const stateAge = Date.now() - safeDateMs(state.timestamp);
  if (!Number.isFinite(stateAge) || stateAge > maxAgeMs) {
    return null;
  }

  const latestDropWorkout = findLatestEventBy((item) => item?.type === 'drop_workout');
  if (!latestDropWorkout) {
    return null;
  }

  const dropAge = Date.now() - safeDateMs(latestDropWorkout.timestamp);
  if (!Number.isFinite(dropAge) || dropAge > maxAgeMs) {
    return null;
  }

  return {
    message: 'Voce parou no treino. Quer continuar de onde parou?',
    ctaLabel: 'Retomar treino',
    routeName: state.routeName || 'TreinoHoje',
    timestamp: state.timestamp,
    reason: state.reason,
  };
}

export function dismissDropRecoveryCandidate() {
  ensureHydrated();
  if (!store.lastSessionState) {
    return;
  }

  store.lastSessionState = {
    ...store.lastSessionState,
    resumable: false,
    dismissedAt: nowIso(),
  };
  schedulePersist();
}

export function getFeaturePriorityRanking(limit = 5) {
  ensureHydrated();
  const map = new Map();

  function readRow(feature) {
    if (!map.has(feature)) {
      map.set(feature, {
        feature,
        usage: 0,
        drops: 0,
        errors: 0,
        score: 0,
        lastEventAt: null,
      });
    }
    return map.get(feature);
  }

  store.events.forEach((event) => {
    const feature = inferFeatureFromEvent(event);
    const row = readRow(feature);

    const eventType = safeString(event?.type || '');
    if (eventType.startsWith('drop_')) {
      row.drops += 1;
    } else if (eventType !== 'error') {
      row.usage += 1;
    }

    row.lastEventAt = event?.timestamp || row.lastEventAt;
  });

  store.errors.forEach((error) => {
    const context = error?.context && typeof error.context === 'object' ? error.context : {};
    const feature = inferFeatureNameFromText(
      `${context?.screen || ''}_${context?.endpoint || ''}_${context?.action || ''}`
    );
    const row = readRow(feature);
    row.errors += 1;
    row.lastEventAt = error?.timestamp || row.lastEventAt;
  });

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      score: Number((row.usage * 2 - row.drops * 1.5 - row.errors * 2.2).toFixed(2)),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.usage - a.usage;
    })
    .slice(0, Math.max(1, Number(limit) || 5));
}

function buildTopDropPoints(limit = 5) {
  const map = new Map();
  store.events.forEach((event) => {
    const type = safeString(event?.type || '');
    if (!type.startsWith('drop_')) {
      return;
    }

    const screen = safeString(event?.payload?.screen || type, type);
    const current = map.get(screen) || { point: screen, count: 0, type };
    current.count += 1;
    map.set(screen, current);
  });

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function buildMostUsedActions(limit = 8) {
  const map = new Map();
  store.events.forEach((event) => {
    const type = safeString(event?.type || '');
    if (type !== 'screen_action' && type !== 'button_click') {
      return;
    }

    const payload = event?.payload && typeof event.payload === 'object' ? event.payload : {};
    const actionId = safeString(payload?.id || payload?.source || payload?.screen || type, type);
    const current = map.get(actionId) || { action: actionId, count: 0 };
    current.count += 1;
    map.set(actionId, current);
  });

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function buildTopErrors(limit = 5) {
  const map = new Map();
  store.errors.forEach((error) => {
    const key = safeString(error?.message || 'unknown_error', 'unknown_error');
    const current = map.get(key) || { message: key, count: 0, latestAt: null };
    current.count += 1;
    current.latestAt = error?.timestamp || current.latestAt;
    map.set(key, current);
  });

  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getCoachContextualMessage() {
  ensureHydrated();
  const variants = ensureTestingIdentity().variants || {};
  if (variants.coach_active === 'A') {
    return null;
  }

  if (!canInterruptCoach()) {
    return null;
  }

  const latestDropWorkout = findLatestEventBy((item) => item?.type === 'drop_workout');
  if (latestDropWorkout && Date.now() - safeDateMs(latestDropWorkout.timestamp) <= DROP_RECOVERY_TTL_MS) {
    return {
      tone: 'recover',
      title: 'Retoma facil',
      message: 'Seu treino travou no meio. Volte para concluir e manter sua consistencia.',
      cta: 'Retomar treino',
      routeName: 'TreinoHoje',
    };
  }

  const latestEmpty = findLatestEventBy((item) => {
    if (item?.type === 'empty_exercise_list') {
      return true;
    }

    if (item?.type === 'empty_state') {
      return safeString(item?.payload?.reason || '', '').includes('exercise_list_empty');
    }

    return false;
  });

  if (latestEmpty && Date.now() - safeDateMs(latestEmpty.timestamp) <= DROP_RECOVERY_TTL_MS) {
    return {
      tone: 'assist',
      title: 'Coach atento',
      message: 'Percebi que faltaram exercicios no seu treino. Posso sugerir uma alternativa rapida.',
      cta: 'Ver sugestoes',
      routeName: 'Treinos',
    };
  }

  const inactivityHours = getInactivityHours();
  if (inactivityHours >= INACTIVITY_THRESHOLD_MS / (60 * 60 * 1000)) {
    return {
      tone: 'reengage',
      title: 'Hora de voltar',
      message: `Voce ficou ${Math.round(inactivityHours)}h sem registrar atividade. Vamos com um treino curto hoje?`,
      cta: 'Ativar rotina de 15 min',
      routeName: 'TreinoHoje',
    };
  }

  return {
    tone: 'maintain',
    title: 'Ritmo consistente',
    message: 'Seu comportamento esta estavel. Mantenha a cadencia para evolucao continua.',
    cta: 'Abrir insights',
    routeName: 'Insights',
  };
}

export function getAdaptiveHomeConfig() {
  ensureHydrated();
  const variants = ensureTestingIdentity().variants || {};
  const ranking = getFeaturePriorityRanking(4);
  const topFeature = ranking.find((item) => item.feature !== 'general')?.feature || 'workout';
  const quickActionOrderByFeature = {
    workout: ['workout', 'nutrition', 'insights'],
    nutrition: ['nutrition', 'workout', 'insights'],
    coach: ['insights', 'workout', 'nutrition'],
    social: ['workout', 'insights', 'nutrition'],
    general: ['workout', 'nutrition', 'insights'],
  };

  return {
    highlightedFeature: topFeature,
    quickActionOrder:
      variants.adaptive_home === 'A'
        ? quickActionOrderByFeature.general
        : quickActionOrderByFeature[topFeature] || quickActionOrderByFeature.general,
    recovery: getDropRecoveryCandidate(),
    coach: getCoachContextualMessage(),
    lightweightMode: store.lightweightMode,
    autoFixReason: store.autoFixReason,
    testingMode: {
      testing_phase: TESTING_PHASE_ACTIVE,
      session_id: store.currentSession?.session_id || null,
      user_id: ensureTestingIdentity().userId,
      variant: variants,
    },
  };
}

export function isLightweightModeEnabled() {
  ensureHydrated();
  return store.lightweightMode;
}

export function getTestingModeContext() {
  ensureHydrated();
  const testing = ensureTestingIdentity();
  return {
    testing_phase: TESTING_PHASE_ACTIVE,
    session_id: store.currentSession?.session_id || null,
    user_id: testing.userId,
    variant: testing.variants,
  };
}

export function getExperimentVariants() {
  return getTestingModeContext().variant || {};
}

export function isFeatureVariantEnabled(key = '', expected = 'B') {
  const variants = getExperimentVariants();
  return safeString(variants?.[key] || 'A', 'A') === safeString(expected, 'B');
}

export function setLightweightMode(value, reason = 'manual_override') {
  ensureHydrated();
  store.lightweightMode = Boolean(value);
  store.autoFixReason = safeString(reason, 'manual_override');
  schedulePersist();
}

// ─── UX Decision System ───────────────────────────────────────────────────────

function getKnownScreens() {
  const screens = new Set();
  store.events.forEach((e) => {
    const payload = e?.payload && typeof e.payload === 'object' ? e.payload : {};
    const screen = normalizeScreen(payload?.screen || '');
    if (screen && screen !== 'unknown') {
      screens.add(screen);
    }
  });
  return Array.from(screens);
}

function computeScreenScore(screenName) {
  const screen = normalizeScreen(safeString(screenName || '', 'unknown'));
  const screenEvents = store.events.filter((e) => {
    const payload = e?.payload && typeof e.payload === 'object' ? e.payload : {};
    return (
      normalizeScreen(payload?.screen || '') === screen ||
      normalizeScreen(payload?.fromScreen || '') === screen ||
      normalizeScreen(payload?.toScreen || '') === screen
    );
  });

  let score = 100;

  const drops = screenEvents.filter((e) => safeString(e?.type || '').startsWith('drop_')).length;
  const openNoAction = screenEvents.filter((e) => e?.type === 'friction_open_no_action').length;
  const repeatedClick = screenEvents.filter((e) => e?.type === 'friction_repeated_click').length;
  const quickBack = screenEvents.filter((e) => e?.type === 'friction_quick_back').length;

  score -= drops * 8;
  score -= openNoAction * 6;
  score -= repeatedClick * 5;
  score -= quickBack * 4;

  const completedActions = screenEvents.filter((e) =>
    ['button_click', 'screen_action', 'workout_start', 'workout_finish', 'food_logged'].includes(
      safeString(e?.type || '')
    )
  ).length;
  score += Math.min(completedActions * 2, 20);

  safeArray(store.feedback.responses).forEach((resp) => {
    const q = safeString(resp?.question || '');
    if (q.includes(screen)) {
      if (resp?.answer === 'up') score += 3;
      if (resp?.answer === 'down') score -= 4;
    }
  });

  score = Math.max(0, Math.min(100, Math.round(score)));
  let status = 'ok';
  if (score < SCREEN_SCORE_CRITICAL) status = 'critical';
  else if (score < SCREEN_SCORE_WARNING) status = 'warning';

  return { screen, score, status, drops, openNoAction, repeatedClick, quickBack, completedActions };
}

export function computeAllScreenScores() {
  ensureHydrated();
  return getKnownScreens()
    .map((screen) => computeScreenScore(screen))
    .sort((a, b) => a.score - b.score);
}

export function evaluateUxThresholds(windowMs = 7 * 24 * 60 * 60 * 1000) {
  ensureHydrated();
  const events = getRecentEvents(windowMs);
  const violations = [];

  const workoutStarts = events.filter((e) => ['workout_start', 'workout_started'].includes(e?.type)).length;
  const workoutDrops = events.filter((e) => safeString(e?.type || '').startsWith('drop_workout')).length;
  const dropRate = workoutStarts > 0 ? workoutDrops / workoutStarts : 0;
  if (dropRate > UX_THRESHOLDS.drop_rate) {
    violations.push({
      threshold: 'drop_rate',
      value: Number((dropRate * 100).toFixed(1)),
      limit: UX_THRESHOLDS.drop_rate * 100,
      severity: dropRate > RELEASE_BLOCK_DROP_RATE_MAX ? 'critical' : 'warning',
      message: `Abandono de treino: ${(dropRate * 100).toFixed(1)}% (limite ${UX_THRESHOLDS.drop_rate * 100}%)`,
    });
  }

  const totalClicks = events.filter((e) => e?.type === 'button_click').length;
  const repeatedClicks = events.filter((e) => e?.type === 'friction_repeated_click').length;
  const repeatedClickPct = totalClicks > 0 ? repeatedClicks / totalClicks : 0;
  if (repeatedClickPct > UX_THRESHOLDS.repeated_click_pct) {
    violations.push({
      threshold: 'repeated_click',
      value: Number((repeatedClickPct * 100).toFixed(1)),
      limit: UX_THRESHOLDS.repeated_click_pct * 100,
      severity: 'warning',
      message: `Cliques repetidos: ${(repeatedClickPct * 100).toFixed(1)}% (limite ${UX_THRESHOLDS.repeated_click_pct * 100}%)`,
    });
  }

  const totalNavs = events.filter((e) => e?.type === 'navigation_transition').length;
  const quickBacks = events.filter((e) => e?.type === 'friction_quick_back').length;
  const quickBackPct = totalNavs > 0 ? quickBacks / totalNavs : 0;
  if (quickBackPct > UX_THRESHOLDS.quick_back_pct) {
    violations.push({
      threshold: 'quick_back',
      value: Number((quickBackPct * 100).toFixed(1)),
      limit: UX_THRESHOLDS.quick_back_pct * 100,
      severity: 'warning',
      message: `Retorno rapido: ${(quickBackPct * 100).toFixed(1)}% das navegacoes (limite ${UX_THRESHOLDS.quick_back_pct * 100}%)`,
    });
  }

  const screenOpens = events.filter((e) => e?.type === 'screen_open').length;
  const emptyStates = events.filter((e) => ['empty_state', 'empty_exercise_list'].includes(e?.type)).length;
  const emptyStatePct = screenOpens > 0 ? emptyStates / screenOpens : 0;
  if (emptyStatePct > UX_THRESHOLDS.empty_state_pct) {
    violations.push({
      threshold: 'empty_state',
      value: Number((emptyStatePct * 100).toFixed(1)),
      limit: UX_THRESHOLDS.empty_state_pct * 100,
      severity: 'warning',
      message: `Estado vazio: ${(emptyStatePct * 100).toFixed(1)}% das telas abertas (limite ${UX_THRESHOLDS.empty_state_pct * 100}%)`,
    });
  }

  const ctaBehavior = buildCtaBehaviorSummary(windowMs);
  const ctaTotal = ctaBehavior.primary_clicks + ctaBehavior.secondary_clicks;
  if (ctaTotal > 0 && ctaBehavior.primary_share_pct < UX_THRESHOLDS.cta_primary_min_pct) {
    violations.push({
      threshold: 'cta_primary',
      value: ctaBehavior.primary_share_pct,
      limit: UX_THRESHOLDS.cta_primary_min_pct,
      severity: 'warning',
      message: `CTA principal com ${ctaBehavior.primary_share_pct}% dos cliques (minimo ${UX_THRESHOLDS.cta_primary_min_pct}%)`,
    });
  }

  return {
    violations,
    total: violations.length,
    hasCritical: violations.some((v) => v.severity === 'critical'),
    evaluatedAt: nowIso(),
  };
}

export function getUxAlerts() {
  ensureHydrated();
  const alerts = [];

  const thresholdEval = evaluateUxThresholds();
  thresholdEval.violations.forEach((v) => {
    alerts.push({
      type: v.severity,
      category: 'threshold',
      threshold: v.threshold,
      value: v.value,
      limit: v.limit,
      message: v.message,
    });
  });

  computeAllScreenScores().forEach((scoreData) => {
    if (scoreData.score < SCREEN_SCORE_CRITICAL) {
      alerts.push({
        type: 'critical',
        category: 'screen_score',
        screen: scoreData.screen,
        score: scoreData.score,
        message: `Tela "${scoreData.screen}" com score critico: ${scoreData.score}/100`,
      });
    } else if (scoreData.score < SCREEN_SCORE_WARNING) {
      alerts.push({
        type: 'warning',
        category: 'screen_score',
        screen: scoreData.screen,
        score: scoreData.score,
        message: `Tela "${scoreData.screen}" precisa de ajuste: ${scoreData.score}/100`,
      });
    }
  });

  buildTopErrors(5).forEach((error) => {
    if (error.count >= 3) {
      alerts.push({
        type: error.count >= 5 ? 'critical' : 'warning',
        category: 'recurring_error',
        count: error.count,
        message: `Erro recorrente (${error.count}x): ${error.message}`,
      });
    }
  });

  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const recentFeedback = safeArray(store.feedback.responses).filter(
    (r) => Date.now() - safeDateMs(r?.timestamp) <= weekMs
  );
  const negFeedback = recentFeedback.filter((r) => r?.answer === 'down').length;
  const negFeedbackPct = recentFeedback.length > 0 ? negFeedback / recentFeedback.length : 0;
  if (negFeedbackPct >= 0.4 && recentFeedback.length >= 3) {
    alerts.push({
      type: negFeedbackPct >= 0.6 ? 'critical' : 'warning',
      category: 'negative_feedback',
      negPct: Number((negFeedbackPct * 100).toFixed(1)),
      total: recentFeedback.length,
      message: `Feedback negativo: ${(negFeedbackPct * 100).toFixed(0)}% de ${recentFeedback.length} respostas`,
    });
  }

  alerts.sort((a, b) => {
    if (a.type === 'critical' && b.type !== 'critical') return -1;
    if (b.type === 'critical' && a.type !== 'critical') return 1;
    return 0;
  });

  return alerts;
}

export function getReleaseBlockStatus() {
  ensureHydrated();
  const keyMetrics = getKeyProductMetrics();
  const dropRate =
    keyMetrics.workout.started > 0 ? keyMetrics.workout.dropped / keyMetrics.workout.started : 0;

  const mainFlowScreens = ['home', 'treino', 'nutricao'];
  const mainFlowScoreValues = mainFlowScreens.map((s) => computeScreenScore(s).score);
  const mainFlowScore = Math.round(
    mainFlowScoreValues.reduce((sum, s) => sum + s, 0) / mainFlowScoreValues.length
  );

  const avgFlowTime = getAverageFlowTime();
  const dailyCoreFlow = avgFlowTime.find((f) => f.flow === 'daily_core');
  const flowCompletionRate =
    dailyCoreFlow && dailyCoreFlow.sessions > 0
      ? Number(((dailyCoreFlow.completedSessions / dailyCoreFlow.sessions) * 100).toFixed(1))
      : null;

  const reasons = [];
  let blocked = false;

  if (mainFlowScore < RELEASE_BLOCK_MAIN_FLOW_MIN_SCORE) {
    blocked = true;
    reasons.push(
      `Score do fluxo principal: ${mainFlowScore}/100 (minimo ${RELEASE_BLOCK_MAIN_FLOW_MIN_SCORE})`
    );
  }

  if (dropRate > RELEASE_BLOCK_DROP_RATE_MAX) {
    blocked = true;
    reasons.push(
      `Taxa de abandono: ${(dropRate * 100).toFixed(1)}% (limite ${RELEASE_BLOCK_DROP_RATE_MAX * 100}%)`
    );
  }

  return {
    blocked,
    status: blocked ? 'NO_GO' : 'GO',
    reasons,
    mainFlowScore,
    dropRate: Number((dropRate * 100).toFixed(1)),
    flowCompletionRate,
    evaluatedAt: nowIso(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export function getObservabilityInsights() {
  ensureHydrated();
  maybeGeneratePeriodicReports();
  return {
    topErrors: buildTopErrors(6),
    topDropPoints: buildTopDropPoints(6),
    mostUsedActions: buildMostUsedActions(10),
    featureRanking: getFeaturePriorityRanking(6),
    keyProductMetrics: getKeyProductMetrics(),
    realUsageReport: buildRealUsageReport(),
    dailyReport: getLatestDailyReport(),
    weeklyInsight: getLatestWeeklyInsight(),
    sessionCount: store.sessions.length,
    inactivityHours: getInactivityHours(),
    lightweightMode: store.lightweightMode,
    coachMessage: getCoachContextualMessage(),
    feedbackResponses: safeArray(store.feedback.responses).slice(-20),
    testingMode: getTestingModeContext(),
    // UX Decision System
    uxThresholds: evaluateUxThresholds(),
    uxAlerts: getUxAlerts(),
    screenScores: computeAllScreenScores(),
    releaseBlockStatus: getReleaseBlockStatus(),
  };
}

export function initObservability() {
  ensureHydrated();
  ensureTestingIdentity();
  if (!store.currentSession) {
    startUserSession('app_bootstrap');
  }
  maybeGeneratePeriodicReports();
  schedulePersist();
}

export function getObservabilitySnapshot() {
  ensureHydrated();
  return {
    events: [...store.events],
    errors: [...store.errors],
    lastSessionState: store.lastSessionState,
    currentSession: store.currentSession,
    sessions: getSessionSummary(),
    dailyReports: store.dailyReports,
    weeklyInsights: store.weeklyInsights,
    feedback: store.feedback,
    testingMode: getTestingModeContext(),
    lightweightMode: store.lightweightMode,
    autoFixReason: store.autoFixReason,
    lastActivityAt: getLatestActivityIso(),
    insights: getObservabilityInsights(),
    activeScreens: Array.from(store.screenSessions.entries()).map(([screen, session]) => ({
      screen,
      openedAt: new Date(Number(session.openedAt || Date.now())).toISOString(),
      actions: Number(session.actions || 0),
      lastActionAt: session.lastActionAt ? new Date(session.lastActionAt).toISOString() : null,
    })),
  };
}

export function clearObservabilitySnapshot() {
  ensureHydrated();
  store.events.length = 0;
  store.errors.length = 0;
  store.sessions.length = 0;
  store.dailyReports.length = 0;
  store.weeklyInsights.length = 0;
  store.feedback = {
    responses: [],
    lastPromptAt: null,
    promptCountWindow: [],
  };
  store.lastSessionState = null;
  store.lightweightMode = false;
  store.autoFixReason = null;
  store.lastActivityAt = null;
  store.currentSession = null;
  store.coachControl = { lastInterruptAt: null };
  startUserSession('reset_snapshot');
  schedulePersist();
}
