function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePain(value = '') {
  return String(value || '').trim().toLowerCase();
}

function buildProfileAction(goal, level) {
  const safeGoal = String(goal || 'recomposicao');
  const safeLevel = String(level || 'iniciante');
  return `Perfil base: objetivo ${safeGoal} | nível ${safeLevel}.`;
}

export function generateCoachInsight(userData = {}) {
  if (Object.prototype.hasOwnProperty.call(userData || {}, 'workout') || Object.prototype.hasOwnProperty.call(userData || {}, 'nutrition')) {
    const workout = userData?.workout;
    const nutrition = userData?.nutrition;

    if (!workout?.exercises?.length) return 'Bora treinar hoje';
    if (toNumber(nutrition?.protein, 0) < 100) return 'Aumente a proteína hoje';
    return 'Boa evolução';
  }

  const trainedToday = Boolean(userData?.trainedToday);
  const protein = toNumber(userData?.protein, 0);
  const proteinTarget = Math.max(0, toNumber(userData?.proteinTarget, 140));
  const water = toNumber(userData?.water, 0);
  const waterTarget = Math.max(0, toNumber(userData?.waterTarget, 2000));
  const weeklyDone = toNumber(userData?.weeklyDone, 0);
  const weeklyTarget = Math.max(1, toNumber(userData?.weeklyTarget, 4));
  const weakMeals = Math.max(0, toNumber(userData?.weakMeals, 0));
  const hasRoutine = userData?.hasRoutine !== false;
  const goal = String(userData?.goal || 'recomposicao');
  const level = String(userData?.level || 'iniciante');
  const pain = normalizePain(userData?.pain);

  const proteinGap = Math.max(0, proteinTarget - protein);
  const waterGap = Math.max(0, waterTarget - water);
  const trainingGap = Math.max(0, weeklyTarget - weeklyDone);
  const actions = [];

  if (!trainedToday) {
    actions.push('Inicie um treino curto de 25 a 35 min ainda hoje.');
  }
  if (proteinGap > 0) {
    actions.push(`Feche ${proteinGap}g de proteína com uma refeição forte ou shake.`);
  }
  if (waterGap > 0) {
    actions.push(`Beba mais ${Math.min(700, waterGap)}ml agora para reduzir o gap de água.`);
  }
  if (weakMeals > 0) {
    actions.push(`Você teve ${weakMeals} refeição(ões) fraca(s) em proteína. Corrija a próxima.`);
  }
  if (!hasRoutine) {
    actions.push('Salve ao menos uma rotina para não depender de decisões no dia.');
  }
  if (pain && !pain.includes('nenhuma')) {
    actions.push(`Dor reportada em ${pain}. Ajuste carga e amplitude antes de buscar falha.`);
  }

  const priority = !trainedToday
    ? 'treino'
    : proteinGap > 0 || weakMeals > 0
    ? 'nutricao'
    : waterGap > 0
    ? 'hidratacao'
    : !hasRoutine
    ? 'rotina'
    : pain && !pain.includes('nenhuma')
    ? 'perfil'
    : 'manutencao';

  const summaryMap = {
    treino: trainingGap > 0
      ? `Treino é a maior alavanca agora. Semana em ${weeklyDone}/${weeklyTarget}.`
      : 'Treino do dia ainda não foi concluído.',
    nutricao: weakMeals > 0
      ? 'Nutrição precisa de melhor distribuição ao longo do dia.'
      : `Proteína abaixo da meta por ${proteinGap}g.`,
    hidratacao: `Água abaixo da meta por ${waterGap}ml.`,
    rotina: 'Rotina salva reduz atrito e melhora consistência.',
    perfil: 'Perfil e segurança precisam ser considerados antes de aumentar intensidade.',
    manutencao: 'Dia bem encaminhado. Foque em executar o próximo bloco sem dispersão.',
  };

  return {
    priority,
    summary: summaryMap[priority] || summaryMap.manutencao,
    actions: actions.length ? actions : ['Mantenha o plano atual.'],
    profileLine: buildProfileAction(goal, level),
  };
}
