const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { getPersona } = require('./personas');
const {
  countEventEntries,
  fetchHeatmap,
  hideKeyboardIfNeeded,
  humanDelay,
  isVisible,
  logStep,
  replaceInput,
  scrollToElement,
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

  const adbName = String(process.env.DETOX_ADB_NAME || '').trim();
  const adbArgs = [];
  if (adbName) {
    adbArgs.push('-s', adbName);
  }
  adbArgs.push('shell', 'pm', 'clear', ANDROID_APP_ID);
  execFileSync(resolveAdbPath(), adbArgs, { stdio: 'pipe' });
}

async function launchApp({ deleteApp = false } = {}) {
  const isAttachedRun = String(process.env.DETOX_ATTACHED_CONFIGURATION || '').includes('android.attached')
    || String(process.env.DETOX_CONFIGURATION || '').includes('android.attached')
    || String(process.env.DETOX_REUSE_APP || '') === '1';
  const shouldForceTerminateAttached = String(process.env.DETOX_FORCE_TERMINATE || '0') === '1';
  const shouldClearAttachedData = Boolean(deleteApp)
    && isAttachedRun
    && String(process.env.DETOX_CLEAR_APP_DATA || '1') !== '0';

  const shouldDeleteAppData = Boolean(deleteApp) && !isAttachedRun;

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
      if (isAttachedRun) {
        // For physical devices, avoid hard terminate by default to preserve Detox handshake stability.
        if (shouldForceTerminateAttached) {
          try {
            await device.terminateApp();
          } catch {
            // app pode ja estar fechado
          }
        }

        await device.launchApp({ newInstance: true });
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

      // O app dispara telemetria e timers contínuos; sem isso o Detox pode ficar bloqueado aguardando "idle".
      await device.disableSynchronization();

      await waitForAny(['app-root', 'questionnaire-screen', 'screen-home', 'tab-home'], 45000);
      return;
    } catch (error) {
      lastError = error;
      if (attempt >= 2) {
        break;
      }
    }
  }

  throw lastError || new Error('Falha ao iniciar app no e2e.');
}

async function completeOnboarding(persona = getPersona()) {
  const activeScreen = await waitForAny(['questionnaire-screen', 'screen-home', 'tab-home'], 30000);

  if (activeScreen !== 'questionnaire-screen') {
    if (await isVisible('tab-home', 1000)) {
      await tapElement('tab-home');
    }
    await waitFor(element(by.id('screen-home'))).toBeVisible().withTimeout(15000);
    return;
  }

  logStep(`preenchendo onboarding persona=${persona.key}`);
  await tapElement(persona.goalTestId);
  await humanDelay(persona, 'goal');
  await tapElement(persona.levelTestId);
  await humanDelay(persona, 'level');
  await replaceInput('input-peso-atual', persona.currentWeight);
  await hideKeyboardIfNeeded();
  await tapElement(persona.trainingDaysTestId);
  await scrollToElement('scroll-container', 'btn-toggle-advanced-questionnaire');
  await tapElement('btn-toggle-advanced-questionnaire');
  await scrollToElement('scroll-container', 'input-peso-meta');
  await replaceInput('input-peso-meta', persona.targetWeight);
  await scrollToElement('scroll-container', 'input-altura');
  await replaceInput('input-altura', persona.height);
  await scrollToElement('scroll-container', 'btn-continuar');
  await hideKeyboardIfNeeded();
  await humanDelay(persona, 'submit-questionnaire');
  await tapElement('btn-continuar');
  await waitFor(element(by.id('screen-home'))).toBeVisible().withTimeout(30000);
}

async function ensureOnboarded(persona = getPersona()) {
  if (await isVisible('questionnaire-screen', 2000)) {
    await completeOnboarding(persona);
    return;
  }

  if (await isVisible('tab-home', 4000)) {
    await tapElement('tab-home');
  }

  await waitForAny(['screen-home', 'questionnaire-screen'], 15000);

  if (await isVisible('questionnaire-screen', 1000)) {
    await completeOnboarding(persona);
    return;
  }

  await waitFor(element(by.id('screen-home'))).toBeVisible().withTimeout(15000);
}

