const { expectNotVisible, expectVisible } = require('./helpers/asserts');
const { waitAndTap } = require('./helpers/actions');

describe('Erros', () => {
  beforeEach(async () => {
    await device.launchApp({ delete: true });
  });

  it('deve bloquear onboarding com dados invalidos', async () => {
    await expectVisible('questionnaire-screen');

    await waitFor(element(by.id('btn-continuar')))
      .toBeVisible()
      .whileElement(by.id('scroll-container'))
      .scroll(200, 'down');

    await waitAndTap('btn-continuar');

    await expectVisible('questionnaire-screen');
    await expectNotVisible('home-ready');
  });
});
