/**
 * Reps V7 Detox dedicado — preenche peso + reps e salva série guiada.
 *
 * Pré-requisitos:
 * - Preferencial: sessão logada + `npx detox test --reuse --configuration android.attached.debug`
 * - Alternativa: QA_TEST_EMAIL / QA_TEST_PASSWORD no ambiente
 * - Device: DETOX_ADB_NAME=RQ8T209ZTAF
 * - APK Detox com Auth PR #42 embutido
 *
 * Harness: alinhado ao fluxo provado em e2e/99-v7-guided-weight-reps.e2e.js
 */
const fs = require('fs');
const path = require('path');
const { expect: jestExpect } = require('@jest/globals');
const { getPersona } = require('./helpers/personas');
const {
  completeOnboarding,
  ensureGuidedInputReady,
  ensureOnboarded,
  goToTreinos,
  isAuthScreenVisible,
  resetWorkoutStateViaQaDeepLink,
} = require('./helpers/flows');
const {
  assertGuidedSetSaved,
  dismissBlockingSystemDialogs,
  dismissInlineSetRowKeypad,
  hideKeyboardIfNeeded,
  isVisible,
  logStep,
  readWorkoutInputValue,
  replaceInput,
  scrollToElement,
  setKeypadValueStrict,
  sleep,
  stabilizeAfterKeypadConfirm,
  tapElement,
  waitForAny,
} = require('./helpers/utils');

const WEIGHT = '20';
const REPS = '10';
const AUDIT_ROOT = path.resolve(__dirname, '..', '.qa_runtime', 'visual_audit', 'reps_v7');
const SHOTS_DIR = path.join(AUDIT_ROOT, 'screenshots');
const RESULT_FILE = path.join(AUDIT_ROOT, 'detox_run_result.json');

const proof = {
  run: 'reps_v7_guided_set',
  at: new Date().toISOString(),
  screenWorkout: false,
  weightFilled: false,
  repsFilled: false,
  saveTapped: false,
  setSaved: false,
  inputWeightVisible: false,
  inputRepsExists: false,
  repsConfirmedOk: false,
  verdict: 'REPS_V7_INCONCLUSIVE',
  steps: [],
  screenshots: [],
  error: null,
  bootstrap: null,
  envBlocked: false,
};

function ensureAuditDirs() {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  fs.mkdirSync(path.join(AUDIT_ROOT, 'xml'), { recursive: true });
}

async function captureStep(name) {
  const fileName = `reps_v7_${name}`;
  try {
    await device.takeScreenshot(fileName);
    proof.screenshots.push({
      name: fileName,
      path: `.qa_runtime/visual_audit/reps_v7/screenshots/${fileName}.png`,
    });
  } catch (error) {
    proof.steps.push({ name, screenshot: 'fail', note: String(error?.message || error) });
  }
}

function recordStep(name, ok, note = '') {
  proof.steps.push({ name, ok: Boolean(ok), note });
}

