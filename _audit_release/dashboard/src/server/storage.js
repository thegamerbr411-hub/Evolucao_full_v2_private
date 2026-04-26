const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const STORE_VERSION = 3;
const TENANT_LIST_VERSION = 1;
const MAX_BUGS_PER_TENANT = 3000;
const MAX_EVENTS_PER_TENANT = 8000;
const MAX_FIXES_PER_TENANT = 1000;
const MAX_RETESTS_PER_TENANT = 400;
const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', '..', 'artifacts');
const STORE_PATH = path.join(ARTIFACTS_DIR, 'learning.json');
const EVENTS_STORE_PATH = path.join(ARTIFACTS_DIR, 'events.json');
const APPLIED_FIXES_STORE_PATH = path.join(ARTIFACTS_DIR, 'apply-fix.json');
const RETESTS_STORE_PATH = path.join(ARTIFACTS_DIR, 'retests.json');
const DETOX_ARTIFACTS_DIR = path.join(ARTIFACTS_DIR, 'detox');

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

function createEmptyBugStore() {
  return {
    version: STORE_VERSION,
    tenants: {},
  };
}

function createEmptyTenantListStore(bucketName) {
  return {
    version: TENANT_LIST_VERSION,
    bucketName,
    tenants: {},
  };
}

function normalizeClientId(value) {
  const safe = String(value || 'default').trim().toLowerCase();
  return safe.replace(/[^a-z0-9-_]/g, '').slice(0, 60) || 'default';
}

function safeText(value, fallback = '') {
  const text = String(value ?? fallback).replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function sanitizeStack(stack) {
  return String(stack || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.includes('node_modules'))
    .slice(0, 5)
    .join('\n');
}

function normalizeDate(value, fallback) {
  const date = value ? new Date(value) : new Date(fallback || Date.now());
  if (Number.isNaN(date.getTime())) {
    return new Date(fallback || Date.now()).toISOString();
  }
  return date.toISOString();
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
  const status = safeText(item.status, 'open').toLowerCase();

  return {
    fingerprint: String(item.fingerprint || `${item.message || 'unknown'}|${item.screen || 'unknown'}`),
    message: String(item.message || 'unknown_error'),
    screen: String(item.screen || 'unknown'),
    severity,
    status,
    stack: sanitizeStack(item.stack),
    count,
    synthetic: Boolean(item.synthetic),
    syntheticReason: safeText(item.syntheticReason, ''),
    fixed: Boolean(item.fixed),
    fixedAt: safeText(item.fixedAt, ''),
    fixedBy: safeText(item.fixedBy, ''),
    resolved: Boolean(item.resolved),
    resolvedAt: safeText(item.resolvedAt, ''),
    resolvedBy: safeText(item.resolvedBy, ''),
    autoClosed: Boolean(item.autoClosed),
    autoClosedAt: safeText(item.autoClosedAt, ''),
    autoCloseReason: safeText(item.autoCloseReason, ''),
    decision: safeText(item.decision, ''),
    decisionAt: safeText(item.decisionAt, ''),
    decisionBy: safeText(item.decisionBy, ''),
    decisionReason: safeText(item.decisionReason, ''),
    firstOccurrence: normalizeDate(firstOccurrence, Date.now()),
    lastOccurrence: normalizeDate(lastOccurrence, firstOccurrence),
    history: normalizeHistory(item.history, firstDate, count),
  };
}

function normalizeBugStore(raw) {
  if (!raw) {
    return createEmptyBugStore();
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

  return createEmptyBugStore();
}

function readJsonFileSync(filePath, fallbackFactory) {
  ensureArtifactsDir();

  if (!fs.existsSync(filePath)) {
    return fallbackFactory();
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallbackFactory();
  }
}

function writeJsonFileSync(filePath, value) {
  ensureArtifactsDir();
  const payload = JSON.stringify(value, null, 2);
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, payload, 'utf-8');

  try {
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    if (error && ['EPERM', 'EACCES', 'EBUSY', 'EXDEV'].includes(error.code)) {
      fs.writeFileSync(filePath, payload, 'utf-8');
    } else {
      throw error;
    }
  } finally {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Best-effort cleanup.
      }
    }
  }
}

function readStoreSync() {
  const raw = readJsonFileSync(STORE_PATH, createEmptyBugStore);
  return normalizeBugStore(raw);
}

function writeStoreSync(store) {
  writeJsonFileSync(STORE_PATH, store);
}

