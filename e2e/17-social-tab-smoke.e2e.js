const { ensureOnboarded, goHome, launchApp } = require('./helpers/flows');
const { getPersona } = require('./helpers/personas');
const { isVisible, logStep, sleep, tapElement, waitForAny } = require('./helpers/utils');

async function disableSyncSafely(timeoutMs = 7000) {
  let timedOut = false;

  try {
    await Promise.race([
      device.disableSynchronization(),
      sleep(timeoutMs).then(() => {
        timedOut = true;
      }),
    ]);
    return !timedOut;
  } catch {
    return false;
  }
}

async function ensureRootTabsReady(persona, isAttachedRun) {
  const rootMarkers = [
    'tab-home',
    'tab-treino',
    'tab-nutricao',
    'tab-conversa',
    'tab-social',
    'tab-perfil',
    'screen-home',
  ];

  const alreadyReady = await waitForAny(rootMarkers, 4000).catch(() => null);
  if (alreadyReady) {
    return alreadyReady;
  }

  logStep('social-smoke:root-recovery:start');

  try {
    await ensureOnboarded(persona);
  } catch (error) {
    logStep(`social-smoke:root-recovery:ensureOnboarded-skip=${String(error?.message || error)}`);
  }

  try {
    await goHome();
  } catch (error) {
    logStep(`social-smoke:root-recovery:goHome-skip=${String(error?.message || error)}`);
  }

  const recovered = await waitForAny(rootMarkers, isAttachedRun ? 18000 : 10000).catch(() => null);
  if (!recovered) {
    await device.takeScreenshot('smoke-social-root-tabs-not-ready');
    throw new Error('social-smoke falhou: tabs raiz nao ficaram visiveis apos recovery.');
  }

  logStep(`social-smoke:root-recovery:ok=${recovered}`);
  return recovered;
}

describe('17 - social tab smoke', () => {
  const persona = getPersona();
  const isAttachedRun = String(process.env.DETOX_CONFIGURATION || '').includes('android.attached');

  beforeAll(async () => {
    await launchApp({ deleteApp: !isAttachedRun });

    const syncDisabled = await disableSyncSafely(7000);
    logStep(`social-smoke:sync-disabled=${syncDisabled}`);

    if (!isAttachedRun) {
      await ensureOnboarded(persona);
      await goHome();
      return;
    }

    // Em device fisico attached, o onboarding completo pode oscilar.
    // O corpo do teste lanca erro explicito se a navegacao falhar.
  });

  it('abre social pela tab principal', async () => {
    await ensureRootTabsReady(persona, isAttachedRun);

    if (await isVisible('tab-social', 2500)) {
      await tapElement('tab-social', 10000);
    } else {
      try {
        await waitFor(element(by.text('Social'))).toBeVisible().withTimeout(1800);
        await element(by.text('Social')).tap();
      } catch {
        if (isAttachedRun) {
          logStep('social-smoke:attached-safe-no-root-tab');
          await device.takeScreenshot('smoke-social-attached-safe-no-root-tab');
          throw new Error('social-smoke falhou: tab-social nao encontrada no attached.');
        }
      }
    }

    const target = await waitForAny(['screen-social', 'tab-social'], isAttachedRun ? 30000 : 15000).catch(() => null);
    if (!target && isAttachedRun) {
      logStep('social-smoke:attached-safe-no-social-target');
      await device.takeScreenshot('smoke-social-attached-safe-no-target');
      throw new Error('social-smoke falhou: nenhum alvo social detectado apos toque na aba Social.');
    }
    await device.takeScreenshot(`smoke-social-${target}`);
    if (!target) {
      throw new Error('Nao foi possivel validar alvo da aba social.');
    }
  });
});
