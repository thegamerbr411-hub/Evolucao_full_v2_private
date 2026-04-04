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

export function buildCoachMessage(state) {
  const done = state?.done || {};
  const missing = state?.missing || {};

  const doneText =
    `Proteina: ${Number(done.protein || 0)}g | Agua: ${Number(done.water || 0)}ml` +
    (done.workout ? ' | Treino: ✔' : ' | Treino: ❌');

  const missingParts = [];
  if (Number(missing.proteinLeft || 0) > 0) {
    missingParts.push(`${Number(missing.proteinLeft || 0)}g proteina`);
  }
  if (Number(missing.waterLeft || 0) > 0) {
    missingParts.push(`${Number(missing.waterLeft || 0)}ml agua`);
  }
  if (missing.needsWorkoutToday) {
    missingParts.push('treino');
  }

  const missingText = missingParts.length ? missingParts.join(' + ') : 'Nada critico';

  let action = 'Manter consistencia';
  if (missing.needsWorkoutToday) {
    action = 'Iniciar treino agora';
  } else if (Number(missing.proteinLeft || 0) > 0) {
    action = 'Fazer refeicao proteica';
  } else if (Number(missing.waterLeft || 0) > 0) {
    action = 'Beber agua agora';
  }

  let urgencyLevel = 'baixa';
  if (
    missing.needsWorkoutToday &&
    Number(missing.proteinLeft || 0) >= 30
  ) {
    urgencyLevel = 'alta';
  } else if (
    Number(missing.proteinLeft || 0) > 0 ||
    Number(missing.waterLeft || 0) > 0 ||
    missing.needsWorkoutToday
  ) {
    urgencyLevel = 'media';
  }

  const waterLeft = Number(missing.waterLeft || 0);
  const waterQuickMl = waterLeft <= 0 ? 0 : waterLeft <= 120 ? 100 : 300;

  const quickActions = {
    trainingTitle: missing.needsWorkoutToday ? 'Treinar' : 'Treino OK',
    nutritionTitle: Number(missing.proteinLeft || 0) > 0 ? 'Comer' : 'Proteina OK',
    waterTitle: waterQuickMl ? `+${waterQuickMl}ml` : 'Agua OK',
    routineTitle: Number(missing.workoutsLeft || 0) > 0 ? 'Rotina' : 'Rotina OK',
    waterQuickMl,
  };

  return {
    doneText,
    missingText,
    action,
    urgencyLevel,
    quickActions,
  };
}
