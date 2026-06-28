import { normalizeProgressCounts } from './workoutProgressCopy.js';

export function formatSessionDuration(elapsedMs) {
  const ms = Math.max(0, Number(elapsedMs) || 0);
  if (ms <= 0) {
    return '0 min';
  }

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remMin = minutes % 60;
    return remMin > 0 ? `${hours}h ${remMin} min` : `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes} min`;
  }

  return `${seconds}s`;
}

export function buildWorkoutSessionStatsCopy({
  startedAtMs,
  nowMs,
  completedSets = 0,
  plannedSets = 0,
  exerciseIndex = 0,
  totalExercises = 0,
} = {}) {
  const started = Number(startedAtMs) || 0;
  const now = Number(nowMs) || Date.now();
  const elapsedMs = started > 0 ? Math.max(0, now - started) : 0;
  const { completed, planned } = normalizeProgressCounts(completedSets, plannedSets);
  const safeTotal = Math.max(0, Number(totalExercises) || 0);
  const safeIndex = Math.max(0, Number(exerciseIndex) || 0);
  const exerciseNumber = safeTotal > 0 ? Math.min(safeIndex + 1, safeTotal) : 0;

  const durationLabel = formatSessionDuration(elapsedMs);
  const setsLabel = planned > 0 ? `${completed}/${planned}` : String(completed);
  const exerciseLabel = safeTotal > 0 ? `${exerciseNumber}/${safeTotal}` : '—';

  return {
    durationLabel,
    setsLabel,
    exerciseLabel,
    elapsedMs,
    completedSets: completed,
    plannedSets: planned,
  };
}
