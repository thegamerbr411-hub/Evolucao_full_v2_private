const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');
const { hasDetoxGlobals, isAttachedRun } = require('./runtime');

const expoQaClientId = process.env['EXPO_PUBLIC_QA_CLIENT_ID'];
const DEFAULT_CLIENT_ID = expoQaClientId || process.env.QA_CLIENT_ID || 'default';
const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', 'artifacts');
// Mapeamento bidirecional: ID semântico (novo) ↔ ID legado (antigo)
// Quando um teste usar o ID novo, o Detox também tenta o legado (e vice-versa),
// garantindo que qualquer uma das duas formas encontre o elemento na UI.
const ID_ALIASES = {
  // Inputs de treino
  'input-peso': ['input-peso', 'input-weight'],
  'input-weight': ['input-weight', 'input-peso'],
  'input-reps': ['input-reps'],
  'btn-salvar-serie': ['btn-salvar-serie', 'btn-save-set'],
  'btn-save-set': ['btn-save-set', 'btn-salvar-serie'],

  // Telas semânticas (novo) ↔ legado (antigo)
  screen_home: ['screen_home', 'screen-home', 'home-screen'],
  'screen-home': ['screen-home', 'screen_home', 'home-screen'],
  'home-screen': ['home-screen', 'screen-home', 'screen_home'],
  screen_treinos: ['screen_treinos', 'screen-treinos'],
  'screen-treinos': ['screen-treinos', 'screen_treinos'],
  screen_profile: ['screen_profile', 'screen-perfil', 'screen-profile'],
  'screen-perfil': ['screen-perfil', 'screen_profile'],
  screen_login: ['screen_login', 'screen-login'],
  'screen-login': ['screen-login', 'screen_login'],
  screen_register: ['screen_register', 'screen-register', 'screen-cadastro'],
  'screen-register': ['screen-register', 'screen_register'],

  // Elementos bootstrap
  app_root: ['app_root', 'app-root'],
  'app-root': ['app-root', 'app_root'],
  app_bootstrap_ready: ['app_bootstrap_ready', 'app-bootstrap-ready'],
  'app-bootstrap-ready': ['app-bootstrap-ready', 'app_bootstrap_ready'],
  home_ready: ['home_ready', 'home-ready'],
  'home-ready': ['home-ready', 'home_ready'],

  // Tabs semânticas (novo) ↔ legado (antigo)
  tab_home: ['tab_home', 'tab-home'],
  'tab-home': ['tab-home', 'tab_home'],
  tab_treinos: ['tab_treinos', 'tab-treino'],
  'tab-treino': ['tab-treino', 'tab_treinos'],
  tab_nutricao: ['tab_nutricao', 'tab-nutricao'],
  'tab-nutricao': ['tab-nutricao', 'tab_nutricao'],
  tab_coach: ['tab_coach', 'tab-conversa'],
  'tab-conversa': ['tab-conversa', 'tab_coach'],
  tab_social: ['tab_social', 'tab-social'],
  'tab-social': ['tab-social', 'tab_social'],
  tab_profile: ['tab_profile', 'tab-perfil'],
  'tab-perfil': ['tab-perfil', 'tab_profile'],

  // Botões autenticação
  btn_login: ['btn_login', 'btn-login'],
  'btn-login': ['btn-login', 'btn_login'],
  btn_register: ['btn_register', 'btn-register', 'btn-cadastrar'],
  btn_go_login: ['btn_go_login', 'btn-go-login'],
  btn_go_register: ['btn_go_register', 'btn-go-register'],
  input_email: ['input_email', 'input-email'],
  input_password: ['input_password', 'input-password', 'input-senha'],
  input_name: ['input_name', 'input-name', 'input-nome'],

  // Botões de ação
  btn_start_workout: ['btn_start_workout', 'btn-iniciar-treino'],
  'btn-iniciar-treino': ['btn-iniciar-treino', 'btn_start_workout'],
  btn_open_free_workout: ['btn_open_free_workout', 'btn-open-free-workout'],
  'btn-open-free-workout': ['btn-open-free-workout', 'btn_open_free_workout'],
  btn_open_routines: ['btn_open_routines', 'btn-open-routines'],
  'btn-open-routines': ['btn-open-routines', 'btn_open_routines'],
  btn_logout: ['btn_logout', 'btn-profile-session-logout'],
  'btn-profile-session-logout': ['btn-profile-session-logout', 'btn_logout'],
  btn_google_login: ['btn_google_login', 'btn-profile-google-login'],
  btn_google_logout: ['btn_google_logout', 'btn-profile-google-logout'],
  btn_save_profile: ['btn_save_profile', 'btn-profile-save'],
  'btn-profile-save': ['btn-profile-save', 'btn_save_profile'],
  btn_open_admin: ['btn_open_admin', 'btn-open-admin'],
  'btn-open-admin': ['btn-open-admin', 'btn_open_admin'],

  // Video / player
  btn_open_video_external: ['btn_open_video_external', 'btn-open-video-external'],
  btn_enable_player: ['btn_enable_player', 'btn-enable-player'],
  btn_player_fullscreen: ['btn_player_fullscreen', 'btn-video-fullscreen'],
  'btn-video-fullscreen': ['btn-video-fullscreen', 'btn_player_fullscreen'],
  btn_player_close: ['btn_player_close', 'btn-video-close-player'],
  player_internal: ['player_internal', 'player-internal'],
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
  // IDs semânticos (novo padrão)
  'screen_home',
  'screen_treinos',
  'screen_profile',
  'screen_login',
  'screen_register',
  // IDs legados (mantidos por compatibilidade)
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

async function dismissWorkoutFeedbackDialog() {
  if (!hasDetoxGlobals()) {
    return false;
  }

  // Attached runs: dialog probes via Espresso often hang even with short timeouts.
  if (isAttachedRun()) {
    return false;
  }

  try {
    await waitFor(element(by.text('Feedback rapido'))).toExist().withTimeout(600);
    try {
      await element(by.id('android:id/button1')).tap();
      logStep('feedback-dismiss:button1');
      await sleep(280);
      return true;
    } catch {
      await element(by.id('android:id/button2')).tap();
      logStep('feedback-dismiss:button2');
      await sleep(280);
      return true;
    }
  } catch {
    // sem dialog de feedback
  }

  const labels = ['Fechar', 'Continuar'];
  for (const label of labels) {
    try {
      await waitFor(element(by.text(label))).toBeVisible().withTimeout(400);
      await element(by.text(label)).tap();
      logStep(`feedback-dismiss:${label}`);
      await sleep(280);
      return true;
    } catch {
      // tenta proximo rotulo
    }
  }

  return false;
}

async function dismissBlockingSystemDialogs() {
  if (!hasDetoxGlobals()) {
    return false;
  }

  if (await dismissWorkoutFeedbackDialog()) {
    return true;
  }

  // Attached runs pre-grant permissions via adb; Espresso dialog taps often hang here.
  if (isAttachedRun()) {
    return false;
  }

  const labels = [
    'Cancelar',
    'Nao permitir',
    'Não permitir',
    "Don't allow",
    'Deny',
    'Permitir',
    'Allow',
    'ALLOW',
    'Permitir durante o uso do app',
    'While using the app',
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
    const tappedViaXml = await tryTapViaXmlBounds(id);
    if (tappedViaXml) {
      return;
    }

    captureTapFailureEvidence(id);
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
  const scrollCandidates = getIdCandidates(scrollId);

  for (let index = 0; index < attempts; index += 1) {
    if (await isVisible(targetId, 500)) {
      return true;
    }

    let scrolled = false;
    for (let retry = 0; retry < 3; retry += 1) {
      for (const candidate of scrollCandidates) {
        try {
          await element(by.id(candidate)).scroll(amount, direction);
          scrolled = true;
          break;
        } catch (error) {
          if (!isDetoxConcurrencyError(error)) {
            continue;
          }
          if (retry >= 2) {
            throw error;
          }
          await sleep(220);
        }
      }

      if (scrolled) {
        break;
      }
    }

    if (!scrolled) {
      await sleep(220);
      continue;
    }

    await sleep(150);
  }

  const resolved = await resolveElementWithFallback(targetId, 4000);
  return Boolean(resolved);
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

const KEYPAD_KEY_GRID = {
  1: [0, 0], 2: [0, 1], 3: [0, 2],
  4: [1, 0], 5: [1, 1], 6: [1, 2],
  7: [2, 0], 8: [2, 1], 9: [2, 2],
  '.': [3, 0], 0: [3, 1],
};

const EVOLUCAO_PACKAGE = 'com.tipolt.evolucaofullv2';

function getAdbPrefix() {
  const serial = process.env.DETOX_ADB_NAME || '';
  return serial ? `adb -s ${serial}` : 'adb';
}

function ensureEvolucaoForegroundSync() {
  const prefix = getAdbPrefix();
  try {
    const out = execSync(`${prefix} shell dumpsys window`, {
      encoding: 'utf8',
      timeout: 8000,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (out.includes(EVOLUCAO_PACKAGE)) {
      return true;
    }
    execSync(
      `${prefix} shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p ${EVOLUCAO_PACKAGE}`,
      { stdio: 'pipe', timeout: 8000 },
    );
    execSync(`${prefix} shell sleep 0.6`, { stdio: 'pipe', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function readWorkoutInputValueFromXml(fieldId) {
  ensureEvolucaoForegroundSync();
  const xml = fetchUiXmlSnapshot(
    '/sdcard/reps_v7_field_read.xml',
    `reps_v7_field_read_${String(fieldId).replace(/[^a-z0-9_-]/gi, '_')}.xml`,
    2,
  );
  if (!xml) {
    return null;
  }
  const candidates = getIdCandidates(fieldId);
  for (const candidate of candidates) {
    const escaped = String(candidate).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const anchor = new RegExp(`resource-id="${escaped}"`, 'i');
    const idx = xml.search(anchor);
    if (idx < 0) {
      continue;
    }
    const slice = xml.slice(idx, idx + 1600);
    const nestedText = new RegExp(
      `resource-id="${escaped}"[\\s\\S]{0,1600}?text="([^"]+)"`,
      'i',
    ).exec(slice);
    if (nestedText?.[1]) {
      return nestedText[1];
    }
    const descMatch = /content-desc="([^"]*)"/.exec(slice);
    if (descMatch?.[1] && !['Kg', 'Reps', 'Km', 'Min', 'RPE'].includes(descMatch[1])) {
      return descMatch[1];
    }
    const textMatch = /text="([^"]*)"/.exec(slice);
    if (textMatch?.[1]) {
      return textMatch[1];
    }
  }
  if (!xml.includes(EVOLUCAO_PACKAGE)) {
    return null;
  }
  return null;
}

async function readWorkoutInputValue(fieldId) {
  return readWorkoutInputValueFromXml(fieldId);
}

function findInlineKeyCenterInXml(xml, label, minY = 1900, maxY1 = 9999) {
  const escaped = String(label).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(?:text|content-desc)="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
    'gi',
  );
  let best = null;
  let match = pattern.exec(xml);
  while (match) {
    const x1 = Number(match[1]);
    const y1 = Number(match[2]);
    const x2 = Number(match[3]);
    const y2 = Number(match[4]);
    const center = parseBoundsCenter(`[${match[1]},${match[2]}][${match[3]},${match[4]}]`);
    const height = y2 - y1;
    const width = x2 - x1;
    if (
      !isValidBoundsCenter(center)
      || y1 < minY
      || y1 > maxY1
      || height < 40
      || height > 140
      || width < 40
    ) {
      match = pattern.exec(xml);
      continue;
    }
    if (!best || y2 > best.y2) {
      best = { ...center, y2 };
    }
    match = pattern.exec(xml);
  }
  return best;
}

const INLINE_KEYPAD_Y = { digitMin: 1380, digitMax: 1930, footerMin: 1900 };

function findInlineKeypadAnchor(xml) {
  if (!xml) {
    return null;
  }
  const limparMatch = /text="Limpar"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(xml);
  if (limparMatch && Number(limparMatch[2]) >= INLINE_KEYPAD_Y.footerMin) {
    const center = parseBoundsCenter(
      `[${limparMatch[1]},${limparMatch[2]}][${limparMatch[3]},${limparMatch[4]}]`,
    );
    if (isValidBoundsCenter(center)) {
      return { x: center.x + 102, y: center.y - 42 };
    }
  }
  const okMatch = /text="OK"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(xml);
  if (okMatch && Number(okMatch[2]) >= INLINE_KEYPAD_Y.footerMin) {
    const center = parseBoundsCenter(
      `[${okMatch[1]},${okMatch[2]}][${okMatch[3]},${okMatch[4]}]`,
    );
    if (isValidBoundsCenter(center)) {
      return { x: center.x - 403, y: center.y - 42 };
    }
  }
  return findInlineKeyCenterInXml(xml, '2', INLINE_KEYPAD_Y.digitMin, INLINE_KEYPAD_Y.digitMax)
    || findInlineKeyCenterInXml(xml, '5', INLINE_KEYPAD_Y.digitMin, INLINE_KEYPAD_Y.digitMax);
}

function findAndTapInlineKey(char, minY = INLINE_KEYPAD_Y.digitMin, maxY1 = INLINE_KEYPAD_Y.digitMax) {
  const effectiveMinY = char === '0' ? 1750 : minY;
  const effectiveMaxY = maxY1;
  const xml = fetchUiXmlSnapshot('/sdcard/reps_v7_inline_key.xml', 'reps_v7_inline_key.xml', 2);
  if (!xml) {
    return false;
  }
  const center = findInlineKeyCenterInXml(xml, char, effectiveMinY, effectiveMaxY);
  if (!center) {
    return false;
  }
  logStep(`inline-keypad-dump:${char}@${center.x},${center.y}`);
  adbTap(center.x, center.y);
  return true;
}

function tapInlineKeyFromGridAnchor(char) {
  const xml = fetchUiXmlSnapshot('/sdcard/reps_v7_inline_key.xml', 'reps_v7_inline_key.xml', 2);
  if (!xml) {
    return false;
  }
  const anchor = findInlineKeyCenterInXml(xml, '2', 1900)
    || findInlineKeyCenterInXml(xml, '5', 1900)
    || findInlineKeyCenterInXml(xml, '8', 1900);
  if (!anchor) {
    return false;
  }
  const offsets = {
    '1': [-198, 0],
    '2': [0, 0],
    '3': [198, 0],
    '4': [-198, 75],
    '5': [0, 75],
    '6': [198, 75],
    '7': [-198, 150],
    '8': [0, 150],
    '9': [198, 150],
    '.': [-198, 225],
    '0': [0, 225],
    '⌫': [198, 225],
  };
  const off = offsets[char];
  if (!off) {
    return false;
  }
  const x = anchor.x + off[0];
  const y = Math.min(anchor.y + off[1], getAndroidScreenSize().height - 8);
  logStep(`inline-keypad-grid:${char}@${x},${y}`);
  adbTap(x, y);
  return true;
}

async function tryDetoxInlineDigitTap(char) {
  if (!hasDetoxGlobals()) {
    return false;
  }
  const minY = INLINE_KEYPAD_Y.digitMin;
  const maxY = INLINE_KEYPAD_Y.digitMax;
  for (let index = 0; index < 10; index += 1) {
    const matchers = [
      () => (index === 0 ? element(by.label(char)) : element(by.label(char)).atIndex(index)),
      () => (index === 0 ? element(by.text(char)) : element(by.text(char)).atIndex(index)),
    ];
    for (const getTarget of matchers) {
      try {
        const target = getTarget();
        await waitFor(target).toExist().withTimeout(700);
        const attrs = await target.getAttributes();
        const y = Number(attrs?.screenY ?? attrs?.y ?? 0);
        if (y < minY || y > maxY) {
          continue;
        }
        await target.tap();
        logStep(`inline-keypad-detox:${char}@${index} y=${y}`);
        return true;
      } catch {
        // tenta proximo matcher
      }
    }
  }
  return false;
}

function tapInlineZeroKey() {
  const xml = fetchUiXmlSnapshot('/sdcard/reps_v7_inline_key.xml', 'reps_v7_inline_key.xml', 2);
  if (xml) {
    const direct = findInlineKeyCenterInXml(xml, '0', 2050);
    if (direct) {
      logStep(`inline-keypad-dump:0@${direct.x},${direct.y}`);
      adbTap(direct.x, direct.y);
      return true;
    }
  }
  if (tapInlineKeyFromGridAnchor('0')) {
    return true;
  }
  const anchor = xml ? findInlineKeypadAnchor(xml) : null;
  if (anchor) {
    const y = Math.min(anchor.y + 125, getAndroidScreenSize().height - 12);
    logStep(`inline-keypad-zero-anchor:0@${anchor.x},${y}`);
    adbTap(anchor.x, y);
    return true;
  }
  return tapInlineDigitCoordFallback('0');
}

function tapCharOnInlineGrid(anchor, char) {
  const offsets = {
    '1': [-198, 0],
    '2': [0, 0],
    '3': [198, 0],
    '4': [-198, 75],
    '5': [0, 75],
    '6': [198, 75],
    '7': [-198, 150],
    '8': [0, 150],
    '9': [198, 150],
    '.': [-198, 225],
    '0': [0, 225],
    '⌫': [198, 225],
  };
  const off = offsets[char];
  if (!anchor || !off) {
    return false;
  }
  const x = anchor.x + off[0];
  const y = Math.min(anchor.y + off[1], getAndroidScreenSize().height - 8);
  logStep(`inline-keypad-grid:${char}@${x},${y}`);
  adbTap(x, y);
  return true;
}

async function tapInlineKeypadChar(char, gridAnchor = null) {
  if (char === '0') {
    await ensureInlineKeypadFullyVisible();
  }

  const digitOpts = { maxY: INLINE_KEYPAD_Y.digitMax };
  if (await tapDetoxLabelOrAdbCoords(char, INLINE_KEYPAD_Y.digitMin, digitOpts)) {
    return true;
  }
  if (findAndTapInlineKey(char)) {
    return true;
  }
  if (await tryDetoxInlineDigitTap(char)) {
    return true;
  }
  if (gridAnchor && tapCharOnInlineGrid(gridAnchor, char)) {
    return true;
  }

  return tapInlineDigitCoordFallback(char);
}

function getAndroidScreenSize() {
  const serial = process.env.DETOX_ADB_NAME || '';
  const adbArgs = serial ? ['-s', serial, 'shell', 'wm', 'size'] : ['shell', 'wm', 'size'];
  try {
    const output = execSync(`adb ${adbArgs.join(' ')}`, { encoding: 'utf8' });
    const match = String(output || '').match(/(\d+)x(\d+)/);
    if (match) {
      return { width: Number(match[1]), height: Number(match[2]) };
    }
  } catch {
    // fallback abaixo
  }
  return { width: 1080, height: 2340 };
}

function adbTap(x, y) {
  const prefix = getAdbPrefix();
  execSync(`${prefix} shell input tap ${Math.round(x)} ${Math.round(y)}`, { stdio: 'pipe' });
}

function parseBoundsCenter(boundsText) {
  const match = String(boundsText || '').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) {
    return null;
  }
  const x1 = Number(match[1]);
  const y1 = Number(match[2]);
  const x2 = Number(match[3]);
  const y2 = Number(match[4]);
  if (x2 <= x1 || y2 <= y1) {
    return null;
  }
  return {
    x: Math.round((x1 + x2) / 2),
    y: Math.round((y1 + y2) / 2),
    x1,
    y1,
    x2,
    y2,
  };
}

function isValidBoundsCenter(center) {
  return Boolean(center && center.x > 0 && center.y > 0 && center.x2 > center.x1 && center.y2 > center.y1);
}

function isUsableTapTarget(point) {
  if (!point || !Number(point.x) || !Number(point.y)) {
    return false;
  }
  if (Number(point.x2) > Number(point.x1) && Number(point.y2) > Number(point.y1)) {
    return isValidBoundsCenter(point);
  }
  return true;
}

function fetchUiXmlSnapshot(remoteName = '/sdcard/v7_keypad_ui.xml', localName = 'v7_keypad_ui.xml', retries = 3) {
  const prefix = getAdbPrefix();
  const local = path.join(ARTIFACTS_DIR, localName);
  ensureArtifactsDir();

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      execSync(`${prefix} shell uiautomator dump ${remoteName}`, { stdio: 'pipe' });
      let xml = '';
      try {
        xml = execSync(`${prefix} shell cat ${remoteName}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      } catch {
        execSync(`${prefix} pull ${remoteName} "${local}"`, { stdio: 'pipe' });
        xml = fs.readFileSync(local, 'utf8');
      }
      xml = String(xml || '').trim();
      if (xml.length > 200 && xml.includes('<hierarchy')) {
        fs.writeFileSync(local, xml, 'utf8');
        return xml;
      }
    } catch {
      // retry
    }
    if (attempt < retries) {
      execSync(`${prefix} shell sleep 0.4`, { stdio: 'pipe' });
    }
  }
  return '';
}

function inferKeypadOkFromDigitGrid(xml) {
  const pattern = /(?:text|content-desc)="([0-9]|\.|⌫)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/gi;
  let minY1 = Infinity;
  let match = pattern.exec(xml);
  while (match) {
    const y1 = Number(match[3]);
    const center = parseBoundsCenter(`[${match[2]},${match[3]}][${match[4]},${match[5]}]`);
    if (isValidBoundsCenter(center) && y1 < minY1 && y1 > 900) {
      minY1 = y1;
    }
    match = pattern.exec(xml);
  }
  if (minY1 === Infinity) {
    return null;
  }
  const { width } = getAndroidScreenSize();
  return {
    x: Math.round(width * 0.91),
    y: Math.round(minY1 - 88),
  };
}

function resolveKeypadConfirmBounds(xml) {
  const patterns = [
    /resource-id="[^"]*keypad-confirm"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/i,
    /content-desc="keypad-confirm"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/i,
    /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*resource-id="[^"]*keypad-confirm"/i,
    /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*content-desc="keypad-confirm"/i,
  ];

  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match) {
      const center = parseBoundsCenter(`[${match[1]},${match[2]}][${match[3]},${match[4]}]`);
      if (isValidBoundsCenter(center)) {
        return center;
      }
    }
  }

  const okPatterns = [
    /(?:text|content-desc)="OK"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/gi,
    /clickable="true"[^>]*(?:text|content-desc)="OK"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/gi,
  ];
  let okBest = null;
  for (const okPattern of okPatterns) {
    let okMatch = okPattern.exec(xml);
    while (okMatch) {
      const center = parseBoundsCenter(`[${okMatch[1]},${okMatch[2]}][${okMatch[3]},${okMatch[4]}]`);
      if (isValidBoundsCenter(center) && center.y > (okBest?.y || 0)) {
        okBest = center;
      }
      okMatch = okPattern.exec(xml);
    }
  }
  if (okBest) {
    return okBest;
  }

  return inferKeypadOkFromDigitGrid(xml);
}

function resolveBoundsFromXml(xml, fieldId) {
  const candidates = getIdCandidates(fieldId);
  for (const candidate of candidates) {
    const escaped = String(candidate).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp(`resource-id="[^"]*${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, 'i'),
      new RegExp(`content-desc="${escaped}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, 'i'),
      new RegExp(`bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*resource-id="[^"]*${escaped}"`, 'i'),
      new RegExp(`bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*content-desc="${escaped}"`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = String(xml || '').match(pattern);
      if (match) {
        const center = parseBoundsCenter(`[${match[1]},${match[2]}][${match[3]},${match[4]}]`);
        if (isValidBoundsCenter(center)) {
          return { id: candidate, center };
        }
      }
    }
  }

  return null;
}

function captureTapFailureEvidence(id) {
  const xml = fetchUiXmlSnapshot('/sdcard/v7_tap_fail.xml', `v7_tap_fail_${id}.xml`, 2);
  if (!xml) {
    return '';
  }

  const failPath = path.join(ARTIFACTS_DIR, `v7_tap_fail_${id}.xml`);
  fs.writeFileSync(failPath, xml, 'utf8');
  logStep(`tap-fail-evidence:${failPath}`);
  return xml;
}

async function tryTapViaXmlBounds(id) {
  const xml = fetchUiXmlSnapshot('/sdcard/v7_tap_bounds.xml', `v7_tap_bounds_${id}.xml`, 3);
  if (!xml) {
    return false;
  }

  const resolved = resolveBoundsFromXml(xml, id);
  if (resolved) {
    logStep(`tap-xml-bounds:${id}@${resolved.center.x},${resolved.center.y}`);
    adbTap(resolved.center.x, resolved.center.y);
    await sleep(280);
    return true;
  }

  if (id === 'btn-save-set' || id === 'btn-salvar-serie') {
    const salvarMatch = xml.match(/content-desc="Salvar serie"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/i);
    if (salvarMatch) {
      const center = parseBoundsCenter(`[${salvarMatch[1]},${salvarMatch[2]}][${salvarMatch[3]},${salvarMatch[4]}]`);
      if (isUsableTapTarget(center)) {
        logStep(`tap-xml-bounds:salvar-serie@${center.x},${center.y}`);
        adbTap(center.x, center.y);
        await sleep(400);
        return true;
      }
    }
  }

  return false;
}

async function tapSaveSetIfVisible() {
  await dismissInlineSetRowKeypad();
  await stabilizeAfterKeypadConfirm();
  await sleep(350);

  if (await isVisible('btn-save-set', 3000)) {
    try {
      await scrollToElement('screen-workout', 'btn-save-set', 'down', 220, 6);
    } catch {
      // segue
    }
    try {
      await waitFor(element(by.id('btn-save-set'))).toBeVisible().withTimeout(2500);
      try {
        await element(by.id('btn-save-set')).tap();
        logStep('save-set:detox');
      } catch {
        await element(by.label('Salvar serie')).tap();
        logStep('save-set:label');
      }
      await sleep(900);
      return true;
    } catch {
      await tapElement('btn-save-set');
      logStep('save-set:detox-fallback');
      await sleep(900);
      return true;
    }
  }

  if (await tryTapViaXmlBounds('btn-save-set')) {
    logStep('save-set:xml');
    await sleep(900);
    return true;
  }

  if (hasDetoxGlobals()) {
    try {
      await element(by.text('Salvar serie')).tap();
      logStep('save-set:text');
      await sleep(900);
      return true;
    } catch {
      // segue
    }
  }

  return false;
}

function xmlShowsGuidedSetSaved(xml, weight, reps) {
  if (!xml) {
    return false;
  }
  if (xml.includes('resource-id="serie-salva-indicator"')) {
    return true;
  }
  if (/TREINO: [1-9][0-9]*\/11/.test(xml)) {
    return true;
  }
  if (/>Salva</.test(xml) || /text="Salva"/.test(xml)) {
    return true;
  }
  if (xml.includes('text="&#10004;"')) {
    return true;
  }
  return false;
}

async function assertGuidedSetSaved(weight, reps, timeout = 20000) {
  if (!hasDetoxGlobals()) {
    throw new Error('Detox globals indisponiveis durante assertGuidedSetSaved.');
  }

  const savedText = `${weight}kg x ${reps}`;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    try {
      await waitFor(element(by.id('serie-salva-indicator'))).toBeVisible().withTimeout(900);
      logStep('guided-set-saved:serie-salva-indicator');
      return;
    } catch {
      // segue
    }

    try {
      await waitFor(element(by.text('Salva'))).toBeVisible().withTimeout(700);
      logStep('guided-set-saved:status-salva');
      return;
    } catch {
      // segue
    }

    const xml = fetchUiXmlSnapshot('/sdcard/v7_saved_row.xml', 'v7_saved_row.xml', 1);
    if (xmlShowsGuidedSetSaved(xml, weight, reps)) {
      logStep(`guided-set-saved:row-status:${savedText}`);
      return;
    }

    await sleep(220);
  }

  throw new Error(`guided-set-not-saved:${savedText}`);
}

async function waitKeypadClosed(timeout = 8000) {
  if (!hasDetoxGlobals()) {
    await sleep(320);
    return true;
  }

  if (isAttachedRun()) {
    await sleep(400);
    logStep('keypad-closed-ok');
    return true;
  }

  try {
    await waitFor(element(by.id('keypad-modal'))).not.toExist().withTimeout(timeout);
    logStep('keypad-closed-ok');
    return true;
  } catch {
    // segue
  }

  try {
    await waitFor(element(by.id('keypad-hidden-input'))).not.toExist().withTimeout(Math.min(timeout, 4000));
    logStep('keypad-closed-ok');
    return true;
  } catch {
    logStep('keypad-closed-timeout');
    await sleep(320);
    return false;
  }
}

async function stabilizeAfterKeypadConfirm() {
  await waitKeypadClosed(8000);
  await dismissWorkoutFeedbackDialog();

  if (hasDetoxGlobals()) {
    if (isAttachedRun()) {
      logStep('screen-workout-stable-ok');
    } else {
      try {
        await waitFor(element(by.id('screen-workout'))).toBeVisible().withTimeout(4000);
        logStep('screen-workout-stable-ok');
      } catch {
        logStep('screen-workout-stable-timeout');
      }
    }
  }

  await sleep(320);
  await dismissWorkoutFeedbackDialog();
}

async function waitForGuidedFieldReady(fieldId, timeout = 8000) {
  await stabilizeAfterKeypadConfirm();

  if (await isVisible(fieldId, Math.min(3000, timeout))) {
    logStep(`guided-field-ready:${fieldId}`);
    return;
  }

  await scrollToElement('screen-workout', fieldId, 'down', 360, 8);

  if (await isVisible(fieldId, Math.min(3000, timeout))) {
    logStep(`guided-field-ready-scroll:${fieldId}`);
    return;
  }

  const xml = fetchUiXmlSnapshot('/sdcard/v7_field_ready.xml', `v7_field_ready_${fieldId}.xml`, 3);
  const resolved = xml ? resolveBoundsFromXml(xml, fieldId) : null;
  if (resolved) {
    logStep(`guided-field-bounds:${fieldId}@${resolved.center.x},${resolved.center.y}`);
    return;
  }

  const failPath = path.join(ARTIFACTS_DIR, `v7_field_missing_${fieldId}.xml`);
  if (xml) {
    fs.writeFileSync(failPath, xml, 'utf8');
  } else {
    fs.writeFileSync(failPath, '<!-- uiautomator dump unavailable -->', 'utf8');
  }

  throw new Error(`guided-field-not-ready:${fieldId} artefato=${failPath}`);
}

async function fillKeypadHiddenInput(value) {
  if (!hasDetoxGlobals()) {
    return false;
  }

  const target = element(by.id('keypad-hidden-input'));
  try {
    await waitFor(target).toExist().withTimeout(12000);
  } catch {
    return false;
  }

  try {
    await target.tap();
    await sleep(200);
    await target.replaceText(String(value || ''));
    await sleep(120);
    return true;
  } catch {
    try {
      await target.clearText();
      await sleep(80);
      await target.typeText(String(value || ''));
      return true;
    } catch {
      return false;
    }
  }
}

async function confirmKeypad() {
  if (hasDetoxGlobals()) {
    if (await waitForInlineSetRowKeypadOpen(600)) {
      try {
        await element(by.label('OK')).tap();
        logStep('keypad-confirm-inline-detox-label');
        await waitKeypadClosed(8000);
        return;
      } catch {
        try {
          await element(by.text('OK')).atIndex(0).tap();
          logStep('keypad-confirm-inline-detox-text');
          await waitKeypadClosed(8000);
          return;
        } catch {
          // segue para dump
        }
      }
    }

    try {
      await waitFor(element(by.id('keypad-modal'))).toExist().withTimeout(4000);
      await waitFor(element(by.id('keypad-confirm'))).toExist().withTimeout(4000);
      await element(by.id('keypad-confirm')).tap();
      logStep('keypad-confirm-detox');
      await waitKeypadClosed(8000);
      return;
    } catch {
      // segue para dump
    }
    try {
      await element(by.label('keypad-confirm')).tap();
      logStep('keypad-confirm-label');
      await waitKeypadClosed(8000);
      return;
    } catch {
      // segue para dump
    }
  }

  const xml = fetchUiXmlSnapshot('/sdcard/v7_keypad_ok.xml', 'v7_keypad_ok.xml', 3);
  const okBest = xml ? resolveKeypadConfirmBounds(xml) : null;
  if (isUsableTapTarget(okBest)) {
    logStep(`keypad-confirm-dump@${okBest.x},${okBest.y}`);
    adbTap(okBest.x, okBest.y);
    await waitKeypadClosed(8000);
    return;
  }

  if (hasDetoxGlobals()) {
    try {
      const frame = await element(by.id('keypad-modal')).getAttributes();
      const width = Number(frame?.width || 0);
      const height = Number(frame?.height || 0);
      const originX = Number(frame?.screenX ?? frame?.x ?? 0);
      const originY = Number(frame?.screenY ?? frame?.y ?? 0);
      if (width && height) {
        const x = originX + width * 0.88;
        const y = originY + height * 0.12;
        logStep(`keypad-confirm-frame@${Math.round(x)},${Math.round(y)}`);
        adbTap(x, y);
        await waitKeypadClosed(8000);
        return;
      }
    } catch {
      // segue
    }

    try {
      await waitFor(element(by.id('keypad-modal'))).toExist().withTimeout(2000);
      await element(by.text('OK')).atIndex(0).tap();
      logStep('keypad-confirm-text-ok-scoped');
      await waitKeypadClosed(8000);
      return;
    } catch {
      // segue
    }
  }

  const confirmXml = fetchUiXmlSnapshot('/sdcard/v7_keypad_confirm_fb.xml', 'v7_keypad_confirm_fb.xml', 2);
  const gridOk = confirmXml ? resolveKeypadConfirmBounds(confirmXml) : null;
  if (isUsableTapTarget(gridOk)) {
    logStep(`keypad-confirm-grid-fallback@${gridOk.x},${gridOk.y}`);
    adbTap(gridOk.x, gridOk.y);
    await waitKeypadClosed(8000);
    return;
  }

  const { width } = getAndroidScreenSize();
  const x = width * 0.91;
  const y = 1653;
  logStep(`keypad-confirm-coord-fallback@${Math.round(x)},${Math.round(y)}`);
  adbTap(x, y);
  await waitKeypadClosed(8000);
}

function tapKeyFromUiDump(char) {
  const xml = fetchUiXmlSnapshot('/sdcard/v7_keypad_dump.xml', 'v7_keypad_dump.xml', 2);
  if (!xml) {
    return false;
  }
  const label = char === '.' ? '.' : String(char);
  const pattern = new RegExp(`(?:text|content-desc)="${label.replace('.', '\\.')}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`, 'gi');
  let best = null;
  let match = pattern.exec(xml);
  while (match) {
    const y1 = Number(match[2]);
    const y2 = Number(match[4]);
    const center = parseBoundsCenter(`[${match[1]},${match[2]}][${match[3]},${match[4]}]`);
    if (
      isValidBoundsCenter(center)
      && y1 >= INLINE_KEYPAD_Y.digitMin
      && y1 <= INLINE_KEYPAD_Y.digitMax + 160
      && (!best || y2 > best.y2)
    ) {
      best = { ...center, y2 };
    }
    match = pattern.exec(xml);
  }
  if (!best) {
    return false;
  }
  logStep(`keypad-dump:${char}@${best.x},${best.y}`);
  adbTap(best.x, best.y);
  return true;
}

async function tapKeypadDigit(char) {
  const digitTestId = char === '.' ? 'keypad-digit-dot' : `keypad-digit-${char}`;
  // Attached runs: Espresso digit taps often hang; prefer adb/XML fallbacks.
  if (!isAttachedRun() && hasDetoxGlobals()) {
    try {
      await waitFor(element(by.id('keypad-modal'))).toExist().withTimeout(4000);
    } catch {
      // segue para fallbacks
    }
    try {
      await element(by.id(digitTestId)).tap();
      return;
    } catch {
      // segue
    }
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    if (tapKeyFromUiDump(char)) {
      return;
    }
    await sleep(280);
  }

  const pos = KEYPAD_KEY_GRID[char];
  if (!pos) {
    throw new Error(`tecla ${char} nao suportada no keypad`);
  }
  const [row, col] = pos;

  if (hasDetoxGlobals()) {
    try {
      const frame = await element(by.id('keypad-modal')).getAttributes();
      const width = Number(frame?.width || 0);
      const height = Number(frame?.height || 0);
      const originX = Number(frame?.screenX ?? frame?.x ?? 0);
      const originY = Number(frame?.screenY ?? frame?.y ?? 0);
      if (width && height) {
        const headerOffset = Math.min(96, height * 0.22);
        const gridHeight = height - headerOffset;
        const cellW = width / 3;
        const cellH = gridHeight / 4;
        const x = originX + cellW * (col + 0.5);
        const y = originY + headerOffset + cellH * (row + 0.5);
        adbTap(x, y);
        return;
      }
    } catch {
      // fallback por tamanho da tela
    }
  }

  const { width, height } = getAndroidScreenSize();
  const keypadTop = height * 0.58;
  const gridHeight = height * 0.36;
  const cellW = width / 3;
  const cellH = gridHeight / 4;
  const x = cellW * (col + 0.5);
  const y = keypadTop + cellH * (row + 0.5);
  logStep(`keypad-coord:${char}@${Math.round(x)},${Math.round(y)}`);
  adbTap(x, y);
}

async function clearKeypadValue() {
  if (hasDetoxGlobals()) {
    try {
      const target = element(by.id('keypad-hidden-input'));
      await waitFor(target).toExist().withTimeout(2500);
      await target.tap();
      await sleep(80);
      await target.replaceText('');
      logStep('keypad-clear-hidden-input');
      return;
    } catch {
      // segue para backspace via dump
    }
  }

  let cleared = 0;
  for (let i = 0; i < 15; i += 1) {
    if (!tapKeyFromUiDump('⌫')) {
      break;
    }
    cleared += 1;
    await sleep(80);
  }
  if (cleared > 0) {
    logStep(`keypad-clear-backspace:${cleared}`);
  }
}

async function fillKeypadViaDigits(rawValue) {
  await clearKeypadValue();
  await sleep(150);
  for (const char of String(rawValue || '').split('')) {
    await tapKeypadDigit(char);
    await sleep(150);
  }
  await confirmKeypad();
  await sleep(320);
}

async function fillKeypadAfterFieldOpen(fieldId, value) {
  if (hasDetoxGlobals()) {
    try {
      await waitFor(element(by.id('keypad-modal'))).toExist().withTimeout(8000);
    } catch {
      logStep(`keypad-modal-missing-after-${fieldId}`);
    }
  }

  const hiddenFilled = await fillKeypadHiddenInput(value);
  if (hiddenFilled) {
    await confirmKeypad();
    await stabilizeAfterKeypadConfirm();
    logStep(`keypad-hidden-input-ok:${fieldId}`);
    return;
  }

  logStep(`keypad-hidden-input-unavailable:${fieldId}`);

  let keypadReady = isAttachedRun();
  if (!keypadReady) {
    for (const probeId of ['keypad-confirm', 'keypad-modal', 'keypad-value']) {
      if (await isVisible(probeId, 1800)) {
        keypadReady = true;
        break;
      }
    }
  }

  if (!keypadReady) {
    try {
      await waitFor(element(by.text('OK'))).toExist().withTimeout(4000);
      keypadReady = true;
    } catch {
      logStep(`keypad-not-open-after-${fieldId}`);
      throw new Error(`keypad nao abriu apos tocar ${fieldId}`);
    }
  }

  await fillKeypadViaDigits(value);
  await stabilizeAfterKeypadConfirm();
}

async function waitForInlineSetRowKeypadOpen(timeout = 8000) {
  if (!hasDetoxGlobals()) {
    return false;
  }
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const xml = fetchUiXmlSnapshot('/sdcard/reps_v7_inline_probe.xml', 'reps_v7_inline_probe.xml', 1);
    if (xml) {
      const digit2 = /content-desc="2"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(xml);
      if (digit2 && Number(digit2[2]) >= 2100) {
        return true;
      }
      if (xml.includes('text="Limpar"') && /text="Limpar"[^>]*bounds="\[(\d+),(\d+)/.test(xml)) {
        const limpar = /text="Limpar"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(xml);
        if (limpar && Number(limpar[2]) >= 2000) {
          return true;
        }
      }
    }
    await sleep(250);
  }
  return false;
}

async function ensureInlineKeypadFullyVisible() {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const xml = fetchUiXmlSnapshot('/sdcard/reps_v7_inline_probe.xml', 'reps_v7_inline_probe.xml', 1);
    if (xml && (xml.includes('text="Limpar"') || /content-desc="0"[^>]*bounds="\[(\d+),(\d+)/.test(xml))) {
      const zeroMatch = /content-desc="0"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(xml || '');
      if (zeroMatch && Number(zeroMatch[2]) >= 1900) {
        return true;
      }
      if (xml.includes('text="Limpar"')) {
        return true;
      }
    }
    try {
      await element(by.id('screen-workout')).scroll(180, 'down');
    } catch {
      try {
        await element(by.id('workout-exercise-list-simple')).scroll(180, 'down');
      } catch {
        // segue
      }
    }
    await sleep(350);
  }
  return false;
}

function tapViaXmlLabel(label, minY = 1900, options = {}) {
  const { minX = 0, maxX = 9999, maxY = 9999, requireClickable = false } = options;
  const xml = fetchUiXmlSnapshot('/sdcard/reps_v7_inline_key.xml', 'reps_v7_inline_key.xml', 2);
  if (!xml) {
    return false;
  }
  const needleA = `content-desc="${label}"`;
  const needleB = `text="${label}"`;
  const nodePattern = /<node[^>]*\/?>/gi;
  let match = nodePattern.exec(xml);
  let best = null;
  while (match) {
    const node = match[0];
    if (!node.includes(needleA) && !node.includes(needleB)) {
      match = nodePattern.exec(xml);
      continue;
    }
    const boundsMatch = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node);
    if (!boundsMatch) {
      match = nodePattern.exec(xml);
      continue;
    }
    const x1 = Number(boundsMatch[1]);
    const y1 = Number(boundsMatch[2]);
    const x2 = Number(boundsMatch[3]);
    const y2 = Number(boundsMatch[4]);
    if (y2 <= y1 || y2 - y1 < 8) {
      match = nodePattern.exec(xml);
      continue;
    }
    const center = parseBoundsCenter(`[${boundsMatch[1]},${boundsMatch[2]}][${boundsMatch[3]},${boundsMatch[4]}]`);
    if (
      isValidBoundsCenter(center)
      && y1 >= minY
      && y1 <= maxY
      && center.x >= minX
      && center.x <= maxX
      && (!requireClickable || node.includes('clickable="true"'))
      && (!best || y1 > best.y1)
    ) {
      best = { ...center, y1 };
    }
    match = nodePattern.exec(xml);
  }
  if (!best) {
    return false;
  }
  logStep(`inline-keypad-xml:${label}@${best.x},${best.y}`);
  adbTap(best.x, best.y);
  return true;
}

