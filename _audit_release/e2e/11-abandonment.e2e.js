const { getUserProfile } = require('./helpers/userProfiles');
const { ensureOnboarded, goToCoach, goToTreinos, launchApp } = require('./helpers/flows');

async function quickBack(times = 1) {
  for (let i = 0; i < times; i += 1) {
    try {
      await device.pressBack();
    } catch {
      // ignore
    }
  }
}

describe('11 - flow abandonment', () => {
  const profile = getUserProfile();

  it('abandona fluxo de treino e retorna sem travar', async () => {
    await launchApp({ deleteApp: true });
    await ensureOnboarded(profile);

    await goToTreinos();
    await element(by.id('btn-iniciar-treino')).tap();
    await quickBack(1);

    await expect(element(by.id('screen-treinos'))).toBeVisible();
  });

  it('abandona fluxo de coach e mantém navegação funcional', async () => {
    await goToCoach();
    await quickBack(1);
    await element(by.id('tab-home')).tap();

    await expect(element(by.id('screen-home'))).toBeVisible();
  });
});
