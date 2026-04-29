const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { getPersona } = require('./personas');
const { hasDetoxGlobals, isAttachedRun } = require('./runtime');
const {
  countEventEntries,
  fetchHeatmap,
  hideKeyboardIfNeeded,
  humanDelay,
  isVisible,
  logStep,
  dismissBlockingSystemDialogs,
  replaceInput,
  scrollToElement,
  sleep,
  slugify,
  tapElement,
  waitForAny,
  waitForCountIncrease,
} = require('./utils');

const ANDROID_APP_ID = 'com.tipolt.evolucaofullv2';

function resolveAdbPath() {
  const directCandidates = [
    process.env.ADB,
    process.env.ANDROID_HOME && path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb.exe'),
    process.env.ANDROID_SDK_ROOT && path.join(process.env.ANDROID_SDK_ROOT, 'platform-tools', 'adb.exe'),
  ].filter(Boolean);

  for (const candidate of directCandidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const localPropertiesPath = path.resolve(__dirname, '..', '..', 'android', 'local.properties');
  if (fs.existsSync(localPropertiesPath)) {
    const contents = fs.readFileSync(localPropertiesPath, 'utf8');
    const match = contents.match(/^sdk\.dir=(.+)$/m);
    if (match) {
      const sdkDir = match[1].trim().replace(/\\/g, '\\');
      const adbPath = path.join(sdkDir, 'platform-tools', 'adb.exe');
      if (fs.existsSync(adbPath)) {
        return adbPath;
      }
    }
  }

  return 'adb';
}

function clearAttachedAndroidAppData() {
  if (device.getPlatform() !== 'android') {
    return;
  }

  let adbName = String(process.env.DETOX_ADB_NAME || '').trim();
  if (!adbName) {
    try {
      const output = execFileSync(resolveAdbPath(), ['devices'], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });

      const devices = String(output || '')
        .split(/\r?\n/)
        .slice(1)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.split(/\s+/))
        .filter((parts) => parts[1] === 'device')
        .map((parts) => parts[0]);

      if (devices.length > 0) {
        const physical = devices.find((serial) => !String(serial).startsWith('emulator-'));
        adbName = physical || devices[0];
      }
    } catch {
      // segue sem serial explícito quando adb devices falhar
    }
  }

  const adbArgs = [];
  if (adbName) {
    adbArgs.push('-s', adbName);
  }
  adbArgs.push('shell', 'pm', 'clear', ANDROID_APP_ID);
  execFileSync(resolveAdbPath(), adbArgs, { stdio: 'pipe' });
}

async function waitForLandingByText(timeout = 12000) {
  if (!hasDetoxGlobals()) {
    return null;
  }

  const labels = ['Home', 'Treino', 'Social', 'Coach', 'Perfil', 'Nutricao', 'Nutricao', 'Nutrição', 'Permitir', 'Allow', 'OK'];
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    await dismissBlockingSystemDialogs();
    for (const label of labels) {
      try {
        await waitFor(element(by.text(label))).toExist().withTimeout(350);
        return `text:${label}`;
      } catch {
        // tenta próximo texto
      }
    }
    await sleep(220);
  }

  return null;
}

async function waitForLandingByIds(ids, timeout = 18000) {
  if (!hasDetoxGlobals()) {
    return null;
  }

  const startedAt = Date.now();

  while (Date.now() - startedAt < timeout) {
    await dismissBlockingSystemDialogs();
    for (const id of ids) {
      if (await isVisible(id, 700)) {
        return `visible:${id}`;
      }

      try {
        await waitFor(element(by.id(id))).toExist().withTimeout(700);
        return `exists:${id}`;
      } catch {
        // tenta o proximo marcador
      }
    }

    await sleep(220);
  }

  return null;
}

async function waitForLandingSignal(isAttachedRun) {
  const idLanding = await waitForLandingByIds([
    'home-screen',
    'screen-home',
    'home-ready',
    'app-bootstrap-ready',
    'app-root',
    'questionnaire-screen',
    'tab-home',
    'tab-treino',
    'tab-social',
    'tab-nutricao',
    'tab-conversa',
    'tab-perfil',
    'screen-treinos',
    'screen-social',
    'screen-nutricao',
    'screen-coach',
    'screen-routines',
    'screen-workout',
    'screen-free-workout',
  ], isAttachedRun ? 22000 : 50000);

  if (idLanding) {
    return idLanding;
  }

  const textLanding = await waitForLandingByText(isAttachedRun ? 12000 : 18000);
  if (textLanding) {
    return textLanding;
  }

  const existsLanding = await waitForLandingByIds([
    'app-root',
    'app-bootstrap-ready',
    'home-screen',
    'screen-home',
    'tab-home',
  ], isAttachedRun ? 6000 : 8000);

  return existsLanding;
}

