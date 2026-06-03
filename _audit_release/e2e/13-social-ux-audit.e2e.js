const { getUserProfile } = require('./helpers/userProfiles');
const { ensureOnboarded } = require('./helpers/flows');
const { tapElement } = require('./helpers/utils');

describe('13 - social ux audit', () => {
  const profile = getUserProfile();
  jest.setTimeout(480000);

  it('valida aba social obrigatoria e captura evidencias visuais', async () => {
    await device.launchApp({ newInstance: false });
    await device.disableSynchronization();
    await ensureOnboarded(profile);

    await expect(element(by.id('tab-social'))).toBeVisible();
    await device.takeScreenshot('ux-home-with-social-tab');

    // Critico: aba social deve existir e abrir a tela social.
    await tapElement('tab-social');
    await expect(element(by.id('screen-social'))).toBeVisible();
    await device.takeScreenshot('ux-social');
  });
});