async function tapDetoxLabelOrAdbCoords(label, minY = 1750, options = {}) {
  if (!hasDetoxGlobals()) {
    return tapViaXmlLabel(label, minY, options);
  }

  const maxY = Number(options.maxY || 9999);
  const minX = Number(options.minX || 0);
  const maxX = Number(options.maxX || 9999);

  for (let index = 0; index < 8; index += 1) {
    const matchers = [
      () => (index === 0 ? element(by.label(label)) : element(by.label(label)).atIndex(index)),
      () => (index === 0 ? element(by.text(label)) : element(by.text(label)).atIndex(index)),
    ];
    for (const getTarget of matchers) {
      try {
        const target = getTarget();
        await waitFor(target).toExist().withTimeout(1200);
        const attrs = await target.getAttributes();
        const originY = Number(attrs?.screenY ?? attrs?.y ?? 0);
        const originX = Number(attrs?.screenX ?? attrs?.x ?? 0);
        const width = Number(attrs?.width ?? 0);
        const height = Number(attrs?.height ?? 0);
        const centerX = originX + width / 2;
        if (
          originY < minY
          || originY > maxY
          || width <= 0
          || height <= 0
          || centerX < minX
          || centerX > maxX
        ) {
          continue;
        }
        try {
          await target.tap();
          logStep(`inline-keypad-detox:${label}@${index}`);
          return true;
        } catch {
          const x = Math.round(centerX);
          const y = Math.round(originY + height / 2);
          if (y >= minY && y <= maxY) {
            logStep(`inline-keypad-adb:${label}@${x},${y}`);
            adbTap(x, y);
            return true;
          }
        }
      } catch {
        // tenta proximo matcher
      }
    }
  }

  return tapViaXmlLabel(label, minY, options);
}

