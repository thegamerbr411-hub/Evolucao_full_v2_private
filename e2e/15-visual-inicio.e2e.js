const fs = require('fs');
const path = require('path');
const { getPersona } = require('./helpers/personas');
const { ensureOnboarded, goHome, launchApp } = require('./helpers/flows');
const { waitForAny } = require('./helpers/utils');
const {
  QA_DIR,
  captureAllMainTabsByPhase,
  ensureQaDir,
  shotAndTrack,
} = require('./helpers/visualAudit');

const REPORT_FILE = path.join(QA_DIR, 'mobile-visual-inicio.last.json');

describe('15 - visual inicio', () => {
  const persona = getPersona();
  jest.setTimeout(900000);

  it('captura inicio em todas as abas', async () => {
    ensureQaDir();

    await launchApp({ deleteApp: true });

    const report = {
      phase: 'inicio',
      completedAt: null,
      screenshots: [],
      workflow: [],
    };

    const firstScreen = await waitForAny(['questionnaire-screen', 'screen-home', 'tab-home'], 35000);
    report.workflow.push(`first-screen:${firstScreen}`);

    await ensureOnboarded(persona);
    await goHome();
    await waitForAny(['screen-home', 'tab-home'], 15000);
    await shotAndTrack(report, 'inicio-home-ready');

    await captureAllMainTabsByPhase(report, 'inicio');

    report.completedAt = new Date().toISOString();
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  });
});
