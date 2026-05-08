function assertCondition(condition, message, extra = {}) {
  if (!condition) {
    const error = new Error(message);
    error.extra = extra;
    throw error;
  }
}

function getCurrentScreen(snapshot = {}) {
  return String(snapshot.currentScreen || '').trim() || 'screen_unknown';
}

async function waitForScreen(readSnapshot, expectedScreen, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 10000);
  const intervalMs = Number(options.intervalMs || 250);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const snapshot = await readSnapshot();
    if (getCurrentScreen(snapshot) === expectedScreen) {
      return snapshot;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`timeout_waiting_screen:${expectedScreen}`);
}

function assertNavigation(snapshot, expectedScreen) {
  assertCondition(
    getCurrentScreen(snapshot) === expectedScreen,
    `navigation_mismatch:${expectedScreen}`,
    { currentScreen: getCurrentScreen(snapshot) }
  );
}

function assertAuth(snapshot, expectedLoggedIn) {
  const hasAccount = Boolean(snapshot?.auth?.hasAccount);
  assertCondition(hasAccount === Boolean(expectedLoggedIn), 'auth_state_mismatch', {
    expectedLoggedIn: Boolean(expectedLoggedIn),
    actual: hasAccount,
  });
}

function assertPlayer(snapshot, expectedActive = true) {
  const active = Boolean(snapshot?.player?.active);
  assertCondition(active === Boolean(expectedActive), 'player_state_mismatch', {
    expectedActive: Boolean(expectedActive),
    actual: active,
  });
}

function assertFullscreen(snapshot, expectedFullscreen = true) {
  const fullscreen = Boolean(snapshot?.player?.fullscreen);
  assertCondition(fullscreen === Boolean(expectedFullscreen), 'fullscreen_state_mismatch', {
    expectedFullscreen: Boolean(expectedFullscreen),
    actual: fullscreen,
  });
}

function assertNoCrash(snapshot) {
  const count = Number(snapshot?.errors?.count || 0);
  assertCondition(count === 0, 'runtime_errors_detected', { count });
}

module.exports = {
  getCurrentScreen,
  waitForScreen,
  assertNavigation,
  assertAuth,
  assertPlayer,
  assertFullscreen,
  assertNoCrash,
};