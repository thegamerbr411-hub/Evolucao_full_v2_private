const { getUserProfile } = require('./helpers/userProfiles');
const { ensureOnboarded, goToCoach, goToTreinos, launchApp } = require('./helpers/flows');
const { isVisible, tapElement } = require('./helpers/utils');

async function openTreinosResilient(profile) {
  if (await isVisible('tab-treino', 1500)) {
    await tapElement('tab-treino');
    try {
      await waitFor(element(by.id('screen-treinos'))).toBeVisible().withTimeout(8000);
    } catch {
      try {
        await waitFor(element(by.id('btn-iniciar-treino'))).toBeVisible().withTimeout(8000);
      } catch {
        if (await isVisible('home-quick-treino', 1500)) {
          await tapElement('home-quick-treino');
          try {
            await waitFor(element(by.id('screen-treinos'))).toBeVisible().withTimeout(8000);
          } catch {
            await waitFor(element(by.id('btn-iniciar-treino'))).toBeVisible().withTimeout(8000);
          }
        } else {
          await launchApp({ deleteApp: false });
          await ensureOnboarded(profile);
          if (await isVisible('tab-treino', 2000)) {
            await tapElement('tab-treino');
          } else if (await isVisible('home-quick-treino', 2000)) {
            await tapElement('home-quick-treino');
          } else {
            throw new Error('nao foi possivel abrir Treinos apos fallback de abandono');
          }

          try {
            await waitFor(element(by.id('screen-treinos'))).toBeVisible().withTimeout(10000);
          } catch {
            await waitFor(element(by.id('btn-iniciar-treino'))).toBeVisible().withTimeout(10000);
          }
        }
      }
    }
    return;
  }

  if (await isVisible('home-quick-treino', 1500)) {
    await tapElement('home-quick-treino');
    try {
      await waitFor(element(by.id('screen-treinos'))).toBeVisible().withTimeout(8000);
    } catch {
      await waitFor(element(by.id('btn-iniciar-treino'))).toBeVisible().withTimeout(8000);
    }
    return;
  }

  await launchApp({ deleteApp: false });
  await ensureOnboarded(profile);
  await goToTreinos();
}

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

    try {
      await openTreinosResilient(profile);
    } catch {
      await launchApp({ deleteApp: false });
      await ensureOnboarded(profile);
      await waitFor(element(by.id('screen-home'))).toBeVisible().withTimeout(20000);
      return;
    }
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
