const { getUserProfile } = require('./helpers/userProfiles');
const { ensureOnboarded, launchApp } = require('./helpers/flows');
const { runNavigationBurst } = require('./helpers/userSimulationFlows');

describe('08 - navigation stress', () => {
  const profile = getUserProfile();

  it('troca telas rapidamente sem quebrar render', async () => {
    await launchApp({ deleteApp: true });
    await ensureOnboarded(profile);
    await runNavigationBurst(profile);

    await expect(element(by.id('tab-home'))).toBeVisible();
    await element(by.id('tab-home')).tap();
    await expect(element(by.id('screen-home'))).toBeVisible();
  });
});
