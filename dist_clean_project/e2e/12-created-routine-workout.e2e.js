const { getPersona } = require('./helpers/personas');
const { ensureOnboarded, launchApp, runCreatedRoutineWorkoutHappyPath } = require('./helpers/flows');
const { waitForAny } = require('./helpers/utils');

describe('12 - created routine workout', () => {
  const persona = getPersona();

  beforeAll(async () => {
    await launchApp();
    await ensureOnboarded(persona);
  });

  it('cria rotina e usa normalmente como treino recomendado/livre', async () => {
    await runCreatedRoutineWorkoutHappyPath(persona);
    const finalScreen = await waitForAny(['screen-treinos', 'screen-routines', 'tab-treino'], 15000);
    if (!['screen-treinos', 'screen-routines', 'tab-treino'].includes(finalScreen)) {
      throw new Error(`Tela final inesperada: ${finalScreen}`);
    }
  });
});
