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
    const homeVisible = await waitForAny(['screen-home', 'screen_home'], 12000);
    if (!homeVisible) {
      throw new Error('Home nao ficou visivel antes do fluxo de insights.');
    }

    if (await isVisible('home-shortcut-insights', 2500)) {
      await tapElement('home-shortcut-insights');
    } else if (await isVisible('tab-progresso', 1200)) {
      await tapElement('tab-progresso');
      if (await isVisible('home-shortcut-insights', 1200)) {
        await tapElement('home-shortcut-insights');
      }
    }

    const insightsVisible = await waitForAny(['insights-dashboard', 'screen_insights'], 12000);
    if (!insightsVisible) {
      throw new Error('Dashboard de insights nao ficou visivel.');
    }

    await waitForAny(['btn-insights-postvalue-paywall', 'insights-dashboard'], 8000);
    await tapElement('btn-insights-postvalue-paywall');
    const paywallVisible = await waitForAny(['screen-paywall', 'screen_paywall'], 12000);
    if (!paywallVisible) {
      throw new Error('Paywall nao abriu apos CTA de insights.');
    }

    await scrollToElement('screen-paywall', 'btn-paywall-trial', 'down', 360, 8);
    await tapElement('btn-paywall-trial');

    const landing = await waitForAny(['insights-dashboard', 'screen-home', 'screen_home', 'tab-home', 'screen-paywall', 'screen_paywall'], 15000);
    if (!landing) {
      throw new Error('Nenhuma tela de retorno detectada apos trial.');
    }
  });
});