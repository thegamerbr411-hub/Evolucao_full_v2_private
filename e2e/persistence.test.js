const { completeOnboardingIfNeeded } = require('./helpers/actions');
const { expectVisible } = require('./helpers/asserts');

describe('Persistencia', () => {
  it('deve manter dados apos fechar app', async () => {
    await device.launchApp({ delete: true });
    await completeOnboardingIfNeeded();

    await expectVisible('home-ready');

    await device.launchApp({ newInstance: true });

    await expectVisible('home-ready');
  });
});
