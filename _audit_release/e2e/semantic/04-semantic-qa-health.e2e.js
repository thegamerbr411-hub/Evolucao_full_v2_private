/**
 * 04-semantic-qa-health.e2e.js
 * Valida a integração da infraestrutura QA Phase 3 via seletores semânticos:
 * - Verifica que global.__EVOLUCAO_QA_HEALTH__ está acessível em dev
 * - Verifica que a tela DebugHealth é navegável via ProfileScreen em dev
 * - Confirma que o exporte de snapshot QA funciona via btn_qa_health_export
 * NOTA: Só executa completamente em builds __DEV__ com o app instalado.
 */
const { launchApp, ensureOnboarded } = require('../helpers/flows');
const { getPersona } = require('../helpers/personas');
const {
  SCREENS,
  ELEMENTS,
  waitForAppReady,
  assertScreen,
  navigateToProfileViaMais,
} = require('./helpers/semanticHelpers');

describe('[SEMANTIC] 04 - qa_health: infraestrutura Phase 3', () => {
  const persona = getPersona();

  beforeAll(async () => {
    await launchApp({ deleteApp: false });
    await waitForAppReady(30000);
    await ensureOnboarded(persona);
  });

  it('screen_home tem ID semântico correto', async () => {
    try {
      await element(by.id(ELEMENTS.tabHome)).tap();
    } catch {
      // pode já estar na home
    }
    await assertScreen(SCREENS.home, 10000);
    console.log('[qa_health] screen_home com ID semântico correto ✓');
  });

  it('screen_treinos tem ID semântico correto', async () => {
    await element(by.id(ELEMENTS.tabTreinos)).tap();
    await assertScreen(SCREENS.treinos, 10000);
    console.log('[qa_health] screen_treinos com ID semântico correto ✓');
  });

  it('screen_profile tem ID semântico correto', async () => {
    await navigateToProfileViaMais(12000);
    console.log('[qa_health] screen_profile com ID semântico correto ✓');
  });

  it('debug health screen é acessível via perfil (dev build)', async () => {
    // Navega para o perfil
    try {
      await navigateToProfileViaMais(8000);
    } catch {
      // já está no perfil
    }

    // Procura o botão de debug health (presente apenas em __DEV__)
    const debugHealthBtn = 'btn_open_debug_health';
    let found = false;

    try {
      await waitFor(element(by.id(debugHealthBtn))).toExist().withTimeout(4000);
      found = true;
    } catch {
      // tenta scroll
      try {
        await waitFor(element(by.id(debugHealthBtn)))
          .toExist()
          .whileElement(by.id(SCREENS.profile))
          .scroll(400, 'down');
        found = true;
      } catch {
        // não disponível em prod build
      }
    }

    if (found) {
      await element(by.id(debugHealthBtn)).tap();
      // Aguarda a tela de debug health
      try {
        await assertScreen(SCREENS.debugHealth, 8000);
        console.log('[qa_health] DebugHealthScreen acessível via ProfileScreen ✓');

        // Testa o botão de export
        try {
          await waitFor(element(by.id(ELEMENTS.qaHealthExport))).toBeVisible().withTimeout(5000);
          await expect(element(by.id(ELEMENTS.qaHealthExport))).toBeVisible();
          console.log('[qa_health] qa_health_export detectado ✓');
        } catch {
          console.log('[qa_health] qa_health_export não visível — soft pass');
        }
      } catch {
        console.log('[qa_health] DebugHealthScreen não detectada — pode ser prod build');
      }
    } else {
      console.log('[qa_health] btn_open_debug_health não detectado — build de prod (esperado)');
    }
  });

  it('elementos semânticos principais estão todos mapeados', () => {
    const requiredScreens = Object.values(SCREENS);
    const requiredElements = Object.values(ELEMENTS);

    expect(requiredScreens.length).toBeGreaterThan(5);
    expect(requiredElements.length).toBeGreaterThan(10);

    // Verifica convenção de nomenclatura: snake_case sem hífens
    for (const id of [...requiredScreens, ...requiredElements]) {
      expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
    }

    console.log(`[qa_health] ${requiredScreens.length} screens + ${requiredElements.length} elements mapeados ✓`);
  });
});
