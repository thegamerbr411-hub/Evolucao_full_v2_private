export function generateCoachInsight(userData = {}) {
  const trainedToday = Boolean(userData?.trainedToday);
  const protein = Number(userData?.protein || 0);
  const proteinTarget = Math.max(0, Number(userData?.proteinTarget || 140));
  const water = Number(userData?.water || 0);
  const waterTarget = Math.max(0, Number(userData?.waterTarget || 2000));
  const weeklyDone = Number(userData?.weeklyDone || 0);
  const weeklyTarget = Math.max(1, Number(userData?.weeklyTarget || 4));

  const proteinGap = Math.max(0, proteinTarget - protein);
  const waterGap = Math.max(0, waterTarget - water);
  const trainingGap = Math.max(0, weeklyTarget - weeklyDone);

  const actions = [];
  if (!trainedToday) {
    actions.push('Inicie treino curto de 25 min agora.');
  }
  if (proteinGap > 0) {
    actions.push(`Feche ${proteinGap}g de proteina hoje.`);
  }
  if (waterGap > 0) {
    actions.push(`Beba +${Math.min(600, waterGap)}ml agora.`);
  }
  if (trainingGap > 0) {
    actions.push(`Faltam ${trainingGap} treino(s) para bater a meta semanal.`);
  }

  const priority = !trainedToday
    ? 'treino'
    : proteinGap > 0
    ? 'nutricao'
    : waterGap > 0
    ? 'hidratacao'
    : 'manutencao';

  return {
    priority,
    summary: actions[0] || 'Dia sob controle. Mantenha consistencia.',
    actions: actions.length ? actions : ['Mantenha o plano atual.'],
  };
}
