const { getPersona } = require('./helpers/personas');
const { launchApp, completeOnboarding } = require('./helpers/flows');

describe('01 - onboarding', () => {
  const persona = getPersona();

  it('abre o app, preenche o questionario e entra na home', async () => {
    await launchApp({ deleteApp: true });
    await completeOnboarding(persona);

    await expect(element(by.id('screen-home'))).toBeVisible();
    await expect(element(by.id('home-ready'))).toBeVisible();
  });
});
