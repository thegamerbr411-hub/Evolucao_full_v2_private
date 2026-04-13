const PLAN_LIMITS = {
  free: {
    aiPerDay: 5,
    cloudSyncPerDay: 10,
    missionsPerDay: 3,
    leaderboardAccess: 'top10',
  },
  pro: {
    aiPerDay: 200,
    cloudSyncPerDay: 500,
    missionsPerDay: 30,
    leaderboardAccess: 'full',
  },
  team: {
    aiPerDay: 1000,
    cloudSyncPerDay: 5000,
    missionsPerDay: 200,
    leaderboardAccess: 'full',
  },
};

export const plans = PLAN_LIMITS;

export const normalizePlanName = (plan) => {
  const key = String(plan || 'free').toLowerCase();
  return PLAN_LIMITS[key] ? key : 'free';
};

export const getPlanLimits = (plan) => {
  return PLAN_LIMITS[normalizePlanName(plan)];
};

export const isWithinPlanLimit = ({ plan = 'free', type, used = 0 }) => {
  const limits = getPlanLimits(plan);
  const safeUsed = Number(used || 0);

  if (type === 'ai') return safeUsed < limits.aiPerDay;
  if (type === 'sync') return safeUsed < limits.cloudSyncPerDay;
  if (type === 'mission') return safeUsed < limits.missionsPerDay;
  if (type === 'leaderboard') return limits.leaderboardAccess === 'full' || safeUsed < 10;

  return false;
};
