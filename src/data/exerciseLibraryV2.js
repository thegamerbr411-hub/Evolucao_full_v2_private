import { EXERCISES, getExerciseByName } from './exercises';

const GIF_FALLBACK = 'https://placehold.co/320x180/0f172a/dbeafe?text=Exercise';

function normalize(value = '') {
  const base = String(value || '');
  const normalized = typeof base.normalize === 'function' ? base.normalize('NFD') : base;
  return normalized
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatMuscle(exercise) {
  return String(exercise?.musclePrimary?.[0] || exercise?.muscleSecondary?.[0] || 'geral');
}

function toLegacyItem(exercise) {
  return {
    id: exercise.id,
    name: exercise.name,
    muscle: formatMuscle(exercise),
    equipment: exercise.equipment,
    gif: exercise.thumbnail || GIF_FALLBACK,
    video: exercise.video,
    thumbnail: exercise.thumbnail,
    difficulty: exercise.difficulty,
    objective: exercise.objective,
    instructions: exercise.instructions || [],
    tags: exercise.tags || [],
  };
}

const SAFE_EXERCISES = Array.isArray(EXERCISES) ? EXERCISES : [];

export const EXERCISE_LIBRARY_V2 = SAFE_EXERCISES.map(toLegacyItem);
export const EXERCISE_NAMES_V2 = EXERCISE_LIBRARY_V2.map((item) => item.name);
export const EXERCISE_LIBRARY_SIMPLE = EXERCISE_LIBRARY_V2.map((item) => ({
  name: item.name,
  muscle: item.muscle,
}));

const map = new Map();
EXERCISE_LIBRARY_V2.forEach((entry) => {
  const key = normalize(entry.name);
  if (key && !map.has(key)) {
    map.set(key, entry);
  }
});

export function getExerciseMetaByName(name = '') {
  const key = normalize(name);
  const fromLegacy = map.get(key);
  if (fromLegacy) {
    return fromLegacy;
  }

  const fromPremium = getExerciseByName(name);
  return fromPremium ? toLegacyItem(fromPremium) : null;
}

export function getExerciseGifFallback() {
  return GIF_FALLBACK;
}
