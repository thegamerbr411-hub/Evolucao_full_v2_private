import { getFromAvailableQaHost, postToAvailableQaHost } from '../utils/qaTransport';

function safeUserId(userId) {
  return String(userId || '').trim();
}

function getApiErrorCode(response) {
  return String(response?.data?.error || response?.error || 'request_failed').trim();
}

export async function getSocialOverviewFromApi({ userId }) {
  const safe = safeUserId(userId);
  if (!safe) {
    return { ok: false, error: 'missing_user_id', data: null };
  }

  const response = await getFromAvailableQaHost(`/api/social/overview?userId=${encodeURIComponent(safe)}`);
  if (!response?.ok) {
    return { ok: false, error: response?.error || 'request_failed', data: null };
  }

  return { ok: true, data: response.data || null };
}

export async function getSocialLeaderboardFromApi({ userId, metric = 'xp' }) {
  const overview = await getSocialOverviewFromApi({ userId });
  if (!overview?.ok) {
    return { ok: false, error: overview?.error || 'request_failed', data: [] };
  }

  const metricKey = String(metric || 'xp').toLowerCase();
  const data = overview.data || {};
  const map = {
    completed: data.completedLeaderboard,
    consistency: data.consistencyLeaderboard,
    volume: data.volumeLeaderboard,
    xp: data.friendsLeaderboard,
  };

  return {
    ok: true,
    data: Array.isArray(map[metricKey]) ? map[metricKey] : [],
  };
}

export async function addFriendFromApi({ userId, friendUserId }) {
  const safeUserIdValue = safeUserId(userId);
  const safeFriendId = safeUserId(friendUserId);
  if (!safeUserIdValue || !safeFriendId) {
    return { ok: false, error: 'invalid_friend_payload' };
  }

  if (safeUserIdValue === safeFriendId) {
    return { ok: false, error: 'cannot_add_self' };
  }

  const response = await postToAvailableQaHost('/api/social/friends/add', {
    userId: safeUserIdValue,
    friendUserId: safeFriendId,
  });

  if (!response?.ok) {
    return { ok: false, error: getApiErrorCode(response) };
  }

  return { ok: true, data: response.data };
}

export async function createChallengeFromApi({ userId, title, target = 3, type = 'workouts_count', endDate }) {
  const safeUserIdValue = safeUserId(userId);
  if (!safeUserIdValue || !String(title || '').trim()) {
    return { ok: false, error: 'invalid_challenge_payload' };
  }

  const response = await postToAvailableQaHost('/api/social/challenges', {
    userId: safeUserIdValue,
    title: String(title || '').trim(),
    target: Math.max(1, Number(target || 3)),
    type: String(type || 'workouts_count'),
    endDate: endDate ? String(endDate) : undefined,
  });

  if (!response?.ok) {
    return { ok: false, error: getApiErrorCode(response) };
  }

  return { ok: true, data: response.data };
}

export async function joinChallengeFromApi({ userId, challengeId }) {
  const safeUserIdValue = safeUserId(userId);
  const safeChallengeId = String(challengeId || '').trim();
  if (!safeUserIdValue || !safeChallengeId) {
    return { ok: false, error: 'invalid_challenge_payload' };
  }

  const response = await postToAvailableQaHost(`/api/social/challenges/${encodeURIComponent(safeChallengeId)}/join`, {
    userId: safeUserIdValue,
  });

  if (!response?.ok) {
    return { ok: false, error: getApiErrorCode(response) };
  }

  return { ok: true, data: response.data };
}

export async function updateChallengeProgressFromApi({ userId, challengeId, progress }) {
  const safeUserIdValue = safeUserId(userId);
  const safeChallengeId = String(challengeId || '').trim();
  const safeProgress = Number(progress || 0);
  if (!safeUserIdValue || !safeChallengeId || !Number.isFinite(safeProgress)) {
    return { ok: false, error: 'invalid_progress_payload' };
  }

  const response = await postToAvailableQaHost(`/api/social/challenges/${encodeURIComponent(safeChallengeId)}/progress`, {
    userId: safeUserIdValue,
    progress: safeProgress,
  });

  if (!response?.ok) {
    return { ok: false, error: getApiErrorCode(response) };
  }

  return { ok: true, data: response.data };
}
