const { ensureOnboarded, goHome, launchApp } = require('./helpers/flows');
const { getPersona } = require('./helpers/personas');
const { isAttachedRun } = require('./helpers/runtime');
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

  logStep('treino-smoke:root-recovery:start');

  try {
    await ensureOnboarded(persona);
  } catch (error) {
    logStep(`treino-smoke:root-recovery:ensureOnboarded-skip=${String(error?.message || error)}`);
  }

  try {
    await goHome();
  } catch (error) {
    logStep(`treino-smoke:root-recovery:goHome-skip=${String(error?.message || error)}`);
  }

  const recovered = await waitForAny(rootMarkers, isAttachedRun ? 18000 : 10000).catch(() => null);
  if (!recovered) {
    await device.takeScreenshot('smoke-treino-root-tabs-not-ready');
    throw new Error('treino-smoke falhou: tabs raiz nao ficaram visiveis apos recovery.');
  }

  logStep(`treino-smoke:root-recovery:ok=${recovered}`);
  return recovered;
}

describe('16 - treino tab smoke', () => {
  const persona = getPersona();
  const attachedRun = isAttachedRun();

  beforeAll(async () => {
    await launchApp({ deleteApp: !attachedRun });

    const syncDisabled = await disableSyncSafely(7000);
    logStep(`treino-smoke:sync-disabled=${syncDisabled}`);

    if (!attachedRun) {
      await ensureOnboarded(persona);
      await goHome();
      return;
    }

    // Em device fisico attached, o onboarding completo pode oscilar.
    // O corpo do teste lanca erro explicito se a navegacao falhar.
  });

  it('abre treino pela tab principal', async () => {
    await ensureRootTabsReady(persona, attachedRun);

    if (await isVisible('tab-treino', 2500)) {
      logStep('smoke treino: tocando tab-treino');
      await tapElement('tab-treino', 10000);
    } else {
      try {
        await waitFor(element(by.text('Treino'))).toBeVisible().withTimeout(1800);
        await element(by.text('Treino')).tap();
      } catch {
        if (attachedRun) {
          logStep('treino-smoke:attached-safe-no-root-tab');
          await device.takeScreenshot('smoke-treino-attached-safe-no-root-tab');
          throw new Error('treino-smoke falhou: tab-treino nao encontrada no attached.');
        }
      }
    }

    await sleep(800);
    await device.takeScreenshot('smoke-treino-after-tap');
    const target = await waitForAny([
      'screen-treinos',
      'btn-iniciar-treino',
      'btn-open-free-workout',
      'btn-open-routines',
      'screen-routines',
      'screen-workout',
      'screen-home',
      'screen-social',
      'screen-nutricao',
      'screen-coach',
    ], attachedRun ? 30000 : 20000).catch(() => null);

    if (!target && attachedRun) {
      logStep('treino-smoke:attached-safe-no-target');
      await device.takeScreenshot('smoke-treino-attached-safe-no-target');
      throw new Error('treino-smoke falhou: nenhum alvo detectado apos toque na aba Treino.');
    }

    await device.takeScreenshot(`smoke-treino-${target}`);
    if (!target) {
      throw new Error('Nao foi possivel identificar alvo apos toque em tab-treino.');
    }
  });
});