const INLINE_KEYPAD_COORDS = {
  Limpar: { x: 345, y: 2000 },
  OK: { x: 735, y: 2000 },
  '1': { x: 249, y: 1493 },
  '2': { x: 447, y: 1493 },
  '3': { x: 645, y: 1493 },
  '4': { x: 249, y: 1619 },
  '5': { x: 447, y: 1619 },
  '6': { x: 645, y: 1619 },
  '7': { x: 249, y: 1745 },
  '8': { x: 447, y: 1745 },
  '9': { x: 645, y: 1745 },
  '.': { x: 249, y: 1871 },
  '0': { x: 447, y: 1871 },
  '⌫': { x: 645, y: 1871 },
};

function tapInlineDigitCoordFallback(char) {
  const pos = INLINE_KEYPAD_COORDS[char];
  if (!pos) {
    return false;
  }
  const { height } = getAndroidScreenSize();
  const y = Math.min(pos.y, height - 8);
  logStep(`inline-keypad-coord:${char}@${pos.x},${y}`);
  adbTap(pos.x, y);
  return true;
}

async function dismissInlineSetRowKeypad() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (!(await waitForInlineSetRowKeypadOpen(700))) {
      logStep('inline-keypad-dismissed:closed');
      return true;
    }
    const footerOpts = { minX: 500, maxY: 9999 };
    let dismissed = false;
    if (hasDetoxGlobals()) {
      try {
        await element(by.label('OK')).tap();
        dismissed = true;
        logStep('inline-keypad-detox-dismiss:OK');
      } catch {
        try {
          await element(by.text('OK')).atIndex(0).tap();
          dismissed = true;
          logStep('inline-keypad-detox-dismiss:OK-text');
        } catch {
          // segue
        }
      }
    }
    if (!dismissed) {
      dismissed = await tapInlineFooterButton('OK');
    }
    await sleep(450);
  }
  const stillOpen = await waitForInlineSetRowKeypadOpen(600);
  if (stillOpen) {
    logStep('inline-keypad-dismissed:still-open');
  }
  return !stillOpen;
}

