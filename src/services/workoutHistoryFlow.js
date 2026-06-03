import { sanitizeWorkoutLogsForRead } from './workoutLogIntegrity.js';
import { calculateVolume } from './performanceEngine.js';
import {
  filterLogsByExercise,
  resolveExerciseIdentity,
} from './workoutExerciseIdentity.js';

function safeTimestampMs(log) {
  const createdAt = Date.parse(String(log?.createdAt || ''));
  if (Number.isFinite(createdAt)) {
    return createdAt;
  }

  const dateOnly = Date.parse(`${String(log?.date || '')}T12:00:00`);
  return Number.isFinite(dateOnly) ? dateOnly : 0;
}

export function sortWorkoutLogsNewestFirst(logs = []) {
  const safe = Array.isArray(logs) ? [...logs] : [];
  return safe.sort((left, right) => safeTimestampMs(right) - safeTimestampMs(left));
}

export function getSafeExerciseHistory({
  workoutLogs = [],
  exerciseName = '',
  exerciseId = '',
} = {}) {
  const identity = resolveExerciseIdentity(exerciseName, exerciseId);
  const scoped = filterLogsByExercise(workoutLogs, identity);
  const plausible = sanitizeWorkoutLogsForRead(scoped);
  const ignoredCount = Math.max(0, scoped.length - plausible.length);
  const logs = sortWorkoutLogsNewestFirst(plausible);

  return {
    logs,
    identity,
    ignoredCount,
    hasInvalidIgnored: ignoredCount > 0,
  };
}

export function buildWorkoutHistorySummary({
  workoutLogs = [],
  exerciseName = '',
  exerciseId = '',
  limit,
} = {}) {
  const { logs, ignoredCount, hasInvalidIgnored } = getSafeExerciseHistory({
    workoutLogs,
    exerciseName,
    exerciseId,
  });

  const successful = logs.filter((item) => !item.failed);
  const lastSet = logs[0] || null;
  const bestWeight = successful.length
    ? Math.max(...successful.map((item) => Number(item.weight || 0)))
    : 0;
  const bestSet = successful.find((item) => Number(item.weight || 0) === bestWeight) || null;
  const recent = successful.slice(0, 5);
  const totalReps = recent.reduce((acc, item) => acc + Number(item.reps || 0), 0);
  const safeLimit = limit == null ? logs.length : Math.max(0, Number(limit) || 0);
  const limitedLogs = safeLimit > 0 ? logs.slice(0, safeLimit) : logs;

  return {
    logs: limitedLogs,
    lastSet,
    bestSet,
    bestWeight,
    totalVolume: calculateVolume(logs),
    totalSets: logs.length,
    recentAverageReps: recent.length ? Math.round(totalReps / recent.length) : 0,
    hasInvalidIgnored,
    ignoredCount,
  };
}

export function buildEmptyWorkoutHistorySummary() {
  return {
    logs: [],
    lastSet: null,
    bestSet: null,
    bestWeight: 0,
    totalVolume: 0,
    totalSets: 0,
    recentAverageReps: 0,
    hasInvalidIgnored: false,
    ignoredCount: 0,
  };
}
