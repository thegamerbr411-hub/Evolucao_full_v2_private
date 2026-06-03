import { getJsonItem, setJsonItem } from './storageService';

const USER_IDENTITY_KEY = 'evolucao.user.identity.v1';

function buildUserId() {
  return `user_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

export async function getOrCreateUserIdentity() {
  const current = await getJsonItem(USER_IDENTITY_KEY);
  const currentUserId = String(current?.userId || '').trim();

  if (currentUserId) {
    return {
      userId: currentUserId,
      createdAt: String(current?.createdAt || new Date().toISOString()),
      source: String(current?.source || 'local'),
    };
  }

  const next = {
    userId: buildUserId(),
    createdAt: new Date().toISOString(),
    source: 'local',
  };
  await setJsonItem(USER_IDENTITY_KEY, next);
  return next;
}

export async function saveUserIdentity(partial = {}) {
  const normalized = {
    userId: String(partial?.userId || '').trim(),
    createdAt: String(partial?.createdAt || new Date().toISOString()),
    source: String(partial?.source || 'unknown').trim() || 'unknown',
  };

  if (!normalized.userId) {
    return null;
  }

  await setJsonItem(USER_IDENTITY_KEY, normalized);
  return normalized;
}

export async function getUserIdentity() {
  const current = await getJsonItem(USER_IDENTITY_KEY);
  const userId = String(current?.userId || '').trim();
  if (!userId) {
    return null;
  }

  return {
    userId,
    createdAt: String(current?.createdAt || ''),
    source: String(current?.source || 'unknown').trim() || 'unknown',
  };
}
