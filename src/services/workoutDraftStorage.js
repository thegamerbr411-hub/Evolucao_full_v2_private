export const WORKOUT_DRAFT_BUNDLE_STORAGE_KEY = '@workout:draft-bundle-v2';

export function buildWorkoutDraftScopeKey({
  sessionDayKey = '',
  workoutSessionId = '',
  routineId = '',
} = {}) {
  return [
    String(sessionDayKey || ''),
    String(workoutSessionId || 'no-session'),
    String(routineId || 'default'),
  ].join('|');
}

export function parseWorkoutDraftBundle(raw) {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if (parsed.version === 2 && parsed.scopeKey) {
      return {
        scopeKey: String(parsed.scopeKey),
        draftSetsByExercise: parsed.draftSetsByExercise && typeof parsed.draftSetsByExercise === 'object'
          ? parsed.draftSetsByExercise
          : {},
        setCountByExercise: parsed.setCountByExercise && typeof parsed.setCountByExercise === 'object'
          ? parsed.setCountByExercise
          : {},
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function serializeWorkoutDraftBundle({
  scopeKey,
  draftSetsByExercise = {},
  setCountByExercise = {},
}) {
  return JSON.stringify({
    version: 2,
    scopeKey: String(scopeKey || ''),
    draftSetsByExercise,
    setCountByExercise,
  });
}

export function resolveExercisePlannedSetCount(exerciseName, {
  setCountByExercise = {},
  exerciseSets = 3,
} = {}) {
  const fromState = Number(setCountByExercise?.[exerciseName]);
  if (Number.isFinite(fromState) && fromState > 0) {
    return fromState;
  }

  const fromExercise = Number(exerciseSets);
  if (Number.isFinite(fromExercise) && fromExercise > 0) {
    return fromExercise;
  }

  return 3;
}

export function incrementExerciseSetCount(prev = {}, exerciseName, exerciseSets = 3) {
  const safeName = String(exerciseName || '').trim();
  if (!safeName) {
    return prev;
  }

  const current = resolveExercisePlannedSetCount(safeName, {
    setCountByExercise: prev,
    exerciseSets,
  });

  return {
    ...prev,
    [safeName]: current + 1,
  };
}

export function buildSetCountMapFromExercises(exercises = []) {
  return (Array.isArray(exercises) ? exercises : []).reduce((acc, item) => {
    const name = String(item?.name || '').trim();
    if (!name) {
      return acc;
    }
    acc[name] = Math.max(1, Number(item?.sets || 3));
    return acc;
  }, {});
}
