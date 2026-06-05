/**
 * Pure helpers extracted from WorkoutScreen to shrink the main module
 * and clarify boundaries (matching, catalog, cardio detection).
 */
import * as exerciseLibraryV2 from '../../data/exerciseLibraryV2.js';

export const RPE_CHIPS = ['7', '8', '9', '10'];
export const SPARKLINE_WIDTH = 230;
export const SPARKLINE_HEIGHT = 58;

export const EXERCISE_NAMES_V2 = Array.isArray(exerciseLibraryV2?.EXERCISE_NAMES_V2)
  ? exerciseLibraryV2.EXERCISE_NAMES_V2
  : [];

export const safeGetExerciseMetaByName =
  typeof exerciseLibraryV2?.getExerciseMetaByName === 'function'
    ? exerciseLibraryV2.getExerciseMetaByName
    : () => null;

export function formatTimer(seconds) {
  const safe = Math.max(0, Number(seconds || 0));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function getTodayKeyLocal() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function resolveExperimentVariant(seed = '') {
  const source = String(seed || 'anonymous');
  let acc = 0;
  for (let i = 0; i < source.length; i += 1) {
    acc = (acc + source.charCodeAt(i) * (i + 1)) % 9973;
  }
  return acc % 2 === 0 ? 'A' : 'B';
}

export function buildSparklinePoints(values = [], width = SPARKLINE_WIDTH, height = SPARKLINE_HEIGHT) {
  const safeValues = Array.isArray(values) ? values.map((entry) => Number(entry || 0)) : [];
  if (!safeValues.length) {
    return [];
  }

  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = Math.max(1, max - min);
  const xStep = safeValues.length > 1 ? width / (safeValues.length - 1) : width;

  return safeValues.map((value, index) => {
    const normalized = (value - min) / range;
    return {
      x: Math.round(index * xStep),
      y: Math.round(height - normalized * height),
      value,
      normalized,
    };
  });
}

export function normalizeText(value) {
  const base = String(value || '');
  const normalized = typeof base.normalize === 'function' ? base.normalize('NFD') : base;
  return normalized
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function findBestCatalogMatch(catalog = [], query = '') {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return '';
  }

  const exact = catalog.find((item) => normalizeText(item) === normalizedQuery);
  if (exact) {
    return exact;
  }

  const includes = catalog.find(
    (item) =>
      normalizeText(item).includes(normalizedQuery) || normalizedQuery.includes(normalizeText(item))
  );
  if (includes) {
    return includes;
  }

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (!tokens.length) {
    return '';
  }

  return (
    catalog.find((item) => {
      const normalizedItem = normalizeText(item);
      return tokens.every((token) => normalizedItem.includes(token));
    }) || ''
  );
}

export function isCardioExerciseName(value = '') {
  const normalized = normalizeText(value);
  if (!normalized) {
    return false;
  }

  return [
    'cardio',
    'corrida',
    'caminhada',
    'bike',
    'bicicleta',
    'esteira',
    'eliptico',
    'corda',
    'hiit',
    'aerobico',
  ].some((term) => normalized.includes(term));
}

export function isCardioExercise(exercise) {
  const exerciseName = String(exercise?.name || '');
  const category = String(exercise?.category || '').toLowerCase();
  const libCategory = String(safeGetExerciseMetaByName(exerciseName)?.category || '').toLowerCase();
  return category === 'cardio' || libCategory === 'cardio' || isCardioExerciseName(exerciseName);
}

export function normalizeWorkoutExercise(item, index = 0, prefix = 'exercise') {
  if (!item) {
    return null;
  }

  const isObject = typeof item === 'object';
  const rawName = isObject ? item.name || item.exerciseName || item.title || item.label : item;
  const name = String(rawName || '').trim();
  if (!name) {
    return null;
  }

  const sets = Math.max(1, Number(isObject ? item.sets : 3) || 3);
  const reps = String((isObject ? item.reps : '') || '8-12').trim() || '8-12';
  const id = String((isObject ? item.id : '') || `${prefix}-${index + 1}-${name}`);

  return {
    ...(isObject ? item : {}),
    id,
    name,
    sets,
    reps,
    targetWeight: Number(isObject ? item.targetWeight : 0) || 0,
  };
}
