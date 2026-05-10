import { EXERCISES, MUSCLE_GROUPS } from '../src/data/exercises.js';

function normalize(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const validMuscles = new Set(Object.values(MUSCLE_GROUPS));
const requiredFields = ['name', 'primaryMuscle', 'secondaryMuscles', 'equipment', 'category', 'movementPattern'];

const seenIds = new Map();
const seenNames = new Map();
const issues = [];

EXERCISES.forEach((exercise, index) => {
  const label = `${exercise?.name || 'sem_nome'} (#${index})`;

  requiredFields.forEach((field) => {
    const value = exercise?.[field];
    const isEmptyArray = Array.isArray(value) && value.length === 0 && field !== 'secondaryMuscles';
    const isEmptyString = typeof value === 'string' && !value.trim();
    const isMissing = value == null;

    if (isMissing || isEmptyString || isEmptyArray) {
      issues.push(`[EMPTY_FIELD] ${label}: campo '${field}' vazio`);
    }
  });

  if (!Array.isArray(exercise?.secondaryMuscles)) {
    issues.push(`[INVALID_TYPE] ${label}: secondaryMuscles precisa ser array`);
  }

  if (!validMuscles.has(exercise?.primaryMuscle)) {
    issues.push(`[INVALID_PRIMARY_MUSCLE] ${label}: '${exercise?.primaryMuscle}' nao esta no enum`);
  }

  const idKey = normalize(exercise?.id);
  if (idKey) {
    if (seenIds.has(idKey)) {
      issues.push(`[DUPLICATE_ID] ${label}: id duplicado com ${seenIds.get(idKey)}`);
    } else {
      seenIds.set(idKey, label);
    }
  }

  const nameKey = normalize(exercise?.name);
  if (nameKey) {
    if (seenNames.has(nameKey)) {
      issues.push(`[DUPLICATE_NAME] ${label}: nome duplicado com ${seenNames.get(nameKey)}`);
    } else {
      seenNames.set(nameKey, label);
    }
  }
});

if (issues.length) {
  console.error('VALIDACAO FALHOU');
  issues.forEach((issue) => console.error(` - ${issue}`));
  process.exit(1);
}

console.log(`VALIDACAO OK: ${EXERCISES.length} exercicios validados sem duplicidade, campos vazios ou primaryMuscle invalido.`);
