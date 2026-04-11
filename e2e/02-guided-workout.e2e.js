const { getPersona } = require('./helpers/personas');
const { ensureOnboarded, launchApp, runGuidedWorkoutHappyPath, saveGuidedWorkoutPartial } = require('./helpers/flows');

describe('02 - guided workout', () => {
  const persona = getPersona();

  beforeAll(async () => {
    await launchApp();
    await ensureOnboarded(persona);
  });

  it('entra no treino guiado, registra serie e salva parcial', async () => {
    await runGuidedWorkoutHappyPath(persona);
    await expect(element(by.id('series-salvas-total'))).toBeVisible();
    await saveGuidedWorkoutPartial();
    await expect(element(by.id('screen-treinos'))).toBeVisible();
  });
});
