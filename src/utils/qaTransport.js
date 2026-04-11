import axios from 'axios';

export const QA_LOCAL_HEADER = 'x-qa-local';
export const QA_CLIENT_ID_HEADER = 'x-qa-client-id';

const extra = {};
const DEFAULT_TIMEOUT_MS = 3000;
const DEFAULT_CLIENT_ID = String(
  extra.qaClientId
  || (typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_QA_CLIENT_ID : '')
  || 'default'
).trim() || 'default';

function unique(values = []) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean)));
}

function getConfiguredJwt() {
  return String(
    extra.qaJwt
    || (typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_QA_JWT : '')
    || ''
  ).trim();
}

function getConfiguredApiKey() {
  return String(
    extra.qaApiKey
    || (typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_QA_API_KEY : '')
    || ''
  ).trim();
}

export function shouldInjectQaAppError() {
  const explicit = String(
    extra.qaInjectAppCrash
    || (typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_QA_INJECT_APP_CRASH : '')
    || ''
  ).trim();

  return explicit === '1' || explicit.toLowerCase() === 'true';
}

export function getQaBaseUrls() {
  const nodeEnv = String(typeof process !== 'undefined' ? process?.env?.NODE_ENV : '').toLowerCase();
  const publicBase = unique([
    extra.qaApiBaseUrl,
    extra.logApiBaseUrl,
    typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_QA_API_BASE_URL : '',
    typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_LOG_API_BASE_URL : '',
    typeof process !== 'undefined' ? process?.env?.EXPO_PUBLIC_API_BASE_URL : '',
  ]);

  if (nodeEnv === 'production') {
    return publicBase;
  }

  return unique([
    ...publicBase,
    'http://10.0.2.2:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3000',
  ]);
}

export function buildQaHeaders(extraHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    [QA_LOCAL_HEADER]: '1',
    [QA_CLIENT_ID_HEADER]: DEFAULT_CLIENT_ID,
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

  return headers;
}

export async function postToAvailableQaHost(endpoint, payload, options = {}) {
  const timeout = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const headers = buildQaHeaders(options.headers);

  for (const baseURL of getQaBaseUrls()) {
    try {
      const response = await axios.post(
        `${String(baseURL).replace(/\/$/, '')}${endpoint}`,
        payload,
        {
          headers,
          timeout,
        }
      );

      return {
        ok: true,
        baseURL,
        data: response.data,
        status: response.status,
      };
    } catch (_error) {
      // tenta o proximo host QA disponivel
    }
  }

  return { ok: false };
}

export async function getFromAvailableQaHost(endpoint, options = {}) {
  const timeout = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const headers = buildQaHeaders(options.headers);

  for (const baseURL of getQaBaseUrls()) {
    try {
      const response = await axios.get(
        `${String(baseURL).replace(/\/$/, '')}${endpoint}`,
        {
          headers,
          timeout,
        }
      );

      return {
        ok: true,
        baseURL,
        data: response.data,
        status: response.status,
      };
    } catch (_error) {
      // tenta o proximo host QA disponivel
    }
  }

  return { ok: false };
}

export function fireAndForgetQaPost(endpoint, payload, options = {}) {
  postToAvailableQaHost(endpoint, payload, options).catch(() => {
    // observabilidade nunca bloqueia o app
  });
}
