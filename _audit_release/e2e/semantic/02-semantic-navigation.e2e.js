/**
 * 02-semantic-navigation.e2e.js
 * Testa navegação por tabs usando exclusivamente seletores semânticos Phase 3.
 * Valida que cada tab exibe a tela correspondente via ID semântico.
 */
const { launchApp, ensureOnboarded } = require('../helpers/flows');
const { getPersona } = require('../helpers/personas');
const {
  SCREENS,
  ELEMENTS,
  waitForAppReady,
  tapTab,
  assertScreen,
  tapSemantic,
  waitForSemantic,
} = require('./helpers/semanticHelpers');

const NAV_TABS = [
  { tabId: ELEMENTS.tabHome, screenId: SCREENS.home, label: 'Home' },
  { tabId: ELEMENTS.tabTreinos, screenId: SCREENS.treinos, label: 'Treinos' },
  { tabId: ELEMENTS.tabProfile, screenId: SCREENS.profile, label: 'Perfil' },
];

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

  it('perfil tab é tocável e leva à screen_profile', async () => {
    await waitForSemantic(ELEMENTS.tabProfile, 10000);
    await element(by.id(ELEMENTS.tabProfile)).tap();
    await assertScreen(SCREENS.profile, 10000);
    console.log('[nav] tab_profile → screen_profile ✓');
  });

  it('rotação home → treinos → home sem crash', async () => {
    // Home
    await element(by.id(ELEMENTS.tabHome)).tap();
    await assertScreen(SCREENS.home, 8000);

    // Treinos
    await element(by.id(ELEMENTS.tabTreinos)).tap();
    await assertScreen(SCREENS.treinos, 8000);

    // Home novamente
    await element(by.id(ELEMENTS.tabHome)).tap();
    await assertScreen(SCREENS.home, 8000);

    console.log('[nav] rotação home → treinos → home sem crash ✓');
  });
});
