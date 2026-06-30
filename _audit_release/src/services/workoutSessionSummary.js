import { formatSessionDuration } from './workoutSessionStatsCopy.js';

export const WORKOUT_COMPLETE_TEST_IDS = {
  screen: 'screen-workout-complete',
  summaryCard: 'workout-summary-card',
  duration: 'workout-summary-duration',
  exercises: 'workout-summary-exercises',
  sets: 'workout-summary-sets',
  volume: 'workout-summary-volume',
  finishedAt: 'workout-summary-finished-at',
  exerciseList: 'workout-summary-exercise-list',
  btnHistory: 'btn-workout-summary-history',
  btnHome: 'btn-workout-summary-home',
};

export const WORKOUT_COMPLETE_COPY = {
  title: 'Treino concluído',
  subtitle: 'Resumo do treino',
  duration: 'Duração',
  exercises: 'Exercícios',
  sets: 'Séries concluídas',
  volume: 'Volume estimado',
  finishedAt: 'Finalizado em',
  btnHistory: 'Ver histórico',
  btnHome: 'Voltar ao início',
};

const EXERCISE_LIST_MAX = 6;

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatWorkoutFinishedAt(finishedAt, nowMs = Date.now()) {
  const raw = finishedAt ? new Date(finishedAt) : new Date(nowMs);
  const date = raw instanceof Date && !Number.isNaN(raw.getTime()) ? raw : new Date(nowMs);

  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return date.toLocaleString('pt-BR');
  }
}

export function buildCompactExerciseList(exerciseNames = [], maxVisible = EXERCISE_LIST_MAX) {
  const names = Array.isArray(exerciseNames)
    ? exerciseNames.map((name) => String(name || '').trim()).filter(Boolean)
    : [];

  if (!names.length) {
    return { items: [], overflowCount: 0, displayText: '—' };
  }

  const visible = names.slice(0, maxVisible);
  const overflowCount = Math.max(0, names.length - visible.length);
  const displayText = overflowCount > 0
    ? `${visible.join(' · ')} · +${overflowCount}`
    : visible.join(' · ');

  return { items: visible, overflowCount, displayText };
}

export function buildWorkoutCompleteSummary({
  exerciseCount = 0,
  plannedExercises = 0,
  completedSets = 0,
  plannedSets = 0,
  totalVolume = 0,
  sessionDurationMinutes = 0,
  finishedAt,
  exerciseNames = [],
  streak = 0,
  sessionXp = 0,
  nowMs = Date.now(),
} = {}) {
  const safeCompletedSets = Math.max(0, toSafeNumber(completedSets, 0));
  const safePlannedSets = Math.max(0, toSafeNumber(plannedSets, 0));
  const safeExerciseCount = Math.max(0, toSafeNumber(exerciseCount, 0));
  const safePlannedExercises = Math.max(0, toSafeNumber(plannedExercises, 0));
  const safeVolume = Math.max(0, toSafeNumber(totalVolume, 0));
  const safeDurationMinutes = Math.max(0, toSafeNumber(sessionDurationMinutes, 0));
  const safeStreak = Math.max(0, toSafeNumber(streak, 0));
  const safeXp = Math.max(0, toSafeNumber(sessionXp, 0));

  const exerciseDisplay = safeExerciseCount > 0
    ? String(safeExerciseCount)
    : (safePlannedExercises > 0 ? String(safePlannedExercises) : '0');

  const setsDisplay = safePlannedSets > 0
    ? `${safeCompletedSets}/${safePlannedSets}`
    : String(safeCompletedSets);

  const durationDisplay = safeDurationMinutes > 0
    ? `${safeDurationMinutes} min`
    : formatSessionDuration(0);

  const volumeDisplay = safeVolume > 0
    ? `${safeVolume.toLocaleString('pt-BR')} kg`
    : '—';

  const showVolume = safeVolume > 0;
  const exerciseList = buildCompactExerciseList(exerciseNames);

  return {
    copy: WORKOUT_COMPLETE_COPY,
    testIds: WORKOUT_COMPLETE_TEST_IDS,
    title: WORKOUT_COMPLETE_COPY.title,
    subtitle: WORKOUT_COMPLETE_COPY.subtitle,
    durationLabel: WORKOUT_COMPLETE_COPY.duration,
    durationValue: durationDisplay,
    exercisesLabel: WORKOUT_COMPLETE_COPY.exercises,
    exercisesValue: exerciseDisplay,
    setsLabel: WORKOUT_COMPLETE_COPY.sets,
    setsValue: setsDisplay,
    volumeLabel: WORKOUT_COMPLETE_COPY.volume,
    volumeValue: volumeDisplay,
    showVolume,
    finishedAtLabel: WORKOUT_COMPLETE_COPY.finishedAt,
    finishedAtValue: formatWorkoutFinishedAt(finishedAt, nowMs),
    exerciseList,
    streak: safeStreak,
    sessionXp: safeXp,
    isPureSummaryModule: true,
  };
}
