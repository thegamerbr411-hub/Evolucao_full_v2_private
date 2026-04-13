import { getCanonicalMuscleGroup } from '../../data/exerciseDatabase.js';
import { getExerciseById } from '../../data/exerciseDatabase.js';

export function getWeekBounds(dateKey) {
  const base = new Date(`${dateKey}T12:00:00`);
  const weekday = (base.getDay() + 6) % 7;

  const start = new Date(base);
  start.setDate(base.getDate() - weekday);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);

  const toDateKey = (value) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    startKey: toDateKey(start),
    endKey: toDateKey(end),
  };
}

export function getWorkoutDelta(current, previous) {
  if (!previous) {
    return null;
  }

  return {
    setsDiff: Number(current?.totalSets || 0) - Number(previous?.totalSets || 0),
    loadDiff: Number(current?.totalLoad || 0) - Number(previous?.totalLoad || 0),
  };
}

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function inferMuscleGroup(name = '') {
  const canonical = getCanonicalMuscleGroup(name);
  if (canonical) return canonical;

  const lower = normalize(name);
  if (lower.includes('supino') || lower.includes('crucifixo') || lower.includes('peck')) return 'peito';
  if (lower.includes('remada') || lower.includes('puxada') || lower.includes('pull')) return 'costas';
  if (lower.includes('agach') || lower.includes('leg') || lower.includes('stiff') || lower.includes('panturrilha') || lower.includes('terra')) return 'perna';
  if (lower.includes('desenvolvimento') || lower.includes('elevacao')) return 'ombro';
  if (lower.includes('triceps')) return 'triceps';
  if (lower.includes('rosca') || lower.includes('biceps')) return 'biceps';
  return null;
}

function inferMuscleGroupFromLog(entry = {}) {
  const byId = getExerciseById(entry.exerciseId || '');
  if (byId?.grupo) {
    const normalized = normalize(byId.grupo);
    if (normalized === 'pernas') return 'perna';
    if (normalized === 'ombros') return 'ombro';
    return normalized;
  }

  return inferMuscleGroup(entry.exerciseName || '');
}

