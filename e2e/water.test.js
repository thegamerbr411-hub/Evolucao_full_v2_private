const { completeOnboardingIfNeeded } = require('./helpers/actions');
const { expectVisible } = require('./helpers/asserts');

describe('Agua', () => {
  beforeEach(async () => {
    await device.launchApp({ delete: true });
    await completeOnboardingIfNeeded();
  });

  it('deve exibir card de hidratacao', async () => {
    await expectVisible('screen-home');

    await waitFor(element(by.id('agua-total')))
      .toBeVisible()
      .whileElement(by.id('screen-home'))
      .scroll(180, 'down');

    await expectVisible('agua-total');
  });
});
