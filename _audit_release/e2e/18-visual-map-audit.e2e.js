const fs = require('fs');
const path = require('path');
const { getPersona } = require('./helpers/personas');
const {
  ensureOnboarded,
  goHome,
  goToCoach,
  goToNutrition,
  goToSocial,
  goToTreinos,
  launchApp,
} = require('./helpers/flows');
const {
  isVisible,
  logStep,
  replaceInput,
  sleep,
  tapElement,
  waitForAny,
} = require('./helpers/utils');

const QA_DIR = path.resolve(__dirname, '..', 'qa');
const REPORT_FILE = path.join(QA_DIR, 'visual-map-audit.last.json');

function ensureQaDir() {
  if (!fs.existsSync(QA_DIR)) {
    fs.mkdirSync(QA_DIR, { recursive: true });
  }
}

function shotName(name) {
  const seed = String(process.env.QA_SEED || Date.now());
  return `visual-map-${seed}-${name}`;
}

async function shot(name) {
  await device.takeScreenshot(shotName(name));
}

async function disableSyncSafely(timeoutMs = 7000) {
  let timedOut = false;

  try {
    await Promise.race([
      device.disableSynchronization(),
      sleep(timeoutMs).then(() => {
        timedOut = true;
      }),
    ]);
    return !timedOut;
  } catch {
    return false;
  }
}

async function captureScrollable(targetId, name) {
  await shot(`${name}-start`);
  try {
    await element(by.id(targetId)).scroll(360, 'down');
    await sleep(150);
    await shot(`${name}-mid`);

    for (let i = 0; i < 4; i += 1) {
      await element(by.id(targetId)).scroll(460, 'down');
      await sleep(120);
    }
  } catch {
    // best effort
  }
  await shot(`${name}-end`);
}

async function goBackSafe() {
  try {
    await device.pressBack();
    await sleep(300);
  } catch {
    // sem back disponível
  }
}