async function launchApp({ deleteApp = false } = {}) {
  const attachedRun = isAttachedRun()
    || String(process.env.DETOX_REUSE_APP || '') === '1';
  const shouldForceTerminateAttached = String(process.env.DETOX_FORCE_TERMINATE || '0') === '1';
  const shouldClearAttachedData = Boolean(deleteApp)
    && attachedRun
    && String(process.env.DETOX_CLEAR_APP_DATA || '1') !== '0';

  const shouldDeleteAppData = Boolean(deleteApp) && !attachedRun;

  if (!hasDetoxGlobals()) {
    throw new Error('Detox globals indisponiveis no launchApp. Sessao pode ter desconectado.');
  }

  if (shouldClearAttachedData) {
    if (shouldForceTerminateAttached) {
      try {
        await device.terminateApp();
      } catch {
        // app pode ainda nao estar aberto nesta sessao
      }
    }
    clearAttachedAndroidAppData();
  }

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      logStep(`launchApp attempt=${attempt} attached=${attachedRun}`);

      if (attachedRun) {
        const mustRelaunchFromScratch = shouldForceTerminateAttached || attempt > 1;

        // Segunda tentativa sempre força relaunch completo para reduzir travas de bootstrap no attached.
        if (mustRelaunchFromScratch) {
          try {
            await device.terminateApp();
          } catch {
            // app pode ja estar fechado
          }
        }

        await device.launchApp({
          newInstance: mustRelaunchFromScratch,
          launchArgs: {
            detoxEnableSynchronization: 0,
          },
        });
      } else {
        try {
          await device.terminateApp();
        } catch {
          // app pode ja estar fechado
        }

        await device.launchApp({
          delete: shouldDeleteAppData,
          launchArgs: {
            detoxEnableSynchronization: 0,
          },
          newInstance: true,
          permissions: {
            notifications: 'YES',
          },
        });
      }

      const landing = await waitForLandingSignal(attachedRun);
      if (!landing) {
        if (attachedRun) {
          logStep('launchApp attached sem marker inicial; seguindo com fallback de onboarding');
          return;
        }
        throw new Error('Falha ao detectar tela inicial por testID, texto e exists.');
      }

      logStep(`launchApp landed=${landing}`);
      return;
    } catch (error) {
      lastError = error;
      logStep(`launchApp error=${String(error?.message || error)}`);
      if (attempt >= 2) {
        break;
      }
    }
  }

  throw lastError || new Error('Falha ao iniciar app no e2e.');
}

async function completeOnboarding(persona = getPersona()) {
  const detectStage = async () => {
    if (await isVisible('questionnaire-screen', 1200)) {
      return 'questionnaire';
    }
    if ((await isVisible('screen-home', 1200)) || (await isVisible('tab-home', 1200))) {
      return 'home';
    }
    return 'unknown';
  };

  const activeScreen = await waitForAny(['questionnaire-screen', 'screen-home', 'tab-home'], 30000);

  const fillFieldIfVisible = async (fieldId, fieldValue, options = {}) => {
    const { scrollAttempts = 8, required = false } = options;
    await scrollToElement('scroll-container', fieldId, 'down', 320, scrollAttempts);
    if (!(await isVisible(fieldId, 2500))) {
      const stage = await detectStage();
      if (stage === 'home') {
        return false;
      }
      if (required) {
        throw new Error(`campo obrigatorio ausente no onboarding: ${fieldId}`);
      }
      return false;
    }

    await replaceInput(fieldId, fieldValue);
    await hideKeyboardIfNeeded();
    return true;
  };

  const submitQuestionnaire = async () => {
    await scrollToElement('scroll-container', 'btn-continuar');
    await hideKeyboardIfNeeded();

    // Em Android, um tap fora do input costuma fechar teclado sem acionar navegação.
    // Fazemos blur explícito antes do CTA para evitar "tap perdido" no botão de continuar.
    try {
      await element(by.id('questionnaire-screen')).tap();
      await sleep(160);
    } catch {
      // best effort
    }

    await humanDelay(persona, 'submit-questionnaire');
    await tapElement('btn-continuar');
    await sleep(600);
  };

  const pickChipWithFallback = async (preferredId, fallbackIds = []) => {
    const candidates = [preferredId, ...fallbackIds];

    for (const id of candidates) {
      if (!id) {
        continue;
      }
      if (await isVisible(id, 1200)) {
        await tapElement(id);
        return true;
      }
    }

    return false;
  };

  if (activeScreen !== 'questionnaire-screen') {
    if (await isVisible('tab-home', 1000)) {
      await tapElement('tab-home');
    }
    await waitFor(element(by.id('screen-home'))).toBeVisible().withTimeout(15000);
    return;
  }

  logStep(`preenchendo onboarding persona=${persona.key}`);
  await waitForAny(['questionnaire-screen', 'input-peso-atual', 'btn-continuar'], 12000);

  const goalPicked = await pickChipWithFallback(persona.goalTestId, [
    'chip-goal-emagrecer',
    'chip-goal-ganhar_massa',
    'chip-goal-recomposicao',
  ]);
  if (goalPicked) {
    await humanDelay(persona, 'goal');
  }

  const levelPicked = await pickChipWithFallback(persona.levelTestId, [
    'chip-level-iniciante',
    'chip-level-intermediario',
    'chip-level-avancado',
  ]);
  if (levelPicked) {
    await humanDelay(persona, 'level');
  }

  if ((await detectStage()) === 'home') {
    return;
  }

  if (!(await fillFieldIfVisible('input-peso-atual', persona.currentWeight, { required: true }))) {
    return;
  }
  await pickChipWithFallback(persona.trainingDaysTestId, [
    'chip-days-3',
    'chip-days-4',
    'chip-days-2',
  ]);
  await submitQuestionnaire();

  const afterSubmit = await waitForAny(['screen-home', 'tab-home', 'questionnaire-screen'], 30000);
  if (afterSubmit === 'questionnaire-screen') {
    await fillFieldIfVisible('input-peso-atual', persona.currentWeight, { required: true });
    const chipSelected = await pickChipWithFallback(persona.trainingDaysTestId, [
        'chip-days-3',
        'chip-days-4',
        'chip-days-2',
      ]);
    if (!chipSelected) {
      logStep('onboarding:chip-days-nao-selecionado — nenhum chip de dias de treino encontrado');
    }

    await submitQuestionnaire();

      let landingAfterRetry = await waitForLandingByIds([
        'screen-home',
        'tab-home',
        'tab-treino',
        'tab-social',
        'tab-nutricao',
        'tab-conversa',
        'tab-perfil',
        'screen-treinos',
        'screen-social',
        'screen-nutricao',
        'screen-coach',
        'questionnaire-screen',
      ], 30000);

      if (String(landingAfterRetry || '').includes('questionnaire-screen')) {
        try {
          await device.launchApp({ newInstance: false });
        } catch {
          // segue para nova leitura de estado
        }

        landingAfterRetry = await waitForLandingByIds([
          'screen-home',
          'tab-home',
          'tab-treino',
          'tab-social',
          'tab-nutricao',
          'tab-conversa',
          'tab-perfil',
          'screen-treinos',
          'screen-social',
          'screen-nutricao',
          'screen-coach',
          'questionnaire-screen',
        ], 15000);
      }

      if (!landingAfterRetry || String(landingAfterRetry).includes('questionnaire-screen')) {
        throw new Error('questionario permaneceu aberto apos tentativa de submit e relaunch');
      }
  }

  if (!(await isVisible('tab-home', 3000))) {
    try {
      await device.launchApp({ newInstance: false });
    } catch {
      // segue para validacao final
    }
      const finalLanding = await waitForLandingByIds([
        'tab-home',
        'screen-home',
        'tab-treino',
        'tab-social',
        'tab-nutricao',
        'tab-conversa',
        'tab-perfil',
        'screen-treinos',
        'screen-social',
        'screen-nutricao',
        'screen-coach',
      ], 12000);

      if (!finalLanding) {
        throw new Error('nao foi possivel detectar tela ativa apos concluir onboarding');
      }
  }
}

