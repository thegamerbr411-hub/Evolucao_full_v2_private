const DAILY_MISSIONS = [
  {
    id: 'daily_water_2000',
    type: 'daily',
    title: 'Hidratacao do dia',
    description: 'Consumir pelo menos 2000ml de agua hoje.',
    rewardXP: 80,
    check: (user = {}) => Number(user.waterMlToday || 0) >= 2000,
  },
  {
    id: 'daily_protein_goal',
    type: 'daily',
    title: 'Meta de proteina',
    description: 'Bater a meta diaria de proteina.',
    rewardXP: 120,
    check: (user = {}) => Number(user.proteinToday || 0) >= Number(user.proteinTarget || 0),
  },
  {
    id: 'daily_train',
    type: 'daily',
    title: 'Treino concluido',
    description: 'Finalizar um treino hoje.',
    rewardXP: 150,
    check: (user = {}) => Boolean(user.trainedToday),
  },
];

const WEEKLY_MISSIONS = [
  {
    id: 'weekly_4_workouts',
    type: 'weekly',
    title: 'Consistencia semanal',
    description: 'Completar 4 treinos na semana.',
    rewardXP: 400,
    check: (user = {}) => Number(user.weeklyWorkouts || 0) >= 4,
  },
  {
    id: 'weekly_streak_5',
    type: 'weekly',
    title: 'Streak de 5 dias',
    description: 'Atingir streak de 5 dias.',
    rewardXP: 500,
    check: (user = {}) => Number(user.streakDays || 0) >= 5,
  },
];

export const missionTemplates = {
  daily: DAILY_MISSIONS,
  weekly: WEEKLY_MISSIONS,
};

export const getActiveMissionsForUser = (user = {}) => {
  const completed = new Set(Array.isArray(user.completedMissionIds) ? user.completedMissionIds : []);
  return [...DAILY_MISSIONS, ...WEEKLY_MISSIONS].map((mission) => {
    const isCompleted = completed.has(mission.id) || Boolean(mission.check(user));
    return {
      ...mission,
      completed: isCompleted,
      progress: isCompleted ? 1 : 0,
    };
  });
};

export const rewardMission = async ({ userId, missionId, rewardXP, saveFn }) => {
  if (!userId || !missionId || typeof saveFn !== 'function') {
    return { ok: false, message: 'Parametros invalidos para rewardMission.' };
  }

  const value = Number(rewardXP || 0);
  if (value <= 0) {
    return { ok: false, message: 'rewardXP invalido.' };
  }

  try {
    await saveFn({
      userId,
      missionId,
      rewardXP: value,
      rewardedAt: Date.now(),
    });

    return {
      ok: true,
      userId,
      missionId,
      rewardXP: value,
    };
  } catch (error) {
    return {
      ok: false,
      message: String(error?.message || error),
    };
  }
};
