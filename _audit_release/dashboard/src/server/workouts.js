const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = path.resolve(__dirname, '..', '..', '..', 'artifacts');
const WORKOUTS_STORE_FILE = path.join(ARTIFACTS_DIR, 'workouts.json');

const LEAGUES = ['bronze', 'prata', 'ouro', 'elite'];

const XP_RULES = {
  baseWorkout: 50,
  perSet: 3,
  maxSetXp: 80,
  perVolumeUnit: 300,
  maxVolumeXp: 60,
  perStreakDay: 5,
  maxStreakXp: 80,
  progressionGainPct: 5,
  progressionGainXp: 25,
  weeklyConsistencyMinDays: 3,
  weeklyConsistencyBonusXp: 40,
  missionCompletionXp: 15,
  streakBreakPenaltyPerDay: 6,
  maxStreakBreakPenalty: 36,
};

let queue = Promise.resolve();

function withLock(task) {
  queue = queue.then(task, task);
  return queue;
}

function ensureArtifactsDir() {
  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
}

function normalizeUserId(value) {
  const safe = String(value || '').trim().toLowerCase();
  return safe.replace(/[^a-z0-9-_]/g, '').slice(0, 80);
}

function readStore() {
  ensureArtifactsDir();
  if (!fs.existsSync(WORKOUTS_STORE_FILE)) {
    return { version: 1, workouts: [] };
  }

  try {
    const raw = JSON.parse(fs.readFileSync(WORKOUTS_STORE_FILE, 'utf-8'));
    if (raw && typeof raw === 'object' && Array.isArray(raw.workouts)) {
      return raw;
    }
  } catch {
    // fallback abaixo
  }

  return { version: 1, workouts: [] };
}

