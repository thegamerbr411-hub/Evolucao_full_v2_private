const fs = require('fs');
const path = require('path');

const DEFAULT_CLIENT_ID = process.env.EXPO_PUBLIC_QA_CLIENT_ID || process.env.QA_CLIENT_ID || 'default';
const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', 'artifacts');

function ensureArtifactsDir() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

function logStep(message) {
  console.log(`[e2e] ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min, max, rng = Math.random) {
  const safeMin = Math.max(0, Number(min || 0));
  const safeMax = Math.max(safeMin, Number(max || safeMin));
  const factor = typeof rng === 'function' ? rng() : Math.random();
  return Math.round(safeMin + ((safeMax - safeMin) * factor));
}

async function humanDelay(persona, label = 'delay') {
  const [minDelay, maxDelay] = Array.isArray(persona?.randomDelayMs)
    ? persona.randomDelayMs
    : [200, 500];
  const delay = randomBetween(minDelay, maxDelay, persona?.rng);
  logStep(`${label}: ${delay}ms`);
  await sleep(delay);
  return delay;
}

async function isVisible(target, timeout = 1000) {
  const matcher = typeof target === 'string' ? element(by.id(target)) : target;
  try {
    await waitFor(matcher).toBeVisible().withTimeout(timeout);
    return true;
  } catch {
    return false;
  }
}

async function waitForAny(ids, timeout = 15000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    for (const id of ids) {
      if (await isVisible(id, 400)) {
        return id;
      }
    }

    await sleep(250);
  }

  throw new Error(`Nenhum alvo visivel: ${ids.join(', ')}`);
}

async function tapElement(id, timeout = 12000) {
  try {
    await waitFor(element(by.id(id))).toBeVisible().withTimeout(timeout);
  } catch {
    try {
      await device.pressBack();
    } catch {
      // sem stack para voltar
    }
    await waitFor(element(by.id(id))).toBeVisible().withTimeout(timeout);
  }
  await element(by.id(id)).tap();
}

async function replaceInput(id, value, timeout = 12000) {
  try {
    await waitFor(element(by.id(id))).toBeVisible().withTimeout(timeout);
  } catch {
    await waitFor(element(by.id(id))).toExist().withTimeout(timeout);
    try {
      await element(by.id(id)).tap();
    } catch {
      // segue para tentativa de clear/replace mesmo sem tap
    }
  }
  try {
    await element(by.id(id)).clearText();
  } catch {
    // alguns campos nao suportam clearText em todos os devices
  }

  if (String(value || '') === '') {
    return;
  }

  await element(by.id(id)).replaceText(String(value));
}

async function hideKeyboardIfNeeded() {
  if (device.getPlatform() !== 'android') {
    return;
  }

  // Em alguns devices físicos, pressBack sem teclado aberto tira o app de foco.
  // Só usamos esse fallback quando explicitamente habilitado via env.
  if (process.env.DETOX_HIDE_KEYBOARD_WITH_BACK !== '1') {
    return;
  }

  try {
    await device.pressBack();
  } catch {
    // sem teclado aberto
  }
}

async function scrollToElement(scrollId, targetId, direction = 'down', amount = 320, attempts = 8) {
  for (let index = 0; index < attempts; index += 1) {
    if (await isVisible(targetId, 500)) {
      return;
    }

    await element(by.id(scrollId)).scroll(amount, direction);
    await sleep(150);
  }

  await waitFor(element(by.id(targetId))).toBeVisible().withTimeout(4000);
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function readJsonArtifact(fileName, fallback = null) {
  ensureArtifactsDir();
  const filePath = path.join(ARTIFACTS_DIR, fileName);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJsonArtifact(fileName, value) {
  ensureArtifactsDir();
  fs.writeFileSync(path.join(ARTIFACTS_DIR, fileName), JSON.stringify(value, null, 2), 'utf-8');
}

function resetArtifacts() {
  ensureArtifactsDir();
  writeJsonArtifact('learning.json', { version: 3, tenants: {} });
  writeJsonArtifact('events.json', { version: 1, bucketName: 'events', tenants: {} });
  writeJsonArtifact('apply-fix.json', { version: 1, bucketName: 'appliedFixes', tenants: {} });
  writeJsonArtifact('insights.json', { generatedAt: new Date().toISOString(), totalInsights: 0, insights: [] });
}

function readTenantBucket(fileName, bucketName, clientId = DEFAULT_CLIENT_ID) {
  const payload = readJsonArtifact(fileName, { tenants: {} });

  if (Array.isArray(payload?.[bucketName])) {
    return payload[bucketName];
  }

  if (!payload?.tenants || typeof payload.tenants !== 'object') {
    return [];
  }

  return Array.isArray(payload.tenants?.[clientId]?.[bucketName])
    ? payload.tenants[clientId][bucketName]
    : [];
}

function countBugEntries(clientId = DEFAULT_CLIENT_ID) {
  return readTenantBucket('learning.json', 'bugs', clientId).length;
}

function countBugOccurrences(clientId = DEFAULT_CLIENT_ID) {
  return readTenantBucket('learning.json', 'bugs', clientId)
    .reduce((acc, item) => acc + Number(item?.count || 0), 0);
}

function countEventEntries(clientId = DEFAULT_CLIENT_ID) {
  return readTenantBucket('events.json', 'events', clientId).length;
}

async function waitForCountIncrease(reader, previousCount, timeout = 10000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    const nextCount = Number(reader() || 0);
    if (nextCount > previousCount) {
      return nextCount;
    }
    await sleep(300);
  }

  throw new Error(`contador nao aumentou em ${timeout}ms`);
}

async function fetchHeatmap(clientId = DEFAULT_CLIENT_ID) {
  const response = await fetch('http://127.0.0.1:3000/api/heatmap', {
    headers: {
      'x-qa-client-id': clientId,
      'x-qa-local': '1',
    },
  });

  if (!response.ok) {
    throw new Error(`heatmap request failed with ${response.status}`);
  }

  return response.json();
}

module.exports = {
  ARTIFACTS_DIR,
  DEFAULT_CLIENT_ID,
  countBugEntries,
  countBugOccurrences,
  countEventEntries,
  fetchHeatmap,
  hideKeyboardIfNeeded,
  humanDelay,
  isVisible,
  logStep,
  readJsonArtifact,
  resetArtifacts,
  replaceInput,
  scrollToElement,
  sleep,
  slugify,
  tapElement,
  waitForAny,
  waitForCountIncrease,
};