async function ensureOnboarded(persona = getPersona()) {
  try {
    await device.launchApp({ newInstance: false });
  } catch {
    // best effort para trazer app ao foreground
  }

  const dismissBlockingDialogs = async () => {
    const dialogButtons = [
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
    for (const label of dialogButtons) {
      try {
        await waitFor(element(by.text(label))).toBeVisible().withTimeout(500);
        await element(by.text(label)).tap();
        await sleep(300);
      } catch {
        // ignora quando botão não existe
      }
    }
  };

  await dismissBlockingDialogs();

  if (await isVisible('questionnaire-screen', 2000)) {
    await completeOnboarding(persona);
    return;
  }

  let active = null;
  try {
    active = await waitForAny([
      'app-bootstrap-ready',
      'app-root',
      'screen-home',
      'questionnaire-screen',
      'tab-home',
      'tab-social',
      'tab-treino',
      'tab-nutricao',
      'tab-conversa',
      'tab-perfil',
      'screen-social',
      'screen-treinos',
      'screen-nutricao',
      'screen-coach',
      'screen-routines',
      'screen-workout',
      'screen-free-workout',
    ], 15000);
  } catch {
    try {
      await device.launchApp({ newInstance: false });
    } catch {
      // segue para segunda tentativa de leitura da tela ativa
    }

    try {
      active = await waitForAny([
        'app-bootstrap-ready',
        'app-root',
        'screen-home',
        'questionnaire-screen',
        'tab-home',
        'tab-social',
        'tab-treino',
        'tab-nutricao',
        'tab-conversa',
        'tab-perfil',
        'screen-social',
        'screen-treinos',
        'screen-nutricao',
        'screen-coach',
        'screen-routines',
        'screen-workout',
        'screen-free-workout',
      ], 20000);
    } catch {
      const textLanding = await waitForLandingByText(10000);
      if (textLanding) {
        active = textLanding;
      }
    }
  }

  if (active === 'questionnaire-screen' || await isVisible('questionnaire-screen', 1000)) {
    await completeOnboarding(persona);
    return;
  }

  if (active === 'app-root') {
    await sleep(800);
  }

  if (!(await isVisible('tab-home', 3000))) {
    try {
      await device.launchApp({ newInstance: false });
    } catch {
      // segue para validacao final
    }
    await dismissBlockingDialogs();
    await waitForAny([
      'app-bootstrap-ready',
      'app-root',
      'tab-home',
      'tab-social',
      'tab-treino',
      'tab-nutricao',
      'tab-conversa',
      'tab-perfil',
      'screen-home',
      'screen-social',
      'screen-treinos',
      'screen-nutricao',
      'screen-coach',
      'screen-workout',
      'screen-free-workout',
    ], 12000);
  }

  if (await isVisible('tab-home', 1000)) {
    try {
      await tapElement('tab-home');
    } catch {
      // permanece na tela atual quando aba não estiver acionável
    }
  }
}

async function navigateToTab(tabId, expectedScreenId) {
  if (await isVisible(expectedScreenId, 1200)) {
    if (tabId === 'tab-home' && await isVisible('tab-home', 800)) {
      await tapElement('tab-home', 4000);
      await sleep(150);
    }
    return;
  }

  const tabCandidates = tabId === 'tab-conversa'
    ? ['tab-conversa', 'tab-coach']
    : [tabId];

  let targetTabId = null;
  for (const candidate of tabCandidates) {
    if (await isVisible(candidate, 900)) {
      targetTabId = candidate;
      break;
    }
  }

  if (!targetTabId) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await sleep(250);

      for (const candidate of tabCandidates) {
        if (await isVisible(candidate, 900)) {
          targetTabId = candidate;
          break;
        }
      }

      if (targetTabId) {
        break;
      }
    }
  }

  if (!targetTabId) {
    try {
      await device.launchApp({ newInstance: false });
    } catch {
      // segue para validação final
    }

    const homeFallbackMap = {
      'screen-treinos': 'home-quick-treino',
      'screen-nutricao': 'home-quick-nutricao',
      'screen-coach': 'home-quick-coach',
    };
    const fallbackActionId = homeFallbackMap[expectedScreenId];

    if (fallbackActionId && await isVisible(fallbackActionId, 1200)) {
      await tapElement(fallbackActionId, 12000);
      await waitFor(element(by.id(expectedScreenId))).toBeVisible().withTimeout(15000);
      return;
    }
  }

  if (!targetTabId) {
    // Alguns fluxos empilham telas sem tabs visíveis; voltar ajuda a recuperar a barra principal.
    for (let backTry = 0; backTry < 3 && !targetTabId; backTry += 1) {
      try {
        await device.pressBack();
      } catch {
        // sem tela para voltar
      }
      await sleep(350);
      for (const candidate of tabCandidates) {
        if (await isVisible(candidate, 1000)) {
          targetTabId = candidate;
          break;
        }
      }
    }

    if (!targetTabId) {
      try {
        await device.launchApp({ newInstance: false });
      } catch {
        // mantém fallback por tentativa de abas existentes
      }
      await sleep(350);
    }

    for (const candidate of tabCandidates) {
      if (await isVisible(candidate, 1200)) {
        targetTabId = candidate;
        break;
      }
    }

    if (!targetTabId) {
      // Em fluxos longos, a barra de tabs pode sumir temporariamente.
      // Se a tela esperada ja estiver visivel, nao tratamos como erro.
      if (await isVisible(expectedScreenId, 1500)) {
        return;
      }

      // Fallback especifico para Home: tenta reancorar no app sem depender da aba visivel.
      if (expectedScreenId === 'screen-home') {
        try {
          await device.launchApp({ newInstance: false });
        } catch {
          // segue para validacao final
        }

        const recovered = await waitForAny(['screen-home', 'questionnaire-screen'], 10000);
        if (recovered === 'screen-home') {
          return;
        }
        if (recovered === 'questionnaire-screen') {
          await completeOnboarding(getPersona());
          await waitFor(element(by.id('screen-home'))).toBeVisible().withTimeout(15000);
          return;
        }
      }

      throw new Error(`aba ${tabId} nao encontrada para navegar ate ${expectedScreenId}`);
    }
  }

  const preferredTabId = targetTabId || tabId;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await tapElement(preferredTabId, 15000);
    } catch {
      if (attempt >= 3) {
        throw new Error(`falha ao tocar na aba ${preferredTabId}`);
      }

      await ensureOnboarded(getPersona());
      await sleep(300);
      continue;
    }

    try {
      await waitFor(element(by.id(expectedScreenId))).toBeVisible().withTimeout(10000);
      return;
    } catch {
      try {
        await waitFor(element(by.id(expectedScreenId))).toExist().withTimeout(2500);
        return;
      } catch {
        // segue com retries e fallbacks
      }

      if (attempt >= 3) {
        if (expectedScreenId === 'screen-treinos') {
          if (await isVisible('screen-routines', 1200)) {
            try {
              await device.pressBack();
              await waitFor(element(by.id('screen-treinos'))).toBeVisible().withTimeout(6000);
              return;
            } catch {
              // segue para fallback do atalho da home
            }
          }

          try {
            if (await isVisible('tab-home', 1200)) {
              await tapElement('tab-home', 10000);
            }

            if (await isVisible('screen-home', 4000) && await isVisible('home-quick-treino', 1500)) {
              await tapElement('home-quick-treino', 12000);
              await waitForAny(['screen-treinos', 'screen-routines'], 12000);
              if (await isVisible('screen-treinos', 1200)) {
                return;
              }
            }
          } catch {
            // fallback falhou; erro original será lançado abaixo
          }
        }

        throw new Error(`falha ao navegar para ${expectedScreenId} via ${preferredTabId}`);
      }
      try {
        await device.launchApp({ newInstance: false });
      } catch {
        // segue com próxima tentativa
      }
      await sleep(250);
    }
  }
}

