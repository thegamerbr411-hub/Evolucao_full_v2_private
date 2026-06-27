export function normalizeProgressCounts(completedSets = 0, plannedSets = 0) {
  const planned = Math.max(0, Number(plannedSets) || 0);
  const completed = Math.max(0, Number(completedSets) || 0);
  const cappedCompleted = planned > 0 ? Math.min(completed, planned) : completed;

  return {
    completed: cappedCompleted,
    planned,
  };
}

export function computeWorkoutCompletionPercent(completedSets = 0, plannedSets = 0) {
  const { completed, planned } = normalizeProgressCounts(completedSets, plannedSets);
  if (planned <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((completed / planned) * 100));
}

export function buildWorkoutProgressCopy({
  completedSets = 0,
  plannedSets = 0,
  currentExerciseIndex = 0,
  totalExercises = 0,
  canFinish = false,
} = {}) {
  const { completed, planned } = normalizeProgressCounts(completedSets, plannedSets);
  const completionPercent = computeWorkoutCompletionPercent(completed, planned);
  const safeTotalExercises = Math.max(0, Number(totalExercises) || 0);
  const safeExerciseIndex = Math.max(0, Number(currentExerciseIndex) || 0);
  const exerciseNumber = safeTotalExercises > 0
    ? Math.min(safeExerciseIndex + 1, safeTotalExercises)
    : 0;

  const headerLabel = safeTotalExercises > 0
    ? `Exercicio atual · ${exerciseNumber} de ${safeTotalExercises}`
    : '';

  const seriesWord = completed === 1 && planned === 1 ? 'série' : 'séries';
  const workoutProgressLabel = `Treino: ${completed}/${planned} ${seriesWord} concluídas · ${completionPercent}%`;

  const isComplete = Boolean(canFinish && planned > 0 && completed >= planned);
  const footerHint = isComplete
    ? 'Todas as séries planejadas foram concluídas.'
    : 'Continue para completar o treino.';

  return {
    headerLabel,
    workoutProgressLabel,
    footerHint,
    isComplete,
    completionPercent,
    completedSets: completed,
    plannedSets: planned,
  };
}
