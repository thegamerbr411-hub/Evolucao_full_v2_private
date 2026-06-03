/**
 * 02-semantic-navigation.e2e.js
 * Testa navegação por tabs usando exclusivamente seletores semânticos Phase 3.
 * Valida que cada tab exibe a tela correspondente via ID semântico.
 * Social/Perfil: barra de 5 abas — acesso via Tab "Mais" (hub) + linhas dedicadas.
 */
const { launchApp, ensureOnboarded } = require('../helpers/flows');
const { getPersona } = require('../helpers/personas');
const {
  SCREENS,
  ELEMENTS,
  waitForAppReady,
  assertScreen,
  tapSemantic,
  waitForSemantic,
} = require('./helpers/semanticHelpers');

describe('[SEMANTIC] 02 - navigation: tabs por ID semântico', () => {
  const persona = getPersona();

  beforeAll(async () => {
    await launchApp({ deleteApp: false });
    await waitForAppReady(30000);
    await ensureOnboarded(persona);
  });

  it('home tab é tocável e leva à screen_home', async () => {
    await waitForSemantic(ELEMENTS.tabHome, 10000);
    await element(by.id(ELEMENTS.tabHome)).tap();
    await assertScreen(SCREENS.home, 10000);
    console.log('[nav] tab_home → screen_home ✓');
  });

  it('treinos tab é tocável e leva à screen_treinos', async () => {
    await waitForSemantic(ELEMENTS.tabTreinos, 10000);
    await element(by.id(ELEMENTS.tabTreinos)).tap();
    await assertScreen(SCREENS.treinos, 10000);
    console.log('[nav] tab_treinos → screen_treinos ✓');
  });

  it('tab Mais leva ao hub (screen_mais) e fluxo Perfil abre screen_profile', async () => {
    await tapSemantic(ELEMENTS.tabMore);
    await assertScreen(SCREENS.mais, 10000);
    console.log('[nav] tab_mais → screen_mais ✓');
    await tapSemantic(ELEMENTS.btnMaisPerfil);
    await assertScreen(SCREENS.profile, 12000);
    console.log('[nav] btn_mais_perfil → screen_profile ✓');
  });

  it('rotação home → treinos → home sem crash', async () => {
    await element(by.id(ELEMENTS.tabHome)).tap();
    await assertScreen(SCREENS.home, 8000);

    await element(by.id(ELEMENTS.tabTreinos)).tap();
    await assertScreen(SCREENS.treinos, 8000);

    await element(by.id(ELEMENTS.tabHome)).tap();
    await assertScreen(SCREENS.home, 8000);

    console.log('[nav] rotação home → treinos → home sem crash ✓');
  });
});