async function tapInlineFooterButton(label) {
  const footerOpts = label === 'OK' ? { minX: 500 } : { minX: 0 };
  if (await tapDetoxLabelOrAdbCoords(label, INLINE_KEYPAD_Y.footerMin, footerOpts)) {
    return true;
  }
  if (tapViaXmlLabel(label, INLINE_KEYPAD_Y.footerMin, footerOpts)) {
    return true;
  }
  return tapInlineDigitCoordFallback(label);
}

async function fillInlineSetRowKeypad(value, skipClear = false) {
  if (!hasDetoxGlobals()) {
    return { ok: false, method: 'no-detox' };
  }

  if (!(await waitForInlineSetRowKeypadOpen(5000))) {
    return { ok: false, method: 'inline-keypad-not-open' };
  }

  try {
    if (!skipClear) {
      await ensureInlineKeypadFullyVisible();
      tapInlineDigitCoordFallback('Limpar')
        || tapViaXmlLabel('Limpar', INLINE_KEYPAD_Y.footerMin)
        || (await tapDetoxLabelOrAdbCoords('Limpar', INLINE_KEYPAD_Y.footerMin));
      for (let i = 0; i < 12; i += 1) {
        tapKeyFromUiDump('⌫')
          || tapViaXmlLabel('⌫', 1750, {
            minX: 520,
            maxY: INLINE_KEYPAD_Y.digitMax + 150,
            requireClickable: true,
          })
          || tapInlineDigitCoordFallback('⌫');
        await sleep(80);
      }
      logStep('inline-keypad-cleared:backspace-loop');
      await sleep(300);
    }

    if (String(value || '').includes('0')) {
      await ensureInlineKeypadFullyVisible();
    }

    for (const char of String(value || '').split('')) {
      if (char === '0') {
        await ensureInlineKeypadFullyVisible();
      }
      await tapKeypadDigit(char);
      await sleep(150);
    }

    await confirmKeypad();
    await stabilizeAfterKeypadConfirm();
    return { ok: true, method: 'inline-keypad-via-digits' };
  } catch (fillError) {
    return { ok: false, method: String(fillError?.message || fillError) };
  }
}

