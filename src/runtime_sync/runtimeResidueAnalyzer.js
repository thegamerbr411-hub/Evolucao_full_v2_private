function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildResult(healthSnapshot = {}, extras = {}) {
  const runtime = healthSnapshot?.runtime || {};
  const asyncState = healthSnapshot?.async || {};
  const network = healthSnapshot?.network || {};
  const player = healthSnapshot?.player || {};
  const navigationHistory = Array.isArray(healthSnapshot?.navigationHistory)
    ? healthSnapshot.navigationHistory
    : [];

  const pendingAsyncTasks = toNumber(asyncState.pendingAsyncTasks);
  const activeTimers = toNumber(asyncState.activeTimers);
  const listenerCount = toNumber(asyncState.listenerCount);
  const pendingRequests = toNumber(network.pendingRequests);
  const playerLoading = Boolean(player.loading);
  const runtimeIdle = Boolean(runtime?.idle?.runtimeIdle);

  const recentRoutes = navigationHistory.slice(-18).map((entry) => String(entry?.route || entry?.screen || 'unknown'));
  const repetitiveRouteCount = recentRoutes.length > 0
    ? recentRoutes.filter((route, index, arr) => route && arr.indexOf(route) !== index).length
    : 0;

  const residues = {
    pendingTaskResidual: pendingAsyncTasks > 0,
    listenerResidual: listenerCount > 1,
    timerResidual: activeTimers > 1,
    pendingRequestResidual: pendingRequests > 0,
    screenResidual: repetitiveRouteCount > Math.ceil(recentRoutes.length * 0.6) && recentRoutes.length >= 8,
    playerResidual: playerLoading || (Boolean(player.active) && !runtimeIdle),
  };

  const suspects = Object.keys(residues).filter((key) => residues[key]);
  const score = suspects.length;

  return {
    timestamp: new Date().toISOString(),
    score,
    suspects,
    residues,
    stats: {
      pendingAsyncTasks,
      activeTimers,
      listenerCount,
      pendingRequests,
      repetitiveRouteCount,
      runtimeIdle,
    },
    context: {
      source: String(extras.source || 'runtime_probe'),
      appState: String(healthSnapshot?.appState || 'unknown'),
      currentScreen: String(healthSnapshot?.currentScreen || 'unknown'),
    },
  };
}

let latestResult = buildResult();
const listeners = new Set();

function emit(result) {
  for (const listener of listeners) {
    try {
      listener(result);
    } catch {
      // Best effort observers only.
    }
  }
}

export function analyzeRuntimeResidue(healthSnapshot = {}, extras = {}) {
  latestResult = buildResult(healthSnapshot, extras);
  global.__EVOLUCAO_RUNTIME_RESIDUE__ = latestResult;
  emit(latestResult);
  return latestResult;
}

export function getRuntimeResidueSnapshot() {
  return latestResult;
}

export function subscribeRuntimeResidue(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }

  listeners.add(listener);
  listener(latestResult);
  return () => listeners.delete(listener);
}
