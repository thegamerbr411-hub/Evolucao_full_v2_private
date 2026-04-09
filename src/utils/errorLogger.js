import axios from 'axios';
import Constants from 'expo-constants';

const fromAppConfig = Constants?.expoConfig?.extra?.logApiBaseUrl;
const fromEnv = typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_LOG_API_BASE_URL : '';
const CANDIDATE_BASE_URLS = [
  fromAppConfig,
  fromEnv,
  'http://10.0.2.2:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3000',
  'http://192.168.15.2:3000',
].filter(Boolean);

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

async function postToAvailableHost(payload) {
  for (const baseURL of CANDIDATE_BASE_URLS) {
    try {
      await axios.post(`${String(baseURL).replace(/\/$/, '')}/api/log`, payload, {
        timeout: 3000,
      });
      return true;
    } catch (_error) {
      // tenta o proximo endpoint
    }
  }

  return false;
}

export async function logError(error, context = {}) {
  try {
    const message = String(error?.message || 'unknown_error');
    await postToAvailableHost({
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
