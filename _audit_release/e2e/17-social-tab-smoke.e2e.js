const { ensureOnboarded, goHome, goToSocial, launchApp } = require('./helpers/flows');
const { getPersona } = require('./helpers/personas');
const { isAttachedRun } = require('./helpers/runtime');
const { logStep, sleep, waitForAny } = require('./helpers/utils');

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
    'tab_mais',
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
  const attachedRun = isAttachedRun();

  beforeAll(async () => {
    await launchApp({ deleteApp: !attachedRun });

    const syncDisabled = await disableSyncSafely(7000);
    logStep(`social-smoke:sync-disabled=${syncDisabled}`);

    if (!attachedRun) {
      await ensureOnboarded(persona);
      await goHome();
      return;
    }

    // Em device fisico attached, o onboarding completo pode oscilar.
    // O corpo do teste lanca erro explicito se a navegacao falhar.
  });

  it('abre social pela tab principal', async () => {
    await ensureRootTabsReady(persona, attachedRun);

    await goToSocial();

    const target = await waitForAny(['screen-social', 'tab-social', 'screen_social'], attachedRun ? 30000 : 15000).catch(() => null);
    if (!target && attachedRun) {
      logStep('social-smoke:attached-safe-no-social-target');
      await device.takeScreenshot('smoke-social-attached-safe-no-target');
      throw new Error('social-smoke falhou: nenhum alvo social detectado apos goToSocial.');
    }
    await device.takeScreenshot(`smoke-social-${target}`);
    if (!target) {
      throw new Error('Nao foi possivel validar alvo da aba social.');
    }
  });
});
