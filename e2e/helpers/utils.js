const fs = require('fs');
const path = require('path');
const { hasDetoxGlobals } = require('./runtime');

const expoQaClientId = process.env['EXPO_PUBLIC_QA_CLIENT_ID'];
const DEFAULT_CLIENT_ID = expoQaClientId || process.env.QA_CLIENT_ID || 'default';
const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', 'artifacts');
const ID_ALIASES = {
  'input-peso': ['input-peso', 'input-weight'],
  'input-weight': ['input-weight', 'input-peso'],
  'input-reps': ['input-reps'],
  'btn-salvar-serie': ['btn-salvar-serie', 'btn-save-set'],
  'btn-save-set': ['btn-save-set', 'btn-salvar-serie'],
};

function getIdCandidates(id) {
  const target = String(id || '').trim();
  if (!target) {
    return [];
  }

  const aliases = Array.isArray(ID_ALIASES[target]) ? ID_ALIASES[target] : [target];
  return Array.from(new Set(aliases));
}

const KNOWN_SCROLL_CONTAINERS = [
  'screen-workout',
  'screen-home',
  'screen-treinos',
  'screen-routines',
  'screen-nutricao',
  'screen-social',
  'screen-perfil',
  'screen-profile',
  'screen-free-workout',
  'scroll-container',
];

async function tryScrollToTarget(id) {
  for (const containerId of KNOWN_SCROLL_CONTAINERS) {
    try {
      const containerReady = await isVisible(containerId, 450);
      if (!containerReady) {
        continue;
      }
      const found = await scrollToElement(containerId, id, 'down', 360, 6);
      if (found) {
        return true;
      }
    } catch {
      // tenta o proximo container
    }
  }

  return false;
}

async function resolveElementWithFallback(id, timeout = 5000) {
  const candidates = getIdCandidates(id);
  for (const candidate of candidates) {
    const target = element(by.id(candidate));
    try {
      await waitFor(target).toBeVisible().withTimeout(Math.max(1200, timeout));
      return { id: candidate, target };
    } catch {
      try {
        await waitFor(target).toExist().withTimeout(Math.max(1200, timeout));
        return { id: candidate, target };
      } catch {
        // tenta proximo alias
      }
    }
  }

  return null;
}

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

function isDetoxConcurrencyError(error) {
  const message = String(error?.message || error || '');
  return message.includes('multiple interactions taking place simultaneously');
}

async function withDetoxGuard(action, fallbackValue, timeoutMs = 2000) {
  try {
    // Avoid Promise.race here: timed-out Detox actions keep running in the background
    // and can flood the bridge with overlapping requests.
    return await Promise.resolve().then(action);
  } catch {
    return fallbackValue;
  }
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
  if (!hasDetoxGlobals()) {
    return false;
  }

  if (typeof target === 'string') {
    const candidates = getIdCandidates(target);
    for (const candidate of candidates) {
      const matcher = element(by.id(candidate));
      const visible = await withDetoxGuard(
        async () => {
          await waitFor(matcher).toBeVisible().withTimeout(timeout);
          return true;
        },
        false,
        Math.max(1200, Number(timeout || 0) + 800)
      );

      if (visible) {
        return true;
      }
    }

    return false;
  }

  const matcher = target;
  return withDetoxGuard(
    async () => {
      await waitFor(matcher).toBeVisible().withTimeout(timeout);
      return true;
    },
    false,
    Math.max(1200, Number(timeout || 0) + 800)
  );
}

async function dismissBlockingSystemDialogs() {
  if (!hasDetoxGlobals()) {
    return false;
  }

  const labels = [
    'Nao permitir',
    'Não permitir',
    "Don't allow",
    'Deny',
    'Permitir',
    'Allow',
    'ALLOW',
    'OK',
    'Ok',
    'Fechar',
  ];
  for (const label of labels) {
    try {
      await waitFor(element(by.text(label))).toBeVisible().withTimeout(120);
      await element(by.text(label)).tap();
      await sleep(120);
      return true;
    } catch {
      // segue para o proximo rotulo
    }
  }
  return false;
}

