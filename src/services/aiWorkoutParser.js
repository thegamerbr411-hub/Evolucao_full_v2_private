function normalize(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

const EXERCISE_ALIASES = [
  { keys: ['supino inclinado', 'inclinado'], name: 'Supino Inclinado Maquina' },
  { keys: ['supino reto', 'supino', 'chest press'], name: 'Supino Maquina (Chest Press)' },
  { keys: ['crucifixo', 'voador'], name: 'Crucifixo' },
  { keys: ['leg press', 'leg'], name: 'Leg Press 45' },
  { keys: ['agachamento', 'agach'], name: 'Agachamento Livre' },
  { keys: ['remada curvada', 'remada'], name: 'Remada Curvada Barra' },
  { keys: ['puxada', 'pulldown', 'puxador'], name: 'Puxada Frontal Polia' },
  { keys: ['desenvolvimento', 'ombro'], name: 'Desenvolvimento Halter' },
  { keys: ['rosca direta', 'rosca'], name: 'Rosca Direta' },
  { keys: ['triceps', 'triceps pulley', 'triceps corda'], name: 'Triceps Polia' },
  { keys: ['stiff'], name: 'Stiff' },
  { keys: ['mesa flexora', 'flexora'], name: 'Mesa Flexora' },
  { keys: ['cadeira extensora', 'extensora'], name: 'Cadeira Extensora' },
];

function resolveCatalogName(candidate = '') {
  const normalizedCandidate = normalize(candidate);
  if (!normalizedCandidate) {
    return '';
  }

  const aliasNames = Array.from(new Set(EXERCISE_ALIASES.map((item) => item.name).filter(Boolean)));
  const exact = aliasNames.find((name) => normalize(name) === normalizedCandidate);
  if (exact) {
    return exact;
  }

  const contains = aliasNames.find((name) => normalize(name).includes(normalizedCandidate) || normalizedCandidate.includes(normalize(name)));
  return contains || '';
}

function resolveExerciseName(line = '') {
  const lower = normalize(line);
  const matched = EXERCISE_ALIASES.find((item) => item.keys.some((key) => lower.includes(key)));
  if (matched) {
    return resolveCatalogName(matched.name) || matched.name;
  }

  return resolveCatalogName(line);
}

function parseSetRep(line = '') {
  const lower = normalize(line);

  // Formatos aceitos: 4x10, 4 x 10, 4 de 10
  const direct = lower.match(/(\d{1,2})\s*(x|de)\s*(\d{1,3})/i);
  if (direct) {
    return {
      sets: Math.max(1, Number(direct[1] || 1)),
      reps: String(Number(direct[3] || 10)),
    };
  }

  // Fallback: apenas reps no final da linha
  const trailingReps = lower.match(/(\d{1,3})\s*$/);
  if (trailingReps) {
    return {
      sets: 3,
      reps: String(Number(trailingReps[1] || 10)),
    };
  }

  return { sets: 3, reps: '10' };
}

function buildSets(count = 3, reps = '10') {
  const safeCount = Math.max(1, Math.min(12, Number(count || 3)));
  return Array.from({ length: safeCount }).map(() => ({
    reps: String(reps || '10'),
    weight: '',
    done: false,
  }));
}

export const parseWorkoutText = (text) => {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.replace(/^[-*•\s]+/, '').trim())
    .filter(Boolean);

  const exercises = [];

  lines.forEach((line) => {
    const name = resolveExerciseName(line);
    if (!name) {
      return;
    }

    const parsed = parseSetRep(line);
    exercises.push({
      name,
      sets: buildSets(parsed.sets, parsed.reps),
    });
  });

  return {
    name: 'Treino importado',
    exercises,
  };
};
