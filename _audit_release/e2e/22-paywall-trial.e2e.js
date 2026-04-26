const { getPersona } = require('./helpers/personas');
const { ensureOnboarded, launchApp } = require('./helpers/flows');
const { tapElement, waitForAny } = require('./helpers/utils');

describe('22 - paywall trial', () => {
  const persona = getPersona();

  beforeAll(async () => {
    await launchApp({ deleteApp: true });
    await ensureOnboarded(persona);
  });

  it('abre insights, entra na paywall e ativa trial sem quebrar navegacao', async () => {
    await tapElement('tab-home');
    await expect(element(by.id('screen-home'))).toBeVisible();

    await tapElement('home-shortcut-insights');
    await expect(element(by.id('insights-dashboard'))).toBeVisible();

    await tapElement('btn-insights-postvalue-paywall');
    await expect(element(by.id('screen-paywall'))).toBeVisible();

    await tapElement('btn-paywall-trial');

    const landing = await waitForAny(['insights-dashboard', 'screen-home', 'tab-home'], 15000);
    expect(landing).toBeTruthy();
  });
});