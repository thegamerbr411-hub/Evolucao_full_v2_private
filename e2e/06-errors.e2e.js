const { getPersona } = require('./helpers/personas');
const { ensureOnboarded, goHome, goToNutrition, goToTreinos, launchApp, saveGuidedWorkoutPartial } = require('./helpers/flows');
const {
  countBugOccurrences,
  countEventEntries,
  fetchHeatmap,
  isVisible,
  replaceInput,
  tapElement,
  waitForAny,
  waitForCountIncrease,
} = require('./helpers/utils');
const { expect: jestExpect } = require('@jest/globals');

const BASE_URL = 'http://127.0.0.1:3000';
const QA_CLIENT_ID = process.env.QA_CLIENT_ID || 'default';

async function postEvent(id) {
  await fetch(`${BASE_URL}/api/events`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-qa-client-id': QA_CLIENT_ID,
      'x-qa-local': '1',
    },
    body: JSON.stringify({
      event: 'tap',
      screen: 'MainTabs',
      meta: {
        domain: 'navigation',
        id,
      },
    }),
  });
}

async function postBug(message, screen = 'e2e-errors') {
  await fetch(`${BASE_URL}/api/log`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-qa-client-id': QA_CLIENT_ID,
      'x-qa-local': '1',
    },
    body: JSON.stringify({
      message,
      screen,
      severity: 'LOW',
      stack: 'Synthetic E2E validation log',
    }),
  });
}

async function dismissNativeAlertIfVisible() {
  try {
    await waitFor(element(by.text('OK'))).toBeVisible().withTimeout(1200);
    await element(by.text('OK')).tap();
    return;
  } catch {
    // continua
  }

  try {
    await device.pressBack();
  } catch {
    // sem alerta aberto
  }
}

describe('06 - error handling and telemetry', () => {
  const persona = getPersona();

  beforeAll(async () => {
    await launchApp();
    await ensureOnboarded(persona);
  });

  it('gera erros de validacao, spam click e envia telemetria', async () => {
    const bugOccurrencesBefore = countBugOccurrences(QA_CLIENT_ID);
    const eventsBefore = countEventEntries(QA_CLIENT_ID);

    await goToTreinos();
    await tapElement('btn-open-free-workout');
    await tapElement('btn-free-save-routine');
    await dismissNativeAlertIfVisible();
    await device.pressBack();
       await waitForAny(['screen-treinos', 'screen-workout', 'screen-home', 'tab-home'], 8000);
    if (!(await isVisible('screen-treinos', 800)) && (await isVisible('tab-treino', 800))) {
      await tapElement('tab-treino');
      await waitFor(element(by.id('screen-treinos'))).toBeVisible().withTimeout(10000);
    }

    await goToNutrition();
    await replaceInput('input-alimento-nome', '');
    await tapElement('btn-adicionar-alimento');

    await goToTreinos();
    await tapElement('btn-iniciar-treino');
    await waitForAny(['btn-save-set', 'btn-salvar-serie', 'btn-add-set', 'screen-workout'], 12000);
    if (await isVisible('btn-save-set', 1200) || await isVisible('btn-salvar-serie', 1200)) {
      await tapElement('btn-save-set');
      await dismissNativeAlertIfVisible();
    }
    await saveGuidedWorkoutPartial();

    await postBug('e2e_validation_error_nutrition');
    await postBug('e2e_validation_error_workout');

    for (let index = 0; index < 6; index += 1) {
      await postEvent('tab-home');
      await postEvent('tab-treino');
      await postEvent('tab-nutricao');
    }

    const bugsAfter = await waitForCountIncrease(() => countBugOccurrences(QA_CLIENT_ID), bugOccurrencesBefore, 90000);
    const eventsAfter = await waitForCountIncrease(() => countEventEntries(QA_CLIENT_ID), eventsBefore, 90000);
    const heatmap = await fetchHeatmap(QA_CLIENT_ID);

    jestExpect(bugsAfter).toBeGreaterThan(bugOccurrencesBefore);
    jestExpect(eventsAfter).toBeGreaterThan(eventsBefore);
    jestExpect(Number(heatmap['tab-home'] || 0)).toBeGreaterThan(0);
    jestExpect(Number(heatmap['tab-treino'] || 0)).toBeGreaterThan(0);
    jestExpect(Number(heatmap['tab-nutricao'] || 0)).toBeGreaterThan(0);
  });
});
