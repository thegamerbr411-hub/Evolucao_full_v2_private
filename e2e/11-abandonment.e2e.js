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
  const isAttachedRun = String(process.env.DETOX_ATTACHED_CONFIGURATION || '').includes('android.attached')
    || String(process.env.DETOX_CONFIGURATION || '').includes('android.attached');
  const scenario = isAttachedRun ? it.skip : it;

  scenario('abandona fluxo de treino e retorna sem travar', async () => {
    await launchApp({ deleteApp: !isAttachedRun });
    await ensureOnboarded(profile);

    await goToTreinos();
    await element(by.id('btn-iniciar-treino')).tap();
    await quickBack(1);

    await expect(element(by.id('screen-treinos'))).toBeVisible();
  });

  scenario('abandona fluxo de coach e mantém navegação funcional', async () => {
    await goToCoach();
    await quickBack(1);
    await element(by.id('tab-home')).tap();

    await expect(element(by.id('screen-home'))).toBeVisible();
  });
});
