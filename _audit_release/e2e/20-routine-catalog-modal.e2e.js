/**
 * Catálogo Detox dedicado — modal-routine-catalog via builder manual (etapa 2).
 *
 * Pré-requisitos (sem secrets no código):
 * - Preferencial: sessão já logada + `npx detox test --reuse --configuration android.attached.debug`
 * - Alternativa cold run: QA_TEST_EMAIL e QA_TEST_PASSWORD no ambiente local
 * - Device: DETOX_ADB_NAME=RQ8T209ZTAF (ou device attached configurado)
 * - APK Detox staged com Auth PR #42 embutido
 */
const fs = require('fs');
const path = require('path');
const { expect: jestExpect } = require('@jest/globals');
const { getPersona } = require('./helpers/personas');
const {
  completeOnboarding,
  ensureOnboarded,
  goToTreinos,
  isAuthScreenVisible,
} = require('./helpers/flows');
const {
  isVisible,
  logStep,
  replaceInput,
  scrollToElement,
  sleep,
  tapElement,
  waitForAny,
} = require('./helpers/utils');

const ROUTINE_NAME = 'QACatalogoDetox';
const QUICK_CHIP_ID = 'chip-routine-quick-leg-press-45';
const AUDIT_ROOT = path.resolve(__dirname, '..', '.qa_runtime', 'visual_audit', 'catalogo_detox_dedicated');
const SHOTS_DIR = path.join(AUDIT_ROOT, 'screenshots');
const RESULT_FILE = path.join(AUDIT_ROOT, 'detox_run_result.json');

const proof = {
  run: 'catalogo_detox_dedicated',
  routineName: ROUTINE_NAME,
  at: new Date().toISOString(),
  screenRoutines: false,
  nameFilled: false,
  nextTapped: false,
  step2: false,
  catalogButtonTapped: false,
  modalOpen: false,
  searchVisible: false,
  chipVisible: false,
  verdict: 'CATALOGO_INCONCLUSIVE',
  steps: [],
  screenshots: [],
  error: null,
  bootstrap: null,
  envBlocked: false,
};

function ensureAuditDirs() {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
}

async function captureStep(name) {
  const fileName = `catalogo_detox_${name}`;
  try {
    await device.takeScreenshot(fileName);
    proof.screenshots.push({
      name: fileName,
      path: `.qa_runtime/visual_audit/catalogo_detox_dedicated/screenshots/${fileName}.png`,
    });
  } catch (error) {
    proof.steps.push({ name, screenshot: 'fail', note: String(error?.message || error) });
  }
}

function recordStep(name, ok, note = '') {
  proof.steps.push({ name, ok: Boolean(ok), note });
}

async function dismissFeedbackRapidoSafely() {
  const thumbLabels = ['👍', '👎'];
  for (const label of thumbLabels) {
    try {
      await waitFor(element(by.text(label))).toExist().withTimeout(800);
      await element(by.text(label)).tap();
      logStep(`feedback-dismiss:thumb:${label}`);
      recordStep('dismiss_feedback_rapido', true, `tap ${label}`);
      await sleep(400);
      return true;
    } catch {
      // try next
    }
  }

  for (const buttonId of ['android:id/button2', 'android:id/button1']) {
    try {
      await waitFor(element(by.id(buttonId))).toExist().withTimeout(800);
      await element(by.id(buttonId)).tap();
      logStep(`feedback-dismiss:${buttonId}`);
      recordStep('dismiss_feedback_rapido', true, buttonId);
      await sleep(400);
      return true;
    } catch {
      // try next
    }
  }

  recordStep('dismiss_feedback_rapido', true, 'not_shown');
  return false;
}

async function reopenScreenRoutinesFromTreinosHub() {
  try {
    if (await isVisible('screen-routines', 1200)) {
      return true;
    }
    if (!(await isVisible('screen_treinos', 2500)) && !(await isVisible('btn_open_routines', 2500))) {
      await goToTreinos();
      await sleep(600);
    }
    await scrollToElement('screen_treinos', 'btn_open_routines', 'down', 360, 10);
    await tapElement('btn_open_routines', 12000);
    await waitFor(element(by.id('screen-routines'))).toBeVisible().withTimeout(15000);
    recordStep('recover_screen_routines', true, 'reopened via treinos hub');
    return true;
  } catch (error) {
    recordStep('recover_screen_routines', false, String(error?.message || error));
    return false;
  }
}