async function waitForAny(ids, timeout = 15000) {
  if (!hasDetoxGlobals()) {
    throw new Error('Detox globals indisponiveis durante waitForAny.');
  }

  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    await dismissBlockingSystemDialogs();

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
  if (!hasDetoxGlobals()) {
    throw new Error('Detox globals indisponiveis durante tapElement.');
  }

  let resolved = await resolveElementWithFallback(id, Math.min(timeout, 5000));
  if (!resolved) {
    await tryScrollToTarget(id);
    resolved = await resolveElementWithFallback(id, timeout);
  }

  if (!resolved) {
    throw new Error(`elemento ${id} nao ficou disponivel para tap`);
  }

  const { target } = resolved;

  await withDetoxGuard(
    async () => {
      await waitFor(target).toExist().withTimeout(timeout);
      return true;
    },
    false,
    Math.max(2500, Number(timeout || 0) + 800)
  );

  await withDetoxGuard(
    async () => {
      await waitFor(target).toBeVisible().withTimeout(Math.min(2500, timeout));
      return true;
    },
    false,
    Math.max(1800, Number(timeout || 0) + 500)
  );

  await expect(target).toBeVisible();

  let tapped = await withDetoxGuard(
    async () => {
      await target.tap();
      return true;
    },
    false,
    2500
  );

  if (!tapped) {
    if (device.getPlatform() === 'android') {
      try {
        await device.pressBack();
        await sleep(180);
      } catch {
        // teclado pode ja estar fechado
      }
    }

    await tryScrollToTarget(id);
    const resolvedAfterScroll = await resolveElementWithFallback(id, Math.max(3000, timeout));
    if (resolvedAfterScroll) {
      tapped = await withDetoxGuard(
        async () => {
          await resolvedAfterScroll.target.tap();
          return true;
        },
        false,
        2500
      );
    }
  }

  if (!tapped) {
    throw new Error(`falha ao tocar no elemento ${id}`);
  }
}

async function replaceInput(id, value, timeout = 12000) {
  if (!hasDetoxGlobals()) {
    throw new Error('Detox globals indisponiveis durante replaceInput.');
  }

  let resolved = await resolveElementWithFallback(id, Math.min(timeout, 5000));

  if (!resolved) {
    await tryScrollToTarget(id);
    resolved = await resolveElementWithFallback(id, timeout);
  }

  if (!resolved) {
    throw new Error(`campo ${id} nao foi encontrado para preenchimento`);
  }

  const { target } = resolved;

  try {
    await waitFor(target).toBeVisible().withTimeout(timeout);
  } catch {
    await waitFor(target).toExist().withTimeout(timeout);
    try {
      await target.tap();
    } catch {
      // segue para tentativa de clear/replace mesmo sem tap
    }
  }

  await expect(target).toBeVisible();

  try {
    await target.tap();
    await sleep(120);
  } catch {
    // foco best effort
  }

  try {
    await target.clearText();
  } catch {
    // alguns campos nao suportam clearText em todos os devices
  }

  if (String(value || '') === '') {
    return;
  }

  const expectedValue = String(value);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await waitFor(target).toBeVisible().withTimeout(Math.min(2500, timeout));
    } catch {
      // visibilidade pode oscilar por transicao de layout
    }

    try {
      await target.tap();
      await sleep(80);
    } catch {
      // foco best effort
    }

    try {
      await target.replaceText(expectedValue);
    } catch {
      try {
        await target.typeText(expectedValue);
      } catch {
        if (attempt >= 3) {
          throw new Error(`falha ao preencher ${id} com ${expectedValue}`);
        }
        await sleep(220);
        continue;
      }
    }

    try {
      await waitFor(target).toHaveText(expectedValue).withTimeout(1800);
      return;
    } catch {
      if (attempt >= 3) {
        throw new Error(`falha ao preencher ${id} com ${expectedValue}`);
      }
      try {
        await target.tap();
      } catch {
        // segue para nova tentativa
      }
      await sleep(200);
    }
  }
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
      return true;
    }

    let scrolled = false;
    for (let retry = 0; retry < 3; retry += 1) {
      try {
        await element(by.id(scrollId)).scroll(amount, direction);
        scrolled = true;
        break;
      } catch (error) {
        if (!isDetoxConcurrencyError(error) || retry >= 2) {
          throw error;
        }
        await sleep(220);
      }
    }

    if (!scrolled) {
      await sleep(220);
      continue;
    }

    await sleep(150);
  }

  try {
    await waitFor(element(by.id(targetId))).toBeVisible().withTimeout(4000);
    return true;
  } catch {
    try {
      await waitFor(element(by.id(targetId))).toExist().withTimeout(4000);
      return true;
    } catch {
      return false;
    }
  }
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
  dismissBlockingSystemDialogs,
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
