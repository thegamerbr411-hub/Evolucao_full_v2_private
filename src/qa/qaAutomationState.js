import { getLocal, setLocal } from '../storage/mmkv';

const QA_HEALTH_STORAGE_KEY = 'qa.health.v1';
const NAVIGATION_LIMIT = 40;
const METRIC_SAMPLES_LIMIT = 120;

export const QA_RUNTIME_STATES = Object.freeze({
  BOOTING: 'BOOTING',
  INITIALIZING: 'INITIALIZING',
  RESTORING_AUTH: 'RESTORING_AUTH',
  HYDRATING_STORES: 'HYDRATING_STORES',
  NAVIGATION_READY: 'NAVIGATION_READY',
  READY: 'READY',
  BACKGROUND: 'BACKGROUND',
  RESTORING_FROM_BACKGROUND: 'RESTORING_FROM_BACKGROUND',
  ERROR: 'ERROR',
});

const defaultState = {
  currentScreen: 'screen_bootstrap',
  currentRoute: 'bootstrap',
  auth: {
    hydrated: false,
    hasAccount: false,
    userId: null,
  },
  loading: {
    active: true,
    reason: 'bootstrap',
  },
  modal: {
    active: false,
    name: null,
  },
  player: {
    active: false,
    exerciseName: null,
    fullscreen: false,
    loading: false,
  },
  network: {
    offline: false,
    pendingRequests: 0,
    activeRequests: 0,
    failedRequests: 0,
    retryCount: 0,
    cancelledRequests: 0,
    stalledRequests: 0,
    idle: true,
  },
  async: {
    pendingAsyncTasks: 0,
    activeTimers: 0,
    backgroundTasks: 0,
    orphanTasks: 0,
    listenerCount: 0,
    runtimeIdle: true,
  },
  stores: {
    loaded: [],
  },
  runtime: {
    state: QA_RUNTIME_STATES.BOOTING,
    previousState: null,
    stateChangedAt: new Date().toISOString(),
    readiness: {
      appInitialized: false,
      navigationReady: false,
      authResolved: false,
      storesHydrated: false,
      splashFinished: false,
      runtimeSynchronized: false,
    },
    stalls: {
      boot: null,
      navigation: null,
      player: null,
      network: null,
      task: null,
      hydration: null,
    },
    idle: {
      runtimeIdle: false,
      busyReasons: ['bootstrap_not_synchronized'],
      updatedAt: new Date().toISOString(),
    },
    transitionHistory: [],
  },
  metrics: {
    timers: {},
    samples: {
      bootDurationMs: [],
      navigationDurationMs: [],
      hydrationDurationMs: [],
      authRestoreDurationMs: [],
      playerLoadDurationMs: [],
      fullscreenTransitionDurationMs: [],
      runtimeFpsApprox: [],
      memorySnapshotsMb: [],
    },
    latest: {},
  },
  navigationHistory: [],
  appState: 'active',
  errors: {
    count: 0,
    lastMessage: null,
    lastAt: null,
  },
  updatedAt: new Date().toISOString(),
};

const listeners = new Set();

function safeState(input) {
  if (!input || typeof input !== 'object') {
    return { ...defaultState };
  }

  return {
    ...defaultState,
    ...input,
    runtime: {
      ...defaultState.runtime,
      ...(input.runtime || {}),
      readiness: {
        ...defaultState.runtime.readiness,
        ...(input.runtime?.readiness || {}),
      },
      stalls: {
        ...defaultState.runtime.stalls,
        ...(input.runtime?.stalls || {}),
      },
      idle: {
        ...defaultState.runtime.idle,
        ...(input.runtime?.idle || {}),
      },
      transitionHistory: Array.isArray(input.runtime?.transitionHistory)
        ? input.runtime.transitionHistory.slice(-80)
        : [],
    },
    network: {
      ...defaultState.network,
      ...(input.network || {}),
    },
    async: {
      ...defaultState.async,
      ...(input.async || {}),
    },
    metrics: {
      ...defaultState.metrics,
      ...(input.metrics || {}),
      timers: {
        ...(input.metrics?.timers || {}),
      },
      samples: {
        ...defaultState.metrics.samples,
        ...(input.metrics?.samples || {}),
      },
      latest: {
        ...(input.metrics?.latest || {}),
      },
    },
  };
}

let state = safeState(getLocal(QA_HEALTH_STORAGE_KEY));

function emitChange() {
  for (const listener of listeners) {
    try {
      listener(state);
    } catch {
      // best effort observer updates only
    }
  }
}

function persist() {
  state.updatedAt = new Date().toISOString();
  setLocal(QA_HEALTH_STORAGE_KEY, state);
  global.__EVOLUCAO_QA_HEALTH__ = state;
  global.__EVOLUCAO_QA_RUNTIME__ = {
    state: state.runtime.state,
    readiness: state.runtime.readiness,
    stalls: state.runtime.stalls,
    idle: state.runtime.idle,
    network: state.network,
    async: state.async,
    metrics: state.metrics.latest,
    updatedAt: state.updatedAt,
  };
  emitChange();
}

