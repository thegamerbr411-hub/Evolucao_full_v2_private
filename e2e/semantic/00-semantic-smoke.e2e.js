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
  waitForAppReady,
  assertScreen,
  tapTab,
} = require('./helpers/semanticHelpers');

describe('[SEMANTIC] 00 - smoke: boot e landing', () => {
  beforeAll(async () => {
    await launchApp({ deleteApp: false });
  });

  it('app_root e app_bootstrap_ready são detectados via ID semântico', async () => {
    const signal = await waitForAppReady(30000);
    expect(typeof signal).toBe('string');
    expect(signal.length).toBeGreaterThan(0);
    console.log(`[smoke] boot signal detectado: ${signal}`);
  });

  it('tela inicial é detectada por ID semântico (home ou auth)', async () => {
    const candidates = [SCREENS.home, SCREENS.login, SCREENS.register, ELEMENTS.appBootstrapReady];
    let found = null;

    for (const id of candidates) {
      try {
        await waitFor(element(by.id(id))).toExist().withTimeout(4000);
        found = id;
        break;
      } catch {
        // tenta próximo
      }
    }

    expect(found).not.toBeNull();
    console.log(`[smoke] tela detectada: ${found}`);
  });
});