function sanitizeIdToken(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function buildConsistentExerciseId({ dateKey, workoutKey, exerciseName, index }) {
  const safeDate = sanitizeIdToken(dateKey || new Date().toISOString().slice(0, 10));
  const safeWorkoutKey = sanitizeIdToken(workoutKey || 'smart');
  const safeName = sanitizeIdToken(exerciseName || `exercise-${Number(index || 0) + 1}`);
  return `smart-${safeDate}-${safeWorkoutKey}-${safeName}-${Number(index || 0) + 1}`;
}

function getClusterFromGroup(group) {
  if (['peito', 'ombro', 'triceps'].includes(group)) return 'push';
  if (['costas', 'biceps'].includes(group)) return 'pull';
  if (group === 'perna') return 'legs';
  return 'full';
}

function isBlockedByPain(exerciseName, normalizedPain) {
  const lower = normalize(exerciseName);
  if (normalizedPain.includes('ombro')) {
    return lower.includes('supino') || lower.includes('desenvolvimento');
  }
  if (normalizedPain.includes('joelho')) {
    return lower.includes('agach') || lower.includes('leg press');
  }
  if (normalizedPain.includes('lombar') || normalizedPain.includes('coluna')) {
    return lower.includes('terra') || lower.includes('agachamento livre');
  }
  return false;
}

function findReplacementExercise({ blockedName, group, catalog = [], normalizedPain }) {
  const safeCatalog = Array.isArray(catalog) ? catalog : [];
  const preferred = safeCatalog.find((name) => {
    if (normalize(name) === normalize(blockedName)) {
      return false;
    }
    if (isBlockedByPain(name, normalizedPain)) {
      return false;
    }
    const candidateGroup = inferMuscleGroup(name);
    return candidateGroup === group;
  });

  if (preferred) {
    return preferred;
  }

  return safeCatalog.find((name) => !isBlockedByPain(name, normalizedPain)) || blockedName;
}

export function applyPainAdaptiveWorkout(exercises = [], pain = '', catalog = []) {
  const normalizedPain = normalize(pain);
  if (!normalizedPain || normalizedPain.includes('nenhuma')) {
    return {
      exercises,
      replacements: [],
      painApplied: false,
    };
  }

  const replacements = [];
  const adapted = exercises.map((exercise, index) => {
    const name = exercise?.name || exercise?.nome || '';
    if (!isBlockedByPain(name, normalizedPain)) {
      return exercise;
    }

    const group = inferMuscleGroup(name);
    const replacementName = findReplacementExercise({
      blockedName: name,
      group,
      catalog,
      normalizedPain,
    });

    if (replacementName && replacementName !== name) {
      replacements.push({
        from: name,
        to: replacementName,
      });
      return {
        ...exercise,
        name: replacementName,
        id: `pain-adapt-${replacementName}-${index}`,
      };
    }

    return exercise;
  });

  return {
    exercises: adapted,
    replacements,
    painApplied: replacements.length > 0,
  };
}

export function adaptWorkoutForPain(exercises = [], pain = '') {
  const normalizedPain = normalize(pain);
  if (!normalizedPain || normalizedPain.includes('nenhuma')) {
    return exercises;
  }

  return exercises.filter((exercise) => {
    const lower = normalize(exercise.name || exercise.nome || '');
    return !isBlockedByPain(lower, normalizedPain);
  });
}

export function getRecommendedWorkout({
  workoutLogs = [],
  weeklyTarget = 3,
  pain = '',
  library = {},
  catalog = [],
  todayKey,
}) {
  const dateKey = todayKey || new Date().toISOString().slice(0, 10);
  const week = getWeekBounds(dateKey);

  const trainedThisWeek = new Set(
    workoutLogs
      .filter((item) => String(item.date || '') >= week.startKey && String(item.date || '') <= week.endKey)
      .map((item) => item.date)
  ).size;

  const recentDates = Array.from(new Set(workoutLogs.map((item) => item.date))).sort((a, b) => String(b).localeCompare(String(a)));
  const recentGroups = [];

  recentDates.slice(0, 5).forEach((key) => {
    const groups = Array.from(new Set(
      workoutLogs
        .filter((item) => item.date === key)
        .map((item) => inferMuscleGroupFromLog(item))
        .filter(Boolean)
    ));
    if (groups.length) {
      recentGroups.push(...groups);
    }
  });

  const usage = { push: 0, pull: 0, legs: 0, full: 0 };
  recentGroups.forEach((group) => {
    const cluster = getClusterFromGroup(group);
    usage[cluster] += 1;
  });

  const options = [
    { key: 'push', title: 'Peito + Triceps + Ombro', exercises: library.push || [] },
    { key: 'pull', title: 'Costas + Biceps', exercises: library.pull || [] },
    { key: 'legs', title: 'Pernas completas', exercises: library.legs || [] },
    { key: 'full', title: 'Full body de consistencia', exercises: library.fullBody || [] },
  ].filter((item) => item.exercises.length > 0);

  const recentExerciseNames = new Set(
    workoutLogs
      .slice(0, 120)
      .filter((item) => {
        const key = String(item?.date || '');
        return key && key >= week.startKey && key <= week.endKey;
      })
      .map((item) => normalize(item.exerciseName || ''))
      .filter(Boolean)
  );

  const ranked = options
    .map((item) => ({
      ...item,
      score: Number(usage[item.key] || 0),
      noveltyPenalty: item.exercises.reduce(
        (acc, exercise) => acc + (recentExerciseNames.has(normalize(exercise?.name || exercise?.nome || '')) ? 1 : 0),
        0
      ),
    }))
    .sort((a, b) => (a.score + a.noveltyPenalty) - (b.score + b.noveltyPenalty));

  const fallbackFromCatalog = (Array.isArray(catalog) ? catalog : [])
    .filter((name) => !recentExerciseNames.has(normalize(name)))
    .slice(0, 5)
    .map((name) => ({ name, sets: 3, reps: '8-12' }));

  const best = ranked[0] || { key: 'full', title: 'Full body', exercises: [] };
  const baseExercises = best.exercises.length ? best.exercises : fallbackFromCatalog;
  const adaptive = applyPainAdaptiveWorkout(baseExercises, pain, catalog);
  const diversified = adaptive.exercises
    .filter((exercise) => exercise && String(exercise.name || exercise.nome || '').trim())
    .filter((exercise, index, list) => list.findIndex((item) => normalize(item?.name || item?.nome || '')) === index)
    .slice(0, 8);
  const remainingToTarget = Math.max(0, Number(weeklyTarget || 3) - trainedThisWeek);

  const decisionReasons = [
    'Baseado nos seus ultimos treinos',
    'Ajustado para sua frequencia semanal',
    ...(adaptive.painApplied ? ['Adaptado por dor informada no perfil'] : []),
  ];

  return {
    key: best.key,
    title: best.title,
    exercises: diversified.map((exercise, index) => ({
      ...exercise,
      id: buildConsistentExerciseId({
        dateKey,
        workoutKey: best.key,
        exerciseName: exercise?.name || exercise?.nome || '',
        index,
      }),
    })),
    trainedThisWeek,
    weeklyTarget: Number(weeklyTarget || 3),
    remainingToTarget,
    source: 'local',
    confidence: diversified.length ? 0.9 : 0.6,
    decisionReasons,
    replacements: adaptive.replacements,
    debug: {
      usage,
      noveltyPenalty: ranked[0]?.noveltyPenalty || 0,
      selected: best.key,
      painApplied: adaptive.painApplied,
    },
  };
}

export function getNextWeightSuggestion({
  exerciseName,
  logs = [],
  currentWeight = 0,
  repsHit = 0,
  targetRepMax = 12,
}) {
  const recent = logs
    .filter((item) => item.exerciseName === exerciseName)
    .slice(0, 5);

  const reference = Number(currentWeight || recent[0]?.weight || 0);
  if (!reference) {
    return {
      suggestedWeight: 0,
      source: 'local',
      confidence: 0.4,
      reason: 'Sem referencia de carga',
    };
  }

  const failCount = recent.slice(0, 3).filter((item) => item.failed).length;
  const shouldReduce = failCount >= 2;
  const shouldIncrease = Number(repsHit || 0) >= Number(targetRepMax || 12) && failCount === 0;
  const step = inferMuscleGroup(exerciseName) === 'perna' ? 5 : 2.5;

  const suggestedWeight = shouldReduce
    ? Math.max(5, reference - step)
    : shouldIncrease
    ? reference + step
    : reference;

  return {
    suggestedWeight,
    source: 'local',
    confidence: recent.length >= 3 ? 0.9 : 0.7,
    reason: shouldReduce ? 'Falhas recentes' : shouldIncrease ? 'Top reps atingido' : 'Manter para consolidar',
  };
}