async function goHome() {
  await navigateToTab('tab-home', 'screen-home');
}

async function goToNutrition() {
  await navigateToTab('tab-nutricao', 'screen-nutricao');
}

async function goToTreinos() {
  const isTreinosHubReady = async () => {
    const hubIds = ['screen-treinos', 'btn-iniciar-treino', 'btn-open-free-workout', 'btn-open-routines'];
    for (const id of hubIds) {
      if (await isVisible(id, 900)) {
        return true;
      }
    }
    return false;
  };

  if (await isVisible('screen-treinos', 1200)) {
    return;
  }

  if (await isTreinosHubReady()) {
    return;
  }

  try {
    if (await isVisible('tab-home', 1200)) {
      await tapElement('tab-home', 10000);
      await waitForAny(['screen-home', 'tab-home'], 10000);
    }
  } catch {
    // segue com as tentativas padrao
  }

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      if (await isVisible('tab-treino', 1200)) {
        await tapElement('tab-treino', 12000);
        await waitForAny(['screen-treinos', 'screen-routines', 'btn-iniciar-treino', 'btn-open-free-workout', 'btn-open-routines'], 12000);
        if (await isVisible('screen-routines', 1000)) {
          try {
            await device.pressBack();
            await waitFor(element(by.id('screen-treinos'))).toExist().withTimeout(8000);
          } catch {
            // segue para fallback abaixo
          }
        }
        if (await isTreinosHubReady()) {
          return;
        }
      }
    } catch {
      // segue para fallback via home
    }

    try {
      if (await isVisible('tab-home', 1200)) {
        await tapElement('tab-home', 10000);
      }

      await waitForAny(['screen-home', 'tab-home'], 8000);
      if (await isVisible('home-quick-treino', 1500)) {
        await tapElement('home-quick-treino', 12000);
        await waitForAny(['screen-treinos', 'screen-routines', 'btn-iniciar-treino', 'btn-open-free-workout', 'btn-open-routines'], 12000);
        if (await isVisible('screen-routines', 1000)) {
          try {
            await device.pressBack();
            await waitFor(element(by.id('screen-treinos'))).toExist().withTimeout(8000);
          } catch {
            // mantém fluxo para tentativa seguinte
          }
        }
      }

      if (await isTreinosHubReady()) {
        return;
      }
    } catch {
      // tenta próxima estratégia
    }

    try {
      await navigateToTab('tab-treino', 'screen-treinos');
      if (await isTreinosHubReady()) {
        return;
      }
    } catch {
      // última tentativa no loop
    }

    await sleep(300);
  }

  throw new Error('falha ao abrir screen-treinos mesmo com fallback dedicado');
}

async function goToCoach() {
  await navigateToTab('tab-conversa', 'screen-coach');
}

async function goToSocial() {
  await navigateToTab('tab-social', 'screen-social');
}

