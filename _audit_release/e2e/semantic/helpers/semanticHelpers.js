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
  appRuntimeBooting: 'app_runtime_state_booting',
  appRuntimeInitializing: 'app_runtime_state_initializing',
  appRuntimeRestoringAuth: 'app_runtime_state_restoring_auth',
  appRuntimeHydratingStores: 'app_runtime_state_hydrating_stores',
  appRuntimeNavigationReady: 'app_runtime_state_navigation_ready',
  appRuntimeReady: 'app_runtime_state_ready',
  appRuntimeBackground: 'app_runtime_state_background',
  appRuntimeRestoringFromBackground: 'app_runtime_state_restoring_from_background',
  appRuntimeError: 'app_runtime_state_error',
  appReadinessNavigationReady: 'app_readiness_navigation_ready',
  appReadinessAuthResolved: 'app_readiness_auth_resolved',
  appReadinessStoresHydrated: 'app_readiness_stores_hydrated',
  appReadinessSplashFinished: 'app_readiness_splash_finished',
  appReadinessRuntimeSynchronized: 'app_readiness_runtime_synchronized',
  appNetworkIdle: 'app_network_idle',
  appNetworkBusy: 'app_network_busy',
  appAsyncIdle: 'app_async_idle',
  appAsyncBusy: 'app_async_busy',
  appRuntimeIdle: 'app_runtime_idle',
  appRuntimeBusy: 'app_runtime_busy',
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
 * Aguarda estado runtime explicito.
 */
async function waitForRuntimeState(runtimeState, timeoutMs = 25000) {
  const states = Array.isArray(runtimeState) ? runtimeState : [runtimeState];
  const normalizedIds = states
    .map((value) => `app_runtime_state_${String(value || '').toLowerCase()}`)
    .filter(Boolean);

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    for (const stateId of normalizedIds) {
      try {
        await waitFor(element(bySemanticId(stateId))).toExist().withTimeout(1200);
        return stateId;
      } catch {
        // try next state
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 220));
  }

  throw new Error(`Runtime state not reached in ${timeoutMs}ms: ${normalizedIds.join(', ')}`);
}

async function waitForNavigationReady(timeoutMs = 18000) {
  await waitFor(element(bySemanticId(ELEMENTS.appReadinessNavigationReady))).toExist().withTimeout(timeoutMs);
  return ELEMENTS.appReadinessNavigationReady;
}

async function waitForStoresHydrated(timeoutMs = 20000) {
  await waitFor(element(bySemanticId(ELEMENTS.appReadinessStoresHydrated))).toExist().withTimeout(timeoutMs);
  return ELEMENTS.appReadinessStoresHydrated;
}

async function waitForAuthResolved(timeoutMs = 20000) {
  await waitFor(element(bySemanticId(ELEMENTS.appReadinessAuthResolved))).toExist().withTimeout(timeoutMs);
  return ELEMENTS.appReadinessAuthResolved;
}

/**
 * Wait for deterministic readiness signal instead of timing guesses.
 */
async function waitForAppReady(timeoutMs = 35000) {
  await waitForRuntimeState(['ready', 'navigation_ready'], timeoutMs);
  await waitFor(element(bySemanticId(ELEMENTS.appBootstrapReady))).toExist().withTimeout(Math.max(8000, Math.floor(timeoutMs / 2)));

  try {
    await waitFor(element(bySemanticId(ELEMENTS.appReadinessRuntimeSynchronized))).toExist().withTimeout(5000);
    return ELEMENTS.appReadinessRuntimeSynchronized;
  } catch {
    await waitForNavigationReady(Math.max(7000, Math.floor(timeoutMs / 3)));
    await waitForAuthResolved(Math.max(7000, Math.floor(timeoutMs / 3)));
    await waitForStoresHydrated(Math.max(7000, Math.floor(timeoutMs / 3)));
    return ELEMENTS.appReadinessNavigationReady;
  }
}

async function assertAppReady() {
  const readySignals = [ELEMENTS.appRuntimeReady, ELEMENTS.appRuntimeNavigationReady];
  let hasRuntimeSignal = false;

  for (const signal of readySignals) {
    try {
      await waitFor(element(bySemanticId(signal))).toExist().withTimeout(2000);
      hasRuntimeSignal = true;
      break;
    } catch {
      // try next signal
    }
  }

  if (!hasRuntimeSignal) {
    throw new Error('Runtime did not expose READY or NAVIGATION_READY anchors.');
  }

  try {
    await expect(element(bySemanticId(ELEMENTS.appReadinessRuntimeSynchronized))).toExist();
  } catch {
    await expect(element(bySemanticId(ELEMENTS.appReadinessNavigationReady))).toExist();
    await expect(element(bySemanticId(ELEMENTS.appReadinessAuthResolved))).toExist();
    await expect(element(bySemanticId(ELEMENTS.appReadinessStoresHydrated))).toExist();
  }
}

