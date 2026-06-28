export const REST_TIMER_ADJUST_STEP_SEC = 15;

export function formatRestTimerCountdown(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;

  if (minutes > 0) {
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  return `${safe}s`;
}

export function buildRestTimerActionLabels() {
  return {
    title: 'Descanso',
    skip: 'Pular',
    plus15: '+15s',
    minus15: '-15s',
  };
}

export function buildRestTimerStatusCopy({ secondsRemaining = 0, isRunning = false } = {}) {
  const safeSeconds = Math.max(0, Number(secondsRemaining) || 0);

  if (!isRunning) {
    return {
      statusCopy: '',
      isLowTime: false,
    };
  }

  return {
    statusCopy: safeSeconds <= 15 ? 'Quase la' : 'Descanso em andamento',
    isLowTime: safeSeconds <= 15,
  };
}

export function clampRestSecondsAfterAdjust(currentEndAtMs, deltaSec, nowMs = Date.now()) {
  const delta = Number(deltaSec) || 0;
  const baseEnd = Number(currentEndAtMs) || nowMs;
  const nextEnd = baseEnd + delta * 1000;
  const minEnd = nowMs + 1000;
  const clampedEnd = Math.max(minEnd, nextEnd);
  const remaining = Math.max(1, Math.ceil((clampedEnd - nowMs) / 1000));

  return {
    endAtMs: clampedEnd,
    secondsRemaining: remaining,
  };
}