async function bootstrapSession(persona) {
  const bootstrap = { mode: 'unknown', authMarker: null };
  try {
    await device.launchApp({
      newInstance: false,
      launchArgs: { detoxEnableSynchronization: 0 },
    });
  } catch (error) {
    bootstrap.softLaunchError = String(error?.message || error);
  }
  await sleep(1500);

  if (await isVisible('tab-treino', 2500) || await isVisible('tab-home', 2500)) {
    bootstrap.mode = 'tabs_already_ready';
    try {
      await ensureOnboarded(persona);
    } catch (error) {
      bootstrap.ensureOnboardedSkip = String(error?.message || error);
    }
    proof.bootstrap = bootstrap;
    return bootstrap.mode;
  }

  bootstrap.authMarker = await isAuthScreenVisible();
  if (bootstrap.authMarker) {
    const email = process.env.QA_TEST_EMAIL;
    const password = process.env.QA_TEST_PASSWORD;
    if (!email || !password) {
      bootstrap.mode = 'auth_unresolved';
      proof.envBlocked = true;
      proof.bootstrap = bootstrap;
      return bootstrap.mode;
    }
    bootstrap.mode = 'login_env';
    if (await isVisible('btn_go_login', 1500)) {
      await tapElement('btn_go_login');
      await sleep(400);
    }
    await scrollToElement('screen_login', 'input_email', 'down', 320, 6);
    await replaceInput('input_email', email);
    await scrollToElement('screen_login', 'input_password', 'down', 320, 6);
    await replaceInput('input_password', password);
    await tapElement('btn_login');
    await waitForAny(['tab-home', 'tab-treino', 'questionnaire-screen'], 30000);
    if (await isVisible('questionnaire-screen', 2000)) {
      await completeOnboarding(persona);
    }
    await ensureOnboarded(persona);
    proof.bootstrap = bootstrap;
    return bootstrap.mode;
  }

  try {
    await ensureOnboarded(persona);
    bootstrap.mode = 'ensure_onboarded';
  } catch (error) {
    bootstrap.ensureOnboardedError = String(error?.message || error);
    proof.envBlocked = true;
    bootstrap.mode = 'auth_unresolved';
  }
  proof.bootstrap = bootstrap;
  return bootstrap.mode;
}

async function openGuidedWorkout() {
  await goToTreinos();
  await captureStep('01_treino_hub');
  let workoutOpened = false;
  for (let attempt = 1; attempt <= 3 && !workoutOpened; attempt += 1) {
    if (!(await isVisible('btn-iniciar-treino', 1500))) {
      try {
        await goToTreinos();
      } catch {
        // retry
      }
    }
    await tapElement('btn-iniciar-treino');
    try {
      const next = await waitForAny(['screen-workout', 'screen-treinos', 'screen-routines'], 22000);
      if (next === 'screen-workout') {
        workoutOpened = true;
        break;
      }
    } catch {
      // retry
    }
    if (attempt < 3) await sleep(350);
  }
  if (!workoutOpened) {
    throw new Error('reps-v7:workout-not-opened');
  }
  proof.screenWorkout = true;
  recordStep('screen_workout', true);
  await captureStep('02_screen_workout');
}

async function ensureInlineKeypadClosed() {
  await dismissInlineSetRowKeypad();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!(await isVisible('keypad-modal', 900)) && !(await isVisible('Limpar', 900))) {
      break;
    }
    await dismissInlineSetRowKeypad();
    await sleep(350);
  }
  await stabilizeAfterKeypadConfirm();
  await dismissBlockingSystemDialogs();
  await sleep(300);
}

async function verifyFieldValue(fieldId, expected) {
  await sleep(400);
  const found = await readWorkoutInputValue(fieldId);
  recordStep(`verify_${fieldId}`, found === expected, `expected=${expected} found=${found}`);
  if (found !== expected) {
    throw new Error(`reps-v7:${fieldId}-not-verified:expected=${expected} found=${found}`);
  }
  return true;
}

async function fillGuidedField(fieldId, value, useXmlTap = false, forceRefill = false) {
  await ensureGuidedInputReady(fieldId);
  const result = await setKeypadValueStrict(fieldId, value, {
    useXmlTap,
    maxRetries: 2,
    forceRefill,
    xmlVerifyFn: readWorkoutInputValue,
  });
  recordStep(`field_${fieldId}_strict`, result.ok, result.note);
  if (!result.ok) {
    throw new Error(`reps-v7:${fieldId}-fill-fail:${result.note}`);
  }
  await ensureInlineKeypadClosed();
  await dismissBlockingSystemDialogs();
  await sleep(300);
  return verifyFieldValue(fieldId, value);
}

