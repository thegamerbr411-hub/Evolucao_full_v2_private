import { trackAppError, trackUnknownErrorWithContext } from '../utils/analytics.js';
import { logEvent as observeEvent, logRuntimeError } from './observability.js';

export function logError(error, context = {}) {
  const safeContext = {
    screen: context?.screen || 'unknown',
    action: context?.action || context?.useCase || 'unknown_action',
    ...context,
  };

  console.error('[ERROR]', {
    code: error?.code,
    message: error?.message,
    ...safeContext,
  });

  logRuntimeError(error, {
    source: 'logger',
    ...safeContext,
  });

  if (error?.code === 'UNKNOWN_ERROR' || !error?.code) {
    trackUnknownErrorWithContext(error, safeContext);
    return;
  }

  trackAppError(error, safeContext);
}

export function logEvent(name, data = {}) {
  console.log('[EVENT]', name, data);
  observeEvent(name, data);
}
