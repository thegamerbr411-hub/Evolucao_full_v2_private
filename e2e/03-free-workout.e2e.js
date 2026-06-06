const { getPersona } = require('./helpers/personas');
const { ensureMainTabsReady, ensureOnboarded, launchApp, runFreeWorkoutHappyPath } = require('./helpers/flows');

describe('03 - free workout', () => {
  const persona = getPersona();

  beforeAll(async () => {
    await launchApp();
    await ensureOnboarded(persona);
    await ensureMainTabsReady(persona);
  });

  it('cria treino livre, adiciona exercicios e salva como rotina', async () => {
    await runFreeWorkoutHappyPath(persona);
    await expect(element(by.id('screen-routines'))).toBeVisible();
  });
});
