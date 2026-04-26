const { getPersona } = require('./helpers/personas');
const { ensureOnboarded, launchApp } = require('./helpers/flows');
const { replaceInput, tapElement } = require('./helpers/utils');

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

    await expect(element(by.text('Perfil atualizado'))).toBeVisible();
    await element(by.text('OK')).tap();
    await expect(element(by.id('screen-perfil'))).toBeVisible();
  });
});