async function navigateToTab(tabId, expectedScreenId) {
  if (await isVisible(expectedScreenId, 1200)) {
    return;
  }

  if (!(await isVisible(tabId, 1200))) {
    try {
      await device.pressBack();
    } catch {
      // sem tela empilhada para voltar
    }
  }

  await tapElement(tabId);
  await waitFor(element(by.id(expectedScreenId))).toBeVisible().withTimeout(15000);
}

async function goHome() {
  await navigateToTab('tab-home', 'screen-home');
}

async function goToNutrition() {
  await navigateToTab('tab-nutricao', 'screen-nutricao');
}

async function goToTreinos() {
  await navigateToTab('tab-treino', 'screen-treinos');
}

async function goToCoach() {
  await navigateToTab('tab-conversa', 'screen-coach');
}

async function runGuidedWorkoutHappyPath(persona = getPersona()) {
  await goToTreinos();
  await humanDelay(persona, 'open-guided-workout');
  await tapElement('btn-iniciar-treino');
  await waitFor(element(by.id('screen-workout'))).toBeVisible().withTimeout(20000);
  await replaceInput('input-peso', persona.guidedWeight);
  await replaceInput('input-reps', persona.guidedReps);
  await hideKeyboardIfNeeded();
  await humanDelay(persona, 'save-guided-set');
  const eventsBeforeSave = countEventEntries();
  await tapElement('btn-salvar-serie');
  try {
    await waitForAny(['btn-editar-serie', 'btn-remover-serie', 'serie-salva-indicator'], 4000);
  } catch {
    await waitForCountIncrease(countEventEntries, eventsBeforeSave, 8000);
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

  const exitTarget = await waitForAny(['screen-treinos', 'screen-routines', 'tab-treino'], 20000);

  if (exitTarget !== 'screen-treinos' && (await isVisible('tab-treino', 1500))) {
    await tapElement('tab-treino');
    await waitFor(element(by.id('screen-treinos'))).toBeVisible().withTimeout(15000);
  }
}

async function runFreeWorkoutHappyPath(persona = getPersona()) {
  const firstExercise = 'Supino Reto';
  const secondExercise = 'Remada Curvada';

  await goToTreinos();
  await tapElement('btn-open-free-workout');
  await waitFor(element(by.id('screen-free-workout'))).toBeVisible().withTimeout(15000);

  await replaceInput('input-free-exercise-name', firstExercise);
  await tapElement('btn-free-add-exercise');
  await replaceInput('input-free-exercise-name', secondExercise);
  await tapElement('btn-free-add-exercise');
  await hideKeyboardIfNeeded();

  await waitFor(element(by.id(`card-free-exercise-${slugify(firstExercise)}`))).toExist().withTimeout(12000);
  await waitFor(element(by.id(`card-free-exercise-${slugify(secondExercise)}`))).toExist().withTimeout(12000);

  await tapElement('btn-free-save-routine');

  try {
    await waitFor(element(by.text('OK'))).toBeVisible().withTimeout(1200);
    await element(by.text('OK')).tap();
  } catch {
    // alerta pode nao aparecer em todos os devices
  }

  await waitFor(element(by.id('screen-routines'))).toBeVisible().withTimeout(15000);
}

async function runCreatedRoutineWorkoutHappyPath(persona = getPersona()) {
  await goToTreinos();

  let routinesOpened = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (await isVisible('screen-routines', 1200)) {
      routinesOpened = true;
      break;
    }

    await scrollToElement('screen-treinos', 'btn-open-routines');
    await tapElement('btn-open-routines');

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
  const quickPrimaryCandidates = [
    'chip-routine-quick-supino-reto',
    'chip-routine-quick-supino-maquina-chest-press',
  ];
  const quickSecondaryCandidates = [
    'chip-routine-quick-remada-curvada',
    'chip-routine-quick-remada-sentada-maquina',
  ];

  await replaceInput('input-routine-name', routineName);
  await hideKeyboardIfNeeded();
  let selectedPrimary = false;
  for (const chipId of quickPrimaryCandidates) {
    if (await isVisible(chipId, 800)) {
      await tapElement(chipId);
      selectedPrimary = true;
      break;
    }
  }
  if (!selectedPrimary) {
    for (const chipId of quickPrimaryCandidates) {
      try {
        await scrollToElement('screen-routines', chipId);
        await tapElement(chipId);
        selectedPrimary = true;
        break;
      } catch {
        // tenta o proximo chip candidato
      }
    }
  }
  if (!selectedPrimary) {
    throw new Error('Nao encontrou atalho rapido primario para criar rotina no e2e.');
  }

  let selectedSecondary = false;
  for (const chipId of quickSecondaryCandidates) {
    if (await isVisible(chipId, 800)) {
      await tapElement(chipId);
      selectedSecondary = true;
      break;
    }
  }
  if (!selectedSecondary) {
    for (const chipId of quickSecondaryCandidates) {
      try {
        await scrollToElement('screen-routines', chipId);
        await tapElement(chipId);
        selectedSecondary = true;
        break;
      } catch {
        // tenta o proximo chip candidato
      }
    }
  }
  if (!selectedSecondary) {
    throw new Error('Nao encontrou atalho rapido secundario para criar rotina no e2e.');
  }

  await waitFor(element(by.id('btn-routine-save'))).toBeVisible().withTimeout(10000);
  await hideKeyboardIfNeeded();
  await scrollToElement('screen-routines', 'btn-routine-save');
  await tapElement('btn-routine-save');

  try {
    await waitFor(element(by.text('OK'))).toBeVisible().withTimeout(1200);
    await element(by.text('OK')).tap();
  } catch {
    // alerta pode nao aparecer em todos os devices
  }

  await waitFor(element(by.id('screen-routines'))).toBeVisible().withTimeout(15000);
  const startButtonId = `btn-routine-start-${routineSlug}`;

  if (await isVisible(startButtonId, 2500)) {
    await scrollToElement('screen-routines', startButtonId);
    await tapElement(startButtonId);
  } else {
    for (let index = 0; index < 10; index += 1) {
      if (await isVisible(element(by.text('Iniciar')).atIndex(0), 600)) {
        break;
      }
      await element(by.id('screen-routines')).scroll(420, 'down');
    }
    await waitFor(element(by.text('Iniciar')).atIndex(0)).toBeVisible().withTimeout(12000);
    await element(by.text('Iniciar')).atIndex(0).tap();
  }

  let openedWorkout = false;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await waitFor(element(by.id('screen-workout'))).toBeVisible().withTimeout(7000);
      openedWorkout = true;
      break;
    } catch {
      if (!(await isVisible('screen-routines', 1000))) {
        break;
      }
      if (await isVisible(startButtonId, 1200)) {
        await tapElement(startButtonId);
      } else {
        await element(by.text('Iniciar')).atIndex(0).tap();
      }
    }
  }

  if (!openedWorkout) {
    throw new Error('Nao abriu tela de treino apos iniciar rotina criada.');
  }

  await replaceInput('input-peso', persona.guidedWeight);
  await replaceInput('input-reps', persona.guidedReps);
  await hideKeyboardIfNeeded();
  await tapElement('btn-salvar-serie');
  await waitFor(element(by.id('serie-salva-indicator'))).toBeVisible().withTimeout(8000);
  await saveGuidedWorkoutPartial();
}

