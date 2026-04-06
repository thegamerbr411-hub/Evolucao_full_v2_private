const { completeOnboardingIfNeeded, typeText, waitAndTap } = require('./helpers/actions');
const { expectVisible } = require('./helpers/asserts');

describe('Onboarding', () => {
  const validCases = [
    { label: 'peso baixo com meta menor', peso: '50', meta: '49', altura: '165' },
    { label: 'peso alto com meta menor', peso: '120', meta: '110', altura: '182' },
    { label: 'meta maior que atual', peso: '78', meta: '85', altura: '175' },
    { label: 'meta menor que atual', peso: '92', meta: '84', altura: '178' },
  ];

  it('deve cobrir variacoes de dados com loop', async () => {
    for (const scenario of validCases) {
      console.log(`[E2E][Onboarding] Iniciando caso: ${scenario.label}`);
      await device.launchApp({ newInstance: true, delete: true });
      await completeOnboardingIfNeeded(scenario);
      await waitFor(element(by.id('home-ready'))).toBeVisible().withTimeout(5000);
      console.log(`[E2E][Onboarding] Caso concluido: ${scenario.label}`);
    }

    console.log('[E2E][Onboarding] Iniciando caso invalido de altura');
    await device.launchApp({ newInstance: true, delete: true });

    await expectVisible('questionnaire-screen');
    await typeText('input-peso-atual', '82');
    await typeText('input-peso-meta', '77');
    await typeText('input-altura', '100');

    await waitFor(element(by.id('btn-continuar')))
      .toBeVisible()
      .whileElement(by.id('scroll-container'))
      .scroll(220, 'down');

    await waitAndTap('btn-continuar');
    await expectVisible('questionnaire-screen');
    console.log('[E2E][Onboarding] Caso invalido validado com bloqueio');
  });
});
