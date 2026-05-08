import { getLocal, setLocal } from '../storage/mmkv';

const QA_HEALTH_STORAGE_KEY = 'qa.health.v1';
const NAVIGATION_LIMIT = 40;

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
  },
  stores: {
    loaded: [],
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

let state = {
  ...defaultState,
  ...(getLocal(QA_HEALTH_STORAGE_KEY) || {}),
};

function persist() {
  state.updatedAt = new Date().toISOString();
  setLocal(QA_HEALTH_STORAGE_KEY, state);
  global.__EVOLUCAO_QA_HEALTH__ = state;
}

function mergeState(partial = {}) {
  state = {
    ...state,
    ...partial,
  };
  persist();
  return state;
}

export function getQaHealthSnapshot() {
  return state;
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
  return mergeState({
    auth: {
      ...state.auth,
      ...partial,
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
  return mergeState({
    network: {
      ...state.network,
      ...partial,
    },
  });
}

export function setQaLoadedStores(loaded = []) {
  return mergeState({
    stores: {
      loaded: Array.from(new Set((Array.isArray(loaded) ? loaded : []).filter(Boolean))),
    },
  });
}

export function setQaAppState(nextAppState) {
  return mergeState({
    appState: String(nextAppState || 'active'),
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
  });
}

persist();