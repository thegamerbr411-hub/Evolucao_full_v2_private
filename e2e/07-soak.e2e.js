const { PERSONAS, getPersona } = require('./helpers/personas');
const { ensureOnboarded, goToCoach, goToNutrition, launchApp, runTrackingHappyPath } = require('./helpers/flows');
const { fetchHeatmap, logStep } = require('./helpers/utils');
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

describe('07 - short soak rotation', () => {
  beforeAll(async () => {
    await launchApp();
    await ensureOnboarded(getPersona());
  });

  it('rotaciona personas com delays humanos e valida heatmap', async () => {
    const sequence = String(process.env.QA_PERSONA_SEQUENCE || Object.keys(PERSONAS).join(','))
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const rounds = Math.max(1, Number(process.env.QA_SOAK_ROUNDS || 2));

    for (let round = 0; round < rounds; round += 1) {
      const personaName = sequence[round % sequence.length];
      const persona = getPersona(personaName);
      logStep(`soak round=${round + 1} persona=${persona.key} seed=${persona.seed}`);
      await runTrackingHappyPath(persona);
      await goToNutrition();
      await goToCoach();
      await postEvent('tab-home');
      await postEvent('tab-nutricao');
      await postEvent('tab-conversa');
    }

    const heatmap = await fetchHeatmap(QA_CLIENT_ID);
    jestExpect(Number(heatmap['tab-home'] || 0)).toBeGreaterThan(0);
    jestExpect(Number(heatmap['tab-conversa'] || 0)).toBeGreaterThan(0);
    jestExpect(Number(heatmap['tab-nutricao'] || 0)).toBeGreaterThan(0);
  });
});