function pushRuntimeTransition(nextState, reason = null) {
  const entry = {
    from: state.runtime.state,
    to: nextState,
    reason,
    timestamp: new Date().toISOString(),
  };
  const transitionHistory = [...(state.runtime.transitionHistory || []), entry].slice(-80);
  return {
    previousState: state.runtime.state,
    state: nextState,
    stateChangedAt: entry.timestamp,
    transitionHistory,
  };
}

function buildRuntimeIdle(nextState) {
  const readiness = nextState?.runtime?.readiness || {};
  const network = nextState?.network || {};
  const asyncState = nextState?.async || {};
  const player = nextState?.player || {};
  const loading = nextState?.loading || {};
  const stalls = nextState?.runtime?.stalls || {};

  const activeStallKeys = Object.keys(stalls).filter((key) => Boolean(stalls[key]?.active));
  const busyReasons = [];

  if (!readiness.runtimeSynchronized) busyReasons.push('bootstrap_not_synchronized');
  if (!network.idle || Number(network.pendingRequests || 0) > 0) busyReasons.push('network_pending');
  if (!asyncState.runtimeIdle || Number(asyncState.pendingAsyncTasks || 0) > 0) busyReasons.push('async_tasks_pending');
  if (Boolean(player.loading)) busyReasons.push('player_loading');
  if (Boolean(loading.active)) busyReasons.push(`loading_${String(loading.reason || 'active')}`);
  if (activeStallKeys.length > 0) busyReasons.push(`stall_${activeStallKeys.join('_')}`);

  return {
    runtimeIdle: busyReasons.length === 0,
    busyReasons,
    updatedAt: new Date().toISOString(),
  };
}

function mergeState(partial = {}) {
  const nextState = safeState({
    ...state,
    ...partial,
  });
  nextState.runtime = {
    ...nextState.runtime,
    idle: buildRuntimeIdle(nextState),
  };
  state = nextState;
  persist();
  return state;
}

function pushMetricSample(metricName, value) {
  const samples = {
    ...state.metrics.samples,
  };
  const metricValues = Array.isArray(samples[metricName]) ? [...samples[metricName]] : [];
  metricValues.push(Number(value));
  samples[metricName] = metricValues.slice(-METRIC_SAMPLES_LIMIT);
  return samples;
}

function runtimeLogMetric(metricName, durationMs, extra = {}) {
  // Parsed later from logcat by QA analyzers.
  console.log(`[RUNTIME_METRIC] metric=${metricName} durationMs=${Math.round(Number(durationMs || 0))} extra=${JSON.stringify(extra || {})}`);
}

