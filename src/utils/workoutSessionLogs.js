/**
 * Shared rules for counting/displaying workout logs within an active session.
 * Avoids flip-flop when sessionId is set but no logs match yet (fallback to same-day guided logs).
 */

export function filterGuidedWorkoutLogs(logs = []) {
  return logs.filter((item) => (item.mode || 'guided') !== 'free');
}

export function resolveEffectiveWorkoutLogs(todayLogs = [], activeSessionId = null) {
  const guided = filterGuidedWorkoutLogs(todayLogs);
  if (!activeSessionId) {
    return guided;
  }

  const sessionLogs = guided.filter((item) => item.sessionId === activeSessionId);
  if (sessionLogs.length > 0) {
    return sessionLogs;
  }

  // Same-day logs without sessionId (legacy) or pre-first-save fallback
  const orphanLogs = guided.filter((item) => !item.sessionId);
  return orphanLogs.length > 0 ? orphanLogs : guided;
}

export function createWorkoutSessionId() {
  return `ws-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
