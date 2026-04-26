const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', '..', 'artifacts');
const STORE_PATH = path.join(ARTIFACTS_DIR, 'hydration.json');

function ensureArtifactsDir() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

function normalizeUserId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 80);
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeIsoDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }
  return date.toISOString();
}

function normalizeTimezone(value) {
  const candidate = String(value || '').trim();
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

function toDailyKey(timestamp, timezone) {
  const safeTimezone = normalizeTimezone(timezone);
  const date = new Date(timestamp);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value || '1970';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  const day = parts.find((part) => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

function createEmptyStore() {
  return {
    version: 1,
    entries: [],
  };
}

function normalizeEntry(entry = {}) {
  const userId = normalizeUserId(entry.userId);
  const ml = Math.max(0, safeNumber(entry.ml, 0));
  const occurredAt = normalizeIsoDate(entry.occurredAt || entry.createdAt);
  const timezone = normalizeTimezone(entry.timezone);
  const id = String(entry.id || crypto.randomUUID()).trim();
  const source = String(entry.source || 'app').trim().slice(0, 32) || 'app';

  return {
    id,
    userId,
    ml,
    source,
    occurredAt,
    timezone,
    dayKey: toDailyKey(occurredAt, timezone),
    createdAt: normalizeIsoDate(entry.createdAt || occurredAt),
  };
}

function readStore() {
  ensureArtifactsDir();
  if (!fs.existsSync(STORE_PATH)) {
    return createEmptyStore();
  }

  try {
    const raw = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
    if (!raw || typeof raw !== 'object') {
      return createEmptyStore();
    }

    const entries = Array.isArray(raw.entries)
      ? raw.entries.map(normalizeEntry).filter((item) => item.userId && item.ml > 0)
      : [];

    return {
      version: 1,
      entries,
    };
  } catch {
    return createEmptyStore();
  }
}

function writeStore(store) {
  ensureArtifactsDir();
  const payload = JSON.stringify(store, null, 2);
  const tempPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tempPath, payload, 'utf-8');

  try {
    fs.renameSync(tempPath, STORE_PATH);
  } catch (error) {
    if (error && ['EPERM', 'EACCES', 'EBUSY', 'EXDEV'].includes(error.code)) {
      fs.writeFileSync(STORE_PATH, payload, 'utf-8');
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

function saveHydration(input = {}) {
  const store = readStore();
  const entry = normalizeEntry(input);

  if (!entry.userId || entry.ml <= 0) {
    return { ok: false, error: 'invalid_hydration_payload' };
  }

  const existingById = store.entries.find((item) => item.id === entry.id && item.userId === entry.userId);
  if (existingById) {
    return { ok: true, deduped: true, entry: existingById };
  }

  store.entries.push(entry);
  store.entries = store.entries.slice(-12000);
  writeStore(store);

  return { ok: true, entry };
}

function listHydration(userId, limit = 100) {
  const safeUserId = normalizeUserId(userId);
  if (!safeUserId) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(1000, safeNumber(limit, 100)));
  const store = readStore();

  return store.entries
    .filter((item) => item.userId === safeUserId)
    .sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt)))
    .slice(0, safeLimit);
}

function getHydrationSummary(userId, timezone, dayKey = null) {
  const safeUserId = normalizeUserId(userId);
  if (!safeUserId) {
    return {
      dayKey: dayKey || toDailyKey(new Date().toISOString(), normalizeTimezone(timezone)),
      timezone: normalizeTimezone(timezone),
      totalMl: 0,
      entries: 0,
    };
  }

  const safeTimezone = normalizeTimezone(timezone);
  const targetDayKey = String(dayKey || toDailyKey(new Date().toISOString(), safeTimezone));
  const rows = listHydration(safeUserId, 2000);

  const selected = rows.filter((item) => toDailyKey(item.occurredAt, safeTimezone) === targetDayKey);
  const totalMl = selected.reduce((acc, item) => acc + safeNumber(item.ml, 0), 0);

  return {
    dayKey: targetDayKey,
    timezone: safeTimezone,
    totalMl,
    entries: selected.length,
  };
}

module.exports = {
  getHydrationSummary,
  listHydration,
  normalizeTimezone,
  saveHydration,
  toDailyKey,
};
