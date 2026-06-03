/**
 * 00-semantic-smoke.e2e.js
 * Smoke test usando exclusivamente seletores semânticos Phase 3.
 * Verifica: boot → landing (home ou auth) → pelo menos um sinal semântico visível.
 * Compatível com device físico RQ8T209ZTAF em modo attached.
 */
const { launchApp } = require('../helpers/flows');
const { isAttachedRun } = require('../helpers/runtime');
const {
  SCREENS,
  ELEMENTS,
  assertAppReady,
  waitForAppReady,
  waitForSemanticExists,
} = require('./helpers/semanticHelpers');

describe('[SEMANTIC] 00 - smoke: boot e landing', () => {
  beforeAll(async () => {
    await launchApp({ deleteApp: false });
  });

  it('readiness deterministico eh detectado por estado runtime', async () => {
    const signal = await waitForAppReady(45000);
    await assertAppReady();

    if (!signal || typeof signal !== 'string') {
      throw new Error('Readiness signal ausente no smoke.');
    }

    console.log(`[smoke] readiness signal detectado: ${signal}`);
  });

  it('tela inicial eh detectada por IDs semanticos', async () => {
    const candidates = [
      SCREENS.home,
      SCREENS.login,
      SCREENS.register,
      'screen_questionario',
      'questionnaire-screen',
      ELEMENTS.appBootstrapReady,
    ];
    let found = null;

    for (const id of candidates) {
      try {
        await waitForSemanticExists(id, 5000);
        found = id;
        break;
      } catch {
        // next candidate
      }
    }

    if (!found) {
      throw new Error(`Nenhuma tela semantica inicial detectada. Candidates=${candidates.join(',')}`);
    }

    console.log(`[smoke] tela detectada: ${found}`);
  });
});
