'use strict';

/**
 * catalogAnalyzer.js
 * Analisador de catálogo de exercícios/máquinas.
 * - Normaliza texto
 * - Detecta tipo (exercício ou máquina)
 * - Valida completude
 * - Sugere muscleGroup / category / equipment
 * - Calcula confidence
 * - Gera reason
 * - Detecta duplicados
 * - NUNCA aprova sozinho
 */

const EXERCISE_KEYWORDS = [
  'rosca', 'supino', 'agachamento', 'levantamento', 'remada', 'puxada',
  'flexao', 'extensao', 'desenvolvimento', 'elevacao', 'triceps', 'biceps',
  'cadeira', 'stiff', 'terra', 'leg press', 'hack', 'abdominal', 'prancha',
  'afundo', 'passada', 'burpee', 'pull up', 'pull-up', 'pullup', 'dip',
  'crunch', 'sit up', 'hiit', 'press', 'fly', 'flye', 'curl', 'row',
  'deadlift', 'squat', 'lunge', 'raise', 'kickback', 'pushdown', 'pushup',
];

const MACHINE_KEYWORDS = [
  'maquina', 'máquina', 'aparelho', 'polia', 'crossover', 'peck deck',
  'graviton', 'smith', 'hack machine', 'leg curl machine', 'leg extension machine',
  'cable', 'barra fixa', 'barra', 'anilha', 'halteres', 'kettlebell',
  'eliptico', 'esteira', 'bicicleta ergometrica', 'remo ergometrico',
  'multifuncional', 'plataforma', 'banco', 'torre', 'voador', 'peck',
];

const MUSCLE_MAP = {
  peito: ['supino', 'crucifixo', 'peck', 'fly', 'flye', 'crossover', 'voador'],
  costas: ['remada', 'puxada', 'pull', 'terra', 'levantamento terra', 'graviton'],
  perna: ['agachamento', 'leg', 'cadeira', 'stiff', 'hack', 'afundo', 'passada', 'lunge', 'squat', 'panturrilha'],
  ombro: ['desenvolvimento', 'elevacao', 'raise', 'press militar', 'desenvolvimento militar'],
  triceps: ['triceps', 'pushdown', 'testa', 'kickback', 'extensao'],
  biceps: ['rosca', 'curl', 'biceps'],
  abdomen: ['abdominal', 'prancha', 'crunch', 'sit up', 'obliquo'],
  core: ['plancha', 'prancha', 'abdominal', 'rotacao', 'vacuo'],
};

const EQUIPMENT_MAP = {
  barra: ['barra', 'olimpico', 'smith'],
  halter: ['halter', 'halteres', 'dumbbell'],
  maquina: ['maquina', 'máquina', 'aparelho'],
  polia: ['polia', 'cable', 'crossover', 'peck', 'voador'],
  peso_corporal: ['flexao', 'afundo', 'burpee', 'pull up', 'pullup', 'dip', 'agachamento livre'],
  kettlebell: ['kettlebell'],
  halteres: ['halter', 'halteres'],
};

const GENERIC_NAMES = [
  'exercicio', 'treino', 'maquina', 'aparelho', 'teste', 'exemplo',
  'exercicio 1', 'exercicio 2', 'novo', 'item', 'nome', 'untitled',
  'aaa', 'abc', 'test', 'foo', 'bar',
];

const MAX_TITLE_CHARS = 120;
const MAX_DESC_CHARS = 500;
const MAX_SHORT_CHARS = 80;