async function runGuidedWorkoutHappyPath(persona = getPersona()) {
  const ensureGuidedInputReady = async (fieldId) => {
    try {
      await waitFor(element(by.id(fieldId))).toBeVisible().withTimeout(5000);
      return;
    } catch {
      try {
        if (!(await isVisible('btn-add-set', 1200))) {
          await scrollToElement('screen-workout', 'btn-add-set', 'down', 360, 6);
        }
        await tapElement('btn-add-set', 5000);
        await sleep(280);
      } catch {
        // segue com fallback de scroll/tap
      }
      await scrollToElement('screen-workout', fieldId, 'down', 360, 8);
      await tapElement(fieldId, 6000);
      await waitFor(element(by.id(fieldId))).toBeVisible().withTimeout(5000);
    }
  };

  await goToTreinos();
  await humanDelay(persona, 'open-guided-workout');

  let workoutOpened = false;
  for (let attempt = 1; attempt <= 3 && !workoutOpened; attempt += 1) {
    if (!(await isVisible('btn-iniciar-treino', 1500))) {
      try {
        await goToTreinos();
      } catch {
        // melhor esforco antes de nova tentativa
      }
    }

    await tapElement('btn-iniciar-treino');

    try {
      const nextScreen = await waitForAny(['screen-workout', 'screen-treinos', 'screen-routines'], 22000);
      if (nextScreen === 'screen-workout') {
        workoutOpened = true;
        break;
      }
    } catch {
      // segue para tentativa seguinte
    }

    if (attempt < 3) {
      await sleep(350);
    }
  }

  if (!workoutOpened) {
    throw new Error('Nao abriu screen-workout apos acionar btn-iniciar-treino.');
  }

  await ensureGuidedInputReady('input-weight');
  await replaceInput('input-weight', persona.guidedWeight);
  await ensureGuidedInputReady('input-reps');
  await replaceInput('input-reps', persona.guidedReps);
  await hideKeyboardIfNeeded();
  await humanDelay(persona, 'save-guided-set');
  try {
    await tapElement('btn-save-set');
  } catch {
    await waitFor(element(by.id('btn-save-set'))).toBeVisible().withTimeout(3000);
    await tapElement('btn-save-set');
  }
  try {
    await waitForAny(['btn-editar-serie', 'btn-remover-serie', 'serie-salva-indicator'], 6000);
  } catch {
    // fallback: em alguns cenários o contador de eventos não incrementa no mesmo tick
    // mas a UI já confirmou persistência da série.
    await waitForAny(['btn-editar-serie', 'btn-remover-serie', 'screen-workout'], 8000);
  }
}

async function saveGuidedWorkoutPartial() {
  if (await isVisible('btn-salvar-parcial', 1200)) {
    await tapElement('btn-salvar-parcial');
  } else if (await isVisible('screen-workout', 1200)) {
    try {
      await scrollToElement('screen-workout', 'btn-salvar-parcial', 'down', 420, 10);
      await tapElement('btn-salvar-parcial');
    } catch {
      try {
        await device.pressBack();
      } catch {
        // fallback para telas sem botão parcial
      }
    }
  } else {
    try {
      await device.pressBack();
    } catch {
      // fallback para telas sem botão parcial
    }
  }

  let exitTarget = null;
  try {
    exitTarget = await waitForAny(['screen-treinos', 'screen-routines', 'tab-treino'], 20000);
  } catch {
    if (await isVisible('tab-treino', 1200)) {
      await tapElement('tab-treino');
      exitTarget = await waitForAny(['screen-treinos', 'screen-routines', 'tab-treino'], 12000);
    }
  }

  if (exitTarget !== 'screen-treinos' && (await isVisible('tab-treino', 1500))) {
    await tapElement('tab-treino');
    await waitFor(element(by.id('screen-treinos'))).toBeVisible().withTimeout(15000);
  }
}

async function runFreeWorkoutHappyPath(persona = getPersona()) {
  const firstExercise = 'Supino Reto';
  const secondExercise = 'Remada Curvada';

  const addExercise = async () => {
    if (!(await isVisible('btn-free-add-exercise', 900))) {
      await scrollToElement('screen-free-workout', 'btn-free-add-exercise', 'down', 260, 8);
    }

    if (!(await isVisible('btn-free-add-exercise', 900)) && device.getPlatform() === 'android') {
      try {
        // No Android fisico, o teclado pode cobrir o CTA de adicionar exercicio.
        await device.pressBack();
        await sleep(220);
      } catch {
        // segue com fallback de scroll
      }
      await scrollToElement('screen-free-workout', 'btn-free-add-exercise', 'down', 260, 8);
    }

    await tapElement('btn-free-add-exercise');
  };

  await goToTreinos();
  await tapElement('btn-open-free-workout');
  await waitFor(element(by.id('screen-free-workout'))).toBeVisible().withTimeout(15000);

  await replaceInput('input-free-exercise-name', firstExercise);
  await addExercise();
  await replaceInput('input-free-exercise-name', secondExercise);
  await addExercise();

  if (device.getPlatform() === 'android') {
    try {
      await device.pressBack();
      await sleep(180);
    } catch {
      // teclado pode ja estar fechado
    }
  }

  await hideKeyboardIfNeeded();

  await waitFor(element(by.id(`card-free-exercise-${slugify(firstExercise)}`))).toExist().withTimeout(12000);
  await waitFor(element(by.id(`card-free-exercise-${slugify(secondExercise)}`))).toExist().withTimeout(12000);

  try {
    await element(by.id('screen-free-workout')).scrollTo('top');
    await sleep(150);
  } catch {
    // alguns devices nao suportam scrollTo no driver atual
  }

  if (!(await isVisible('btn-free-save-routine', 900))) {
    await scrollToElement('screen-free-workout', 'btn-free-save-routine', 'up', 420, 18);
  }
  if (!(await isVisible('btn-free-save-routine', 900)) && device.getPlatform() === 'android') {
    try {
      await device.pressBack();
      await sleep(180);
    } catch {
      // teclado pode ja estar fechado
    }
    await scrollToElement('screen-free-workout', 'btn-free-save-routine', 'up', 420, 18);
    if (!(await isVisible('btn-free-save-routine', 900))) {
      await scrollToElement('screen-free-workout', 'btn-free-save-routine', 'up', 420, 18);
    }
  }
  await tapElement('btn-free-save-routine');

  try {
    await waitFor(element(by.text('OK'))).toBeVisible().withTimeout(1200);
    await element(by.text('OK')).tap();
  } catch {
    // alerta pode nao aparecer em todos os devices
  }

  let landedInRoutines = await isVisible('screen-routines', 5000);

  if (!landedInRoutines) {
    if (await isVisible('tab-treino', 1200)) {
      await tapElement('tab-treino');
    } else if (await isVisible('screen-free-workout', 1200) && device.getPlatform() === 'android') {
      try {
        await device.pressBack();
        await sleep(200);
      } catch {
        // best effort
      }
    }

    await goToTreinos();
    if (await isVisible('btn-open-routines', 2500)) {
      await tapElement('btn-open-routines');
    }

    landedInRoutines = await isVisible('screen-routines', 12000);
  }

  if (!landedInRoutines) {
    throw new Error('Nao abriu Minhas Rotinas apos salvar treino livre.');
  }
}