async function waitForKeypadOpen(timeout = 12000) {
  if (!hasDetoxGlobals()) {
    return false;
  }

  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      await waitFor(element(by.id('keypad-modal'))).toExist().withTimeout(600);
      return true;
    } catch {
      try {
        await waitFor(element(by.id('keypad-hidden-input'))).toExist().withTimeout(600);
        return true;
      } catch {
        await sleep(200);
      }
    }
  }

  return false;
}

async function tapKeypadFieldOpen(fieldId, useXmlTap = false, timeout = 12000) {
  if (useXmlTap) {
    try {
      await tapElement(fieldId, timeout);
      return;
    } catch {
      // segue para XML bounds
    }
    let tapped = await tryTapViaXmlBounds(fieldId);
    if (!tapped) {
      await tryScrollToTarget(fieldId);
      await scrollToElement('screen-workout', fieldId, 'down', 360, 8);
      tapped = await tryTapViaXmlBounds(fieldId);
    }
    if (!tapped) {
      await tapElement(fieldId, timeout);
    }
    return;
  }

  try {
    await tapElement(fieldId, timeout);
  } catch {
    await tryTapViaXmlBounds(fieldId);
  }
}

async function openKeypadField(fieldId, useXmlTap = false, timeout = 12000) {
  if (hasDetoxGlobals()) {
    try {
      await device.launchApp({ newInstance: false });
      await sleep(350);
    } catch {
      ensureEvolucaoForegroundSync();
      await sleep(350);
    }
  } else {
    ensureEvolucaoForegroundSync();
    await sleep(350);
  }

  for (let tapAttempt = 1; tapAttempt <= 2; tapAttempt += 1) {
    await tapKeypadFieldOpen(fieldId, useXmlTap, timeout);
    await sleep(900);
    if (await waitForInlineSetRowKeypadOpen(3000)) {
      logStep(`inline-keypad-opened:${fieldId} tap=${tapAttempt}`);
      return;
    }
    logStep(`keypad-open-retry:${fieldId} tap=${tapAttempt}`);
  }
}

