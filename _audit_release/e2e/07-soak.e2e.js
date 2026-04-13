const { PERSONAS, getPersona } = require('./helpers/personas');
const { ensureOnboarded, goToCoach, goToNutrition, launchApp, runTrackingHappyPath } = require('./helpers/flows');
const { fetchHeatmap, logStep } = require('./helpers/utils');
const { expect: jestExpect } = require('@jest/globals');

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
    }

    const heatmap = await fetchHeatmap();
    jestExpect(Number(heatmap['tab-home'] || 0)).toBeGreaterThan(0);
    jestExpect(Number(heatmap['tab-conversa'] || 0)).toBeGreaterThan(0);
    jestExpect(Number(heatmap['tab-nutricao'] || 0)).toBeGreaterThan(0);
  });
});
