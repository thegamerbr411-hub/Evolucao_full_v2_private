/**
 * semanticHelpers.js
 * Utilitários para testes Detox que usam o novo sistema semântico de seletores Phase 3.
 * Todos os IDs vêm de src/qa/selectorRegistry.js — NUNCA usar strings hardcoded.
 */

// Mirror dos valores de QA_SCREENS / QA_ELEMENTS (CommonJS para compatibilidade Detox)
const SCREENS = Object.freeze({
  bootstrap: 'screen_bootstrap',
  loading: 'screen_loading',
  login: 'screen_login',
  register: 'screen_register',
  home: 'screen_home',
  treinos: 'screen_treinos',
  profile: 'screen_profile',
  exerciseDetail: 'screen_exercise_detail',
  debugHealth: 'screen_debug_health',
  debugObservability: 'screen_debug_observability',
});

const ELEMENTS = Object.freeze({
  appRoot: 'app_root',
  appBootstrapReady: 'app_bootstrap_ready',
  tabHome: 'tab_home',
  tabTreinos: 'tab_treinos',
  tabNutricao: 'tab_nutricao',
  tabCoach: 'tab_coach',
  tabSocial: 'tab_social',
  tabProfile: 'tab_profile',
  btnGoLogin: 'btn_go_login',
  btnGoRegister: 'btn_go_register',
  btnLogin: 'btn_login',
  btnRegister: 'btn_register',
  btnForgotPassword: 'btn_forgot_password',
  inputName: 'input_name',
  inputEmail: 'input_email',
  inputPassword: 'input_password',
  btnStartWorkout: 'btn_start_workout',
  btnOpenAdmin: 'btn_open_admin',
  btnLogout: 'btn_logout',
  btnGoogleLogin: 'btn_google_login',
  btnGoogleLogout: 'btn_google_logout',
  btnSaveProfile: 'btn_save_profile',
  btnOpenVideo: 'btn_open_video',
  btnOpenVideoExternal: 'btn_open_video_external',
  btnEnablePlayer: 'btn_enable_player',
  btnPlayerFullscreen: 'btn_player_fullscreen',
  btnPlayerClose: 'btn_player_close',
  playerInternal: 'player_internal',
  playerStateAnchor: 'player_state_anchor',
  qaHealthExport: 'qa_health_export',
});

/**
 * Resolve um elemento Detox por testID semântico OU por accessibilityLabel (fallback).
 * Como qaProps() seta ambos, qualquer um dos meios encontra o elemento.
 */
function bySemanticId(semanticId) {
  return by.id(semanticId);
}

/**
 * Aguarda um elemento semântico ficar visível.
 */
async function waitForSemantic(semanticId, timeoutMs = 12000) {
  await waitFor(element(bySemanticId(semanticId)))
    .toBeVisible()
    .withTimeout(timeoutMs);
}

/**
 * Toca em um elemento semântico.
 */
async function tapSemantic(semanticId, timeoutMs = 10000) {
  await waitFor(element(bySemanticId(semanticId)))
    .toBeVisible()
    .withTimeout(timeoutMs);
  await element(bySemanticId(semanticId)).tap();
}

/**
 * Digita em um campo semântico.
 */
async function typeSemantic(semanticId, text, timeoutMs = 8000) {
  await waitFor(element(bySemanticId(semanticId)))
    .toBeVisible()
    .withTimeout(timeoutMs);
  await element(bySemanticId(semanticId)).tap();
  await element(bySemanticId(semanticId)).clearText();
  await element(bySemanticId(semanticId)).typeText(String(text));
}

/**
 * Verifica se a tela atual corresponde ao ID semântico esperado.
 */
async function assertScreen(screenId, timeoutMs = 12000) {
  await waitFor(element(bySemanticId(screenId)))
    .toBeVisible()
    .withTimeout(timeoutMs);
  await expect(element(bySemanticId(screenId))).toBeVisible();
}

/**
 * Aguarda o app boostrapping terminar.
 * Testa primeiro o sinal de ready, depois o root, para máxima resiliência.
 */
async function waitForAppReady(timeoutMs = 30000) {
  const signals = [ELEMENTS.appBootstrapReady, ELEMENTS.appRoot, SCREENS.home, SCREENS.login, SCREENS.register];
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    for (const signal of signals) {
      try {
        await waitFor(element(bySemanticId(signal)))
          .toExist()
          .withTimeout(1500);
        return signal;
      } catch {
        // tenta próximo sinal
      }
    }
    await new Promise((res) => setTimeout(res, 300));
  }

  throw new Error(`App não ficou pronto após ${timeoutMs}ms`);
}

/**
 * Navega para uma tab usando o ID semântico do botão de tab.
 */
async function tapTab(tabElementId, expectedScreenId) {
  await tapSemantic(tabElementId);
  if (expectedScreenId) {
    await assertScreen(expectedScreenId);
  }
}

module.exports = {
  SCREENS,
  ELEMENTS,
  bySemanticId,
  waitForSemantic,
  tapSemantic,
  typeSemantic,
  assertScreen,
  waitForAppReady,
  tapTab,
};
