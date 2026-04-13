import { getJsonItem, setJsonItem } from './storageService';
import { getFromAvailableQaHost, postToAvailableQaHost } from '../utils/qaTransport';

const PENDING_HYDRATION_KEY = 'evolucao.hydration.pending.v1';
const MAX_RETRIES = 6;
const BASE_BACKOFF_MS = 1500;
const MAX_BACKOFF_MS = 120000;

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTimezone(timezone) {
  const candidate = String(timezone || '').trim();
  if (!candidate) {
    return 'UTC';
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'UTC';
  }
}

function toPayload({ userId, ml, timezone, occurredAt, id }) {
  return {
    id: String(id || `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`),
    userId: String(userId || '').trim(),
    ml: Math.max(0, safeNumber(ml, 0)),
    occurredAt: String(occurredAt || new Date().toISOString()),
    timezone: normalizeTimezone(timezone),
    source: 'app',
  };
}

function toPendingItem(payload = {}, error = 'offline') {
  const nowIso = new Date().toISOString();
  return {
    ...payload,
    sync: {
      status: 'pending',
      retries: 0,
      lastError: String(error || 'offline').slice(0, 120),
      queuedAt: nowIso,
      nextRetryAt: nowIso,
      updatedAt: nowIso,
    },
  };
}

function getBackoffMs(retries) {
  const attempt = Math.max(0, Number(retries || 0));
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, attempt));
}

async function getPendingHydration() {
  const data = await getJsonItem(PENDING_HYDRATION_KEY);
  return Array.isArray(data) ? data : [];
}

async function setPendingHydration(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const deduped = new Map();
  safeItems.forEach((item) => {
    const key = String(item?.id || '').trim();
    if (!key) {
      return;
    }
    deduped.set(key, item);
  });

  await setJsonItem(PENDING_HYDRATION_KEY, Array.from(deduped.values()).slice(-400));
}

export async function saveHydrationToApi({ userId, ml, timezone, occurredAt, id }) {
  const payload = toPayload({ userId, ml, timezone, occurredAt, id });

  if (!payload.userId || payload.ml <= 0) {
    return { ok: false, error: 'invalid_hydration_payload' };
  }

  const response = await postToAvailableQaHost('/api/hydration', payload, {
    headers: {
      'x-user-timezone': payload.timezone,
    },
  });

  if (response?.ok) {
    return {
      ok: true,
      synced: true,
      data: response.data,
    };
  }

  const pending = await getPendingHydration();
  pending.push(toPendingItem(payload, response?.error || 'offline_queued'));
  await setPendingHydration(pending);

  return {
    ok: true,
    queuedOffline: true,
    syncStatus: 'pending',
    error: response?.error || 'offline_queued',
  };
}

export async function syncPendingHydration({ userId, timezone }) {
  const safeUserId = String(userId || '').trim();
  if (!safeUserId) {
    return { ok: false, synced: 0, error: 'missing_user_id' };
  }

  const pending = await getPendingHydration();
  if (!pending.length) {
    return { ok: true, synced: 0, remaining: 0, needsRetry: false };
  }

  let synced = 0;
  const remaining = [];
  let dropped = 0;

  for (const item of pending) {
    if (String(item?.userId || '') !== safeUserId) {
      remaining.push(item);
      continue;
    }

    const nowMs = Date.now();
    const nextRetryMs = Number(new Date(item?.sync?.nextRetryAt || 0).getTime() || 0);
    if (nextRetryMs && nextRetryMs > nowMs) {
      remaining.push(item);
      continue;
    }

    const response = await postToAvailableQaHost('/api/hydration', {
      ...item,
      timezone: normalizeTimezone(item?.timezone || timezone),
    }, {
      headers: {
        'x-user-timezone': normalizeTimezone(item?.timezone || timezone),
      },
    });

    if (response?.ok) {
      synced += 1;
      continue;
    }

    const retries = Number(item?.sync?.retries || 0) + 1;
    if (retries > MAX_RETRIES) {
      dropped += 1;
      continue;
    }

    const backoffMs = getBackoffMs(retries);

    remaining.push({
      ...item,
      sync: {
        ...(item?.sync || {}),
        status: 'failed',
        retries,
        lastError: String(response?.error || 'request_failed').slice(0, 120),
        nextRetryAt: new Date(Date.now() + backoffMs).toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  }

  await setPendingHydration(remaining);

  return {
    ok: true,
    synced,
    dropped,
    remaining: remaining.length,
    needsRetry: remaining.length > 0,
  };
}

export async function getHydrationSummaryFromApi({ userId, timezone, dayKey = '' }) {
  const safeUserId = String(userId || '').trim();
  if (!safeUserId) {
    return { ok: false, error: 'missing_user_id', data: null };
  }

  const query = [
    `userId=${encodeURIComponent(safeUserId)}`,
    ...(dayKey ? [`dayKey=${encodeURIComponent(dayKey)}`] : []),
  ].join('&');

  const response = await getFromAvailableQaHost(`/api/hydration?${query}`, {
    headers: {
      'x-user-timezone': normalizeTimezone(timezone),
    },
  });

  if (!response?.ok) {
    return { ok: false, error: response?.error || 'request_failed', data: null };
  }

  return { ok: true, data: response.data };
}
