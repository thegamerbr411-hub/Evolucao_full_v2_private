/**
 * V7 QA — treino guiado peso/reps por série (local only, não commitar).
 * Evidências: qa/live_mapping/v7_weight_reps_guided_*
 */
const { execSync } = require('child_process');
const path = require('path');
const { getPersona } = require('./helpers/personas');
const { isAttachedRun } = require('./helpers/runtime');
const {
  assertMainTabsReadyOrFail,
  ensureGuidedInputReady,
  ensureOnboarded,
  ensureWorkoutScreenOpen,
  goToTreinos,
  isAuthScreenVisible,
  launchApp,
  resetWorkoutStateViaQaDeepLink,
} = require('./helpers/flows');
const {
  assertGuidedSetSaved,
  dismissBlockingSystemDialogs,
  fillWorkoutKeypadField,
  isVisible,
  logStep,
  replaceInput,
  scrollToElement,
  sleep,
  tapElement,
  tapSaveSetIfVisible,
  tryTapViaXmlBounds,
  waitForAny,
} = require('./helpers/utils');

const DEVICE = process.env.DETOX_ADB_NAME || 'RQ8T209ZTAF';
const ROOT = path.resolve(__dirname, '..');
const WEIGHT_1 = '20';
const REPS_1 = '10';
const WEIGHT_2 = '30';
const REPS_2 = '8';
const GUIDED_EX2_NAME = 'Puxada Frontal';

function adbUiDump(localName) {
  const remote = '/sdcard/v7_guided.xml';
  const local = path.join(ROOT, 'qa', 'live_mapping', `${localName}.xml`);
  try {
    execSync(`adb -s ${DEVICE} shell uiautomator dump ${remote}`, { stdio: 'pipe' });
    execSync(`adb -s ${DEVICE} pull ${remote} "${local}"`, { stdio: 'pipe' });
    logStep(`v7-adb-dump-ok:${localName}`);
    return local;
  } catch (error) {
    logStep(`v7-adb-dump-fail:${localName}=${String(error?.message || error)}`);
    return null;
  }
}

async function assertNoAuthBeforeNavigation(contextLabel) {
  const authMarker = await isAuthScreenVisible();
  if (!authMarker) {
    return;
  }

  adbUiDump(`v7_guided_auth_fail_${contextLabel}`);
  try {
    await device.takeScreenshot(`v7_guided_auth_fail_${contextLabel}`);
  } catch {
    // best effort
  }
  throw new Error(`auth_required: ${contextLabel} bloqueado por tela de auth (${authMarker})`);
}