async function runNutritionHappyPath(persona = getPersona(), options = {}) {
  const skipEstimate = Boolean(options.skipEstimate);
  await goToNutrition();
  await replaceInput('input-alimento-nome', persona.nutritionQuickMeal);
  await hideKeyboardIfNeeded();
  await humanDelay(persona, 'build-quick-meal');
  await scrollToElement('screen-nutricao', 'btn-adicionar-alimento', 'down', 320, 8);
  await tapElement('btn-adicionar-alimento');
  await tapElement('btn-salvar-alimento');
  await waitFor(element(by.id('alimento-salvo-indicator'))).toBeVisible().withTimeout(10000);

  if (skipEstimate) {
    return;
  }

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
}

async function runTrackingHappyPath(persona = getPersona()) {
  await goHome();
  await humanDelay(persona, 'home-water');
  await scrollToElement('screen-home', 'btn-add-agua', 'down', 320, 10);
  await tapElement('btn-add-agua');
  await waitFor(element(by.id('feedback-add-agua'))).toBeVisible().withTimeout(8000);
}

async function runCoachHappyPath(persona = getPersona()) {
  await goToCoach();
  if (await isVisible('chat-input', 1500)) {
    await replaceInput('chat-input', persona.coachMessage);
    await hideKeyboardIfNeeded();
    await humanDelay(persona, 'coach-send');
    await tapElement('btn-chat-send');
    await waitFor(element(by.id('message-coach')).atIndex(0)).toBeVisible().withTimeout(12000);
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
