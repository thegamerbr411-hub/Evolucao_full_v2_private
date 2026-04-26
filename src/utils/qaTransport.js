import axios from 'axios';
import { Platform } from 'react-native';

export const QA_LOCAL_HEADER = 'x-qa-local';
export const QA_CLIENT_ID_HEADER = 'x-qa-client-id';

const extra = {};
const DEFAULT_TIMEOUT_MS = 3000;
const QA_TRANSPORT_ENABLED = (() => {
  const raw = String(
    extra.enableQaTransport
    || (typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_ENABLE_QA_TRANSPORT : '')
    || ''
  ).trim().toLowerCase();
  return raw === '1' || raw === 'true';
})();

function normalizeBaseUrl(value) {
  const raw = String(value || '').trim().replace(/\/$/, '');
  if (!raw) {
    return raw;
  }

  // Emulador Android nao enxerga localhost do host; usa 10.0.2.2
  if (Platform.OS === 'android') {
    return raw.replace(/^http:\/\/localhost(?=[:/]|$)/i, 'http://10.0.2.2');
  }

  return raw;
}

const BASE_URL = normalizeBaseUrl(
  (typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_QA_API_BASE_URL : '')
  || (typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_API_BASE_URL : '')
  || extra.qaApiBaseUrl
  || extra.logApiBaseUrl
  || 'https://evolucao-api-dou2.onrender.com'
);
const DEFAULT_CLIENT_ID = String(
  extra.qaClientId
  || (typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_QA_CLIENT_ID : '')
  || 'default'
).trim() || 'default';

const runtimeConfig = {
  apiKey: '',
  appVersion: '',
  clientId: '',
  jwt: '',
  userId: '',
};

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean)));
}

function getConfiguredJwt() {
  return String(
    runtimeConfig.jwt
    ||
    extra.qaJwt
    || (typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_QA_JWT : '')
    || ''
  ).trim();
}

function getConfiguredApiKey() {
  return String(
    runtimeConfig.apiKey
    ||
    extra.qaApiKey
    || (typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_QA_API_KEY : '')
    || ''
  ).trim();
}

export function shouldInjectQaAppError() {
  if (!QA_TRANSPORT_ENABLED) {
    return false;
  }

  const explicit = String(
    extra.qaInjectAppCrash
    || (typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_QA_INJECT_APP_CRASH : '')
    || ''
  ).trim();

  return explicit === '1' || explicit.toLowerCase() === 'true';
}

export function getQaBaseUrls() {
  if (!QA_TRANSPORT_ENABLED || !BASE_URL) {
    return [];
  }
  return unique([BASE_URL]);
}

function buildUrl(endpoint = '') {
  if (!QA_TRANSPORT_ENABLED || !BASE_URL) {
    return '';
  }
  const safeEndpoint = String(endpoint || '').startsWith('/')
    ? String(endpoint || '')
    : '/' + String(endpoint || '');
  return BASE_URL + safeEndpoint;
}

export function buildQaHeaders(extraHeaders = {}) {
  const resolvedClientId = String(runtimeConfig.clientId || DEFAULT_CLIENT_ID).trim() || DEFAULT_CLIENT_ID;
  const headers = {
    'Content-Type': 'application/json',
    [QA_LOCAL_HEADER]: '1',
    [QA_CLIENT_ID_HEADER]: resolvedClientId,
    ...extraHeaders,
  };

  const apiKey = getConfiguredApiKey();
  const jwt = getConfiguredJwt();

  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  if (jwt) {
    headers.Authorization = `Bearer ${jwt}`;
  }

  const appVersion = String(runtimeConfig.appVersion || '').trim();
  if (appVersion) {
    headers['x-app-version'] = appVersion;
  }

  return headers;
}

export function setQaRuntimeAuth(partial = {}) {
  if (Object.prototype.hasOwnProperty.call(partial, 'apiKey')) {
    runtimeConfig.apiKey = String(partial.apiKey || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(partial, 'appVersion')) {
    runtimeConfig.appVersion = String(partial.appVersion || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(partial, 'clientId')) {
    runtimeConfig.clientId = String(partial.clientId || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(partial, 'jwt')) {
    runtimeConfig.jwt = String(partial.jwt || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(partial, 'userId')) {
    runtimeConfig.userId = String(partial.userId || '').trim();
  }
}

export async function postToAvailableQaHost(endpoint, payload, options = {}) {
  if (!QA_TRANSPORT_ENABLED) {
    return { ok: false, skipped: true, error: 'qa_transport_disabled' };
  }

  const timeout = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const silentFailure = Boolean(options.silentFailure);
  const headers = buildQaHeaders(options.headers);
  const url = buildUrl(endpoint);

  if (!url) {
    return { ok: false, skipped: true, error: 'qa_base_url_missing' };
  }

  try {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[API]', url, payload);
    const response = await axios.post(url, payload, {
      headers,
      timeout,
    });
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[API RESPONSE]', response.data);

    return {
      ok: true,
      baseURL: BASE_URL,
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    if (!silentFailure && typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[API ERROR]', url, String(error?.message || error || 'unknown_error'));
    }
    return {
      ok: false,
      baseURL: BASE_URL,
      error: String(error?.message || 'request_failed'),
    };
  }
}

export async function getFromAvailableQaHost(endpoint, options = {}) {
  if (!QA_TRANSPORT_ENABLED) {
    return { ok: false, skipped: true, error: 'qa_transport_disabled' };
  }

  const timeout = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const headers = buildQaHeaders(options.headers);
  const url = buildUrl(endpoint);

  if (!url) {
    return { ok: false, skipped: true, error: 'qa_base_url_missing' };
  }

  try {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[API]', url, null);
    const response = await axios.get(url, {
      headers,
      timeout,
    });
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[API RESPONSE]', response.data);

    return {
      ok: true,
      baseURL: BASE_URL,
      data: response.data,
      status: response.status,
    };
  } catch (error) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) console.log('[API ERROR]', url, String(error?.message || error || 'unknown_error'));
    return {
      ok: false,
      baseURL: BASE_URL,
      error: String(error?.message || 'request_failed'),
    };
  }
}

export function fireAndForgetQaPost(endpoint, payload, options = {}) {
  postToAvailableQaHost(endpoint, payload, { ...options, silentFailure: true }).catch(() => {
    // observabilidade nunca bloqueia o app
  });
}