function readTenantListStoreSync(filePath, bucketName, normalizeEntry) {
  const raw = readJsonFileSync(filePath, () => createEmptyTenantListStore(bucketName));
  const store = createEmptyTenantListStore(bucketName);

  if (!raw || typeof raw !== 'object') {
    return store;
  }

  if (raw.tenants && typeof raw.tenants === 'object') {
    Object.entries(raw.tenants).forEach(([tenantId, tenantData]) => {
      const normalizedId = normalizeClientId(tenantId);
      const bucket = Array.isArray(tenantData?.[bucketName])
        ? tenantData[bucketName].map(normalizeEntry)
        : [];
      store.tenants[normalizedId] = { [bucketName]: bucket };
    });
    return store;
  }

  if (Array.isArray(raw[bucketName])) {
    store.tenants.default = {
      [bucketName]: raw[bucketName].map(normalizeEntry),
    };
  }

  return store;
}

function writeTenantListStoreSync(filePath, store) {
  writeJsonFileSync(filePath, store);
}

function sortBugsDescending(items) {
  return items.sort((a, b) => {
    const byCount = Number(b.count || 0) - Number(a.count || 0);
    if (byCount !== 0) {
      return byCount;
    }
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

function getTenantBucket(store, clientId, bucketName) {
  const safeClientId = normalizeClientId(clientId);
  if (!store.tenants[safeClientId]) {
    store.tenants[safeClientId] = { [bucketName]: [] };
  }
  if (!Array.isArray(store.tenants[safeClientId][bucketName])) {
    store.tenants[safeClientId][bucketName] = [];
  }
  return store.tenants[safeClientId][bucketName];
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

function buildStableEventId(timestamp, event, screen) {
  const hash = crypto
    .createHash('sha1')
    .update(`${timestamp}|${event}|${screen}`)
    .digest('hex');
  return `${Date.parse(timestamp)}-${hash.slice(0, 10)}`;
}

function normalizeEventEntry(item = {}) {
  const timestamp = normalizeDate(item.timestamp || item.timestampIso || item.ts, Date.now());
  const meta = item.meta && typeof item.meta === 'object' ? item.meta : {};
  const payload = item.payload && typeof item.payload === 'object' ? item.payload : {};
  const event = safeText(item.event || item.name, 'unknown');
  const screen = safeText(item.screen || meta.screen || payload.screen, 'unknown');

  return {
    event,
    eventId: safeText(item.eventId, buildStableEventId(timestamp, event, screen)),
    screen,
    userId: safeText(item.userId, 'anonymous'),
    timestamp,
    timestampMs: Number(item.timestampMs || Date.parse(timestamp) || Date.now()),
    sessionId: safeText(item.sessionId, ''),
    flowId: safeText(item.flowId, ''),
    meta,
    payload,
  };
}

function normalizeAppliedFixEntry(item = {}) {
  return {
    file: safeText(item.file, 'unknown'),
    change: safeText(item.change, ''),
    requestedAt: normalizeDate(item.requestedAt || item.timestamp, Date.now()),
    requestId: safeText(item.requestId, ''),
    meta: item.meta && typeof item.meta === 'object' ? item.meta : {},
  };
}

function normalizeRetestEntry(item = {}) {
  return {
    createdAt: normalizeDate(item.createdAt || item.startedAt || item.timestamp, Date.now()),
    finishedAt: item.finishedAt ? normalizeDate(item.finishedAt, Date.now()) : '',
    mode: safeText(item.mode, 'smoke'),
    jobId: safeText(item.jobId, ''),
    exitCode: Number(item.exitCode ?? -1),
    status: safeText(item.status, 'unknown'),
    fingerprint: safeText(item.fingerprint, ''),
    requestedBy: safeText(item.requestedBy, ''),
    meta: item.meta && typeof item.meta === 'object' ? item.meta : {},
  };
}

async function upsertBug(clientId, log) {
  return withLock(async () => {
    const store = readStoreSync();
    const tenant = getTenant(store, clientId);
    const nowIso = normalizeDate(log.timestamp, Date.now());
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
        status: current.status === 'closed' ? 'reopened' : (current.status || 'open'),
        synthetic: Boolean(current.synthetic || log.synthetic),
        syntheticReason: safeText(log.syntheticReason || current.syntheticReason, ''),
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
        status: 'open',
        stack: sanitizeStack(log.stack),
        synthetic: Boolean(log.synthetic),
        syntheticReason: safeText(log.syntheticReason, ''),
        count: 1,
        fixed: false,
        resolved: false,
        autoClosed: false,
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

async function appendEvent(clientId, event) {
  return withLock(async () => {
    const store = readTenantListStoreSync(EVENTS_STORE_PATH, 'events', normalizeEventEntry);
    const bucket = getTenantBucket(store, clientId, 'events');
    const normalized = normalizeEventEntry(event);
    bucket.push(normalized);
    if (bucket.length > MAX_EVENTS_PER_TENANT) {
      bucket.splice(0, bucket.length - MAX_EVENTS_PER_TENANT);
    }
    writeTenantListStoreSync(EVENTS_STORE_PATH, store);
    return normalized;
  });
}

async function listEvents(clientId, options = {}) {
  const limit = Math.max(1, Math.min(1000, Number(options.limit || 100)));
  const eventName = safeText(options.event, '').toLowerCase();
  const screen = safeText(options.screen, '').toLowerCase();

  const store = readTenantListStoreSync(EVENTS_STORE_PATH, 'events', normalizeEventEntry);
  const events = [...getTenantBucket(store, clientId, 'events')];

  return events
    .filter((item) => {
      if (eventName && String(item.event || '').toLowerCase() !== eventName) {
        return false;
      }
      if (screen && String(item.screen || '').toLowerCase() !== screen) {
        return false;
      }
      return true;
    })
    .sort((a, b) => Number(b.timestampMs || 0) - Number(a.timestampMs || 0))
    .slice(0, limit);
}

async function buildHeatmap(clientId) {
  const store = readTenantListStoreSync(EVENTS_STORE_PATH, 'events', normalizeEventEntry);
  const events = getTenantBucket(store, clientId, 'events');
  const heatmap = {};

  events.forEach((event) => {
    if (String(event.event || '').toLowerCase() !== 'tap') {
      return;
    }

    const elementId = safeText(event.meta?.id || event.payload?.id, '');
    if (!elementId) {
      return;
    }

    heatmap[elementId] = Number(heatmap[elementId] || 0) + 1;
  });

  return heatmap;
}

async function recordAppliedFix(clientId, entry) {
  return withLock(async () => {
    const store = readTenantListStoreSync(APPLIED_FIXES_STORE_PATH, 'appliedFixes', normalizeAppliedFixEntry);
    const bucket = getTenantBucket(store, clientId, 'appliedFixes');
    const normalized = normalizeAppliedFixEntry(entry);
    bucket.push(normalized);
    if (bucket.length > MAX_FIXES_PER_TENANT) {
      bucket.splice(0, bucket.length - MAX_FIXES_PER_TENANT);
    }
    writeTenantListStoreSync(APPLIED_FIXES_STORE_PATH, store);
    return normalized;
  });
}

async function recordRetestRun(clientId, entry) {
  return withLock(async () => {
    const store = readTenantListStoreSync(RETESTS_STORE_PATH, 'retests', normalizeRetestEntry);
    const bucket = getTenantBucket(store, clientId, 'retests');
    const normalized = normalizeRetestEntry(entry);
    bucket.push(normalized);
    if (bucket.length > MAX_RETESTS_PER_TENANT) {
      bucket.splice(0, bucket.length - MAX_RETESTS_PER_TENANT);
    }
    writeTenantListStoreSync(RETESTS_STORE_PATH, store);
    return normalized;
  });
}

async function listRetestRuns(clientId, options = {}) {
  const limit = Math.max(1, Math.min(200, Number(options.limit || 25)));
  const mode = safeText(options.mode, '').toLowerCase();

  const store = readTenantListStoreSync(RETESTS_STORE_PATH, 'retests', normalizeRetestEntry);
  const entries = [...getTenantBucket(store, clientId, 'retests')];

  return entries
    .filter((item) => {
      if (mode && String(item.mode || '').toLowerCase() !== mode) {
        return false;
      }
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);
}

function isResolvedBug(item = {}) {
  const status = String(item.status || '').trim().toLowerCase();
  return (
    item.resolved === true
    || item.autoClosed === true
    || item.fixed === true
    || status === 'closed'
    || status === 'resolved'
    || status === 'done'
    || status === 'merged'
    || status === 'auto_closed'
  );
}

function getRetentionDate(item = {}) {
  return (
    item.resolvedAt
    || item.autoClosedAt
    || item.fixedAt
    || item.decisionAt
    || item.lastOccurrence
    || item.firstOccurrence
    || new Date().toISOString()
  );
}

async function cleanupResolvedBugs(clientId, options = {}) {
  return withLock(async () => {
    const retentionDays = Math.max(0, Math.min(365, Number(options.retentionDays ?? 7)));
    const now = Date.now();
    const thresholdMs = retentionDays * 24 * 60 * 60 * 1000;
    const store = readStoreSync();
    const targetClientId = options.allTenants ? null : normalizeClientId(clientId || 'default');
    const result = {
      allTenants: Boolean(options.allTenants),
      removed: 0,
      removedByTenant: {},
      retentionDays,
      totalBefore: 0,
      totalAfter: 0,
    };

    Object.entries(store.tenants).forEach(([tenantId, tenantData]) => {
      if (targetClientId && tenantId !== targetClientId) {
        return;
      }

      const bugs = Array.isArray(tenantData?.bugs) ? tenantData.bugs : [];
      result.totalBefore += bugs.length;

      const kept = bugs.filter((bug) => {
        if (!isResolvedBug(bug)) {
          return true;
        }

        const timestamp = Date.parse(getRetentionDate(bug));
        const ageMs = Number.isFinite(timestamp) ? Math.max(0, now - timestamp) : thresholdMs + 1;
        return ageMs < thresholdMs;
      });

      const removedForTenant = Math.max(0, bugs.length - kept.length);
      if (removedForTenant > 0) {
        result.removedByTenant[tenantId] = removedForTenant;
      }
      result.removed += removedForTenant;
      result.totalAfter += kept.length;
      store.tenants[tenantId] = { bugs: kept };
    });

    if (result.removed > 0) {
      writeStoreSync(store);
    }

    if (result.totalAfter === 0 && result.totalBefore > 0 && targetClientId) {
      const tenant = getTenant(store, targetClientId);
      result.totalAfter = Array.isArray(tenant?.bugs) ? tenant.bugs.length : 0;
    }

    return result;
  });
}

function getDirectorySizeBytes(dirPath) {
  if (!fs.existsSync(dirPath)) {
    return 0;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.reduce((total, entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      return total + getDirectorySizeBytes(fullPath);
    }
    try {
      return total + fs.statSync(fullPath).size;
    } catch {
      return total;
    }
  }, 0);
}

async function listArtifactFolders(options = {}) {
  ensureArtifactsDir();
  const limit = Math.max(1, Math.min(200, Number(options.limit || 40)));
  const includeNestedDetox = options.includeNestedDetox !== false;

  const topLevel = fs
    .readdirSync(ARTIFACTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = path.join(ARTIFACTS_DIR, entry.name);
      const stats = fs.statSync(fullPath);
      return {
        name: entry.name,
        path: fullPath,
        sizeBytes: getDirectorySizeBytes(fullPath),
        updatedAt: stats.mtime.toISOString(),
      };
    });

  const detoxChildren = [];
  if (includeNestedDetox && fs.existsSync(DETOX_ARTIFACTS_DIR)) {
    fs.readdirSync(DETOX_ARTIFACTS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .forEach((entry) => {
        const fullPath = path.join(DETOX_ARTIFACTS_DIR, entry.name);
        const stats = fs.statSync(fullPath);
        detoxChildren.push({
          name: `detox/${entry.name}`,
          path: fullPath,
          sizeBytes: getDirectorySizeBytes(fullPath),
          updatedAt: stats.mtime.toISOString(),
        });
      });
  }

  return [...topLevel, ...detoxChildren]
    .sort((a, b) => Number(b.sizeBytes || 0) - Number(a.sizeBytes || 0))
    .slice(0, limit);
}

async function pruneDetoxArtifacts(options = {}) {
  ensureArtifactsDir();
  const keepLatest = Math.max(1, Math.min(60, Number(options.keepLatest || 8)));

  if (!fs.existsSync(DETOX_ARTIFACTS_DIR)) {
    return {
      available: false,
      deleted: [],
      keepLatest,
      kept: 0,
      totalBefore: 0,
    };
  }

  const directories = fs
    .readdirSync(DETOX_ARTIFACTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = path.join(DETOX_ARTIFACTS_DIR, entry.name);
      const stats = fs.statSync(fullPath);
      return {
        fullPath,
        name: entry.name,
        updatedAtMs: stats.mtimeMs,
      };
    })
    .sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));

  const kept = directories.slice(0, keepLatest);
  const toDelete = directories.slice(keepLatest);
  const deleted = [];

  toDelete.forEach((entry) => {
    try {
      fs.rmSync(entry.fullPath, { force: true, recursive: true });
      deleted.push(entry.name);
    } catch (error) {
      console.error('[maintenance][prune-detox]', entry.fullPath, error);
    }
  });

  return {
    available: true,
    deleted,
    keepLatest,
    kept: kept.length,
    totalBefore: directories.length,
  };
}

module.exports = {
  APPLIED_FIXES_STORE_PATH,
  ARTIFACTS_DIR,
  DETOX_ARTIFACTS_DIR,
  EVENTS_STORE_PATH,
  RETESTS_STORE_PATH,
  STORE_PATH,
  appendEvent,
  buildHeatmap,
  cleanupResolvedBugs,
  getTenant,
  getTenantBucket,
  listArtifactFolders,
  listEvents,
  listRetestRuns,
  listTopBugs,
  normalizeClientId,
  normalizeAppliedFixEntry,
  pruneDetoxArtifacts,
  readStoreSync,
  readTenantListStoreSync,
  recordAppliedFix,
  recordRetestRun,
  writeStoreSync,
  upsertBug,
};
