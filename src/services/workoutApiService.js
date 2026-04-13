import { getJsonItem, setJsonItem } from './storageService';
import { getFromAvailableQaHost, postToAvailableQaHost } from '../utils/qaTransport';
import { APP_VERSION } from '../utils/appVersion';

const PENDING_WORKOUTS_KEY = 'evolucao.workouts.pending.v1';
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1500;
const MAX_BACKOFF_MS = 120000;

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildWorkoutPayload(input = {}, userId, plan = 'free') {
  const exercises = Array.isArray(input?.exercises) ? input.exercises : [];

  return {
    id: String(input?.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
    userId: String(userId || '').trim(),
    createdAt: String(input?.createdAt || new Date().toISOString()),
    source: String(input?.source || 'app'),
    mode: String(input?.mode || 'guided'),
    name: String(input?.name || 'Treino'),
    plan: String(plan || 'free'),
    appVersion: APP_VERSION,
    totalVolume: toNumber(input?.totalVolume, 0),
    totalSets: toNumber(input?.totalSets, 0),
    durationMinutes: toNumber(input?.durationMinutes, 0),
    exercises,
  };
}

function toPendingItem(payload = {}, reason = 'offline') {
  const nowIso = new Date().toISOString();
  return {
    ...payload,
    sync: {
      status: 'pending',
      retries: 0,
      lastError: String(reason || 'offline').slice(0, 120),
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

async function getPendingWorkouts() {
  const data = await getJsonItem(PENDING_WORKOUTS_KEY);
  return Array.isArray(data) ? data : [];
}

async function setPendingWorkouts(items) {
  const safeList = Array.isArray(items) ? items : [];
  const dedupedById = new Map();
  safeList.forEach((item) => {
    const key = String(item?.id || '').trim();
    if (!key) {
      return;
    }
    dedupedById.set(key, item);
  });
  const safe = Array.from(dedupedById.values()).slice(-200);
  await setJsonItem(PENDING_WORKOUTS_KEY, safe);
}

export async function saveCompletedWorkoutToApi({ userId, plan = 'free', workout }) {
  const payload = buildWorkoutPayload(workout, userId, plan);

  if (!payload.userId || !payload.exercises.length) {
    return { ok: false, error: 'invalid_workout_payload' };
  }

  const response = await postToAvailableQaHost('/api/workouts', payload);
  if (response?.ok) {
    return { ok: true, data: response.data, synced: true };
  }

  const pending = await getPendingWorkouts();
  pending.push(toPendingItem(payload, response?.error || 'offline_queued'));
  await setPendingWorkouts(pending);
  return { ok: true, queuedOffline: true, syncStatus: 'pending', error: response?.error || 'offline_queued' };
}

export async function syncPendingWorkouts({ userId }) {
  const safeUserId = String(userId || '').trim();
  if (!safeUserId) {
    return { ok: false, synced: 0, error: 'missing_user_id' };
  }

  const pending = await getPendingWorkouts();
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

    const response = await postToAvailableQaHost('/api/workouts', item);
    if (response?.ok) {
      synced += 1;
    } else {
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
  }

  await setPendingWorkouts(remaining);
  return {
    ok: true,
    synced,
    dropped,
    remaining: remaining.length,
    needsRetry: remaining.length > 0,
  };
}

export async function listUserWorkoutsFromApi({ userId, limit = 30 }) {
  const safeUserId = String(userId || '').trim();
  if (!safeUserId) {
    return { ok: false, data: [], error: 'missing_user_id' };
  }

  const response = await getFromAvailableQaHost(`/api/workouts?userId=${encodeURIComponent(safeUserId)}&limit=${Math.max(1, Number(limit || 30))}`);
  if (!response?.ok) {
    return { ok: false, data: [], error: response?.error || 'request_failed' };
  }

  return { ok: true, data: Array.isArray(response.data) ? response.data : [] };
}

export async function getUserStatsFromApi({ userId }) {
  const safeUserId = String(userId || '').trim();
  if (!safeUserId) {
    return { ok: false, data: null, error: 'missing_user_id' };
  }

  const response = await getFromAvailableQaHost(`/api/me/stats?userId=${encodeURIComponent(safeUserId)}`);
  if (!response?.ok) {
    return { ok: false, data: null, error: response?.error || 'request_failed' };
  }

  return { ok: true, data: response.data };
}

export async function getRankingFromApi({ userId }) {
  const safeUserId = String(userId || '').trim();
  const suffix = safeUserId ? `?userId=${encodeURIComponent(safeUserId)}` : '';
  const response = await getFromAvailableQaHost(`/api/ranking${suffix}`);

  if (!response?.ok) {
    return { ok: false, data: [], error: response?.error || 'request_failed' };
  }

  return { ok: true, data: Array.isArray(response.data) ? response.data : [] };
}

export async function getLeaderboardFromApi({ metric = 'consistency', userId } = {}) {
  const safeMetric = String(metric || 'consistency').toLowerCase();
  const safeUserId = String(userId || '').trim();
  const query = [
    `metric=${encodeURIComponent(safeMetric)}`,
    ...(safeUserId ? [`userId=${encodeURIComponent(safeUserId)}`] : []),
  ].join('&');

  const response = await getFromAvailableQaHost(`/api/leaderboard?${query}`);
  if (!response?.ok) {
    return { ok: false, data: null, error: response?.error || 'request_failed' };
  }

  return {
    ok: true,
    data: {
      metric: safeMetric,
      ranking: Array.isArray(response?.data?.ranking) ? response.data.ranking : [],
      updatedAt: response?.data?.updatedAt || null,
    },
  };
}

export async function getGamificationFormulaFromApi() {
  const response = await getFromAvailableQaHost('/api/gamification/formula');
  if (!response?.ok) {
    return { ok: false, error: response?.error || 'request_failed', data: null };
  }

  return {
    ok: true,
    data: response?.data?.formula || null,
  };
}