function sanitizeText(value, maxLen = MAX_SHORT_CHARS) {
  return String(value || '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function capitalize(value) {
  const s = String(value || '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function detectType(title, description, submittedType) {
  const combined = normalizeText(`${title} ${description}`);

  if (submittedType === 'exercise' || submittedType === 'exercicio') {
    return 'exercise';
  }
  if (submittedType === 'machine' || submittedType === 'maquina') {
    return 'machine';
  }

  let exerciseScore = 0;
  let machineScore = 0;

  EXERCISE_KEYWORDS.forEach((kw) => {
    if (combined.includes(normalizeText(kw))) exerciseScore += 1;
  });

  MACHINE_KEYWORDS.forEach((kw) => {
    if (combined.includes(normalizeText(kw))) machineScore += 1;
  });

  if (exerciseScore === 0 && machineScore === 0) return 'exercise';
  return machineScore > exerciseScore ? 'machine' : 'exercise';
}

function suggestMuscleGroup(title, description) {
  const combined = normalizeText(`${title} ${description}`);
  const scores = {};

  Object.entries(MUSCLE_MAP).forEach(([muscle, keywords]) => {
    keywords.forEach((kw) => {
      if (combined.includes(normalizeText(kw))) {
        scores[muscle] = (scores[muscle] || 0) + 1;
      }
    });
  });

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : 'geral';
}

function suggestEquipment(title, description) {
  const combined = normalizeText(`${title} ${description}`);
  const scores = {};

  Object.entries(EQUIPMENT_MAP).forEach(([equipment, keywords]) => {
    keywords.forEach((kw) => {
      if (combined.includes(normalizeText(kw))) {
        scores[equipment] = (scores[equipment] || 0) + 1;
      }
    });
  });

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : 'livre';
}

function suggestCategory(title, description) {
  const combined = normalizeText(`${title} ${description}`);
  if (combined.includes('cardio') || combined.includes('esteira') || combined.includes('bicicleta')) {
    return 'cardio';
  }
  if (combined.includes('funcional') || combined.includes('hiit') || combined.includes('crossfit')) {
    return 'funcional';
  }
  if (combined.includes('alongamento') || combined.includes('yoga') || combined.includes('flexibilidade')) {
    return 'mobilidade';
  }
  return 'musculacao';
}

function isGenericTitle(normalizedTitle) {
  return GENERIC_NAMES.some((g) => normalizedTitle === g || normalizedTitle.length < 3);
}

function detectDuplicate(normalizedTitle, existingTitles = []) {
  const normalizedSet = new Set(
    (Array.isArray(existingTitles) ? existingTitles : [])
      .map((item) => normalizeText(item))
      .filter(Boolean)
  );
  return normalizedSet.has(normalizedTitle);
}

function calculateConfidence({
  hasTitle,
  hasDescription,
  hasMuscleGroup,
  hasEquipment,
  isGeneric,
  isDuplicate,
  typeDetectedFromContent,
  typeMatchSubmitted,
}) {
  let score = 0.5;

  if (hasTitle) score += 0.1;
  if (hasDescription) score += 0.1;
  if (hasMuscleGroup) score += 0.1;
  if (hasEquipment) score += 0.05;
  if (typeDetectedFromContent) score += 0.1;
  if (typeMatchSubmitted) score += 0.05;
  if (isGeneric) score -= 0.35;
  if (isDuplicate) score -= 0.5;

  return Math.round(Math.max(0, Math.min(1, score)) * 100) / 100;
}

/**
 * Analisa um item de catálogo.
 * @param {object} submission
 * @param {string[]} existingTitles - títulos normalizados já existentes no catálogo oficial
 * @returns {object} análise com confidence, normalizedTitle, suggestedCategory, reason, isValid
 */
function analyzeSubmission(submission = {}, existingTitles = []) {
  const rawTitle = sanitizeText(submission.title, MAX_TITLE_CHARS);
  const rawDescription = sanitizeText(submission.description, MAX_DESC_CHARS);
  const rawType = sanitizeText(submission.type, 20).toLowerCase();
  const rawMuscleGroup = sanitizeText(submission.muscleGroup, 60);
  const rawEquipment = sanitizeText(submission.equipment, 60);

  const normalizedTitle = normalizeText(rawTitle);
  const hasTitle = normalizedTitle.length >= 3;
  const hasDescription = rawDescription.length >= 10;
  const hasMuscleGroup = Boolean(rawMuscleGroup);
  const hasEquipment = Boolean(rawEquipment);

  const isGeneric = isGenericTitle(normalizedTitle);
  const isDuplicate = detectDuplicate(normalizedTitle, existingTitles);

  const detectedType = detectType(rawTitle, rawDescription, rawType);
  const typeDetectedFromContent = Boolean(detectedType);
  const typeMatchSubmitted = detectedType === rawType;

  const suggestedMuscle = rawMuscleGroup || suggestMuscleGroup(rawTitle, rawDescription);
  const suggestedEquip = rawEquipment || suggestEquipment(rawTitle, rawDescription);
  const suggestedCat = suggestCategory(rawTitle, rawDescription);

  const confidence = calculateConfidence({
    hasTitle,
    hasDescription,
    hasMuscleGroup,
    hasEquipment,
    isGeneric,
    isDuplicate,
    typeDetectedFromContent,
    typeMatchSubmitted,
  });

  const reasons = [];

  if (!hasTitle) reasons.push('Título ausente ou muito curto.');
  if (isGeneric) reasons.push('Título genérico demais. Use um nome específico.');
  if (isDuplicate) reasons.push('Item já existe no catálogo oficial.');
  if (!hasDescription) reasons.push('Descrição muito curta ou ausente (mínimo recomendado: 10 caracteres).');

  if (detectedType === 'exercise') {
    if (!hasMuscleGroup) reasons.push(`Grupo muscular ausente (sugerido: ${suggestedMuscle}).`);
    if (!hasEquipment) reasons.push(`Equipamento ausente (sugerido: ${suggestedEquip}).`);
  }

  const hasEssentialInfo = detectedType === 'machine'
    ? hasDescription
    : (hasDescription && (hasMuscleGroup || suggestedMuscle !== 'geral'));

  const isValid = hasTitle && !isGeneric && !isDuplicate && hasEssentialInfo && confidence >= 0.35;

  const reason = reasons.length > 0
    ? reasons.join(' ')
    : `Item válido. Tipo detectado: ${detectedType}. Músculo sugerido: ${suggestedMuscle}.`;

  return {
    isValid,
    confidence,
    normalizedTitle,
    normalizedType: detectedType,
    suggestedMuscleGroup: suggestedMuscle,
    suggestedEquipment: suggestedEquip,
    suggestedCategory: suggestedCat,
    reason,
    isDuplicate,
    isGeneric,
    displayTitle: capitalize(rawTitle),
  };
}

/**
 * Valida e sanitiza payload de submissão de catálogo.
 */
function validateSubmissionPayload(body = {}) {
  const errors = [];

  const title = sanitizeText(body.title, MAX_TITLE_CHARS);
  const description = sanitizeText(body.description, MAX_DESC_CHARS);
  const type = ['exercise', 'machine'].includes(String(body.type || '').toLowerCase())
    ? String(body.type).toLowerCase()
    : 'exercise';
  const muscleGroup = sanitizeText(body.muscleGroup, 60);
  const equipment = sanitizeText(body.equipment, 60);
  const difficulty = ['beginner', 'intermediate', 'advanced', 'iniciante', 'intermediario', 'avancado'].includes(
    String(body.difficulty || '').toLowerCase()
  ) ? String(body.difficulty).toLowerCase() : 'intermediate';
  const source = sanitizeText(body.source || 'admin', 60);
  const createdBy = sanitizeText(body.createdBy || body.userId || 'admin', 60);

  if (!title || title.length < 3) {
    errors.push('Title is required and must be at least 3 characters.');
  }
  if (title.length > 120) {
    errors.push('Title must not exceed 120 characters.');
  }
  if (description.length > MAX_DESC_CHARS) {
    errors.push('Description must not exceed 500 characters.');
  }
  if (description && description.length < 10) {
    errors.push('Description must be at least 10 characters when provided.');
  }
  if (type === 'exercise' && !muscleGroup && !equipment && !description) {
    errors.push('Exercise submission requires at least description or muscle/equipment hints.');
  }

  return {
    valid: errors.length === 0,
    errors,
    payload: {
      title,
      description,
      type,
      muscleGroup,
      equipment,
      difficulty,
      source,
      createdBy,
    },
  };
}

module.exports = {
  analyzeSubmission,
  validateSubmissionPayload,
  normalizeText,
};
