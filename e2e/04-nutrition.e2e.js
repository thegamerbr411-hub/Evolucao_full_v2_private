const { getPersona } = require('./helpers/personas');
const { ensureOnboarded, launchApp, runNutritionHappyPath } = require('./helpers/flows');

describe('04 - nutrition', () => {
  const persona = getPersona();

  beforeAll(async () => {
    await launchApp();
    await ensureOnboarded(persona);
  });

  it('registra refeicao rapida e executa estimativa por texto', async () => {
    await runNutritionHappyPath(persona);
    await expect(element(by.id('screen-nutricao'))).toBeVisible();
  });
});
