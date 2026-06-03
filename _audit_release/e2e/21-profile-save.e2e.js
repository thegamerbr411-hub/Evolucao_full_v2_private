const { getPersona } = require('./helpers/personas');
const { ensureOnboarded, goToProfile, launchApp } = require('./helpers/flows');
const { isVisible, replaceInput, tapElement, waitForAny } = require('./helpers/utils');

describe('21 - profile save', () => {
  const persona = getPersona();

  beforeAll(async () => {
    await launchApp({ deleteApp: true });
    await ensureOnboarded(persona);
  });

  it('abre perfil, edita peso e salva sem quebrar', async () => {
    await goToProfile();
    const profileScreen = await waitForAny(['screen-perfil', 'screen_profile', 'screen-profile'], 15000);
    if (!profileScreen) {
      throw new Error('Tela de perfil nao abriu apos tocar na aba.');
    }

    await replaceInput('input-profile-current-weight', '78');
    await tapElement('btn-profile-save');

    const feedback = await waitForAny(['screen-perfil', 'screen_profile', 'tab-profile', 'tab_profile'], 8000);
    if (!feedback) {
      throw new Error('Nenhum feedback de perfil detectado apos salvar.');
    }

    if (await isVisible('toast-title', 1200)) {
      await expect(element(by.id('toast-title'))).toBeVisible();
    }

    if (await isVisible('android:id/button1', 1200)) {
      await element(by.id('android:id/button1')).tap();
    } else if (await isVisible('OK', 1200)) {
      await element(by.text('OK')).tap();
    }

    const profileStillVisible = await waitForAny(['screen-perfil', 'screen_profile', 'screen-profile'], 8000);
    if (!profileStillVisible) {
      throw new Error('Tela de perfil nao permaneceu visivel apos salvar.');
    }
  });
});