async function fillKeypadHiddenInputStrict(value) {
  if (!hasDetoxGlobals()) {
    return { ok: false, method: 'no-detox' };
  }

  await waitForKeypadOpen(12000);

  const selectors = [
    () => element(by.id('keypad-hidden-input')),
    () => element(by.label('keypad-hidden-input')),
  ];

  for (const getTarget of selectors) {
    try {
      const target = getTarget();
      await waitFor(target).toExist().withTimeout(8000);
      await target.tap();
      await sleep(200);
      try {
        await target.clearText();
        await sleep(80);
      } catch {
        // segue
      }
      try {
        await target.replaceText(String(value || ''));
        await sleep(120);
        return { ok: true, method: 'keypad-hidden-input-replaceText' };
      } catch {
        await target.clearText();
        await sleep(80);
        await target.typeText(String(value || ''));
        return { ok: true, method: 'keypad-hidden-input-typeText' };
      }
    } catch {
      // tenta proximo seletor
    }
  }

  return { ok: false, method: 'keypad-hidden-input-unavailable' };
}

async function clearKeypadViaDetoxBackspace(max = 12) {
  if (!hasDetoxGlobals()) {
    return 0;
  }

  let cleared = 0;
  for (let i = 0; i < max; i += 1) {
    try {
      await element(by.id('keypad-backspace')).tap();
      cleared += 1;
      await sleep(80);
    } catch {
      break;
    }
  }

  if (cleared > 0) {
    logStep(`keypad-clear-detox-backspace:${cleared}`);
  }
  return cleared;
}

