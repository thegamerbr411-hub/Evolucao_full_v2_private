import { trackAppError, trackUnknownErrorWithContext } from '../utils/analytics.js';
import { logEvent as observeEvent, logRuntimeError } from './observability.js';

export function logErrorRuntime(error, safeContext) {
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

export function logEventRuntime(name, data = {}) {
  observeEvent(name, data);
}
