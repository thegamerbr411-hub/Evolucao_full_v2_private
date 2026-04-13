const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', '..', 'artifacts');
const LEARNING_FILE = path.join(ARTIFACTS_DIR, 'learning-events.json');

function ensureArtifactsDir() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

function normalizeClientId(value) {
  const safe = String(value || 'default').trim().toLowerCase();
  return safe.replace(/[^a-z0-9-_]/g, '').slice(0, 60) || 'default';
}

function readLearningStore() {
  ensureArtifactsDir();
  try {
    const raw = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf-8'));
    if (raw && typeof raw === 'object' && raw.tenants && typeof raw.tenants === 'object') {
      return raw;
    }
  } catch {
    // fallback abaixo
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    tenants: {},
  };
}

function writeLearningStore(store) {
  ensureArtifactsDir();
  const payload = JSON.stringify(store, null, 2);
  const temp = `${LEARNING_FILE}.tmp`;
  fs.writeFileSync(temp, payload, 'utf-8');
  fs.renameSync(temp, LEARNING_FILE);
}

function getTenant(store, clientId) {
  const safeClientId = normalizeClientId(clientId);
  if (!store.tenants[safeClientId]) {
    store.tenants[safeClientId] = { events: [] };
  }
  if (!Array.isArray(store.tenants[safeClientId].events)) {
    store.tenants[safeClientId].events = [];
  }
  return store.tenants[safeClientId];
}

function sanitizeText(value, fallback = '') {
  const text = String(value ?? fallback).replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function recordLearningEvent(clientId, payload = {}) {
  const store = readLearningStore();
  const tenant = getTenant(store, clientId);

  tenant.events.push({
    action: sanitizeText(payload.action || 'unknown_action', 'unknown_action'),
    error: sanitizeText(payload.error || '', ''),
    eventType: sanitizeText(payload.eventType || 'unknown', 'unknown'),
    meta: payload.meta && typeof payload.meta === 'object' ? payload.meta : {},
    screen: sanitizeText(payload.screen || 'unknown', 'unknown'),
    timestamp: new Date().toISOString(),
  });

  tenant.events = tenant.events.slice(-6000);
  store.generatedAt = new Date().toISOString();
  writeLearningStore(store);

  return tenant.events[tenant.events.length - 1];
}

function listLearningEvents(clientId, limit = 200) {
  const store = readLearningStore();
  const tenant = getTenant(store, clientId);
  const safeLimit = Math.max(1, Math.min(2000, Number(limit || 200)));

  return [...tenant.events]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, safeLimit);
}

function topOccurrences(items, keySelector, limit = 5) {
  const map = new Map();

  items.forEach((item) => {
    const key = sanitizeText(keySelector(item), 'unknown');
    map.set(key, Number(map.get(key) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([key, count]) => ({ count, key }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function buildLearningSummary(clientId) {
  const events = listLearningEvents(clientId, 5000);
  const errors = events.filter((item) => String(item.error || '').trim().length > 0);

  return {
    clientId: normalizeClientId(clientId),
    generatedAt: new Date().toISOString(),
    mostProblematicActions: topOccurrences(errors, (item) => item.action),
    mostProblematicScreens: topOccurrences(errors, (item) => item.screen),
    totalErrors: errors.length,
    totalEvents: events.length,
  };
}

module.exports = {
  LEARNING_FILE,
  buildLearningSummary,
  listLearningEvents,
  normalizeClientId,
  recordLearningEvent,
};