async function fillKeypadViaDetoxDigits(value) {
  if (!hasDetoxGlobals()) {
    return false;
  }

  try {
    await waitFor(element(by.id('keypad-modal'))).toExist().withTimeout(3000);
  } catch {
    try {
      await waitFor(element(by.id('keypad-backspace'))).toExist().withTimeout(2000);
    } catch {
      return false;
    }
  }

  await clearKeypadViaDetoxBackspace(12);
  await sleep(150);

  for (const char of String(value || '').split('')) {
    const digitTestId = char === '.' ? 'keypad-digit-dot' : `keypad-digit-${char}`;
    try {
      await element(by.id(digitTestId)).tap();
      await sleep(120);
    } catch {
      logStep(`detox-digit-fail:${char}`);
      return false;
    }
  }

  await confirmKeypad();
  await sleep(320);
  return true;
}

async function setKeypadValueStrict(fieldId, expectedValue, options = {}) {
  const {
    useXmlTap = false,
    maxRetries = 2,
    xmlVerifyFn = null,
    forceRefill = false,
  } = options;

  const verify = async () => {
    if (typeof xmlVerifyFn === 'function') {
      await sleep(400);
      return await xmlVerifyFn(fieldId);
    }
    return await readWorkoutInputValue(fieldId);
  };

  let lastMethod = 'none';
  let lastFound = null;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    logStep(`setKeypadValueStrict:${fieldId}=${expectedValue} attempt=${attempt}`);

    lastFound = await verify();
    if (!forceRefill && lastFound === expectedValue) {
      await dismissInlineSetRowKeypad();
      return {
        ok: true,
        note: `already-${expectedValue} attempt ${attempt}`,
        method: 'already-set',
        found: lastFound,
      };
    }

    await openKeypadField(fieldId, useXmlTap);
    lastFound = await verify();
    if (!forceRefill && lastFound === expectedValue) {
      await dismissInlineSetRowKeypad();
      return {
        ok: true,
        note: `already-${expectedValue} attempt ${attempt}`,
        method: 'already-set',
        found: lastFound,
      };
    }
    const skipClear = false;
    const inlineResult = await fillInlineSetRowKeypad(expectedValue, skipClear);
    if (inlineResult.ok) {
      lastMethod = inlineResult.method;
      lastFound = await verify();
      if (lastFound === expectedValue) {
        return {
          ok: true,
          note: `${lastMethod} attempt ${attempt}`,
          method: lastMethod,
          found: lastFound,
        };
      }
      logStep(`inline-verify-miss:${fieldId} expected=${expectedValue} found=${lastFound}`);
    } else {
      lastMethod = inlineResult.method;
      logStep(`inline-fill-fail:${inlineResult.method}`);
    }

    lastFound = await verify();
    logStep(
      `setKeypadValueStrict: field=${fieldId} expected=${expectedValue} found=${lastFound} method=${lastMethod}`,
    );
  }

  return {
    ok: false,
    note: `setKeypadValueStrict: field=${fieldId} expected=${expectedValue} found=${lastFound} method=${lastMethod}`,
    method: lastMethod,
    found: lastFound,
  };
}

