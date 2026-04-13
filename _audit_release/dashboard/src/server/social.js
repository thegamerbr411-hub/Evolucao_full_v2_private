const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { getRanking, normalizeUserId } = require('./workouts');

const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', '..', 'artifacts');
const SOCIAL_STORE_FILE = path.join(ARTIFACTS_DIR, 'social.json');

let queue = Promise.resolve();

function withLock(task) {
  queue = queue.then(task, task);
  return queue;
}

function ensureArtifactsDir() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

function readStore() {
  ensureArtifactsDir();
  if (!fs.existsSync(SOCIAL_STORE_FILE)) {
    return { version: 1, friends: {}, challenges: [] };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(SOCIAL_STORE_FILE, 'utf-8'));
    if (raw && typeof raw === 'object') {
      const friends = raw.friends && typeof raw.friends === 'object' ? raw.friends : {};
      const challenges = Array.isArray(raw.challenges) ? raw.challenges : [];
      return { version: 1, friends, challenges };
    }
  } catch {
    // fallback abaixo
  }

  return { version: 1, friends: {}, challenges: [] };
}

function writeStore(store) {
  ensureArtifactsDir();
  const tempPath = `${SOCIAL_STORE_FILE}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tempPath, SOCIAL_STORE_FILE);
}

function toDateKey(input = null) {
  const d = input ? new Date(input) : new Date();
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function createId(prefix) {
  if (typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function sanitizeText(value, maxLength, fallback) {
  const normalized = String(value || fallback || '').replace(/\s+/g, ' ').trim();
  return normalized.slice(0, maxLength);
}

function ensureUserFriends(store, userId) {
  if (!Array.isArray(store.friends[userId])) {
    store.friends[userId] = [];
  }

  store.friends[userId] = store.friends[userId]
    .map((entry) => {
      if (typeof entry === 'string') {
        return {
          friendId: normalizeUserId(entry),
          lastComparedAt: null,
          lastFriendXp: 0,
          lastUserXp: 0,
        };
      }

      const friendId = normalizeUserId(entry?.friendId || entry?.id || '');
      if (!friendId) {
        return null;
      }

      return {
        friendId,
        lastComparedAt: entry?.lastComparedAt || null,
        lastFriendXp: Number(entry?.lastFriendXp || 0),
        lastUserXp: Number(entry?.lastUserXp || 0),
      };
    })
    .filter(Boolean)
    .filter((entry, index, list) => list.findIndex((item) => item.friendId === entry.friendId) === index);
}

function getFriendIdsForUser(store, userId) {
  ensureUserFriends(store, userId);
  return store.friends[userId].map((item) => item.friendId).filter(Boolean);
}

function getFriends(userId) {
  const safeUserId = normalizeUserId(userId);
  if (!safeUserId) {
    return [];
  }

  const store = readStore();
  ensureUserFriends(store, safeUserId);
  return getFriendIdsForUser(store, safeUserId);
}

function addFriend(userId, friendUserId) {
  return withLock(async () => {
    const safeUserId = normalizeUserId(userId);
    const safeFriendId = normalizeUserId(friendUserId);
    if (!safeUserId || !safeFriendId || safeUserId === safeFriendId) {
      return { ok: false, error: 'invalid_friend_payload' };
    }

    const store = readStore();
    ensureUserFriends(store, safeUserId);
    ensureUserFriends(store, safeFriendId);

    const hasFriend = store.friends[safeUserId].some((item) => item.friendId === safeFriendId);
    if (!hasFriend) {
      store.friends[safeUserId].push({
        friendId: safeFriendId,
        lastComparedAt: null,
        lastFriendXp: 0,
        lastUserXp: 0,
      });
    }

    const hasReverseFriend = store.friends[safeFriendId].some((item) => item.friendId === safeUserId);
    if (!hasReverseFriend) {
      store.friends[safeFriendId].push({
        friendId: safeUserId,
        lastComparedAt: null,
        lastFriendXp: 0,
        lastUserXp: 0,
      });
    }

    writeStore(store);
    return { ok: true, friends: getFriendIdsForUser(store, safeUserId) };
  });
}

function normalizeChallenge(input = {}) {
  const id = String(input.id || createId('challenge'));
  const title = sanitizeText(input.title, 120, 'Desafio semanal') || 'Desafio semanal';
  const type = sanitizeText(input.type, 40, 'workouts_count') || 'workouts_count';
  const target = Math.max(1, Math.min(365, Number(input.target || 3)));
  const startDate = toDateKey(input.startDate);
  const endDate = toDateKey(input.endDate || new Date(Date.now() + 6 * 24 * 60 * 60 * 1000));
  const createdBy = normalizeUserId(input.createdBy || input.userId);

  return {
    id,
    title,
    type,
    target,
    startDate,
    endDate,
    createdBy,
    status: 'active',
    winner: null,
    participants: {},
    createdAt: new Date().toISOString(),
  };
}

function createChallenge(input = {}) {
  return withLock(async () => {
    const challenge = normalizeChallenge(input);
    if (!challenge.createdBy) {
      return { ok: false, error: 'invalid_challenge_payload' };
    }

    challenge.participants[challenge.createdBy] = 0;

    const store = readStore();
    store.challenges.push(challenge);
    store.challenges = store.challenges.slice(-500);
    writeStore(store);

    return { ok: true, challenge };
  });
}

function joinChallenge(challengeId, userId) {
  return withLock(async () => {
    const safeChallengeId = String(challengeId || '').trim();
    const safeUserId = normalizeUserId(userId);
    if (!safeChallengeId || !safeUserId) {
      return { ok: false, error: 'invalid_join_payload' };
    }

    const store = readStore();
    const challenge = store.challenges.find((item) => item.id === safeChallengeId);
    if (!challenge) {
      return { ok: false, error: 'challenge_not_found' };
    }

    if (!challenge.participants || typeof challenge.participants !== 'object') {
      challenge.participants = {};
    }

    if (challenge.participants[safeUserId] == null) {
      challenge.participants[safeUserId] = 0;
      writeStore(store);
    }

    return { ok: true, challenge };
  });
}

function updateChallengeProgress(challengeId, userId, progressValue) {
  return withLock(async () => {
    const safeChallengeId = String(challengeId || '').trim();
    const safeUserId = normalizeUserId(userId);
    const safeProgress = Math.max(0, Number(progressValue || 0));
    if (!safeChallengeId || !safeUserId || !Number.isFinite(safeProgress)) {
      return { ok: false, error: 'invalid_progress_payload' };
    }

    const store = readStore();
    const challenge = store.challenges.find((item) => item.id === safeChallengeId);
    if (!challenge) {
      return { ok: false, error: 'challenge_not_found' };
    }

    if (!challenge.participants || typeof challenge.participants !== 'object') {
      challenge.participants = {};
    }

    challenge.participants[safeUserId] = safeProgress;

    const nowDateKey = toDateKey();
    if (
      String(challenge.status || 'active') === 'active' &&
      (safeProgress >= Number(challenge.target || 0) || nowDateKey > String(challenge.endDate || nowDateKey))
    ) {
      const winner = Object.entries(challenge.participants)
        .map(([participantId, progress]) => ({ userId: participantId, progress: Number(progress || 0) }))
        .sort((a, b) => b.progress - a.progress)[0] || null;

      challenge.winner = winner;
      challenge.status = 'completed';
      challenge.completedAt = new Date().toISOString();
    }

    writeStore(store);

    return { ok: true, challenge };
  });
}

function getActiveChallenges() {
  const store = readStore();
  const today = toDateKey();
  let changed = false;

  const active = store.challenges.filter((item) => {
    const status = String(item.status || 'active');
    if (status !== 'active') {
      return false;
    }

    const endDate = String(item.endDate || today);
    if (endDate < today) {
      const winner = Object.entries(item.participants || {})
        .map(([participantId, progress]) => ({ userId: participantId, progress: Number(progress || 0) }))
        .sort((a, b) => b.progress - a.progress)[0] || null;
      item.winner = winner;
      item.status = 'completed';
      item.completedAt = new Date().toISOString();
      changed = true;
      return false;
    }
    return true;
  });

  if (changed) {
    writeStore(store);
  }

  return active;
}

function getSocialOverview(userId) {
  const safeUserId = normalizeUserId(userId);
  if (!safeUserId) {
    return {
      ok: false,
      error: 'missing_user_id',
      friends: [],
      friendsLeaderboard: [],
      activeChallenges: [],
    };
  }

  const store = readStore();
  ensureUserFriends(store, safeUserId);
  const friendEntries = store.friends[safeUserId];
  const friends = friendEntries.map((item) => item.friendId);
  const activeChallenges = getActiveChallenges().map((challenge) => {
    const participants = challenge.participants && typeof challenge.participants === 'object'
      ? challenge.participants
      : {};
    const participantRows = Object.entries(participants)
      .map(([participantId, progress]) => ({
        userId: participantId,
        progress: Math.max(0, Number(progress || 0)),
      }))
      .sort((a, b) => b.progress - a.progress)
      .map((item, index) => ({ ...item, rank: index + 1 }));

    return {
      id: challenge.id,
      title: challenge.title,
      type: challenge.type,
      target: challenge.target,
      startDate: challenge.startDate,
      endDate: challenge.endDate,
      createdBy: challenge.createdBy,
      winner: challenge.winner || null,
      myProgress: Number(participants[safeUserId] || 0),
      participants: participantRows,
    };
  });

  const socialIds = Array.from(new Set([safeUserId, ...friends]));
  const xpRanking = getRanking('xp').filter((item) => socialIds.includes(item.userId));
  const consistencyRanking = getRanking('consistency').filter((item) => socialIds.includes(item.userId));
  const volumeRanking = getRanking('volume').filter((item) => socialIds.includes(item.userId));
  const completedRanking = getRanking('completed').filter((item) => socialIds.includes(item.userId));

  const myXpRow = xpRanking.find((item) => item.userId === safeUserId) || null;
  const nextFriendToPass = xpRanking
    .filter((item) => item.userId !== safeUserId)
    .sort((a, b) => Number(a.xpScore || 0) - Number(b.xpScore || 0))
    .find((item) => Number(item.xpScore || 0) > Number(myXpRow?.xpScore || 0)) || null;

  const xpToPassFriend = nextFriendToPass
    ? Math.max(0, Number(nextFriendToPass.xpScore || 0) - Number(myXpRow?.xpScore || 0))
    : 0;

  const nowIso = new Date().toISOString();
  friendEntries.forEach((entry) => {
    const friendXp = Number((xpRanking.find((row) => row.userId === entry.friendId) || {}).xpScore || 0);
    entry.lastComparedAt = nowIso;
    entry.lastUserXp = Number(myXpRow?.xpScore || 0);
    entry.lastFriendXp = friendXp;
  });
  writeStore(store);

  return {
    ok: true,
    userId: safeUserId,
    friends,
    friendsCount: friends.length,
    friendsLeaderboard: xpRanking,
    consistencyLeaderboard: consistencyRanking,
    volumeLeaderboard: volumeRanking,
    completedLeaderboard: completedRanking,
    nextFriendToPass,
    xpToPassFriend,
    myLeague: String(myXpRow?.league || 'bronze'),
    activeChallenges,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = {
  addFriend,
  createChallenge,
  getFriends,
  getSocialOverview,
  joinChallenge,
  updateChallengeProgress,
};