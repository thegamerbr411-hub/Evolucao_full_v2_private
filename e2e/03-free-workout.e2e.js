const { getPersona } = require('./helpers/personas');
const { ensureOnboarded, launchApp, runFreeWorkoutHappyPath } = require('./helpers/flows');

describe('03 - free workout', () => {
  const persona = getPersona();

  beforeAll(async () => {
    await launchApp();
    await ensureOnboarded(persona);
  });

  it('cria treino livre, adiciona exercicios e salva como rotina', async () => {
    await runFreeWorkoutHappyPath(persona);
    await expect(element(by.id('screen-routines'))).toBeVisible();
  });
});