async function dismissKeyboardKeepRoutines() {
  let dismissed = false;

  try {
    await element(by.id('screen-routines')).scroll(140, 'down');
    await sleep(350);
    dismissed = true;
    recordStep('dismiss_keyboard_scroll', true, 'scroll 140 down');
  } catch (error) {
    recordStep('dismiss_keyboard_scroll', false, String(error?.message || error));
  }

  if (!dismissed) {
    for (const safeId of ['card-routine-manual-builder', 'input-routine-name']) {
      try {
        if (await isVisible(safeId, 1500)) {
          await element(by.id(safeId)).tapAtPoint({ x: 180, y: 48 });
          await sleep(350);
          dismissed = true;
          recordStep('dismiss_keyboard_tap_safe', true, safeId);
          break;
        }
      } catch {
        // try next safe target
      }
    }
  }

  if (!(await isVisible('screen-routines', 2000))) {
    const recovered = await reopenScreenRoutinesFromTreinosHub();
    if (recovered && proof.nameFilled) {
      await scrollToElement('screen-routines', 'input-routine-name', 'down', 360, 14);
      try {
        await replaceInput('input-routine-name', ROUTINE_NAME);
        recordStep('refill_routine_name_after_recover', true);
      } catch (error) {
        recordStep('refill_routine_name_after_recover', false, String(error?.message || error));
      }
    }
    return recovered;
  }

  return true;
}

