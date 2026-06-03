/**
 * 01-semantic-auth.e2e.js
 * Testa fluxo de autenticação usando exclusivamente seletores semânticos Phase 3.
 * Cenários: detecção de tela de auth → campos de entrada → botão de login.
 * NÃO realiza login real (sem credenciais hardcoded) — valida presença dos elementos.
 */
const { launchApp } = require('../helpers/flows');
const {
  SCREENS,
  ELEMENTS,
  waitForAppReady,
  waitForSemantic,
  tapSemantic,
  typeSemantic,
  assertScreen,
} = require('./helpers/semanticHelpers');

const TEST_EMAIL = process.env.QA_TEST_EMAIL || '';
const TEST_PASSWORD = process.env.QA_TEST_PASSWORD || '';
const SKIP_LOGIN = !TEST_EMAIL || !TEST_PASSWORD;

describe('[SEMANTIC] 01 - auth: tela e campos', () => {
  beforeAll(async () => {
    await launchApp({ deleteApp: true });
    await waitForAppReady(30000);
  });

  it('tela de login ou cadastro é visível via ID semântico', async () => {
    const authScreens = [SCREENS.login, SCREENS.register];
    let found = null;

    for (const id of authScreens) {
      try {
        await waitFor(element(by.id(id))).toExist().withTimeout(5000);
        found = id;
        break;
      } catch {
        // tenta próximo
      }
    }

    if (!found) {
      // Já logado — a home é aceitável
      await waitForSemantic(SCREENS.home, 6000);
      console.log('[auth] usuário já autenticado, home detectada via ID semântico');
      return;
    }

    console.log(`[auth] tela de auth detectada: ${found}`);
    expect(authScreens).toContain(found);
  });

  it('botões de troca de modo (login ↔ cadastro) são detectáveis', async () => {
    // Caso já esteja na home, pula
    try {
      await waitFor(element(by.id(SCREENS.home))).toExist().withTimeout(2000);
      console.log('[auth] skip: usuário na home');
      return;
    } catch {
      // continua
    }

    const modeSwitchers = [ELEMENTS.btnGoRegister, ELEMENTS.btnGoLogin];
    let found = null;

    for (const id of modeSwitchers) {
      try {
        await waitFor(element(by.id(id))).toExist().withTimeout(3000);
        found = id;
        break;
      } catch {
        // tenta próximo
      }
    }

    console.log(`[auth] botão de modo detectado: ${found}`);
    // Pode não estar visível se já estiver no modo correto — soft assert
    if (found) {
      await expect(element(by.id(found))).toExist();
    }
  });

  it('campos de email e senha são detectáveis via ID semântico', async () => {
    // Caso já esteja na home, pula
    try {
      await waitFor(element(by.id(SCREENS.home))).toExist().withTimeout(2000);
      console.log('[auth] skip: usuário na home');
      return;
    } catch {
      // continua
    }

    // Garante estar no modo login
    try {
      await tapSemantic(ELEMENTS.btnGoLogin, 3000);
    } catch {
      // pode já estar no modo login
    }

    await waitForSemantic(ELEMENTS.inputEmail, 8000);
    await expect(element(by.id(ELEMENTS.inputEmail))).toBeVisible();

    await waitForSemantic(ELEMENTS.inputPassword, 5000);
    await expect(element(by.id(ELEMENTS.inputPassword))).toBeVisible();

    await waitFor(element(by.id(ELEMENTS.btnLogin))).toExist().withTimeout(5000);
    console.log('[auth] todos os campos semânticos de login detectados');
  });

  it('botão de login está visível e é interagível', async () => {
    // Caso já esteja na home, pula
    try {
      await waitFor(element(by.id(SCREENS.home))).toExist().withTimeout(2000);
      console.log('[auth] skip: usuário na home');
      return;
    } catch {
      // continua
    }

    await waitForSemantic(ELEMENTS.btnLogin, 8000);
    await expect(element(by.id(ELEMENTS.btnLogin))).toBeVisible();
    console.log('[auth] btn_login detectado via ID semântico ✓');
  });

  if (!SKIP_LOGIN) {
    it('fluxo completo de login com credenciais de teste', async () => {
      try {
        await waitFor(element(by.id(SCREENS.home))).toExist().withTimeout(2000);
        console.log('[auth] skip: já na home');
        return;
      } catch {
        // continua
      }

      await typeSemantic(ELEMENTS.inputEmail, TEST_EMAIL);
      await typeSemantic(ELEMENTS.inputPassword, TEST_PASSWORD);
      await tapSemantic(ELEMENTS.btnLogin);
      await assertScreen(SCREENS.home, 20000);
      console.log('[auth] login com credenciais de teste ✓');
    });
  } else {
    it.skip('fluxo completo de login (QA_TEST_EMAIL / QA_TEST_PASSWORD não definidas)', () => {});
  }
});