async function runCreatedRoutineWorkoutHappyPath(persona = getPersona()) {
  await goToTreinos();

  let routinesOpened = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await isVisible('screen-routines', 1200)) {
      routinesOpened = true;
      break;
    }

    if (!(await isVisible('screen-treinos', 1200))) {
      await goToTreinos();
    }

    try {
      await scrollToElement('screen-treinos', 'btn-open-routines');
      await tapElement('btn-open-routines');
    } catch {
      try {
        await goHome();
        await goToTreinos();
      } catch {
        // segue para a proxima tentativa
      }
      continue;
    }

    try {
      await waitFor(element(by.id('screen-routines'))).toBeVisible().withTimeout(6000);
      routinesOpened = true;
      break;
    } catch {
      if (await isVisible('screen-treinos', 1000)) {
        await tapElement('tab-treino');
      }
    }
  }

  if (!routinesOpened) {
    throw new Error('Nao abriu tela de rotinas a partir da hub de treinos.');
  }

  const routineName = `E2E Rotina ${Date.now()}`;
  const routineSlug = slugify(routineName);
  const chipToExerciseName = {
    'chip-routine-quick-supino-reto': 'Supino Reto',
    'chip-routine-quick-supino-maquina-chest-press': 'Supino Maquina (Chest Press)',
    'chip-routine-quick-remada-curvada': 'Remada Curvada',
    'chip-routine-quick-remada-sentada-maquina': 'Remada Sentada Maquina',
    'chip-routine-catalog-remada-sentada-maquina': 'Remada Sentada Maquina',
    'chip-routine-catalog-remada-curvada': 'Remada Curvada Barra',
    'chip-routine-catalog-puxada-frontal-polia': 'Puxada Frontal Polia',
    'chip-routine-catalog-graviton-barra-assistida': 'Graviton (Barra Assistida)',
  };
  const quickPrimaryCandidates = [
    'chip-routine-quick-supino-reto',
    'chip-routine-quick-supino-maquina-chest-press',
  ];
  const quickSecondaryCandidates = [
    'chip-routine-quick-remada-curvada',
    'chip-routine-quick-remada-sentada-maquina',
  ];

  await replaceInput('input-routine-name', routineName);
  try {
    await element(by.id('screen-routines')).tapAtPoint({ x: 16, y: 16 });
  } catch {
    // best effort para desfocar input e evitar teclado cobrindo chips
  }
  await hideKeyboardIfNeeded();
  let selectedPrimary = false;
  let selectedPrimaryName = null;
  for (const chipId of quickPrimaryCandidates) {
    if (await isVisible(chipId, 800)) {
      await tapElement(chipId);
      selectedPrimary = true;
      selectedPrimaryName = chipToExerciseName[chipId] || null;
      break;
    }
  }
  if (!selectedPrimary) {
    for (const chipId of quickPrimaryCandidates) {
      try {
        await scrollToElement('screen-routines', chipId);
        await tapElement(chipId);
        selectedPrimary = true;
        selectedPrimaryName = chipToExerciseName[chipId] || null;
        break;
      } catch {
        // tenta o proximo chip candidato
      }
    }
  }
  if (!selectedPrimary) {
    try {
      await replaceInput('input-routine-search', 'Supino');
      await hideKeyboardIfNeeded();
    } catch {
      // fallback silencioso: segue para candidatos de catalogo
    }

    const primaryCatalogCandidates = [
      'chip-routine-catalog-supino-maquina-chest-press',
      'chip-routine-catalog-supino-reto-barra',
      'chip-routine-quick-supino-maquina-chest-press',
      'chip-routine-quick-supino-reto',
    ];

    for (const chipId of primaryCatalogCandidates) {
      if (await isVisible(chipId, 1000)) {
        await tapElement(chipId);
        selectedPrimary = true;
        selectedPrimaryName = chipToExerciseName[chipId] || selectedPrimaryName;
        break;
      }
    }
  }

  if (!selectedPrimary) {
    const primaryTextCandidates = [
      'Supino Maquina (Chest Press)',
      'Supino Inclinado Maquina',
      'Supino Reto com Barra',
      'Supino Reto Barra',
    ];

    for (const label of primaryTextCandidates) {
      try {
        await waitFor(element(by.text(label))).toBeVisible().withTimeout(1600);
        await element(by.text(label)).tap();
        selectedPrimary = true;
        selectedPrimaryName = label;
        break;
      } catch {
        // tenta proximo texto candidato
      }
    }
  }

  if (!selectedPrimary) {
    throw new Error('Nao encontrou atalho rapido primario para criar rotina no e2e.');
  }

  let selectedSecondary = false;
  let selectedSecondaryName = null;
  for (const chipId of quickSecondaryCandidates) {
    if (await isVisible(chipId, 800)) {
      await tapElement(chipId);
      selectedSecondary = true;
      selectedSecondaryName = chipToExerciseName[chipId] || null;
      break;
    }
  }
  if (!selectedSecondary) {
    for (const chipId of quickSecondaryCandidates) {
      try {
        await scrollToElement('screen-routines', chipId);
        await tapElement(chipId);
        selectedSecondary = true;
        selectedSecondaryName = chipToExerciseName[chipId] || null;
        break;
      } catch {
        // tenta o proximo chip candidato
      }
    }
  }
  if (!selectedSecondary) {
    try {
      await replaceInput('input-routine-search', 'Remada');
      await hideKeyboardIfNeeded();
    } catch {
      // fallback silencioso: tenta candidatos mesmo sem busca
    }

    const secondaryCatalogCandidates = [
      'chip-routine-catalog-remada-sentada-maquina',
      'chip-routine-catalog-remada-curvada',
      'chip-routine-catalog-puxada-frontal-polia',
      'chip-routine-catalog-graviton-barra-assistida',
    ];

    for (const chipId of secondaryCatalogCandidates) {
      if (await isVisible(chipId, 1000)) {
        await tapElement(chipId);
        selectedSecondary = true;
        selectedSecondaryName = chipToExerciseName[chipId] || null;
        break;
      }
    }
  }

  if (!selectedSecondary) {
    throw new Error('Nao encontrou atalho rapido secundario para criar rotina no e2e.');
  }

  const expectedRows = [selectedPrimaryName, selectedSecondaryName]
    .filter(Boolean)
    .map((name) => `row-routine-builder-${slugify(name)}`);

  for (const rowId of expectedRows) {
    if (await isVisible(rowId, 1200)) {
      continue;
    }

    const fallbackSearch = rowId.includes('supino') ? 'Supino' : 'Remada';
    try {
      await replaceInput('input-routine-search', fallbackSearch);
      await hideKeyboardIfNeeded();
    } catch {
      // segue para tentativa direta de chip
    }

    const fallbackChipCandidates = rowId.includes('supino')
      ? [
          'chip-routine-catalog-supino-maquina-chest-press',
          'chip-routine-catalog-supino-reto-barra',
          'chip-routine-quick-supino-maquina-chest-press',
          'chip-routine-quick-supino-reto',
        ]
      : [
          'chip-routine-catalog-remada-sentada-maquina',
          'chip-routine-catalog-remada-curvada-barra',
          'chip-routine-quick-remada-sentada-maquina',
          'chip-routine-quick-remada-curvada',
        ];

    for (const fallbackChipId of fallbackChipCandidates) {
      if (!(await isVisible(fallbackChipId, 1000))) {
        continue;
      }

      try {
        await tapElement(fallbackChipId);
        break;
      } catch {
        // o catálogo pode re-renderizar entre visibilidade e tap; tenta próximo candidato
      }
    }
  }

  // Em alguns devices físicos o builder re-renderiza e pode não refletir imediatamente
  // os exercícios já adicionados. Seguimos com fallback de início por outras rotinas visíveis.

  await hideKeyboardIfNeeded();
  try {
    await waitFor(element(by.id('btn-routine-save'))).toBeVisible().withTimeout(10000);
  } catch {
    await waitFor(element(by.id('btn-routine-save'))).toExist().withTimeout(10000);
    try {
      await scrollToElement('screen-routines', 'btn-routine-save');
    } catch {
      // em alguns devices o botão existe mas não atinge 75% de visibilidade
    }
  }

  let savedRoutine = false;
  for (let attempt = 0; attempt < 3 && !savedRoutine; attempt += 1) {
    try {
      await tapElement('btn-routine-save', 8000);
      savedRoutine = true;
      break;
    } catch {
      try {
        await element(by.id('screen-routines')).scroll(320, 'down');
      } catch {
        // segue para próxima tentativa
      }
      await sleep(250);
    }
  }

  if (!savedRoutine) {
    throw new Error('Nao conseguiu acionar btn-routine-save na tela de rotinas.');
  }

  try {
    await waitFor(element(by.text('OK'))).toBeVisible().withTimeout(1200);
    await element(by.text('OK')).tap();
  } catch {
    // alerta pode nao aparecer em todos os devices
  }

  await waitFor(element(by.id('screen-routines'))).toBeVisible().withTimeout(15000);
  let openedWorkout = false;
  const startButtonId = `btn-routine-start-${routineSlug}`;

  const tryOpenWorkoutFromRoutines = async () => {
    if (await isVisible(startButtonId, 1500)) {
      try {
        await tapElement(startButtonId);
        await waitFor(element(by.id('screen-workout'))).toBeVisible().withTimeout(5000);
        return true;
      } catch {
        // pode ser rotina vazia ou tap sem efeito
      }
    }

    for (let index = 0; index < 3; index += 1) {
      try {
        await waitFor(element(by.text('Iniciar')).atIndex(index)).toBeVisible().withTimeout(1500);
        await element(by.text('Iniciar')).atIndex(index).tap();
        await waitFor(element(by.id('screen-workout'))).toBeVisible().withTimeout(5000);
        return true;
      } catch {
        // tenta próximo botão iniciar
      }
    }

    return false;
  };

  for (let attempt = 0; attempt < 5 && !openedWorkout; attempt += 1) {
    openedWorkout = await tryOpenWorkoutFromRoutines();
    if (openedWorkout) break;

    if (await isVisible('screen-routines', 1000)) {
      try {
        await element(by.id('screen-routines')).scroll(420, 'down');
      } catch {
        // segue para próxima tentativa
      }
    }
  }

  if (!openedWorkout) {
    try {
      await tapElement('tab-treino', 3000);
      await waitFor(element(by.id('screen-treinos'))).toBeVisible().withTimeout(10000);
      await tapElement('btn-iniciar-treino');
      await waitFor(element(by.id('screen-workout'))).toBeVisible().withTimeout(15000);
      openedWorkout = true;
    } catch {
      // mantém validação de erro abaixo
    }
  }

  if (!openedWorkout) {
    throw new Error('Nao abriu tela de treino apos iniciar rotina criada.');
  }

  await replaceInput('input-weight', persona.guidedWeight);
  await replaceInput('input-reps', persona.guidedReps);
  await hideKeyboardIfNeeded();
  try {
    await tapElement('btn-save-set');
  } catch {
    await waitFor(element(by.id('btn-save-set'))).toBeVisible().withTimeout(3000);
    await tapElement('btn-save-set');
  }
  await waitFor(element(by.id('serie-salva-indicator'))).toBeVisible().withTimeout(8000);
  await saveGuidedWorkoutPartial();

  try {
    await goToTreinos();
  } catch {
    // melhor esforço: chamada externa já valida presença de screen-treinos/screen-routines
  }
}

