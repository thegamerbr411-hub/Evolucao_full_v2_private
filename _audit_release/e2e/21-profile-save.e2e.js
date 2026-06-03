const { getPersona } = require('./helpers/personas');
const { ensureOnboarded, launchApp } = require('./helpers/flows');
const { isVisible, replaceInput, tapElement, waitForAny } = require('./helpers/utils');

describe('21 - profile save', () => {
  const persona = getPersona();

  beforeAll(async () => {
    await launchApp({ deleteApp: true });
    await ensureOnboarded(persona);
  });

  it('abre perfil, edita peso e salva sem quebrar', async () => {
    await tapElement('tab-perfil');
    await expect(element(by.id('screen-perfil'))).toBeVisible();

    await replaceInput('input-profile-current-weight', '78');
    await tapElement('btn-profile-save');

    const feedback = await waitForAny(['screen-perfil', 'tab-profile'], 8000);
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

    await expect(element(by.id('screen-perfil'))).toBeVisible();
  });
});