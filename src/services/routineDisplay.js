const DEFAULT_FREQUENCY = 3;

export function clampRoutineFrequency(value, fallback = DEFAULT_FREQUENCY) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    const safeFallback = Math.round(Number(fallback));
    if (Number.isFinite(safeFallback) && safeFallback > 0) {
      return Math.min(7, Math.max(1, safeFallback));
    }
    return DEFAULT_FREQUENCY;
  }
  return Math.min(7, Math.max(1, parsed));
}

export function formatRoutineWeeklyFrequency(frequency, fallback) {
  const explicit = Number(frequency);
  if (Number.isFinite(explicit) && explicit > 0) {
    return `${clampRoutineFrequency(explicit)}x por semana`;
  }
  const safeFallback = Number(fallback);
  if (Number.isFinite(safeFallback) && safeFallback > 0) {
    return `${clampRoutineFrequency(safeFallback)}x por semana`;
  }
  return 'Frequencia nao definida';
}

export function getRoutineExerciseCount(routine) {
  const exercises = Array.isArray(routine?.exercises) ? routine.exercises : [];
  return exercises.filter((item) => {
    const name = typeof item === 'string' ? item : item?.name;
    return Boolean(String(name || '').trim());
  }).length;
}

export function canStartRoutine(routine) {
  return getRoutineExerciseCount(routine) > 0;
}

export function getRoutineStartBlockReason(routine) {
  if (canStartRoutine(routine)) {
    return '';
  }
  return 'Adicione exercicios para iniciar';
}
