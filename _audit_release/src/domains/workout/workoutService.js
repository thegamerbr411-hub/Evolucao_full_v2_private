import { WORKOUT_MULTI_QA_PRESET } from '../../context/modules/workout.js';

function isQaMultiWorkoutEnabled() {
  return typeof __DEV__ !== 'undefined'
    && __DEV__
    && String(process.env.EXPO_PUBLIC_QA_MULTI_WORKOUT || '').trim() === '1';
}

export function getWorkoutDayIndex(date = new Date()) {
  const jsDay = date.getDay();
  return (jsDay + 6) % 7;
}

export function getWorkoutBySplitForDate(split, library, date = new Date()) {
  const dayIndex = getWorkoutDayIndex(date);

  if (!split || split.includes('Full body')) {
    return library.fullBody;
  }

  if (split.includes('Superior/Inferior')) {
    return dayIndex % 2 === 0 ? library.upper : library.lower;
  }

  if (split.includes('Push/Pull/Legs')) {
    const ppl = [library.push, library.pull, library.legs];
    return ppl[dayIndex % 3];
  }

  const classic = [library.push, library.pull, library.legs, library.upper, library.lower];
  return classic[dayIndex % classic.length];
}

export function buildTodayWorkout({
  trainingSplit,
  exerciseTargets,
  profile,
  workoutLogs,
  library,
  applyPainAdaptiveWorkout,
  getExerciseCatalogFromSources,
  date = new Date(),
}) {
  const splitExercises = isQaMultiWorkoutEnabled() && WORKOUT_MULTI_QA_PRESET.length >= 5
    ? WORKOUT_MULTI_QA_PRESET
    : getWorkoutBySplitForDate(trainingSplit, library, date);

  const base = splitExercises.map((exercise, index) => ({
    ...exercise,
    id: `${exercise.name}-${index}`,
    targetWeight: Number(exerciseTargets?.[exercise.name]?.targetWeight || 0),
  }));

  const pain = String(profile?.currentPain || profile?.pain || '');
  const catalog = getExerciseCatalogFromSources(Array.isArray(workoutLogs) ? workoutLogs : []);
  const adaptive = applyPainAdaptiveWorkout(base, pain, catalog);

  return {
    exercises: adaptive.exercises,
    replacements: adaptive.replacements,
  };
}
