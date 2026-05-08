const screens = Object.freeze({
  bootstrap: 'screen_bootstrap',
  loading: 'screen_loading',
  login: 'screen_login',
  register: 'screen_register',
  home: 'screen_home',
  treinos: 'screen_treinos',
  profile: 'screen_profile',
  exerciseDetail: 'screen_exercise_detail',
  debugHealth: 'screen_debug_health',
});

const elements = Object.freeze({
  appRoot: 'app_root',
  appBootstrapReady: 'app_bootstrap_ready',
  btnGoLogin: 'btn_go_login',
  btnGoRegister: 'btn_go_register',
  btnLogin: 'btn_login',
  btnRegister: 'btn_register',
  inputEmail: 'input_email',
  inputPassword: 'input_password',
  tabHome: 'tab_home',
  tabTreinos: 'tab_treinos',
  tabProfile: 'tab_profile',
  btnStartWorkout: 'btn_start_workout',
  btnLogout: 'btn_logout',
  btnOpenAdmin: 'btn_open_admin',
  btnOpenVideoExternal: 'btn_open_video_external',
  btnEnablePlayer: 'btn_enable_player',
  btnPlayerFullscreen: 'btn_player_fullscreen',
  playerInternal: 'player_internal',
});

const aliases = Object.freeze({
  tab_treinos: ['tab-treino'],
  tab_profile: ['tab-perfil'],
  btn_start_workout: ['btn-iniciar-treino'],
  btn_logout: ['btn-profile-session-logout'],
  btn_player_fullscreen: ['btn-video-fullscreen'],
});

module.exports = {
  screens,
  elements,
  aliases,
};