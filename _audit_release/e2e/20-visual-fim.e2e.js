const fs = require('fs');
const path = require('path');
const { getPersona } = require('./helpers/personas');
const { ensureOnboarded, goHome, launchApp } = require('./helpers/flows');
const { isVisible, sleep, waitForAny } = require('./helpers/utils');
const {
  QA_DIR,
  captureAllMainTabsByPhase,
  captureOverlayEvidence,
  ensureQaDir,
  relaunchCheckpoint,
  shotAndTrack,
} = require('./helpers/visualAudit');

const REPORT_FILE = path.join(QA_DIR, 'mobile-visual-fim.last.json');

describe('20 - visual fim', () => {
  const persona = getPersona();
  jest.setTimeout(900000);

  it('captura fim de fluxo e valida persistencia de onboarding', async () => {
    ensureQaDir();

    await launchApp({ deleteApp: true });

    const report = {
      phase: 'fim',
      completedAt: null,
      questionnairePersisted: false,
      screenshots: [],
      workflow: [],
    };

    await ensureOnboarded(persona);
    await relaunchCheckpoint(persona, 'fim-ready', report, ensureOnboarded);
    await goHome();

    await captureAllMainTabsByPhase(report, 'fim');
    await captureOverlayEvidence(report, 'fim-global');

    await device.launchApp({ newInstance: false });
    await device.disableSynchronization();

    const firstAfterRelaunch = await waitForAny(['screen-home', 'tab-home', 'questionnaire-screen'], 20000);

    if (firstAfterRelaunch === 'questionnaire-screen') {
      await sleep(2500);
      const settled = await waitForAny(['screen-home', 'tab-home', 'questionnaire-screen'], 10000);
      if (settled === 'questionnaire-screen') {
        const homeRecovered = (await isVisible('screen-home', 4000)) || (await isVisible('tab-home', 4000));
        report.questionnairePersisted = Boolean(homeRecovered);
      } else {
        report.questionnairePersisted = true;
      }
    } else {
      report.questionnairePersisted = true;
    }

    await shotAndTrack(report, 'fim-persistencia-onboarding');

    report.completedAt = new Date().toISOString();
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');

    if (!report.questionnairePersisted) {
      throw new Error('Falha critica: questionario reapareceu apos relaunch, persistencia invalida.');
    }
  });
});
