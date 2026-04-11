import { postToAvailableQaHost } from './qaTransport.js';

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
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[qa-logError]', {
        message,
        screen: context.screen || 'unknown',
        severity: context.severity || inferSeverity(message),
      });
    }
    await postToAvailableQaHost('/api/log', {
      message,
      stack: normalizeStack(error?.stack),
      screen: context.screen || 'unknown',
      severity: context.severity || inferSeverity(message),
      extra: context.extra || {},
      timestamp: new Date().toISOString(),
    });
  } catch (_error) {
    // nunca quebra o app por falha de observabilidade
  }
}
