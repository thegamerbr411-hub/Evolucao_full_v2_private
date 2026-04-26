const CDN_BASE = 'https://cdn.app.com/exercises';

function slugify(value = '') {
  const base = String(value || '');
  const normalized = typeof base.normalize === 'function' ? base.normalize('NFD') : base;

  return normalized
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function createExercise(config) {
  const id = config.id || slugify(config.name);
  const slug = slugify(config.name);

  return {
    id,
    name: config.name,
    type: config.type,
    musclePrimary: config.musclePrimary || [],
    muscleSecondary: config.muscleSecondary || [],
    equipment: config.equipment,
    objective: config.objective || 'hipertrofia',
    difficulty: config.difficulty || 'iniciante',
    video: config.video || `${CDN_BASE}/${slug}.mp4`,
    thumbnail: config.thumbnail || `${CDN_BASE}/thumbs/${slug}.png`,
    instructions: config.instructions || [],
    tips: config.tips || [],
    commonMistakes: config.commonMistakes || [],
    tags: config.tags || [],
  };
}

export const EXERCISES = [
  createExercise({
    id: 'cadeira_flexora',
    name: 'Cadeira Flexora',
    type: 'machine',
    musclePrimary: ['posterior_coxa'],
    muscleSecondary: ['panturrilha'],
    equipment: 'maquina',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    instructions: [
      'Selecione uma carga que permita controle total do movimento.',
      'Ajuste o rolo acima do calcanhar e alinhe o joelho ao eixo da maquina.',
      'Flexione os joelhos sem tirar o quadril do banco.',
      'Segure 1 segundo no pico da contracao.',
      'Retorne devagar, sem deixar a carga cair.',
    ],
    tips: ['Nao use impulso', 'Controle a descida', 'Foque em contrair posterior'],
    commonMistakes: ['Elevar quadril do banco', 'Movimento muito rapido'],
    tags: ['iniciante', 'maquina', 'posterior'],
  }),
  createExercise({
    id: 'leg_press_45',
    name: 'Leg Press 45',
    type: 'machine',
    musclePrimary: ['quadriceps'],
    muscleSecondary: ['gluteo', 'posterior_coxa'],
    equipment: 'maquina',
    objective: 'forca',
    difficulty: 'iniciante',
    instructions: [
      'Posicione os pes na largura dos ombros na plataforma.',
      'Destrave o equipamento mantendo joelhos levemente flexionados.',
      'Desca ate cerca de 90 graus sem tirar lombar do banco.',
      'Empurre a plataforma controlando joelhos e quadril.',
    ],
    tips: ['Mantenha coluna neutra', 'Empurre com o pe inteiro'],
    commonMistakes: ['Joelhos colapsando para dentro', 'Descer alem da mobilidade'],
    tags: ['maquina', 'pernas', 'forca'],
  }),
  createExercise({
    id: 'supino_inclinado_halter',
    name: 'Supino Inclinado Halter',
    type: 'dumbbell',
    musclePrimary: ['peito_superior'],
    muscleSecondary: ['ombro', 'triceps'],
    equipment: 'halter',
    objective: 'hipertrofia',
    difficulty: 'intermediario',
    instructions: [
      'Ajuste banco em inclinacao moderada.',
      'Leve os halteres para a linha superior do peito.',
      'Desca com cotovelos em angulo confortavel.',
      'Empurre para cima mantendo controle.',
    ],
    tips: ['Nao bater halteres no topo', 'Escapulas estaveis'],
    commonMistakes: ['Angulo excessivo do banco', 'Perda de controle na descida'],
    tags: ['halter', 'peito', 'intermediario'],
  }),
  createExercise({
    id: 'supino_maquina_chest_press',
    name: 'Supino Maquina (Chest Press)',
    type: 'machine',
    musclePrimary: ['peito'],
    muscleSecondary: ['ombro', 'triceps'],
    equipment: 'maquina',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    tags: ['maquina', 'peito', 'seguro'],
    instructions: [
      'Ajuste banco para alinhar pegada ao meio do peito.',
      'Empurre sem travar completamente os cotovelos.',
      'Retorne com controle mantendo peito ativo.',
    ],
  }),
  createExercise({
    id: 'remada_sentada_maquina',
    name: 'Remada Sentada Maquina',
    type: 'machine',
    musclePrimary: ['costas'],
    muscleSecondary: ['biceps'],
    equipment: 'maquina',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    tags: ['costas', 'maquina'],
    instructions: [
      'Mantenha peito aberto e coluna neutra.',
      'Puxe em direcao ao abdomen.',
      'Aproxime escapulas no final do movimento.',
      'Retorne sem perder postura.',
    ],
  }),
  createExercise({
    id: 'puxada_frontal_polia',
    name: 'Puxada Frontal Polia',
    type: 'cable',
    musclePrimary: ['costas'],
    muscleSecondary: ['biceps'],
    equipment: 'cabo',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    tags: ['cabo', 'costas'],
    instructions: [
      'Segure a barra pouco mais aberto que os ombros.',
      'Puxe em direcao ao peito sem jogar tronco para tras.',
      'Suba controlando a fase excentrica.',
    ],
  }),
  createExercise({
    id: 'agachamento_livre',
    name: 'Agachamento Livre',
    type: 'barbell',
    musclePrimary: ['quadriceps'],
    muscleSecondary: ['gluteo', 'core'],
    equipment: 'barra',
    objective: 'forca',
    difficulty: 'intermediario',
    tags: ['barra', 'forca', 'pernas'],
    instructions: [
      'Posicione a barra estavel no tronco.',
      'Inicie descida com quadril e joelhos sincronizados.',
      'Desca ate sua amplitude segura.',
      'Suba empurrando o chao com os pes.',
    ],
  }),
  createExercise({
    id: 'stiff',
    name: 'Stiff',
    type: 'barbell',
    musclePrimary: ['posterior_coxa'],
    muscleSecondary: ['gluteo', 'lombar'],
    equipment: 'barra',
    objective: 'hipertrofia',
    difficulty: 'intermediario',
    tags: ['barra', 'posterior'],
    instructions: [
      'Mantenha joelhos levemente flexionados.',
      'Projete quadril para tras e desca a barra perto da coxa.',
      'Retorne contraindo gluteos e posterior.',
    ],
  }),
  createExercise({
    id: 'desenvolvimento_halter',
    name: 'Desenvolvimento Halter',
    type: 'dumbbell',
    musclePrimary: ['ombro'],
    muscleSecondary: ['triceps'],
    equipment: 'halter',
    objective: 'hipertrofia',
    difficulty: 'intermediario',
    tags: ['ombro', 'halter'],
    instructions: [
      'Inicie com halteres na altura das orelhas.',
      'Empurre para cima sem arquear lombar.',
      'Desca de forma controlada.',
    ],
  }),
  createExercise({
    id: 'elevacao_lateral_halter',
    name: 'Elevacao Lateral Halter',
    type: 'dumbbell',
    musclePrimary: ['ombro'],
    muscleSecondary: ['trapezio'],
    equipment: 'halter',
    objective: 'definicao',
    difficulty: 'iniciante',
    tags: ['ombro', 'isolado'],
    instructions: [
      'Mantenha cotovelos levemente flexionados.',
      'Eleve halteres ate linha dos ombros.',
      'Desca lentamente sem balancar o corpo.',
    ],
  }),
  createExercise({
    id: 'rosca_direta_barra',
    name: 'Rosca Direta Barra',
    type: 'barbell',
    musclePrimary: ['biceps'],
    muscleSecondary: ['antebraco'],
    equipment: 'barra',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    tags: ['biceps', 'barra'],
    instructions: [
      'Mantenha cotovelos fixos ao lado do corpo.',
      'Suba contraindo o biceps sem embalar tronco.',
      'Retorne controlando o peso.',
    ],
  }),
  createExercise({
    id: 'triceps_corda_polia',
    name: 'Triceps Corda Polia',
    type: 'cable',
    musclePrimary: ['triceps'],
    muscleSecondary: ['antebraco'],
    equipment: 'cabo',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    tags: ['triceps', 'cabo'],
    instructions: [
      'Mantenha cotovelos junto ao tronco.',
      'Empurre a corda para baixo separando as pontas no final.',
      'Retorne sem perder controle.',
    ],
  }),
  createExercise({
    id: 'glute_bridge',
    name: 'Glute Bridge',
    type: 'bodyweight',
    musclePrimary: ['gluteo'],
    muscleSecondary: ['posterior_coxa', 'core'],
    equipment: 'peso_corporal',
    objective: 'reabilitacao',
    difficulty: 'iniciante',
    tags: ['gluteo', 'reabilitacao'],
    instructions: [
      'Apoie costas no chao e pes firmes.',
      'Suba quadril ate alinhar joelho, quadril e ombro.',
      'Segure 1 segundo e retorne.',
    ],
  }),
  createExercise({
    id: 'prancha',
    name: 'Prancha',
    type: 'bodyweight',
    musclePrimary: ['abdomen'],
    muscleSecondary: ['core', 'ombro'],
    equipment: 'peso_corporal',
    objective: 'definicao',
    difficulty: 'iniciante',
    tags: ['abdomen', 'core', 'peso_corporal'],
    instructions: [
      'Apoie antebracos e pontas dos pes no chao.',
      'Mantenha quadril alinhado e abdomen contraido.',
      'Respire continuamente durante o tempo alvo.',
    ],
  }),
  createExercise({
    id: 'abdominal_crunch',
    name: 'Abdominal Crunch',
    type: 'bodyweight',
    musclePrimary: ['abdomen'],
    muscleSecondary: ['core'],
    equipment: 'peso_corporal',
    objective: 'definicao',
    difficulty: 'iniciante',
    tags: ['abdomen'],
    instructions: [
      'Eleve o tronco ativando o abdomen.',
      'Evite puxar o pescoco com as maos.',
      'Desca de forma lenta.',
    ],
  }),
  createExercise({
    id: 'face_pull',
    name: 'Face Pull',
    type: 'cable',
    musclePrimary: ['ombro'],
    muscleSecondary: ['costas'],
    equipment: 'cabo',
    objective: 'reabilitacao',
    difficulty: 'intermediario',
    tags: ['ombro', 'postura', 'cabo'],
    instructions: [
      'Puxe a corda na direcao do rosto com cotovelos altos.',
      'Finalize com rotacao externa dos ombros.',
      'Retorne com controle.',
    ],
  }),
];

export const EXERCISE_MUSCLE_FILTERS = [
  'peito',
  'costas',
  'ombro',
  'biceps',
  'triceps',
  'pernas',
  'gluteo',
  'abdomen',
  'posterior_coxa',
  'quadriceps',
  'core',
];

export const EXERCISE_EQUIPMENT_FILTERS = ['maquina', 'halter', 'barra', 'peso_corporal', 'cabo'];
export const EXERCISE_OBJECTIVE_FILTERS = ['hipertrofia', 'forca', 'definicao', 'reabilitacao'];

export function getExerciseById(id = '') {
  const target = slugify(id);
  return EXERCISES.find((item) => slugify(item.id) === target) || null;
}

export function getExerciseByName(name = '') {
  const target = slugify(name);
  return EXERCISES.find((item) => slugify(item.name) === target) || null;
}

export function listExerciseNames() {
  return EXERCISES.map((item) => item.name);
}

function matchesMuscle(exercise, muscle) {
  if (!muscle || muscle === 'all') return true;
  const safe = slugify(muscle);
  const aliases = safe === 'pernas' ? ['quadriceps', 'posterior_coxa', 'panturrilha', 'gluteo', 'pernas'] : [safe];
  const groups = [...(exercise.musclePrimary || []), ...(exercise.muscleSecondary || [])].map(slugify);
  return aliases.some((item) => groups.includes(item));
}

export function searchExercises({ query = '', muscle = 'all', equipment = 'all', objective = 'all' } = {}) {
  const q = slugify(query);
  const equipmentKey = slugify(equipment);
  const objectiveKey = slugify(objective);

  return EXERCISES.filter((exercise) => {
    const textBlob = [
      exercise.name,
      ...(exercise.tags || []),
      ...(exercise.musclePrimary || []),
      ...(exercise.muscleSecondary || []),
    ]
      .map(slugify)
      .join(' ');

    const queryOk = !q || textBlob.includes(q);
    const muscleOk = matchesMuscle(exercise, muscle);
    const equipmentOk = equipmentKey === 'all' || slugify(exercise.equipment) === equipmentKey;
    const objectiveOk = objectiveKey === 'all' || slugify(exercise.objective) === objectiveKey;

    return queryOk && muscleOk && equipmentOk && objectiveOk;
  }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function getExerciseFilters() {
  return {
    muscles: EXERCISE_MUSCLE_FILTERS,
    equipments: EXERCISE_EQUIPMENT_FILTERS,
    objectives: EXERCISE_OBJECTIVE_FILTERS,
  };
}