async function openGuidedWorkout() {
  await assertNoAuthBeforeNavigation('goToTreinos');
  await goToTreinos();
  let workoutOpened = false;
  for (let attempt = 1; attempt <= 3 && !workoutOpened; attempt += 1) {
    if (!(await isVisible('btn-iniciar-treino', 1500))) {
      try {
        await goToTreinos();
      } catch {
        // melhor esforço
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
      // retry
    }
    if (attempt < 3) {
      await sleep(350);
    }
  }
  if (!workoutOpened) {
    throw new Error('V7 guided: não abriu screen-workout');
  }
}

async function capturePostWeightEvidence() {
  adbUiDump('v7_guided_after_weight_confirm_retry5');
  try {
    await device.takeScreenshot('v7_guided_after_weight_confirm_retry5');
  } catch {
    // best effort
  }
}

async function saveGuidedSet(weight, reps) {
  await ensureGuidedInputReady('input-weight');
  await fillWorkoutKeypadField('input-weight', weight);
  await dismissBlockingSystemDialogs();
  await sleep(400);

  if (!(await isVisible('screen-workout', 2000))) {
    await ensureWorkoutScreenOpen();
    await ensureGuidedInputReady('input-weight');
    await fillWorkoutKeypadField('input-weight', weight);
    logStep(`v7-guided:weight-refilled:${weight}`);
  }

  await device.takeScreenshot(`v7_weight_reps_guided_filled_w${weight}`);
  await capturePostWeightEvidence();

  if (await tapSaveSetIfVisible()) {
    logStep('v7-guided:save-after-weight');
    await assertGuidedSetSaved(weight, reps);
    return;
  }

  await ensureGuidedInputReady('input-reps');
  await fillWorkoutKeypadField('input-reps', reps);
  await dismissBlockingSystemDialogs();
  await sleep(400);

  if (!(await tapSaveSetIfVisible())) {
    logStep('v7-guided:btn-save-set-missing');
    try {
      await element(by.text('Salvar serie')).tap();
      logStep('v7-guided:save-by-text');
    } catch {
      // auto-save via confirm reps pode ter sido suficiente
    }
  } else {
    logStep('v7-guided:btn-save-set-tapped');
  }

  await assertGuidedSetSaved(weight, reps);
}

async function ensureSecondGuidedExercise() {
  if (await isVisible('workout-exercise-index-2', 2000)) {
    return;
  }

  await ensureAdvancedWorkoutView();
  await scrollToElement('screen-workout', 'btn-adicionar-exercicio-workout', 'down', 360, 14);

  try {
    await element(by.text(GUIDED_EX2_NAME)).tap();
    logStep(`v7-guided:ex2-chip:${GUIDED_EX2_NAME}`);
  } catch {
    await replaceInput('input-novo-exercicio', GUIDED_EX2_NAME);
  }

  await replaceInput('input-novo-exercicio-series', '3');
  await replaceInput('input-novo-exercicio-reps', '8');
  await tapElement('btn-adicionar-exercicio-workout');
  await sleep(600);

  if (!(await isVisible('workout-exercise-index-2', 4000))) {
    await scrollToElement('screen-workout', 'workout-exercise-index-2', 'up', 320, 10);
  }

  if (!(await isVisible('workout-exercise-index-2', 3000))) {
    throw new Error(`v7-guided:ex2-not-added:${GUIDED_EX2_NAME}`);
  }

  logStep('v7-guided:ex2-added');
}

async function ensureAdvancedWorkoutView() {
  if (await isVisible('workout-exercise-index-2', 1500)) {
    return;
  }

  if (!(await isVisible('btn-toggle-workout-mode', 2000))) {
    await scrollToElement('screen-workout', 'btn-toggle-workout-mode', 'up', 320, 8);
  }

  if (await isVisible('btn-toggle-workout-mode', 2500)) {
    await tapElement('btn-toggle-workout-mode');
    await sleep(500);
    logStep('v7-guided:advanced-mode-enabled');
  }
}

async function focusExercise(index) {
  await ensureAdvancedWorkoutView();
  const badgeId = `workout-exercise-index-${index}`;

  await scrollToElement('screen-workout', badgeId, 'up', 320, 8);
  await scrollToElement('screen-workout', badgeId, 'down', 360, 10);

  if (await tryTapViaXmlBounds(badgeId)) {
    logStep(`v7-guided:focus-xml:${badgeId}`);
    await sleep(400);
    return;
  }

  try {
    await element(by.id(badgeId)).tap();
    logStep(`v7-guided:focus-tap:${badgeId}`);
    await sleep(400);
    return;
  } catch {
    // segue para fallbacks
  }

  if (index === 2 && (await isVisible('workout-next-exercise-name', 2500))) {
    try {
      const attrs = await element(by.id('workout-next-exercise-name')).getAttributes();
      const name = String(attrs?.text || attrs?.label || '').trim();
      if (name) {
        await element(by.text(name)).tap();
        logStep(`v7-guided:focus-next:${name}`);
        await sleep(400);
        return;
      }
    } catch {
      // segue para fallback do badge
    }
  }

  await tapElement(badgeId, 8000);
  await sleep(400);
}

jest.setTimeout(600000);

describe('99 - V7 guided weight reps', () => {
  const persona = getPersona();

  beforeAll(async () => {
    const attachedRun = isAttachedRun();
    await launchApp({ deleteApp: !attachedRun });
    await ensureOnboarded(persona);
    await resetWorkoutStateViaQaDeepLink(persona);
    await assertMainTabsReadyOrFail(persona, {
      evidencePrefix: 'v7_guided_auth_fail_retry4',
    });
  });

  it('salva peso/reps em 2 exercícios sem mistura', async () => {
    logStep('v7-guided:start');
    await openGuidedWorkout();
    await ensureSecondGuidedExercise();
    await focusExercise(1);
    await device.takeScreenshot('v7_weight_reps_guided_before_fill');

    await saveGuidedSet(WEIGHT_1, REPS_1);
    await device.takeScreenshot('v7_weight_reps_guided_ex1_saved');
    adbUiDump('v7_weight_reps_guided_after_ex1');

    await focusExercise(2);
    await saveGuidedSet(WEIGHT_2, REPS_2);
    await device.takeScreenshot('v7_weight_reps_guided_ex2_saved');

    await focusExercise(1);
    await sleep(500);
    await device.takeScreenshot('v7_weight_reps_guided_back_ex1');
    adbUiDump('v7_weight_reps_guided_after');
    logStep('v7-guided:pass');
  });
});