describe('18 - visual map audit', () => {
  const persona = getPersona();
  jest.setTimeout(900000);

  it('captura mapa visual completo antes de melhorias', async () => {
    ensureQaDir();
    const isAttachedRun = String(process.env.DETOX_CONFIGURATION || '').includes('android.attached');

    const report = {
      completedAt: null,
      visited: [],
      arrozAppearedAsExercise: false,
      notes: [],
    };

    await launchApp({ deleteApp: !isAttachedRun });
    const syncDisabled = await disableSyncSafely(7000);
    report.notes.push(syncDisabled ? 'sync-disabled' : 'sync-disable-timeout-or-failed');

    if (isAttachedRun) {
      // Modo attached nao aceita skip de interacoes no gate oficial de release.
      // O audit completo precisa ser executado num emulador (android.emu) para garantir cobertura real.
      await device.takeScreenshot('visual-map-audit-attached-blocked');
      throw new Error(
        'visual-map-audit (18) nao pode executar em modo attached: use android.emu para garantir cobertura completa de telas e interacoes.'
      );
    }

    await ensureOnboarded(persona);
    await goHome();
    await waitForAny(['screen-home', 'tab-home'], 15000);

    report.visited.push('home');
    await captureScrollable('screen-home', 'home-main');

    if (await isVisible('btn-add-agua', 1200)) {
      await tapElement('btn-add-agua');
      await shot('home-water-action');
      if (await isVisible('feedback-add-agua', 1200)) {
        await shot('home-water-feedback');
      }
    }

    if (await isVisible('home-quick-treino', 1200)) {
      await tapElement('home-quick-treino');
      await waitForAny(['screen-workout', 'screen-treinos'], 15000);
      report.visited.push('quick-treino');
      if (await isVisible('screen-workout', 1200)) {
        await captureScrollable('screen-workout', 'quick-workout');
      } else if (await isVisible('screen-treinos', 1200)) {
        await captureScrollable('screen-treinos', 'quick-workout-hub');
      }
      await goBackSafe();
      await goHome();
    }

    if (await isVisible('home-quick-nutricao', 1200)) {
      await tapElement('home-quick-nutricao');
      await waitFor(element(by.id('screen-nutricao'))).toBeVisible().withTimeout(15000);
      report.visited.push('quick-nutricao');
      await captureScrollable('screen-nutricao', 'quick-nutrition');
      await goBackSafe();
      await goHome();
    }

    if (await isVisible('home-quick-coach', 1200)) {
      await tapElement('home-quick-coach');
      await waitFor(element(by.id('screen-coach'))).toBeVisible().withTimeout(15000);
      report.visited.push('quick-coach');
      await captureScrollable('screen-coach', 'quick-coach');
      await goBackSafe();
      await goHome();
    }

    // Abas principais
    await goToTreinos();
    report.visited.push('treino-hub');
    await captureScrollable('screen-treinos', 'treino-hub');

    if (await isVisible('btn-open-free-workout', 1200)) {
      await tapElement('btn-open-free-workout');
      await waitFor(element(by.id('screen-free-workout'))).toBeVisible().withTimeout(15000);
      report.visited.push('treino-livre');
      await captureScrollable('screen-free-workout', 'treino-livre');

      // Checagem visual do caso "Arroz" em contexto de exercício.
      if (await isVisible('input-free-exercise-name', 1200) && await isVisible('btn-free-add-exercise', 1200)) {
        await replaceInput('input-free-exercise-name', 'Arroz');
        await tapElement('btn-free-add-exercise');
        await sleep(250);
        report.arrozAppearedAsExercise = await isVisible('card-free-exercise-arroz', 1200);
        await shot('treino-livre-arroz-check');
        if (report.arrozAppearedAsExercise) {
          report.notes.push('Arroz foi aceito como exercício no treino livre.');
        }
      }

      if (await isVisible('btn-free-save-routine', 1200)) {
        await tapElement('btn-free-save-routine');
        await sleep(500);
        await shot('treino-livre-save-routine-popup');
        try {
          await waitFor(element(by.text('OK'))).toBeVisible().withTimeout(1200);
          await shot('treino-livre-alert-ok');
          await element(by.text('OK')).tap();
        } catch {
          // alerta pode não aparecer
        }
      }

      // Tentar abrir detalhe de exercício via botão inline.
      try {
        await element(by.text('Detalhes')).atIndex(0).tap();
        await waitFor(element(by.id('screen-exercise-detail'))).toBeVisible().withTimeout(8000);
        report.visited.push('exercise-detail');
        await captureScrollable('screen-exercise-detail', 'exercise-detail');
        await goBackSafe();
      } catch {
        report.notes.push('Nao foi possivel abrir detalhe por botao Detalhes nesta execucao.');
      }

      await goBackSafe();
      await goToTreinos();
    }

    if (await isVisible('btn-open-routines', 1200)) {
      await tapElement('btn-open-routines');
      await waitFor(element(by.id('screen-routines'))).toBeVisible().withTimeout(15000);
      report.visited.push('rotinas');
      await captureScrollable('screen-routines', 'rotinas');
      await goBackSafe();
      await goToTreinos();
    }

    if (await isVisible('btn-open-import-workout', 1200)) {
      await tapElement('btn-open-import-workout');
      await shot('import-workout-start');
      report.visited.push('import-workout');
      await goBackSafe();
      await goToTreinos();
    }

    if (await isVisible('btn-open-social', 1200)) {
      await tapElement('btn-open-social');
      await waitFor(element(by.id('screen-social'))).toBeVisible().withTimeout(15000);
      report.visited.push('social-from-hub');
      await captureScrollable('screen-social', 'social-hub-entry');
      await goBackSafe();
      await goToTreinos();
    }

    if (await isVisible('btn-open-ranking', 1200)) {
      await tapElement('btn-open-ranking');
      await shot('ranking-start');
      report.visited.push('ranking');
      await goBackSafe();
      await goToTreinos();
    }

    if (await isVisible('btn-open-admin', 1200)) {
      await tapElement('btn-open-admin');
      await shot('admin-start');
      report.visited.push('admin');
      await goBackSafe();
      await goToTreinos();
    }

    await goToNutrition();
    report.visited.push('nutricao');
    await captureScrollable('screen-nutricao', 'nutricao-main');

    await goToCoach();
    report.visited.push('coach');
    await captureScrollable('screen-coach', 'coach-main');
    if (await isVisible('chat-input', 1000)) {
      await replaceInput('chat-input', 'Me mostre como está meu plano hoje.');
      await shot('coach-chat-typed');
    }

    await goToSocial();
    report.visited.push('social-tab');
    await captureScrollable('screen-social', 'social-tab-main');

    if (await isVisible('tab-perfil', 1200)) {
      await tapElement('tab-perfil');
      await sleep(500);
      report.visited.push('perfil');
      await shot('perfil-start');
      try {
        await element(by.type('RCTScrollView')).atIndex(0).scroll(420, 'down');
        await sleep(120);
      } catch {
        // best effort
      }
      await shot('perfil-mid');
      try {
        await element(by.type('RCTScrollView')).atIndex(0).scroll(980, 'down');
        await sleep(120);
      } catch {
        // best effort
      }
      await shot('perfil-end');
    }

    await goHome();
    await shot('home-final-check');

    report.completedAt = new Date().toISOString();
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  });
});
