const { getPersona } = require('./helpers/personas');
const { ensureOnboarded, launchApp } = require('./helpers/flows');
const { isVisible, scrollToElement, tapElement, waitForAny } = require('./helpers/utils');

describe('22 - paywall trial', () => {
  const persona = getPersona();

  beforeAll(async () => {
    await launchApp({ deleteApp: true });
    await ensureOnboarded(persona);
  });

  it('abre insights, entra na paywall e ativa trial sem quebrar navegacao', async () => {
    await tapElement('tab-home');
    await expect(element(by.id('screen-home'))).toBeVisible();

    if (await isVisible('home-shortcut-insights', 2500)) {
      await tapElement('home-shortcut-insights');
    } else if (await isVisible('tab-progresso', 1200)) {
      await tapElement('tab-progresso');
      if (await isVisible('home-shortcut-insights', 1200)) {
        await tapElement('home-shortcut-insights');
      }
    }

    await expect(element(by.id('insights-dashboard'))).toBeVisible();

    await waitForAny(['btn-insights-postvalue-paywall', 'insights-dashboard'], 8000);
    await tapElement('btn-insights-postvalue-paywall');
    await expect(element(by.id('screen-paywall'))).toBeVisible();

    await scrollToElement('screen-paywall', 'btn-paywall-trial', 'down', 360, 8);
    await tapElement('btn-paywall-trial');

    const landing = await waitForAny(['insights-dashboard', 'screen-home', 'tab-home', 'screen-paywall'], 15000);
    if (!landing) {
      throw new Error('Nenhuma tela de retorno detectada apos trial.');
    }
  });
});