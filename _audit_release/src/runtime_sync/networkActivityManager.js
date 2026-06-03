import { setQaNetworkState } from '../qa/qaAutomationState';
import { logTaggedEvent } from '../utils/runtimeLogger';

const STALL_THRESHOLD_MS = 12000;

const state = {
  byId: new Map(),
  failedRequests: 0,
  retryCount: 0,
  cancelledRequests: 0,
  stalledRequests: 0,
  stallsById: new Set(),
};

const listeners = new Set();
let patched = false;
let originalFetch = null;

function emit() {
  const activeRequests = state.byId.size;
  const pendingRequests = activeRequests;
  const snapshot = {
    activeRequests,
    pendingRequests,
    failedRequests: state.failedRequests,
    retryCount: state.retryCount,
    cancelledRequests: state.cancelledRequests,
    stalledRequests: state.stalledRequests,
    idle: activeRequests <= 0,
    items: Array.from(state.byId.values()).map((item) => ({
      id: item.id,
      method: item.method,
      url: item.url,
      startedAt: item.startedAt,
      ageMs: Date.now() - item.startedAtMs,
      retries: item.retries,
      stalled: Boolean(item.stalled),
    })),
  };

  setQaNetworkState(snapshot);

  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      // best effort
    }
  }

  global.__EVOLUCAO_QA_NETWORK__ = snapshot;
}

function normalizeMethod(method) {
  return String(method || 'GET').toUpperCase();
}

function nextRequestId() {
  return `net_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function scheduleStallCheck(id) {
  const timer = setTimeout(() => {
    const item = state.byId.get(id);
    if (!item || item.ended) {
      return;
    }

    if (!item.stalled) {
      item.stalled = true;
      state.stallsById.add(id);
      state.stalledRequests = state.stallsById.size;
      logTaggedEvent('NETWORK', 'request_stall', {
        id,
        method: item.method,
        url: item.url,
        ageMs: Date.now() - item.startedAtMs,
      });
      emit();
    }
  }, STALL_THRESHOLD_MS);

  return timer;
}

export function trackNetworkRequestStart({ id, method, url }) {
  const requestId = id || nextRequestId();
  const entry = {
    id: requestId,
    method: normalizeMethod(method),
    url: String(url || 'unknown'),
    startedAt: new Date().toISOString(),
    startedAtMs: Date.now(),
    retries: 0,
    stalled: false,
    ended: false,
    stallTimer: null,
  };

  entry.stallTimer = scheduleStallCheck(requestId);
  state.byId.set(requestId, entry);
  emit();
  return requestId;
}

export function trackNetworkRetry(id) {
  const entry = state.byId.get(id);
  if (!entry) {
    state.retryCount += 1;
    emit();
    return;
  }

  entry.retries = Number(entry.retries || 0) + 1;
  state.retryCount += 1;
  emit();
}

export function trackNetworkRequestRetry(id) {
  trackNetworkRetry(id)
}

export function trackNetworkRequestEnd(id) {
  const entry = state.byId.get(id);
  if (!entry) {
    emit();
    return;
  }

  entry.ended = true;
  if (entry.stallTimer) {
    clearTimeout(entry.stallTimer);
  }
  state.byId.delete(id);
  state.stallsById.delete(id);
  state.stalledRequests = state.stallsById.size;
  emit();
}

export function trackNetworkRequestFailure(id, error = null) {
  state.failedRequests += 1;
  if (error && String(error?.message || '').toLowerCase().includes('abort')) {
    state.cancelledRequests += 1;
  }
  trackNetworkRequestEnd(id);
}

export function getNetworkSnapshot() {
  return {
    activeRequests: state.byId.size,
    pendingRequests: state.byId.size,
    failedRequests: state.failedRequests,
    retryCount: state.retryCount,
    cancelledRequests: state.cancelledRequests,
    stalledRequests: state.stalledRequests,
    idle: state.byId.size <= 0,
  };
}

export function waitForNetworkIdle({ timeoutMs = 12000 } = {}) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const snapshot = getNetworkSnapshot();
      if (snapshot.idle) {
        clearInterval(interval);
        resolve(snapshot);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        clearInterval(interval);
        reject(new Error(`Network did not become idle in ${timeoutMs}ms`));
      }
    }, 200);
  });
}

export function assertNoPendingRequests() {
  const snapshot = getNetworkSnapshot();
  if (snapshot.pendingRequests > 0) {
    throw new Error(`Pending requests detected: ${snapshot.pendingRequests}`);
  }
  return snapshot;
}

export function getPendingRequests() {
  return Array.from(state.byId.values()).map((item) => ({
    id: item.id,
    method: item.method,
    url: item.url,
    retries: item.retries,
    ageMs: Date.now() - item.startedAtMs,
    stalled: item.stalled,
  }));
}

export function getFailedRequests() {
  return {
    failedRequests: state.failedRequests,
    retryCount: state.retryCount,
    cancelledRequests: state.cancelledRequests,
    stalledRequests: state.stalledRequests,
  };
}

export function subscribeNetworkSnapshot(listener) {
  if (typeof listener !== 'function') {
    return () => {};
  }
  listeners.add(listener);
  listener(getNetworkSnapshot());
  return () => listeners.delete(listener);
}

export function installGlobalNetworkTracking() {
  if (patched || typeof global.fetch !== 'function') {
    return () => {};
  }

  patched = true;
  originalFetch = global.fetch;

  global.fetch = async (input, init = {}) => {
    const method = normalizeMethod(init?.method || 'GET');
    const url = typeof input === 'string' ? input : String(input?.url || 'unknown');
    const requestId = trackNetworkRequestStart({ method, url });

    try {
      const response = await originalFetch(input, init);
      if (!response?.ok && Number(response?.status || 0) >= 500) {
        trackNetworkRetry(requestId);
      }
      trackNetworkRequestEnd(requestId);
      return response;
    } catch (error) {
      trackNetworkRequestFailure(requestId, error);
      throw error;
    }
  };

  return () => {
    if (originalFetch) {
      global.fetch = originalFetch;
    }
    patched = false;
    originalFetch = null;
  };
}
