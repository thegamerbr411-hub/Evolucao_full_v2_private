import { formatExerciseName } from '../utils/displayText.js';
import {
  buildEmptyWorkoutHistorySummary,
  buildWorkoutHistorySummary,
  sortWorkoutLogsNewestFirst,
} from './workoutHistoryFlow.js';
import { sanitizeWorkoutLogsForRead } from './workoutLogIntegrity.js';
import {
  WORKOUT_COMPLETE_COPY,
  buildCompactExerciseList,
  formatWorkoutFinishedAt,
} from './workoutSessionSummary.js';

export const HISTORY_SESSION_TEST_IDS = {
  emptyState: 'history-empty-state',
  sessionCard: 'history-session-card',
  sessionTitle: 'history-session-title',
  sessionDate: 'history-session-date',
  sessionDuration: 'history-session-duration',
  sessionExercises: 'history-session-exercises',
  sessionSets: 'history-session-sets',
  sessionDetail: 'history-session-detail',
  sessionDetailCard: 'history-session-detail-card',
  sessionDetailExerciseList: 'history-session-detail-exercise-list',
  btnOpenDetail: 'btn-history-session-open-detail',
  btnBack: 'btn-history-session-back',
};

export const HISTORY_SESSION_COPY = {
  sectionTitle: 'Treinos salvos',
  emptyState: 'Seu histórico aparece aqui. Finalize um treino para ver suas séries, cargas e evolução.',
  detailTitle: 'Resumo do treino',
  loading: 'Carregando treinos salvos...',
  fallbackTitle: 'Treino',
  duration: WORKOUT_COMPLETE_COPY.duration,
  exercises: WORKOUT_COMPLETE_COPY.exercises,
  sets: 'Séries',
  volume: WORKOUT_COMPLETE_COPY.volume,
  finishedAt: WORKOUT_COMPLETE_COPY.finishedAt,
};

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolveWorkoutFinishedAt(workout = {}) {
  const raw = workout?.finishedAt || workout?.createdAt || workout?.dateKey;
  if (!raw) {
    return null;
  }
  if (String(workout?.dateKey || '').length >= 10 && !workout?.finishedAt && !workout?.createdAt) {
    return `${String(workout.dateKey).slice(0, 10)}T12:00:00.000Z`;
  }
  return raw;
}

function extractExerciseNames(exercises = []) {
  if (!Array.isArray(exercises)) {
    return [];
  }
  return exercises
    .map((item) => {
      if (typeof item === 'string') {
        return item.trim();
      }
      return String(item?.name || item?.exerciseName || '').trim();
    })
    .filter(Boolean);
}

export function buildRemoteWorkoutSessionCard(workout = {}) {
  const safeWorkout = workout && typeof workout === 'object' ? { ...workout } : {};
  const title = String(safeWorkout.name || '').trim() || HISTORY_SESSION_COPY.fallbackTitle;
  const finishedAt = resolveWorkoutFinishedAt(safeWorkout);
  const dateValue = String(safeWorkout.dateKey || safeWorkout.createdAt || '').slice(0, 10);
  const dateLabel = finishedAt
    ? formatWorkoutFinishedAt(finishedAt)
    : (dateValue || '—');
  const durationMinutes = Math.max(0, toSafeNumber(safeWorkout.durationMinutes, 0));
  const exerciseCount = extractExerciseNames(safeWorkout.exercises).length;
  const totalSets = Math.max(0, toSafeNumber(safeWorkout.totalSets, 0));
  const totalVolume = Math.max(0, toSafeNumber(safeWorkout.totalVolume, 0));
  const durationValue = durationMinutes > 0 ? `${durationMinutes} min` : '—';
  const exercisesValue = exerciseCount > 0 ? String(exerciseCount) : '—';
  const setsValue = totalSets > 0 ? String(totalSets) : '—';
  const volumeValue = totalVolume > 0
    ? `${Math.round(totalVolume).toLocaleString('pt-BR')} kg`
    : '—';
  const metaParts = [dateLabel];
  if (setsValue !== '—') {
    metaParts.push(`${setsValue} séries`);
  }
  if (totalVolume > 0) {
    metaParts.push(volumeValue);
  }

  return {
    id: String(safeWorkout.id || `${title}-${dateValue}`),
    title,
    dateLabel,
    dateValue,
    durationValue,
    exercisesValue,
    setsValue,
    volumeValue,
    showVolume: totalVolume > 0,
    metaLine: metaParts.join(' · '),
    labels: {
      duration: HISTORY_SESSION_COPY.duration,
      exercises: HISTORY_SESSION_COPY.exercises,
      sets: HISTORY_SESSION_COPY.sets,
      volume: HISTORY_SESSION_COPY.volume,
      finishedAt: HISTORY_SESSION_COPY.finishedAt,
    },
    isPurePresentation: true,
  };
}

export function buildRemoteWorkoutSessionDetail(workout = {}) {
  const card = buildRemoteWorkoutSessionCard(workout);
  const safeWorkout = workout && typeof workout === 'object' ? { ...workout } : {};
  const exerciseNames = extractExerciseNames(safeWorkout.exercises);
  const exerciseList = buildCompactExerciseList(exerciseNames);
  const finishedAt = resolveWorkoutFinishedAt(safeWorkout);

  return {
    ...card,
    detailTitle: HISTORY_SESSION_COPY.detailTitle,
    finishedAtValue: finishedAt ? formatWorkoutFinishedAt(finishedAt) : card.dateLabel,
    exerciseList,
    exerciseCount: exerciseNames.length,
    hasExerciseList: exerciseNames.length > 0,
    isPurePresentation: true,
  };
}

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
  const exerciseName = formatExerciseName(log?.exerciseName);

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
    emptyCopy: 'Seu histórico aparece aqui. Finalize um treino para ver suas séries, cargas e evolução.',
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
    emptyCopy: 'Seu histórico aparece aqui. Finalize um treino para ver suas séries, cargas e evolução.',
    ignoredHint: buildIgnoredHint(ignoredCount),
    ignoredCount,
    totalValid: sorted.length,
  };
}
