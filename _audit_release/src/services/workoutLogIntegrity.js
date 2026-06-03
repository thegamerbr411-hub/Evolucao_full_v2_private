import {
  parseWorkoutNumeric,
  validateWorkoutSetInput,
  WORKOUT_SET_LIMITS,
} from './workoutInputValidation.js';

export const RECOMMENDED_INTEGRITY_ACTION = 'read_filter_only';

function isBlank(value) {
  return String(value ?? '').trim() === '';
}

/**
 * Classify a stored workout log without mutating it.
 * @returns {{ valid: boolean, reasons: string[] }}
 */
export function classifyWorkoutLogIssue(log, { isCardio = false } = {}) {
  if (!log || typeof log !== 'object') {
    return { valid: false, reasons: ['malformed_log'] };
  }

  const reasons = [];

  if (isBlank(log.date)) {
    reasons.push('missing_date');
  }

  if (isBlank(log.exerciseName) && isBlank(log.exerciseId)) {
    reasons.push('missing_exercise');
  }

  if (reasons.length > 0) {
    return { valid: false, reasons };
  }

  const validation = validateWorkoutSetInput({
    weight: log.weight,
    reps: log.reps,
    rpe: log.rpe,
    isCardio,
  });

  if (!validation.ok) {
    validation.errors.forEach((error) => {
      if (error.field === 'weight') {
        reasons.push('invalid_weight');
      } else if (error.field === 'reps') {
        reasons.push('invalid_reps');
      } else if (error.field === 'rpe') {
        reasons.push('invalid_rpe');
      }
    });
  }

  if (reasons.length > 0) {
    return { valid: false, reasons: Array.from(new Set(reasons)) };
  }

  return { valid: true, reasons: [] };
}

/**
 * Analyze integrity of workout logs for diagnostics (non-destructive).
 */
export function analyzeWorkoutLogIntegrity(workoutLogs = [], options = {}) {
  const safe = Array.isArray(workoutLogs) ? workoutLogs : [];
  const invalidByReason = {
    malformed_log: 0,
    missing_date: 0,
    missing_exercise: 0,
    invalid_weight: 0,
    invalid_reps: 0,
    invalid_rpe: 0,
  };
  const invalidIds = [];

  let invalidLogs = 0;
  safe.forEach((log) => {
    const { valid, reasons } = classifyWorkoutLogIssue(log, options);
    if (valid) {
      return;
    }
    invalidLogs += 1;
    if (log?.id) {
      invalidIds.push(String(log.id));
    }
    reasons.forEach((reason) => {
      if (Object.prototype.hasOwnProperty.call(invalidByReason, reason)) {
        invalidByReason[reason] += 1;
      }
    });
  });

  const validLogs = safe.length - invalidLogs;

  return {
    totalLogs: safe.length,
    validLogs,
    invalidLogs,
    invalidByReason,
    invalidIds,
    recommendedAction: RECOMMENDED_INTEGRITY_ACTION,
  };
}

/**
 * Returns a new array with only logs safe for history/PR/stats display.
 * Raw persisted logs are never modified.
 */
export function sanitizeWorkoutLogsForRead(workoutLogs = [], options = {}) {
  const safe = Array.isArray(workoutLogs) ? workoutLogs : [];
  return safe.filter((log) => classifyWorkoutLogIssue(log, options).valid);
}

export function getBestWeightFromLogs(logs = [], { excludeFailed = true } = {}) {
  const plausible = sanitizeWorkoutLogsForRead(logs);
  const candidates = excludeFailed
    ? plausible.filter((item) => !item.failed)
    : plausible;

  if (!candidates.length) {
    return 0;
  }

  return Math.max(...candidates.map((item) => Number(item.weight || 0)));
}

export function getLastPlausibleSet(logs = [], { exerciseName = '', exerciseId = '' } = {}) {
  const plausible = sanitizeWorkoutLogsForRead(logs);
  const normalizedName = String(exerciseName || '').trim().toLowerCase();
  const normalizedId = String(exerciseId || '').trim();

  for (const log of plausible) {
    const logName = String(log.exerciseName || '').trim().toLowerCase();
    const logId = String(log.exerciseId || '').trim();
    const nameMatch = normalizedName && logName === normalizedName;
    const idMatch = normalizedId && logId === normalizedId;

    if (nameMatch || idMatch) {
      return log;
    }
  }

  return null;
}

export { WORKOUT_SET_LIMITS, parseWorkoutNumeric };