async function tapSaveSetAndAssert() {
  await ensureInlineKeypadClosed();
  await hideKeyboardIfNeeded();

  if (!(await isVisible('btn-save-set', 5000))) {
    throw new Error('reps-v7:btn-save-set-not-visible');
  }
  recordStep('btn_save_set_visible', true);

  try {
    await scrollToElement('screen-workout', 'btn-save-set', 'down', 220, 6);
  } catch {
    // segue
  }

  await waitFor(element(by.id('btn-save-set'))).toBeVisible().withTimeout(4000);
  await tapElement('btn-save-set');
  logStep('reps-v7:save-set-tap');
  recordStep('save_set_tapped', true);

  await assertGuidedSetSaved(WEIGHT, REPS);
  proof.saveTapped = true;
  proof.setSaved = true;
  recordStep('set_saved', true, `${WEIGHT}kg x ${REPS}`);
  return true;
}

function classifyVerdict() {
  if (proof.envBlocked) {
    return 'REPS_V7_AUTH_SESSION_REQUIRED';
  }
  if (proof.setSaved && proof.weightFilled && proof.repsFilled) {
    return 'REPS_V7_PASS_READY';
  }
  if (proof.repsFilled && proof.saveTapped && !proof.setSaved) {
    return 'REPS_V7_FLOW_PROVED_BUT_EXIT_FAIL';
  }
  if (proof.screenWorkout && proof.weightFilled && !proof.repsFilled) {
    return 'REPS_V7_DETOX_HARNESS_LIMITATION';
  }
  return 'REPS_V7_INCONCLUSIVE';
}

function persistResult() {
  proof.verdict = classifyVerdict();
  proof.at = new Date().toISOString();
  fs.writeFileSync(RESULT_FILE, JSON.stringify(proof, null, 2), 'utf8');
}

jest.setTimeout(600000);

describe('21 - reps v7 guided set dedicated', () => {
  const persona = getPersona();

  beforeAll(async () => {
    ensureAuditDirs();
    const mode = await bootstrapSession(persona);
    logStep(`reps-v7 bootstrap=${mode}`);
    if (proof.envBlocked) {
      persistResult();
      return;
    }
    await resetWorkoutStateViaQaDeepLink(persona);
    logStep('reps-v7:workout-reset-ok');
  });

  afterAll(async () => {
    persistResult();
  });

  it('prova peso + reps + salvar serie no treino guiado', async () => {
    if (proof.envBlocked) {
      throw new Error('REPS_V7_AUTH_SESSION_REQUIRED');
    }

    try {
      await openGuidedWorkout();

      proof.inputWeightVisible = await isVisible('input-weight', 3000);
      recordStep('input_weight_visible', proof.inputWeightVisible);

      proof.weightFilled = await fillGuidedField('input-weight', WEIGHT, false);
      recordStep('weight_filled', true, WEIGHT);
      await captureStep('03_weight_filled');

      await ensureGuidedInputReady('input-reps');
      try {
        await waitFor(element(by.id('input-reps'))).toExist().withTimeout(4000);
        proof.inputRepsExists = true;
      } catch {
        proof.inputRepsExists = false;
      }
      recordStep('input_reps_exists', proof.inputRepsExists);

      proof.repsFilled = await fillGuidedField('input-reps', REPS, true, true);
      proof.repsConfirmedOk = !(await isVisible('Limpar', 800));
      recordStep('reps_confirmed_ok', proof.repsConfirmedOk);
      recordStep('reps_filled', true, REPS);
      await captureStep('05_reps_filled');
      await captureStep('05b_before_save');

      await tapSaveSetAndAssert();
      await captureStep('06_final');

      jestExpect(proof.screenWorkout).toBe(true);
      jestExpect(proof.weightFilled).toBe(true);
      jestExpect(proof.repsFilled).toBe(true);
      jestExpect(proof.setSaved).toBe(true);
      jestExpect(proof.saveTapped).toBe(true);
    } catch (error) {
      proof.error = String(error?.message || error);
      await captureStep('99_error');
      persistResult();
      throw error;
    }
  });
});
