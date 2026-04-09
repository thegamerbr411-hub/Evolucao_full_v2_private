const fs = require('fs');
const path = require('path');

const STORE_VERSION = 3;
const MAX_BUGS_PER_TENANT = 3000;
const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', '..', 'artifacts');
const STORE_PATH = path.join(ARTIFACTS_DIR, 'learning.json');

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

function createEmptyStore() {
  return {
    version: STORE_VERSION,
    tenants: {},
  };
}

function normalizeClientId(value) {
  const safe = String(value || 'default').trim().toLowerCase();
  return safe.replace(/[^a-z0-9-_]/g, '').slice(0, 60) || 'default';
}

function sanitizeStack(stack) {
  return String(stack || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.includes('node_modules'))
    .slice(0, 5)
    .join('\n');
}

function normalizeHistory(history, fallbackDate, fallbackCount) {
  if (!Array.isArray(history) || !history.length) {
    return [{ date: fallbackDate, count: fallbackCount }];
  }

  return history
    .map((item) => {
      const date = String(item?.date || fallbackDate).slice(0, 10);
      const count = Math.max(1, Number(item?.count || 1));
      return { date, count };
    })
    .slice(-120);
}

function normalizeBug(item = {}) {
  const firstOccurrence = item.firstOccurrence || item.timestamp || item.createdAt || new Date().toISOString();
  const lastOccurrence = item.lastOccurrence || item.timestamp || item.createdAt || firstOccurrence;
  const firstDate = String(firstOccurrence).slice(0, 10);
  const count = Math.max(1, Number(item.count || 1));
  const severity = String(item.severity || 'LOW').toUpperCase();

  return {
    fingerprint: String(item.fingerprint || `${item.message || 'unknown'}|${item.screen || 'unknown'}`),
    message: String(item.message || 'unknown_error'),
    screen: String(item.screen || 'unknown'),
    severity,
    stack: sanitizeStack(item.stack),
    count,
    firstOccurrence: new Date(firstOccurrence).toISOString(),
    lastOccurrence: new Date(lastOccurrence).toISOString(),
    history: normalizeHistory(item.history, firstDate, count),
  };
}

function normalizeStore(raw) {
  if (!raw) {
    return createEmptyStore();
  }

  if (Array.isArray(raw)) {
    return {
      version: STORE_VERSION,
      tenants: {
        default: {
          bugs: raw.map(normalizeBug),
        },
      },
    };
  }

  if (raw && raw.tenants && typeof raw.tenants === 'object') {
    const tenants = {};
    Object.entries(raw.tenants).forEach(([tenantId, tenantData]) => {
      const normalizedId = normalizeClientId(tenantId);
      const bugs = Array.isArray(tenantData?.bugs) ? tenantData.bugs.map(normalizeBug) : [];
      tenants[normalizedId] = { bugs };
    });
    return {
      version: STORE_VERSION,
      tenants,
    };
  }

  if (Array.isArray(raw.bugs)) {
    return {
      version: STORE_VERSION,
      tenants: {
        default: {
          bugs: raw.bugs.map(normalizeBug),
        },
      },
    };
  }

  return createEmptyStore();
}

function readStoreSync() {
  ensureArtifactsDir();

  if (!fs.existsSync(STORE_PATH)) {
    return createEmptyStore();
  }

  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    return normalizeStore(raw);
  } catch {
    return createEmptyStore();
  }
}

function writeStoreSync(store) {
  ensureArtifactsDir();
  const payload = JSON.stringify(store, null, 2);
  const tempPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, payload, 'utf-8');
  fs.renameSync(tempPath, STORE_PATH);
}

function sortBugsDescending(items) {
  return items.sort((a, b) => {
    const byCount = Number(b.count || 0) - Number(a.count || 0);
    if (byCount !== 0) return byCount;
    return new Date(b.lastOccurrence).getTime() - new Date(a.lastOccurrence).getTime();
  });
}

function getTenant(store, clientId) {
  const safeClientId = normalizeClientId(clientId);
  if (!store.tenants[safeClientId]) {
    store.tenants[safeClientId] = { bugs: [] };
  }
  return store.tenants[safeClientId];
}

function upsertHistory(history, date) {
  const safeHistory = Array.isArray(history) ? history : [];
  const day = safeHistory.find((item) => item.date === date);
  if (day) {
    day.count += 1;
  } else {
    safeHistory.push({ date, count: 1 });
  }

  return safeHistory.slice(-120);
}

async function upsertBug(clientId, log) {
  return withLock(async () => {
    const store = readStoreSync();
    const tenant = getTenant(store, clientId);
    const nowIso = new Date(log.timestamp).toISOString();
    const today = nowIso.slice(0, 10);
    const index = tenant.bugs.findIndex((item) => item.fingerprint === log.fingerprint);

    if (index >= 0) {
      const current = tenant.bugs[index];
      tenant.bugs[index] = {
        ...current,
        message: log.message,
        screen: log.screen,
        severity: String(log.severity || current.severity || 'LOW').toUpperCase(),
        stack: sanitizeStack(log.stack || current.stack),
        count: Number(current.count || 0) + 1,
        lastOccurrence: nowIso,
        history: upsertHistory(current.history, today),
      };
    } else {
      tenant.bugs.push({
        fingerprint: log.fingerprint,
        message: log.message,
        screen: log.screen,
        severity: String(log.severity || 'LOW').toUpperCase(),
        stack: sanitizeStack(log.stack),
        count: 1,
        firstOccurrence: nowIso,
        lastOccurrence: nowIso,
        history: [{ date: today, count: 1 }],
      });
    }

    sortBugsDescending(tenant.bugs);
    tenant.bugs = tenant.bugs.slice(0, MAX_BUGS_PER_TENANT);
    writeStoreSync(store);

    const currentBug = tenant.bugs.find((item) => item.fingerprint === log.fingerprint) || tenant.bugs[0];
    return currentBug || null;
  });
}

async function listTopBugs(clientId, options = {}) {
  const limit = Math.max(1, Math.min(500, Number(options.limit || 100)));
  const screen = String(options.screen || '').trim().toLowerCase();
  const severity = String(options.severity || '').trim().toUpperCase();

  const store = readStoreSync();
  const tenant = getTenant(store, clientId);
  let bugs = [...tenant.bugs];

  if (screen) {
    bugs = bugs.filter((bug) => String(bug.screen || '').toLowerCase() === screen);
  }

  if (severity) {
    bugs = bugs.filter((bug) => String(bug.severity || '').toUpperCase() === severity);
  }

  return sortBugsDescending(bugs).slice(0, limit);
}

module.exports = {
  ARTIFACTS_DIR,
  STORE_PATH,
  listTopBugs,
  normalizeClientId,
  upsertBug,
};
