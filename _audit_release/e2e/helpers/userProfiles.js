function hashSeed(value) {
  return String(value || 'sim')
    .split('')
    .reduce((acc, char) => ((acc * 31) + char.charCodeAt(0)) >>> 0, 0) || 1;
}

function createSeededRandom(seedInput) {
  let seed = hashSeed(seedInput);

  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function randomInt(min, max, rng) {
  const safeMin = Number(min);
  const safeMax = Number(max);
  return Math.round(safeMin + ((safeMax - safeMin) * rng()));
}

function buildProfile(profileType = 'iniciante', seed = process.env.QA_SEED || `${profileType}-${Date.now()}`) {
  const rng = createSeededRandom(seed);

  if (profileType === 'avancado') {
    return {
      behavior: {
        abandonRate: 0.08,
        burstNavigation: true,
        rapidSwitches: 5,
      },
      coachMessage: 'Fechei treino pesado e quero ajuste fino de recuperação.',
      currentWeight: String(randomInt(84, 96, rng)),
      freeExerciseManual: 'Agachamento Sim',
      freeExerciseSecondary: 'Terra Sim',
      goalTestId: 'chip-goal-ganhar_massa',
      guidedReps: String(randomInt(6, 10, rng)),
      guidedWeight: String(randomInt(55, 90, rng)),
      height: String(randomInt(172, 188, rng)),
      key: 'avancado',
      levelTestId: 'chip-level-avancado',
      nutritionQuickMeal: '220g frango + 180g arroz + 1 iogurte',
      nutritionTextEstimate: '220g frango + 180g arroz + 1 banana',
      randomDelayMs: [120, 300],
      seed,
      targetWeight: String(randomInt(88, 100, rng)),
      trainingDaysTestId: 'chip-days-6',
      type: 'avancado',
      rng,
    };
  }

  if (profileType === 'inconsistente') {
    return {
      behavior: {
        abandonRate: 0.35,
        burstNavigation: true,
        rapidSwitches: 8,
      },
      coachMessage: 'Estou pulando treinos e dieta; preciso de plano simples.',
      currentWeight: String(randomInt(70, 98, rng)),
      freeExerciseManual: 'Treino Curto Sim',
      freeExerciseSecondary: 'Cardio Leve Sim',
      goalTestId: 'chip-goal-recomposicao',
      guidedReps: String(randomInt(8, 14, rng)),
      guidedWeight: String(randomInt(15, 42, rng)),
      height: String(randomInt(160, 186, rng)),
      key: 'inconsistente',
      levelTestId: 'chip-level-iniciante',
      nutritionQuickMeal: '1 sanduiche + 1 iogurte',
      nutritionTextEstimate: '1 pao + queijo + 1 fruta',
      randomDelayMs: [350, 900],
      seed,
      targetWeight: String(randomInt(65, 90, rng)),
      trainingDaysTestId: 'chip-days-2',
      type: 'inconsistente',
      rng,
    };
  }

  return {
    behavior: {
      abandonRate: 0.12,
      burstNavigation: false,
      rapidSwitches: 3,
    },
    coachMessage: 'Quero manter consistência sem exagerar no volume.',
    currentWeight: String(randomInt(74, 90, rng)),
    freeExerciseManual: 'Supino Sim',
    freeExerciseSecondary: 'Remada Sim',
    goalTestId: 'chip-goal-emagrecer',
    guidedReps: String(randomInt(10, 14, rng)),
    guidedWeight: String(randomInt(18, 38, rng)),
    height: String(randomInt(166, 182, rng)),
    key: 'iniciante',
    levelTestId: 'chip-level-iniciante',
    nutritionQuickMeal: '2 ovos + 120g frango',
    nutritionTextEstimate: '2 ovos + 1 fruta + 120g frango',
    randomDelayMs: [220, 580],
    seed,
    targetWeight: String(randomInt(70, 86, rng)),
    trainingDaysTestId: 'chip-days-3',
    type: 'iniciante',
    rng,
  };
}

function getUserProfile() {
  const requested = String(process.env.QA_USER_PROFILE || process.env.QA_PERSONA || 'iniciante').trim().toLowerCase();
  const normalized = ['iniciante', 'avancado', 'inconsistente'].includes(requested) ? requested : 'iniciante';
  return buildProfile(normalized);
}

module.exports = {
  buildProfile,
  getUserProfile,
};
