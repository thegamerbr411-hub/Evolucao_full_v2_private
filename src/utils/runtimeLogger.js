import { logEvent, logRuntimeError } from '../core/observability';
import { registerQaError } from '../qa/qaAutomationState';
import { captureRuntimeError } from '../runtime_error_collector';

const ALLOWED_TAGS = new Set([
  'AUTH',
  'NAVIGATION',
  'VIDEO',
  'NETWORK',
  'STORE',
  'PLAYER',
  'ERROR_BOUNDARY',
]);

function normalizeTag(tag = 'APP') {
  const nextTag = String(tag || 'APP').trim().toUpperCase();
  return ALLOWED_TAGS.has(nextTag) ? nextTag : 'APP';
}

function normalizeEventName(name = 'event') {
  return String(name || 'event')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'event';
}

export function logTaggedEvent(tag, name, payload = {}) {
  const safeTag = normalizeTag(tag);
  const safeName = normalizeEventName(name);
  const safePayload = payload && typeof payload === 'object' ? payload : { value: payload };

  console.log(`[${safeTag}]`, safeName, safePayload);

  try {
    logEvent(`${safeTag.toLowerCase()}_${safeName}`, {
      tag: safeTag,
      ...safePayload,
    });
  } catch {
    // Logging estruturado nunca deve quebrar o fluxo de runtime.
  }
}

export function logTaggedError(tag, error, payload = {}) {
  const safeTag = normalizeTag(tag);
  const safePayload = payload && typeof payload === 'object' ? payload : { value: payload };
  const safeError = error instanceof Error ? error : new Error(String(error || 'unknown_error'));

  console.error(`[${safeTag}]`, safeError.message, safePayload);
  captureRuntimeError(safeError, {
    tag: safeTag,
    ...safePayload,
  });
  registerQaError(safeError, {
    tag: safeTag,
  });

  try {
    logRuntimeError(safeError, {
      tag: safeTag,
      ...safePayload,
    });
  } catch {
    // Logging estruturado nunca deve quebrar o fluxo de runtime.
  }
}