async function fillWorkoutKeypadFieldViaXmlTap(fieldId, value, timeout = 12000) {
  let tapped = await tryTapViaXmlBounds(fieldId);
  if (!tapped) {
    await tryScrollToTarget(fieldId);
    await scrollToElement('screen-workout', fieldId, 'down', 360, 8);
    tapped = await tryTapViaXmlBounds(fieldId);
  }
  if (!tapped) {
    await tapElement(fieldId, timeout);
  }
  await sleep(900);
  await fillKeypadAfterFieldOpen(fieldId, value);
}

async function fillWorkoutKeypadField(fieldId, value, timeout = 12000) {
  if (!(await isVisible(fieldId, 3000))) {
    await tryScrollToTarget(fieldId);
    await scrollToElement('screen-workout', fieldId, 'down', 360, 8);
  }

  await tapElement(fieldId, timeout);
  await sleep(900);
  await fillKeypadAfterFieldOpen(fieldId, value);
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
  assertGuidedSetSaved,
  DEFAULT_CLIENT_ID,
  countBugEntries,
  countBugOccurrences,
  countEventEntries,
  dismissBlockingSystemDialogs,
  dismissInlineSetRowKeypad,
  dismissWorkoutFeedbackDialog,
  fetchHeatmap,
  fillWorkoutKeypadField,
  fillWorkoutKeypadFieldViaXmlTap,
  hideKeyboardIfNeeded,
  humanDelay,
  isVisible,
  logStep,
  readJsonArtifact,
  readWorkoutInputValue,
  readWorkoutInputValueFromXml,
  resetArtifacts,
  replaceInput,
  scrollToElement,
  setKeypadValueStrict,
  sleep,
  slugify,
  stabilizeAfterKeypadConfirm,
  tapElement,
  tapSaveSetIfVisible,
  tryTapViaXmlBounds,
  waitForAny,
  waitForCountIncrease,
  waitForGuidedFieldReady,
};
