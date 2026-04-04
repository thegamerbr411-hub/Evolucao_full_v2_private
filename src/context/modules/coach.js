export function buildWeeklyUrgency(weeklyTarget, trainedThisWeek) {
  const remainingToTarget = Math.max(0, Number(weeklyTarget || 0) - Number(trainedThisWeek || 0));
  const urgencyMessage = remainingToTarget > 0
    ? `Faltam ${remainingToTarget} treino(s) para bater sua meta semanal.`
    : 'Meta semanal batida. Mantenha o ritmo para consolidar progresso.';

  return {
    remainingToTarget,
    urgencyMessage,
  };
}
