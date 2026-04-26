const fs = require('fs');
const path = require('path');
const { getPersona } = require('./helpers/personas');
const {
  ensureOnboarded,
  goHome,
  goToNutrition,
  goToTreinos,
  launchApp,
  runCoachHappyPath,
} = require('./helpers/flows');
const { isVisible, tapElement, waitForAny } = require('./helpers/utils');
const {
  QA_DIR,
  captureAllMainTabsByPhase,
  captureOverlayEvidence,
  ensureQaDir,
  shotAndTrack,
} = require('./helpers/visualAudit');

const REPORT_FILE = path.join(QA_DIR, 'mobile-visual-meio.last.json');

describe('19 - visual meio', () => {
  const persona = getPersona();
  jest.setTimeout(900000);

  it('captura meio do fluxo em todas as abas', async () => {
    ensureQaDir();

    await launchApp({ deleteApp: true });

    const report = {
      phase: 'meio',
      completedAt: null,
      screenshots: [],
      workflow: [],
    };

    await ensureOnboarded(persona);
    await goHome();
    await waitForAny(['screen-home', 'tab-home'], 15000);

    // Interacoes curtas para representar estado de meio de uso real.
    try {
      if (await isVisible('btn-add-agua', 1200)) {
        await tapElement('btn-add-agua');
        await shotAndTrack(report, 'meio-water-action');
        await captureOverlayEvidence(report, 'meio-water-action', { captureNoneFallback: true });
      }
    } catch (error) {
      report.workflow.push(`water-action:skip:${String(error?.message || 'unknown')}`);
    }

    try {
      await goToTreinos();
      await shotAndTrack(report, 'meio-workout-hub');
    } catch (error) {
      report.workflow.push(`go-treinos:skip:${String(error?.message || 'unknown')}`);
    }

    try {
      await goToNutrition();
      await shotAndTrack(report, 'meio-nutrition-entry');
      await captureOverlayEvidence(report, 'meio-nutrition-entry', { captureNoneFallback: true });
    } catch (error) {
      report.workflow.push(`go-nutricao:skip:${String(error?.message || 'unknown')}`);
    }

    try {
      await runCoachHappyPath(persona);
      await shotAndTrack(report, 'meio-coach-interaction');
    } catch (error) {
      report.workflow.push(`coach-happy-path:skip:${String(error?.message || 'unknown')}`);
    }

    await captureOverlayEvidence(report, 'meio-pre-audit');
    await captureAllMainTabsByPhase(report, 'meio');

    report.completedAt = new Date().toISOString();
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8');
  });
});
