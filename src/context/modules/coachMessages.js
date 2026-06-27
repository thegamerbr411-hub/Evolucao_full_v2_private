export function buildCoachMessage(state) {
  const done = state?.done || {};
  const missing = state?.missing || {};

  const doneText =
    `Proteína: ${Number(done.protein || 0)}g | Água: ${Number(done.water || 0)}ml` +
    (done.workout ? ' | Treino: ✔' : ' | Treino: ❌');

  const missingParts = [];
  if (Number(missing.proteinLeft || 0) > 0) {
    missingParts.push(`${Number(missing.proteinLeft || 0)}g proteína`);
  }
  if (Number(missing.waterLeft || 0) > 0) {
    missingParts.push(`${Number(missing.waterLeft || 0)}ml água`);
  }
  if (missing.needsWorkoutToday) {
    missingParts.push('treino');
  }

  const missingText = missingParts.length ? missingParts.join(' + ') : 'Nada crítico';

  let action = 'Faz mais 1 exercício agora.';
  if (missing.needsWorkoutToday) {
    action = 'Você ainda não treinou. Comece agora.';
  } else if (Number(missing.proteinLeft || 0) > 0) {
    action = 'Faltam proteínas. Registre uma refeição agora.';
  } else if (Number(missing.waterLeft || 0) > 0) {
    action = 'Hidratação abaixo da meta. Beba água agora.';
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
    trainingTitle: missing.needsWorkoutToday ? 'Iniciar treino' : 'Treino OK',
    nutritionTitle: Number(missing.proteinLeft || 0) > 0 ? 'Registrar refeição' : 'Proteína OK',
    waterTitle: waterQuickMl ? `+${waterQuickMl}ml água` : 'Água OK',
    routineTitle: Number(missing.workoutsLeft || 0) > 0 ? 'Ver rotina' : 'Rotina OK',
    waterQuickMl,
  };

  const completedGoals = [
    Number(done.protein || 0) >= Number((Number(done.protein || 0) + Number(missing.proteinLeft || 0)) || 0) && Number(done.protein || 0) > 0,
    Number(done.water || 0) >= Number((Number(done.water || 0) + Number(missing.waterLeft || 0)) || 0) && Number(done.water || 0) > 0,
    Boolean(done.workout),
  ].filter(Boolean).length;

  const totalGoals = 3;
  const isPerfectDay = completedGoals === totalGoals;

  return {
    doneText,
    missingText,
    action,
    urgencyLevel,
    quickActions,
    completedGoals,
    totalGoals,
    isPerfectDay,
  };
}