export function subscribeQaHealth(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getQaHealthSnapshot() {
  return state;
}

export function getQaRuntimeSnapshot() {
  return {
    state: state.runtime.state,
    readiness: state.runtime.readiness,
    stalls: state.runtime.stalls,
    idle: state.runtime.idle,
    network: state.network,
    async: state.async,
    latestMetrics: state.metrics.latest,
    updatedAt: state.updatedAt,
  };
}

export function setQaRuntimeState(nextState, reason = null) {
  if (!nextState || nextState === state.runtime.state) {
    return state;
  }

  const runtimeState = pushRuntimeTransition(nextState, reason);
  return mergeState({
    runtime: {
      ...state.runtime,
      ...runtimeState,
    },
  });
}

export function setQaReadinessFlags(partial = {}) {
  const readiness = {
    ...state.runtime.readiness,
    ...(partial || {}),
  };

  const runtimeSynchronized = Boolean(
    readiness.appInitialized
      && readiness.navigationReady
      && readiness.authResolved
      && readiness.storesHydrated
      && readiness.splashFinished
  );

  return mergeState({
    runtime: {
      ...state.runtime,
      readiness: {
        ...readiness,
        runtimeSynchronized,
      },
    },
  });
}

export function setQaStall(stallKey, active, durationMs = 0, meta = {}) {
  if (!stallKey) {
    return state;
  }

  return mergeState({
    runtime: {
      ...state.runtime,
      stalls: {
        ...state.runtime.stalls,
        [stallKey]: active
          ? {
              active: true,
              durationMs: Number(durationMs || 0),
              timestamp: new Date().toISOString(),
              meta,
            }
          : null,
      },
    },
  });
}

export function startQaMetric(metricName, meta = {}) {
  if (!metricName) {
    return state;
  }

  return mergeState({
    metrics: {
      ...state.metrics,
      timers: {
        ...state.metrics.timers,
        [metricName]: {
          startedAtMs: Date.now(),
          meta,
        },
      },
    },
  });
}

export function endQaMetric(metricName, extra = {}) {
  const timer = state.metrics.timers?.[metricName];
  if (!timer?.startedAtMs) {
    return null;
  }

  const durationMs = Date.now() - Number(timer.startedAtMs);
  const latest = {
    ...state.metrics.latest,
    [metricName]: {
      durationMs,
      endedAt: new Date().toISOString(),
      ...(extra || {}),
    },
  };

  const timers = {
    ...state.metrics.timers,
  };
  delete timers[metricName];

  const samples = pushMetricSample(metricName, durationMs);

  mergeState({
    metrics: {
      ...state.metrics,
      timers,
      latest,
      samples,
    },
  });

  runtimeLogMetric(metricName, durationMs, extra);
  return durationMs;
}

export function registerQaFpsSample(fpsApprox) {
  const value = Number(fpsApprox || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return state;
  }

  return mergeState({
    metrics: {
      ...state.metrics,
      samples: pushMetricSample('runtimeFpsApprox', value),
      latest: {
        ...state.metrics.latest,
        runtimeFpsApprox: {
          value,
          sampledAt: new Date().toISOString(),
        },
      },
    },
  });
}

export function registerQaMemorySnapshot(memoryMb, source = 'runtime') {
  const value = Number(memoryMb || 0);
  if (!Number.isFinite(value) || value <= 0) {
    return state;
  }

  return mergeState({
    metrics: {
      ...state.metrics,
      samples: pushMetricSample('memorySnapshotsMb', value),
      latest: {
        ...state.metrics.latest,
        memorySnapshotMb: {
          value,
          source,
          sampledAt: new Date().toISOString(),
        },
      },
    },
  });
}

export function setQaCurrentScreen(currentScreen, currentRoute = currentScreen) {
  const nextHistory = [...(state.navigationHistory || []), {
    screen: currentScreen,
    route: currentRoute,
    timestamp: new Date().toISOString(),
  }].slice(-NAVIGATION_LIMIT);

  return mergeState({
    currentScreen,
    currentRoute,
    navigationHistory: nextHistory,
  });
}

export function setQaAuthState(partial = {}) {
  const nextAuth = {
    ...state.auth,
    ...partial,
  };

  const runtimeState = nextAuth.hydrated
    ? QA_RUNTIME_STATES.HYDRATING_STORES
    : QA_RUNTIME_STATES.RESTORING_AUTH;

  return mergeState({
    auth: nextAuth,
    runtime: {
      ...state.runtime,
      ...(state.runtime.state !== runtimeState ? pushRuntimeTransition(runtimeState, 'auth_state_update') : {}),
      readiness: {
        ...state.runtime.readiness,
        authResolved: Boolean(nextAuth.hydrated),
      },
    },
  });
}

export function setQaLoadingState(active, reason = null) {
  return mergeState({
    loading: {
      active: Boolean(active),
      reason,
    },
  });
}

export function setQaModalState(active, name = null) {
  return mergeState({
    modal: {
      active: Boolean(active),
      name: active ? name : null,
    },
  });
}

export function setQaPlayerState(partial = {}) {
  return mergeState({
    player: {
      ...state.player,
      ...partial,
    },
  });
}

export function setQaNetworkState(partial = {}) {
  const merged = {
    ...state.network,
    ...partial,
  };
  const pendingRequests = Number(merged.pendingRequests || 0);
  const activeRequests = Number(merged.activeRequests || 0);

  return mergeState({
    network: {
      ...merged,
      pendingRequests,
      activeRequests,
      idle: pendingRequests <= 0 && activeRequests <= 0,
    },
  });
}

export function setQaAsyncState(partial = {}) {
  const merged = {
    ...state.async,
    ...partial,
  };
  const pendingAsyncTasks = Number(merged.pendingAsyncTasks || 0);
  const activeTimers = Number(merged.activeTimers || 0);
  const backgroundTasks = Number(merged.backgroundTasks || 0);
  const orphanTasks = Number(merged.orphanTasks || 0);

  return mergeState({
    async: {
      ...merged,
      pendingAsyncTasks,
      activeTimers,
      backgroundTasks,
      orphanTasks,
      runtimeIdle: pendingAsyncTasks <= 0 && activeTimers <= 0 && backgroundTasks <= 0,
    },
  });
}

export function setQaLoadedStores(loaded = []) {
  const loadedStores = Array.from(new Set((Array.isArray(loaded) ? loaded : []).filter(Boolean)));
  return mergeState({
    stores: {
      loaded: loadedStores,
    },
    runtime: {
      ...state.runtime,
      readiness: {
        ...state.runtime.readiness,
        storesHydrated: loadedStores.length > 0,
      },
    },
  });
}

export function setQaAppState(nextAppState) {
  const safeNext = String(nextAppState || 'active');
  const normalized = safeNext === 'background' || safeNext === 'inactive' ? QA_RUNTIME_STATES.BACKGROUND : QA_RUNTIME_STATES.RESTORING_FROM_BACKGROUND;

  return mergeState({
    appState: safeNext,
    runtime: {
      ...state.runtime,
      ...(safeNext === 'active' ? pushRuntimeTransition(normalized, 'app_foreground') : pushRuntimeTransition(normalized, 'app_background')),
    },
  });
}

export function registerQaError(error, context = {}) {
  const safeMessage = error instanceof Error ? error.message : String(error || 'unknown_error');
  return mergeState({
    errors: {
      count: Number(state.errors?.count || 0) + 1,
      lastMessage: safeMessage,
      lastAt: new Date().toISOString(),
      context,
    },
    runtime: {
      ...state.runtime,
      ...pushRuntimeTransition(QA_RUNTIME_STATES.ERROR, 'runtime_error'),
    },
  });
}

persist();