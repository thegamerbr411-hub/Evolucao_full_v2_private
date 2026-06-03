const { getUserProfile } = require('./helpers/userProfiles');
const { ensureOnboarded, goToSocial, launchApp } = require('./helpers/flows');
const { tapElement, waitForAny } = require('./helpers/utils');

describe('13 - social ux audit', () => {
  const profile = getUserProfile();
  jest.setTimeout(480000);

  it('valida aba social obrigatoria e captura evidencias visuais', async () => {
    await launchApp({ deleteApp: true });
    await ensureOnboarded(profile);
    await device.disableSynchronization();

    await goToSocial();
    const socialScreen = await waitForAny(['screen-social', 'screen_social'], 15000);
    if (!socialScreen) {
      throw new Error('tela social nao ficou visivel apos tocar na aba social.');
    }
    await device.takeScreenshot('ux-social');
  });
});
