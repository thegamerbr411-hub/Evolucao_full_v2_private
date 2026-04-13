const { getPersona } = require('./helpers/personas');
const { ensureOnboarded, launchApp, runCoachHappyPath, runTrackingHappyPath } = require('./helpers/flows');

describe('05 - tracking and coach', () => {
  const persona = getPersona();

  beforeAll(async () => {
    await launchApp();
    await ensureOnboarded(persona);
  });

  it('registra agua no tracking diario', async () => {
    await runTrackingHappyPath(persona);
    await expect(element(by.id('feedback-add-agua'))).toBeVisible();
  });

  it('interage com o coach e valida resposta', async () => {
    await runCoachHappyPath(persona);
    await expect(element(by.id('screen-coach'))).toBeVisible();
  });
});
