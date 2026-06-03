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

export function buildDailyCoachState({
  protein,
  proteinTarget,
  water,
  waterTarget,
  workoutsThisWeek,
  weeklyTarget,
  didWorkoutToday,
}) {
  const proteinLeft = Math.max(0, Number(proteinTarget || 0) - Number(protein || 0));
  const waterLeft = Math.max(0, Number(waterTarget || 0) - Number(water || 0));
  const workoutsLeft = Math.max(0, Number(weeklyTarget || 0) - Number(workoutsThisWeek || 0));

  return {
    done: {
      protein: Number(protein || 0),
      water: Number(water || 0),
      workout: didWorkoutToday ? 1 : 0,
    },
    missing: {
      proteinLeft,
      waterLeft,
      workoutsLeft,
      needsWorkoutToday: !didWorkoutToday,
    },
  };
}
