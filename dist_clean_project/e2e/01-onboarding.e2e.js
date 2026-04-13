const { getPersona } = require('./helpers/personas');
const { launchApp, completeOnboarding } = require('./helpers/flows');
const { scrollToElement } = require('./helpers/utils');

describe('01 - onboarding', () => {
  const persona = getPersona();

  it('abre o app, preenche o questionario e entra na home', async () => {
    await launchApp({ deleteApp: true });
    await completeOnboarding(persona);

    await expect(element(by.id('screen-home'))).toBeVisible();
    await scrollToElement('screen-home', 'home-ready', 'down', 320, 6);
    await expect(element(by.id('home-ready'))).toBeVisible();
  });
});