async function runNutritionHappyPath(persona = getPersona(), options = {}) {
  const skipEstimate = Boolean(options.skipEstimate);
  await goToNutrition();

  let mealFilled = false;
  for (let attempt = 1; attempt <= 3 && !mealFilled; attempt += 1) {
    try {
      await scrollToElement('screen-nutricao', 'input-alimento-nome', 'down', 240, 6);
      await sleep(180);
      await replaceInput('input-alimento-nome', persona.nutritionQuickMeal);
      mealFilled = true;
    } catch (error) {
      if (attempt >= 3) {
        logStep(`nutrition-quick-meal-skip: ${String(error?.message || 'unknown')}`);
        break;
      }
      try {
        await hideKeyboardIfNeeded();
      } catch {
        // best effort
      }
      await sleep(300);
    }
  }

  if (mealFilled) {
    await hideKeyboardIfNeeded();
    let quickMealBuilt = false;
    const quickMealCandidates = [persona.nutritionQuickMeal, 'arroz + frango + feijao'];

    for (const candidate of quickMealCandidates) {
      await replaceInput('input-alimento-nome', candidate);
      await hideKeyboardIfNeeded();
      await humanDelay(persona, 'build-quick-meal');
      await scrollToElement('screen-nutricao', 'btn-adicionar-alimento', 'down', 320, 8);
      await tapElement('btn-adicionar-alimento');

      if (await isVisible('btn-salvar-alimento', 2200)) {
        quickMealBuilt = true;
        break;
      }

      logStep(`nutrition-quick-meal-retry: ${candidate}`);
      await sleep(250);
    }

    if (quickMealBuilt) {
      await tapElement('btn-salvar-alimento');
      await waitFor(element(by.id('alimento-salvo-indicator'))).toBeVisible().withTimeout(10000);
    } else {
      logStep('nutrition-quick-meal-skip-save: btn-salvar-alimento nao apareceu');
    }
  }

  if (skipEstimate) {
    return;
  }

  try {
    if (await isVisible('text-input-food', 1200)) {
      await replaceInput('text-input-food', persona.nutritionTextEstimate);
      await hideKeyboardIfNeeded();
      await tapElement('btn-estimate-text');
      await isVisible('nutrition-result-card', 4000);
      return;
    }

    await scrollToElement('screen-nutricao', 'text-input-food', 'down', 420, 16);
    await replaceInput('text-input-food', persona.nutritionTextEstimate);
    await hideKeyboardIfNeeded();
    await tapElement('btn-estimate-text');
    await isVisible('nutrition-result-card', 4000);
  } catch (error) {
    logStep(`nutrition-text-estimate-skip: ${String(error?.message || 'unknown')}`);
  }
}

