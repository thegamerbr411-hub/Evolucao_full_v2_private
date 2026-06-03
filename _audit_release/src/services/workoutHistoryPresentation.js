import {
  buildEmptyWorkoutHistorySummary,
  buildWorkoutHistorySummary,
  sortWorkoutLogsNewestFirst,
} from './workoutHistoryFlow.js';
import { sanitizeWorkoutLogsForRead } from './workoutLogIntegrity.js';

function formatDateLabel(dateValue = '') {
  const raw = String(dateValue || '').trim();
  if (raw.length >= 10) {
    return raw.slice(5).replace('-', '/');
  }
  return raw;
}

export function formatHistoryEntryLine(log = {}) {
  const dateLabel = formatDateLabel(log?.date);
  const weight = Number(log?.weight || 0);
  const reps = Number(log?.reps || 0);
  const exerciseName = String(log?.exerciseName || '').trim();

  if (exerciseName) {
    return `${dateLabel} ${exerciseName} · ${weight}kg x ${reps}`;
  }

  return `${dateLabel} ${weight}kg x ${reps}`;
}

export function buildIgnoredHint(ignoredCount = 0) {
  const safeCount = Math.max(0, Number(ignoredCount) || 0);
  if (safeCount <= 0) {
    return '';
  }

  if (safeCount === 1) {
    return '1 registro invalido ignorado na leitura';
  }

  return `${safeCount} registros invalidos ignorados na leitura`;
}

export function buildWorkoutHistoryPresentation({
  workoutLogs = [],
  exerciseName = '',
  exerciseId = '',
  limit = 5,
} = {}) {
  const summary = exerciseName
    ? buildWorkoutHistorySummary({
      workoutLogs,
      exerciseName,
      exerciseId,
      limit,
    })
    : buildEmptyWorkoutHistorySummary();

  const isEmpty = !summary.lastSet && summary.totalSets <= 0;
  const recentEntries = (Array.isArray(summary.logs) ? summary.logs : [])
    .filter((item) => !item?.failed)
    .slice(0, Math.max(1, Number(limit) || 5))
    .map((item) => ({
      id: String(item?.id || `${item?.date || 'log'}-${item?.weight || 0}-${item?.reps || 0}`),
      dateLabel: formatDateLabel(item?.date),
      lineText: `${formatDateLabel(item?.date)} ${Number(item?.weight || 0)}kg x ${Number(item?.reps || 0)}`,
    }));

  return {
    summary,
    isEmpty,
    emptyCopy: 'Sem historico valido para este exercicio',
    ignoredHint: buildIgnoredHint(summary.ignoredCount),
    recentEntries,
    hasInvalidIgnored: Boolean(summary.hasInvalidIgnored),
  };
}

export function buildLocalWorkoutLogsPresentation(workoutLogs = [], { limit = 10 } = {}) {
  const safeLogs = Array.isArray(workoutLogs) ? workoutLogs : [];
  const plausible = sanitizeWorkoutLogsForRead(safeLogs);
  const ignoredCount = Math.max(0, safeLogs.length - plausible.length);
  const sorted = sortWorkoutLogsNewestFirst(plausible);
  const safeLimit = Math.max(1, Number(limit) || 10);

  const entries = sorted.slice(0, safeLimit).map((item) => ({
    id: String(item?.id || `${item?.date || 'log'}-${item?.exerciseName || 'exercise'}`),
    lineText: formatHistoryEntryLine(item),
  }));

  return {
    entries,
    isEmpty: entries.length === 0,
    emptyCopy: 'Nenhuma serie registrada localmente ainda.',
    ignoredHint: buildIgnoredHint(ignoredCount),
    ignoredCount,
    totalValid: sorted.length,
  };
}