async function assertStep2Reached() {
  if (await isVisible('btn-open-routine-catalog-modal', 2500)) {
    proof.step2 = true;
    recordStep('step2_catalog_button', true, 'btn-open-routine-catalog-modal visible');
    return true;
  }

  try {
    await waitFor(element(by.text('Etapa 2/4'))).toExist().withTimeout(2500);
    proof.step2 = true;
    recordStep('step2_label', true, 'Etapa 2/4');
    return true;
  } catch {
    try {
      await waitFor(element(by.text('2. Adicionar exercicios'))).toExist().withTimeout(1500);
      proof.step2 = true;
      recordStep('step2_label', true, '2. Adicionar exercicios');
      return true;
    } catch (error) {
      recordStep('step2_label', false, String(error?.message || error));
      return false;
    }
  }
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
      bootstrap.registerBlocked = 'QA_TEST_EMAIL/QA_TEST_PASSWORD not set; screen_login requires email verification';
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

function classifyVerdict() {
  if (proof.envBlocked) {
    return 'CATALOGO_DETOX_ENV_BLOCKED';
  }
  if (proof.modalOpen && proof.searchVisible && proof.chipVisible) {
    return 'CATALOGO_PASS_READY';
  }
  if (proof.step2 && !proof.modalOpen) {
    return 'CATALOGO_STEP_NAV_OK_MODAL_MISSING';
  }
  if (proof.screenRoutines && !proof.nextTapped && !proof.step2) {
    return 'CATALOGO_DETOX_HARNESS_LIMITATION';
  }
  if (proof.step2 && proof.catalogButtonTapped && !proof.modalOpen) {
    return 'CATALOGO_PRODUCT_BUG_CONFIRMED';
  }
  return 'CATALOGO_INCONCLUSIVE';
}

function persistResult() {
  proof.verdict = classifyVerdict();
  fs.writeFileSync(RESULT_FILE, JSON.stringify(proof, null, 2), 'utf8');
}

describe('20 - routine catalog modal dedicated', () => {
  const persona = getPersona();

  beforeAll(async () => {
    ensureAuditDirs();
    const mode = await bootstrapSession(persona);
    logStep(`catalogo-detox bootstrap=${mode}`);
    if (proof.envBlocked) {
      persistResult();
      return;
    }
  });

  afterAll(async () => {
    persistResult();
  });

  it('prova modal-routine-catalog via builder step 2 sem salvar rotina', async () => {
    if (proof.envBlocked) {
      throw new Error('CATALOGO_DETOX_ENV_BLOCKED');
    }
    try {
      await goToTreinos();
      await captureStep('01_treino_hub');

      await scrollToElement('screen_treinos', 'btn_open_routines', 'down', 360, 10);
      await tapElement('btn_open_routines', 12000);
      recordStep('tap_btn_open_routines', true);

      await waitFor(element(by.id('screen-routines'))).toBeVisible().withTimeout(15000);
      proof.screenRoutines = true;
      recordStep('screen_routines_visible', true);
      await captureStep('02_screen_routines');

      await dismissFeedbackRapidoSafely();
      if (!(await isVisible('screen-routines', 1200))) {
        throw new Error('Saiu de screen-routines apos dismiss feedback');
      }

      await scrollToElement('screen-routines', 'input-routine-name', 'down', 360, 14);
      await replaceInput('input-routine-name', ROUTINE_NAME);
      proof.nameFilled = true;
      recordStep('fill_input_routine_name', true, ROUTINE_NAME);
      await captureStep('03_name_filled');

      const keyboardDismissed = await dismissKeyboardKeepRoutines();
      if (!keyboardDismissed || !(await isVisible('screen-routines', 2500))) {
        throw new Error('Perdeu screen-routines apos dismiss teclado');
      }

      const nextScrollOk = await scrollToElement(
        'screen-routines',
        'btn-routine-builder-next',
        'down',
        360,
        20
      );
      recordStep('scroll_to_next', nextScrollOk, 'btn-routine-builder-next');

      if (!(await isVisible('btn-routine-builder-next', 5000))) {
        await scrollToElement('screen-routines', 'btn-routine-builder-next', 'down', 420, 8);
      }
      if (!(await isVisible('btn-routine-builder-next', 5000))) {
        throw new Error('btn-routine-builder-next nao visivel apos scroll');
      }
      await captureStep('04_before_next_tap');

      await tapElement('btn-routine-builder-next', 12000);
      proof.nextTapped = true;
      recordStep('tap_btn_routine_builder_next', true);
      await sleep(500);

      const step2Ok = await assertStep2Reached();
      if (!step2Ok) {
        await captureStep('05_step2_fail');
        throw new Error('Etapa 2 nao comprovada apos Proximo');
      }
      await captureStep('05_step2_ok');

      await scrollToElement('screen-routines', 'btn-open-routine-catalog-modal', 'down', 320, 8);
      await tapElement('btn-open-routine-catalog-modal', 12000);
      proof.catalogButtonTapped = true;
      recordStep('tap_open_catalog_modal', true);
      await sleep(700);

      proof.modalOpen = await isVisible('modal-routine-catalog', 8000);
      recordStep('modal_routine_catalog', proof.modalOpen);
      await captureStep('06_modal_state');

      proof.searchVisible = await isVisible('input-routine-search', 6000);
      recordStep('input_routine_search', proof.searchVisible);

      proof.chipVisible = await isVisible(QUICK_CHIP_ID, 6000);
      if (!proof.chipVisible) {
        proof.chipVisible = await isVisible('chip-routine-quick-agachamento-livre', 3000);
      }
      recordStep('chip_routine_quick', proof.chipVisible, QUICK_CHIP_ID);

      if (proof.modalOpen) {
        try {
          await waitFor(element(by.text('Fechar'))).toBeVisible().withTimeout(4000);
          await element(by.text('Fechar')).tap();
          recordStep('close_modal_fechar', true);
          await sleep(500);
        } catch (error) {
          recordStep('close_modal_fechar', false, String(error?.message || error));
        }
      }

      await captureStep('07_final');

      if (!(proof.modalOpen && proof.searchVisible && proof.chipVisible)) {
        if (proof.step2 && !proof.modalOpen) {
          throw new Error('CATALOGO_STEP_NAV_OK_MODAL_MISSING');
        }
        if (proof.screenRoutines && !proof.nextTapped) {
          throw new Error('CATALOGO_DETOX_HARNESS_LIMITATION');
        }
        throw new Error(classifyVerdict());
      }

      jestExpect(proof.modalOpen).toBe(true);
      jestExpect(proof.searchVisible).toBe(true);
      jestExpect(proof.chipVisible).toBe(true);
    } catch (error) {
      proof.error = String(error?.message || error);
      await captureStep('99_error');
      persistResult();
      throw error;
    } finally {
      persistResult();
    }
  });
});
