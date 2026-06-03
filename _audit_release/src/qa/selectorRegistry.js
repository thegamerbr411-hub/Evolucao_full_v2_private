export const QA_SCREENS = Object.freeze({
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

export const QA_ELEMENTS = Object.freeze({
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

export const QA_ALIASES = Object.freeze({
  tab_home: ['tab-home'],
  tab_treinos: ['tab-treino'],
  tab_nutricao: ['tab-nutricao'],
  tab_coach: ['tab-conversa'],
  tab_profile: ['tab-perfil'],
  btn_start_workout: ['btn-iniciar-treino'],
  btn_open_admin: ['btn-open-admin'],
  btn_google_login: ['btn-profile-google-login'],
  btn_google_logout: ['btn-profile-google-logout'],
  btn_logout: ['btn-profile-session-logout'],
  btn_save_profile: ['btn-profile-save'],
  btn_player_fullscreen: ['btn-video-fullscreen'],
  btn_player_close: ['btn-video-close-player'],
});

export function qaProps(testID, extra = {}) {
  const id = String(testID || '').trim();
  if (!id) {
    return extra;
  }

  return {
    testID: id,
    accessibilityLabel: id,
    nativeID: id,
    ...extra,
  };
}

export function qaAliasProps(testID, legacyId, extra = {}) {
  const id = String(testID || '').trim();
  const alias = String(legacyId || '').trim();
  return qaProps(id, {
    accessibilityHint: alias ? `legacy:${alias}` : undefined,
    ...extra,
  });
}

export function normalizeQaScreenName(routeName = '') {
  const safe = String(routeName || '').trim().toLowerCase();
  if (!safe) {
    return QA_SCREENS.bootstrap;
  }

  if (safe === 'cadastro') return QA_SCREENS.register;
  if (safe === 'maintabs') return QA_SCREENS.home;
  if (safe.includes('home')) return QA_SCREENS.home;
  if (safe.includes('treino') || safe.includes('workout')) return QA_SCREENS.treinos;
  if (safe.includes('perfil') || safe.includes('profile')) return QA_SCREENS.profile;
  if (safe.includes('exercise')) return QA_SCREENS.exerciseDetail;
  if (safe.includes('debughealth')) return QA_SCREENS.debugHealth;
  if (safe.includes('debugobservability')) return QA_SCREENS.debugObservability;

  return `screen_${safe.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown'}`;
}