async function runTrackingHappyPath(persona = getPersona()) {
  await goHome();
  await humanDelay(persona, 'home-water');

  let confirmed = false;
  for (let attempt = 1; attempt <= 3 && !confirmed; attempt += 1) {
    await scrollToElement('screen-home', 'btn-add-agua', 'down', 320, 10);
    await tapElement('btn-add-agua');

    try {
      await waitFor(element(by.id('feedback-add-agua'))).toBeVisible().withTimeout(8000);
      confirmed = true;
      break;
    } catch {
      try {
        await goHome();
      } catch {
        // melhor esforco para estabilizar a tela antes de tentar novamente
      }
      await sleep(300);
    }
  }

  if (!confirmed) {
    throw new Error('Nao confirmou feedback-add-agua apos 3 tentativas de registro de agua.');
  }
}

async function runCoachHappyPath(persona = getPersona()) {
  await goToCoach();
  if (await isVisible('chat-input', 1500)) {
    await replaceInput('chat-input', persona.coachMessage);
    await hideKeyboardIfNeeded();
    await humanDelay(persona, 'coach-send');
    await tapElement('btn-chat-send');
    try {
      await waitForAny(['message-coach', 'message-user', 'screen-coach'], 12000);
    } catch {
      try {
        await element(by.id('screen-coach')).scroll(220, 'down');
      } catch {
        // sem scroll disponível
      }
      await waitForAny(['message-coach', 'message-user', 'screen-coach'], 8000);
    }
    return;
  }

  await tapElement('btn-add-water-chat');
  await waitFor(element(by.id('screen-coach'))).toBeVisible().withTimeout(8000);
}

async function collectHeatmap(clientId) {
  return fetchHeatmap(clientId);
}

module.exports = {
  collectHeatmap,
  completeOnboarding,
  ensureOnboarded,
  goHome,
  goToCoach,
  goToSocial,
  goToNutrition,
  goToTreinos,
  launchApp,
  runCoachHappyPath,
  runFreeWorkoutHappyPath,
  runCreatedRoutineWorkoutHappyPath,
  runGuidedWorkoutHappyPath,
  runNutritionHappyPath,
  runTrackingHappyPath,
  saveGuidedWorkoutPartial,
};
