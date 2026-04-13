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

  let action = 'Faz mais 1 exercicio agora.';
  if (missing.needsWorkoutToday) {
    action = 'Voce ainda nao treinou. Comeca agora.';
  } else if (Number(missing.proteinLeft || 0) > 0) {
    action = 'Faltam proteinas. Registre uma refeicao agora.';
  } else if (Number(missing.waterLeft || 0) > 0) {
    action = 'Hidratacao abaixo da meta. Beba agua agora.';
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
    nutritionTitle: Number(missing.proteinLeft || 0) > 0 ? 'Registrar refeicao' : 'Proteina OK',
    waterTitle: waterQuickMl ? `+${waterQuickMl}ml agua` : 'Agua OK',
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