async function waitForNavigationIdle(timeoutMs = 12000) {
  await waitFor(element(bySemanticId(ELEMENTS.appRuntimeNavigationReady))).toExist().withTimeout(timeoutMs);
  return ELEMENTS.appRuntimeNavigationReady;
}

async function waitForPlayerReady(timeoutMs = 16000) {
  await waitFor(element(bySemanticId(ELEMENTS.playerInternal))).toExist().withTimeout(timeoutMs);
  return ELEMENTS.playerInternal;
}

async function waitForScreenStable(screenId, timeoutMs = 12000) {
  await waitFor(element(bySemanticId(screenId))).toBeVisible().withTimeout(timeoutMs);
  await waitForNavigationIdle(Math.min(timeoutMs, 9000));
  return screenId;
}

async function waitForNoPendingRequests(timeoutMs = 9000) {
  await waitFor(element(bySemanticId(ELEMENTS.appNetworkIdle))).toExist().withTimeout(timeoutMs);
  return ELEMENTS.appNetworkIdle;
}

async function waitForNetworkIdle(timeoutMs = 12000) {
  await waitFor(element(bySemanticId(ELEMENTS.appNetworkIdle))).toExist().withTimeout(timeoutMs);
  return ELEMENTS.appNetworkIdle;
}

async function assertNoPendingRequests() {
  await expect(element(bySemanticId(ELEMENTS.appNetworkIdle))).toExist();
}

async function getPendingRequests() {
  let isBusy = false;
  try {
    await waitFor(element(bySemanticId(ELEMENTS.appNetworkBusy))).toExist().withTimeout(300);
    isBusy = true;
  } catch {
    isBusy = false;
  }
  return {
    hasPending: Boolean(isBusy),
  };
}

async function getFailedRequests() {
  // Detailed counts are exported by runtime logs/reports. In E2E we assert idle/busy anchors.
  let isBusy = false;
  try {
    await waitFor(element(bySemanticId(ELEMENTS.appNetworkBusy))).toExist().withTimeout(300);
    isBusy = true;
  } catch {
    isBusy = false;
  }
  return {
    possibleFailures: Boolean(isBusy),
  };
}

async function waitForRuntimeIdle(timeoutMs = 14000) {
  await waitFor(element(bySemanticId(ELEMENTS.appRuntimeIdle))).toExist().withTimeout(timeoutMs);
  await waitFor(element(bySemanticId(ELEMENTS.appAsyncIdle))).toExist().withTimeout(Math.min(timeoutMs, 9000));
  await waitFor(element(bySemanticId(ELEMENTS.appNetworkIdle))).toExist().withTimeout(Math.min(timeoutMs, 9000));
  return ELEMENTS.appRuntimeIdle;
}

async function assertRuntimeIdle() {
  await expect(element(bySemanticId(ELEMENTS.appRuntimeIdle))).toExist();
  await expect(element(bySemanticId(ELEMENTS.appAsyncIdle))).toExist();
  await expect(element(bySemanticId(ELEMENTS.appNetworkIdle))).toExist();
}

async function getRuntimeBusyReasons() {
  let isBusy = false;
  try {
    await waitFor(element(bySemanticId(ELEMENTS.appRuntimeBusy))).toExist().withTimeout(300);
    isBusy = true;
  } catch {
    isBusy = false;
  }
  return {
    isBusy: Boolean(isBusy),
  };
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
  waitForRuntimeState,
  waitForNavigationReady,
  waitForStoresHydrated,
  waitForAuthResolved,
  waitForAppReady,
  assertAppReady,
  waitForNavigationIdle,
  waitForPlayerReady,
  waitForScreenStable,
  waitForNetworkIdle,
  assertNoPendingRequests,
  getPendingRequests,
  getFailedRequests,
  waitForRuntimeIdle,
  assertRuntimeIdle,
  getRuntimeBusyReasons,
  waitForNoPendingRequests,
  tapTab,
};
