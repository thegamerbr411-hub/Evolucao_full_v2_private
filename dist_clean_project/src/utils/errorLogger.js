import { postToAvailableQaHost } from './qaTransport.js';

const runtimeContext = {
  action: 'unknown',
  userId: 'anonymous',
  version: 'unknown',
};

export function setErrorLoggerContext(partial = {}) {
  if (Object.prototype.hasOwnProperty.call(partial, 'action')) {
    runtimeContext.action = String(partial.action || 'unknown');
  }
  if (Object.prototype.hasOwnProperty.call(partial, 'userId')) {
    runtimeContext.userId = String(partial.userId || 'anonymous');
  }
  if (Object.prototype.hasOwnProperty.call(partial, 'version')) {
    runtimeContext.version = String(partial.version || 'unknown');
  }
}

function normalizeStack(stack) {
  if (!stack) return '';

  return String(stack)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .join('\n');
}

function inferSeverity(message) {
  const safe = String(message || '').toLowerCase();
  if (safe.includes('crash') || safe.includes('fatal')) return 'critical';
  if (safe.includes('error') || safe.includes('exception')) return 'high';
  if (safe.includes('warn') || safe.includes('timeout')) return 'medium';
  return 'low';
}

export async function logError(error, context = {}) {
  try {
    const message = String(error?.message || error || 'unknown_error');
    const action = String(context.action || runtimeContext.action || 'unknown');
    const userId = String(context.userId || runtimeContext.userId || 'anonymous');
    const version = String(context.version || runtimeContext.version || 'unknown');
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[qa-logError]', {
        action,
        message,
        screen: context.screen || 'unknown',
        severity: context.severity || inferSeverity(message),
        userId,
        version,
      });
    }
    await postToAvailableQaHost('/api/log', {
      action,
      message,
      stack: normalizeStack(error?.stack),
      screen: context.screen || 'unknown',
      severity: context.severity || inferSeverity(message),
      userId,
      version,
      extra: context.extra || {},
      timestamp: new Date().toISOString(),
    });
  } catch (_error) {
    // nunca quebra o app por falha de observabilidade
  }
}