function writeStore(store) {
  ensureArtifactsDir();
  const tempPath = `${WORKOUTS_STORE_FILE}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), 'utf-8');
  fs.renameSync(tempPath, WORKOUTS_STORE_FILE);
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTimezone(value) {
  const candidate = String(value || '').trim();
  if (!candidate) {
    return 'UTC';
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'UTC';
  }
}

function toDateKey(value, timezone = 'UTC') {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return toDateKey(new Date().toISOString(), timezone);
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: normalizeTimezone(timezone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value || '1970';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  const day = parts.find((part) => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

function normalizeExercise(input = {}) {
  return {
    name: String(input.name || '').trim() || 'Exercicio',
    reps: toNumber(input.reps, 0),
    weight: toNumber(input.weight, 0),
    sets: toNumber(input.sets, 1),
  };
}

function normalizeWorkout(input = {}) {
  const createdAt = String(input.createdAt || new Date().toISOString());
  const userTimezone = normalizeTimezone(input.userTimezone || input.timezone);
  const exercises = Array.isArray(input.exercises) ? input.exercises.map(normalizeExercise).filter((item) => item.name) : [];
  const totalVolume = exercises.reduce((acc, item) => acc + (item.weight * item.reps * Math.max(1, item.sets)), 0);

  return {
    id: String(input.id || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
    userId: normalizeUserId(input.userId),
    createdAt,
    dateKey: toDateKey(createdAt, userTimezone),
    timezone: userTimezone,
    name: String(input.name || 'Treino'),
    mode: String(input.mode || 'guided'),
    source: String(input.source || 'app'),
    plan: String(input.plan || 'free'),
    appVersion: String(input.appVersion || 'unknown'),
    totalSets: toNumber(input.totalSets, exercises.length),
    durationMinutes: toNumber(input.durationMinutes, 0),
    missionsCompleted: Math.max(0, toNumber(input.missionsCompleted, 0)),
    totalVolume: Math.round(toNumber(input.totalVolume, totalVolume)),
    exercises,
  };
}

function getWorkoutXpBreakdown(workout = {}, context = {}) {
  const totalSets = Math.max(0, toNumber(workout.totalSets, 0));
  const totalVolume = Math.max(0, toNumber(workout.totalVolume, 0));
  const streak = Math.max(0, toNumber(context.streak, 0));
  const progressionGain = Number(context.progressionGain || 0);
  const missionsCompleted = Math.max(0, toNumber(workout.missionsCompleted, 0));

  const baseXp = XP_RULES.baseWorkout;
  const setXp = Math.min(XP_RULES.maxSetXp, totalSets * XP_RULES.perSet);
  const volumeXp = Math.min(XP_RULES.maxVolumeXp, Math.round(totalVolume / XP_RULES.perVolumeUnit));
  const streakXp = Math.min(XP_RULES.maxStreakXp, streak * XP_RULES.perStreakDay);
  const progressionXp = progressionGain >= XP_RULES.progressionGainPct ? XP_RULES.progressionGainXp : 0;
  const missionXp = missionsCompleted * XP_RULES.missionCompletionXp;

  const total = Math.max(0, baseXp + setXp + volumeXp + streakXp + progressionXp + missionXp);

  return {
    total,
    breakdown: {
      baseXp,
      missionXp,
      progressionXp,
      setXp,
      streakXp,
      volumeXp,
    },
  };
}

function getWorkoutXp(workout = {}, context = {}) {
  return getWorkoutXpBreakdown(workout, context).total;
}

function getLevelFromXp(totalXp = 0) {
  const safeXp = Math.max(0, toNumber(totalXp, 0));
  return Math.max(1, Math.floor(Math.sqrt(safeXp / 100)) + 1);
}

function getWeeklyConsistency(workouts = []) {
  const byWeek = new Map();
  workouts.forEach((item) => {
    const d = new Date(`${String(item.dateKey || '').slice(0, 10)}T12:00:00`);
    if (Number.isNaN(d.getTime())) {
      return;
    }
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    const weekKey = d.toISOString().slice(0, 10);
    if (!byWeek.has(weekKey)) {
      byWeek.set(weekKey, new Set());
    }
    byWeek.get(weekKey).add(String(item.dateKey || ''));
  });

  let consistentWeeks = 0;
  Array.from(byWeek.values()).forEach((days) => {
    if (days.size >= 3) {
      consistentWeeks += 1;
    }
  });

  return { consistentWeeks, trackedWeeks: byWeek.size };
}

function getBadgesFromStats({ totalWorkouts = 0, streak = 0, trendPct = 0, exerciseProgress = [] } = {}) {
  const badges = [];

  if (totalWorkouts >= 1) {
    badges.push({ id: 'first_workout', title: 'Primeiro treino', icon: '🥇' });
  }
  if (streak >= 7) {
    badges.push({ id: 'streak_7', title: '7 dias de streak', icon: '🔥' });
  }
  if (trendPct >= 10) {
    badges.push({ id: 'evolution_10', title: 'Evolucao +10%', icon: '📈' });
  }
  const hasStrengthGain = (Array.isArray(exerciseProgress) ? exerciseProgress : []).some((item) => Number(item.gainPct || 0) >= 10);
  if (hasStrengthGain) {
    badges.push({ id: 'strength_gain', title: 'Forca em alta', icon: '💪' });
  }
  if (totalWorkouts >= 20) {
    badges.push({ id: 'workhorse_20', title: 'Workhorse 20', icon: '⚙️' });
  }
  if (totalWorkouts >= 50) {
    badges.push({ id: 'discipline_50', title: 'Disciplina 50', icon: '🛡️' });
  }
  if (trendPct >= 20) {
    badges.push({ id: 'rocket_growth', title: 'Crescimento foguete', icon: '🚀' });
  }

  return badges;
}

function getLeagueThreshold(rank, totalUsers) {
  const safeRank = Math.max(1, Number(rank || 1));
  const safeTotal = Math.max(1, Number(totalUsers || 1));
  return 1 - ((safeRank - 1) / safeTotal);
}

function getLeagueName(rank, totalUsers) {
  const percentile = getLeagueThreshold(rank, totalUsers);

  if (percentile >= 0.85) return LEAGUES[3];
  if (percentile >= 0.6) return LEAGUES[2];
  if (percentile >= 0.3) return LEAGUES[1];
  return LEAGUES[0];
}

function buildUserGameStats(userId, workouts = []) {
  const statsBase = {
    userId,
    streak: calculateStreak(workouts),
    totalWorkouts: workouts.length,
    totalVolume: workouts.reduce((acc, item) => acc + toNumber(item.totalVolume, 0), 0),
  };

  const averageVolume = statsBase.totalWorkouts ? Math.round(statsBase.totalVolume / statsBase.totalWorkouts) : 0;
  const current3 = workouts.slice(0, 3);
  const previous3 = workouts.slice(3, 6);
  const currentAvg = current3.length ? current3.reduce((acc, item) => acc + toNumber(item.totalVolume, 0), 0) / current3.length : 0;
  const previousAvg = previous3.length ? previous3.reduce((acc, item) => acc + toNumber(item.totalVolume, 0), 0) / previous3.length : 0;
  const trendPct = previousAvg > 0 ? Math.round(((currentAvg - previousAvg) / previousAvg) * 100) : 0;

  const exerciseProgress = getExerciseProgress(userId);
  const progressionGain = Math.max(0, ...exerciseProgress.map((item) => Number(item.gainPct || 0)));
  const weekly = getWeeklyConsistency(workouts);

  let rollingXp = 0;
  let streakBreakPenaltyXp = 0;
  let previousDate = null;
  const asc = [...workouts].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  asc.forEach((workout) => {
    const dateKey = String(workout.dateKey || '');
    if (previousDate && dateKey) {
      const prev = new Date(`${previousDate}T12:00:00`);
      const current = new Date(`${dateKey}T12:00:00`);
      const diffDays = Math.max(0, Math.floor((current.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000)));
      if (diffDays > 1) {
        const penalty = Math.min(XP_RULES.maxStreakBreakPenalty, (diffDays - 1) * XP_RULES.streakBreakPenaltyPerDay);
        streakBreakPenaltyXp += penalty;
      }
    }

    rollingXp += getWorkoutXp(workout, {
      progressionGain,
      streak: statsBase.streak,
    });
    previousDate = dateKey || previousDate;
  });

  const weeklyConsistencyXp = weekly.consistentWeeks * XP_RULES.weeklyConsistencyBonusXp;
  rollingXp = Math.max(0, rollingXp + weeklyConsistencyXp - streakBreakPenaltyXp);

  const level = getLevelFromXp(rollingXp);

  return {
    ...statsBase,
    averageVolume,
    trendPct,
    xp: rollingXp,
    level,
    xpInLevel: rollingXp - (Math.pow(level - 1, 2) * 100),
    xpNeeded: (Math.pow(level, 2) - Math.pow(level - 1, 2)) * 100,
    consistentWeeks: weekly.consistentWeeks,
    trackedWeeks: weekly.trackedWeeks,
    weeklyConsistencyXp,
    streakBreakPenaltyXp,
  };
}

function sortByCreatedAtDesc(items = []) {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function listUserWorkouts(userId, limit = 50) {
  const safeUserId = normalizeUserId(userId);
  if (!safeUserId) {
    return [];
  }

  const store = readStore();
  return sortByCreatedAtDesc(store.workouts.filter((item) => item.userId === safeUserId)).slice(0, Math.max(1, Math.min(200, Number(limit || 50))));
}

function saveWorkout(input = {}) {
  return withLock(async () => {
    const normalized = normalizeWorkout(input);
    if (!normalized.userId || !normalized.exercises.length) {
      return null;
    }

    const store = readStore();
    const exists = store.workouts.some((item) => item.id === normalized.id && item.userId === normalized.userId);
    if (!exists) {
      store.workouts.push(normalized);
      store.workouts = sortByCreatedAtDesc(store.workouts).slice(0, 50000);
      writeStore(store);
    }
    return normalized;
  });
}

function getWorkoutById(userId, workoutId) {
  const safeUserId = normalizeUserId(userId);
  const safeWorkoutId = String(workoutId || '').trim();
  if (!safeUserId || !safeWorkoutId) {
    return null;
  }
  const store = readStore();
  return store.workouts.find((item) => item.userId === safeUserId && item.id === safeWorkoutId) || null;
}

function calculateStreak(workouts = []) {
  const dates = Array.from(new Set(workouts.map((item) => item.dateKey).filter(Boolean))).sort((a, b) => String(b).localeCompare(String(a)));
  if (!dates.length) {
    return 0;
  }

  let streak = 1;
  let cursor = new Date(`${dates[0]}T12:00:00`);
  for (let index = 1; index < dates.length; index += 1) {
    cursor.setDate(cursor.getDate() - 1);
    const expected = cursor.toISOString().slice(0, 10);
    if (dates[index] === expected) {
      streak += 1;
      continue;
    }
    break;
  }
  return streak;
}

function getUserStats(userId) {
  const workouts = listUserWorkouts(userId, 500);
  const stats = buildUserGameStats(normalizeUserId(userId), workouts);
  const exerciseProgress = getExerciseProgress(userId);

  return {
    ...stats,
    badges: getBadgesFromStats({
      totalWorkouts: stats.totalWorkouts,
      streak: stats.streak,
      trendPct: stats.trendPct,
      exerciseProgress,
    }),
  };
}

function getExerciseProgress(userId) {
  const workouts = listUserWorkouts(userId, 500);
  const grouped = new Map();

  workouts.forEach((workout) => {
    (workout.exercises || []).forEach((exercise) => {
      const key = String(exercise.name || '').trim().toLowerCase();
      if (!key) {
        return;
      }
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push({
        date: workout.dateKey,
        reps: toNumber(exercise.reps, 0),
        volume: toNumber(exercise.weight, 0) * Math.max(1, toNumber(exercise.reps, 0)) * Math.max(1, toNumber(exercise.sets, 1)),
        weight: toNumber(exercise.weight, 0),
      });
    });
  });

  return Array.from(grouped.entries()).map(([exerciseKey, entries]) => {
    const sorted = entries.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const avgWeight = sorted.length ? sorted.reduce((acc, item) => acc + item.weight, 0) / sorted.length : 0;
    const avgReps = sorted.length ? sorted.reduce((acc, item) => acc + item.reps, 0) / sorted.length : 0;
    const first = sorted[0] || null;
    const last = sorted[sorted.length - 1] || null;
    const gainPct = first?.weight > 0 && last?.weight > 0
      ? Math.round(((last.weight - first.weight) / first.weight) * 100)
      : 0;

    return {
      avgReps: Math.round(avgReps),
      avgWeight: Math.round(avgWeight),
      exercise: exerciseKey,
      gainPct,
      stable: sorted.length >= 4 && Math.abs(gainPct) <= 3,
      trend: gainPct > 0 ? 'up' : gainPct < 0 ? 'down' : 'stable',
      workouts: sorted.length,
    };
  }).sort((a, b) => b.gainPct - a.gainPct);
}

function getRanking(metric = 'consistency') {
  const store = readStore();
  const byUser = new Map();

  store.workouts.forEach((item) => {
    const userId = normalizeUserId(item.userId);
    if (!userId) {
      return;
    }

    if (!byUser.has(userId)) {
      byUser.set(userId, []);
    }
    byUser.get(userId).push(item);
  });

  const rows = Array.from(byUser.entries()).map(([userId, workouts]) => {
    const game = buildUserGameStats(userId, sortByCreatedAtDesc(workouts));
    const uniqueDays = new Set(workouts.map((item) => item.dateKey).filter(Boolean)).size;
    const consistencyScore = uniqueDays * 10 + Number(game.streak || 0) * 8;
    const volumeScore = Math.round(Number(game.totalVolume || 0) / 100);
    const xpScore = Number(game.xp || 0);

    return {
      userId,
      badges: getBadgesFromStats({
        totalWorkouts: Number(game.totalWorkouts || 0),
        streak: Number(game.streak || 0),
        trendPct: Number(game.trendPct || 0),
        exerciseProgress: getExerciseProgress(userId),
      }),
      workouts: Number(game.totalWorkouts || 0),
      streak: Number(game.streak || 0),
      totalVolume: Number(game.totalVolume || 0),
      consistencyScore,
      volumeScore,
      completedScore: Number(game.totalWorkouts || 0),
      xpScore,
      level: Number(game.level || 1),
      trendPct: Number(game.trendPct || 0),
      badgesCount: Number((getBadgesFromStats({
        totalWorkouts: Number(game.totalWorkouts || 0),
        streak: Number(game.streak || 0),
        trendPct: Number(game.trendPct || 0),
        exerciseProgress: getExerciseProgress(userId),
      }) || []).length),
    };
  });

  const metricKey = String(metric || 'consistency').toLowerCase();
  const key = metricKey === 'volume'
    ? 'volumeScore'
    : metricKey === 'completed'
    ? 'completedScore'
    : metricKey === 'xp'
    ? 'xpScore'
    : 'consistencyScore';

  const ranked = rows
    .sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0))
    .map((item, index, list) => ({
      ...item,
      rank: index + 1,
      league: getLeagueName(index + 1, list.length),
      nextLeagueProgress: Number((getLeagueThreshold(index + 1, list.length) * 100).toFixed(1)),
      metric: key,
    }));

  return ranked.map((item, index) => {
    const ahead = ranked[index - 1] || null;
    const pointsToPass = ahead
      ? Math.max(0, Number(ahead[key] || 0) - Number(item[key] || 0) + 1)
      : 0;

    return {
      ...item,
      pointsToPass,
      sortMetric: key,
    };
  });
}

function getXpFormula() {
  return {
    leagueTiers: LEAGUES,
    rules: { ...XP_RULES },
    version: 'xp-v2.1-stable',
  };
}

module.exports = {
  getExerciseProgress,
  getRanking,
  getXpFormula,
  getUserStats,
  getWorkoutById,
  listUserWorkouts,
  normalizeUserId,
  saveWorkout,
};
