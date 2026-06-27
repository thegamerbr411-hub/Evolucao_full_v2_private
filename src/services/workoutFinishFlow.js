import { canFinishWorkout, computeWorkoutSessionStatus } from './dailyState.js';

export { canFinishWorkout };

export const INCOMPLETE_EXIT_CONFIRMATION = {
  title: 'Treino em andamento',
  message: 'Você ainda tem séries pendentes. Deseja sair e salvar o progresso?',
  cancelLabel: 'Continuar treino',
  confirmLabel: 'Sair e salvar progresso',
};

export function shouldBlockWorkoutFinish({ plannedSets = 0, completedSets = 0 } = {}) {
  return !canFinishWorkout({ plannedSets, completedSets });
}

export function shouldMarkPartialSessionOnExit({ plannedSets = 0, completedSets = 0 } = {}) {
  return shouldBlockWorkoutFinish({ plannedSets, completedSets });
}

export function shouldDismissRecoveryOnFinish({ plannedSets = 0, completedSets = 0 } = {}) {
  return canFinishWorkout({ plannedSets, completedSets });
}

export function getWorkoutSessionPresentation({
  guidedSets = 0,
  plannedSets = 0,
  hasResumableSession = false,
} = {}) {
  return computeWorkoutSessionStatus({
    guidedSets,
    plannedSets,
    plannedExerciseCount: 1,
    hasResumableSession,
  });
}
