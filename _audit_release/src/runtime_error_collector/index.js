import { getLocal, setLocal } from '../storage/mmkv';
import { getQaHealthSnapshot } from '../qa/qaAutomationState';

const STORAGE_KEY = 'runtime.error.collector.v1';
const LIMIT = 200;

let errors = Array.isArray(getLocal(STORAGE_KEY)) ? getLocal(STORAGE_KEY) : [];

function persist() {
  setLocal(STORAGE_KEY, errors.slice(-LIMIT));
}

export function captureRuntimeError(error, context = {}) {
  const health = getQaHealthSnapshot();
  const safeError = error instanceof Error ? error : new Error(String(error || 'unknown_error'));
  const record = {
    id: `runtime_error_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    message: safeError.message,
    stack: safeError.stack || null,
    currentScreen: health.currentScreen,
    currentRoute: health.currentRoute,
    auth: health.auth,
    context,
  };

  errors = [...errors, record].slice(-LIMIT);
  persist();
  return record;
}

export function getRuntimeErrorSnapshot() {
  return {
    total: errors.length,
    latest: errors[errors.length - 1] || null,
    items: [...errors].reverse(),
  };
}

export function clearRuntimeErrorSnapshot() {
  errors = [];
  persist();
}