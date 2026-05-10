const CDN_BASE = 'https://cdn.app.com/exercises';

// ─────────────────────────────────────────────────────────────────────────────
// ENUM DE GRUPOS MUSCULARES — fonte de verdade única
// Todas as referências devem usar esses valores.
// ─────────────────────────────────────────────────────────────────────────────
export const MUSCLE_GROUPS = {
  CHEST:      'chest',
  BACK:       'back',
  SHOULDERS:  'shoulders',
  BICEPS:     'biceps',
  TRICEPS:    'triceps',
  LEGS:       'legs',        // quadríceps como primário
  HAMSTRINGS: 'hamstrings',  // posterior da coxa como primário
  GLUTES:     'glutes',
  CALVES:     'calves',
  CORE:       'core',
};

// Labels em Português para exibição na UI
export const MUSCLE_GROUP_LABELS = {
  chest:      'Peito',
  back:       'Costas',
  shoulders:  'Ombro',
  biceps:     'Bíceps',
  triceps:    'Tríceps',
  legs:       'Pernas (Quadríceps)',
  hamstrings: 'Posterior',
  glutes:     'Glúteo',
  calves:     'Panturrilha',
  core:       'Abdômen / Core',
};

// Conjunto de valores válidos para validação rápida
const VALID_MUSCLE_SET = new Set(Object.values(MUSCLE_GROUPS));

// ─────────────────────────────────────────────────────────────────────────────
// VALIDAÇÃO
// ─────────────────────────────────────────────────────────────────────────────
export function validateExercise(ex) {
  if (!ex || typeof ex !== 'object') throw new Error(`validateExercise: exercício inválido (${ex})`);
  if (!ex.primaryMuscle)             throw new Error(`validateExercise: campo "primaryMuscle" ausente em "${ex.name || ex.id}"`);
  if (!VALID_MUSCLE_SET.has(ex.primaryMuscle)) {
    throw new Error(
      `validateExercise: primaryMuscle "${ex.primaryMuscle}" inválido em "${ex.name}". ` +
      `Valores aceitos: ${[...VALID_MUSCLE_SET].join(', ')}`
    );
  }
  if (!Array.isArray(ex.secondaryMuscles)) throw new Error(`validateExercise: "secondaryMuscles" deve ser array em "${ex.name}"`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
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
  const id     = config.id || slugify(config.name);
  const slug   = slugify(config.name);
  const pm     = config.primaryMuscle;
  const sm     = config.secondaryMuscles || [];

  const exercise = {
    id,
    name:             config.name,
    // ── Schema v2 (padrão): campo único, string ──────────────────────────────
    primaryMuscle:    pm,
    secondaryMuscles: sm,
    category:         config.category    || 'compound',
    movementPattern:  config.movementPattern || '',
    // ── Campos comuns ────────────────────────────────────────────────────────
    equipment:        config.equipment,
    objective:        config.objective   || 'hipertrofia',
    difficulty:       config.difficulty  || 'iniciante',
    video:            config.video       || `${CDN_BASE}/${slug}.mp4`,
    thumbnail:        config.thumbnail   || `${CDN_BASE}/thumbs/${slug}.png`,
    instructions:     config.instructions || [],
    tips:             config.tips         || [],
    commonMistakes:   config.commonMistakes || [],
    tags:             config.tags         || [],
    // ── Retrocompatibilidade (leitores legados de musclePrimary/muscleSecondary)
    musclePrimary:    pm ? [pm] : [],
    muscleSecondary:  sm,
  };

  return exercise;
}

export const EXERCISES = [
  // ─── POSTERIOR DA COXA (hamstrings) ───────────────────────────────────────
  createExercise({
    id: 'cadeira_flexora',
    name: 'Cadeira Flexora',
    primaryMuscle: MUSCLE_GROUPS.HAMSTRINGS,
    secondaryMuscles: [MUSCLE_GROUPS.CALVES],
    category: 'isolation',
    movementPattern: 'knee_flexion',
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
    tags: ['iniciante', 'maquina', 'posterior', 'hamstrings'],
  }),
  createExercise({
    id: 'stiff',
    name: 'Stiff',
    primaryMuscle: MUSCLE_GROUPS.HAMSTRINGS,
    secondaryMuscles: [MUSCLE_GROUPS.GLUTES, MUSCLE_GROUPS.BACK],
    category: 'compound',
    movementPattern: 'hip_hinge',
    equipment: 'barra',
    objective: 'hipertrofia',
    difficulty: 'intermediario',
    instructions: [
      'Mantenha joelhos levemente flexionados.',
      'Projete quadril para tras e desca a barra perto da coxa.',
      'Retorne contraindo gluteos e posterior.',
    ],
    tips: ['Coluna neutra durante todo movimento', 'Barra sempre proxima ao corpo'],
    commonMistakes: ['Arredondar lombar', 'Dobrar joelhos demais (vira levantamento terra)'],
    tags: ['barra', 'posterior', 'hamstrings', 'hip_hinge'],
  }),

  // ─── PERNAS / QUADRÍCEPS (legs) ───────────────────────────────────────────
  createExercise({
    id: 'leg_press_45',
    name: 'Leg Press 45',
    primaryMuscle: MUSCLE_GROUPS.LEGS,
    secondaryMuscles: [MUSCLE_GROUPS.GLUTES, MUSCLE_GROUPS.HAMSTRINGS],
    category: 'compound',
    movementPattern: 'knee_extension',
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
    tags: ['maquina', 'pernas', 'quadriceps', 'forca'],
  }),
  createExercise({
    id: 'agachamento_livre',
    name: 'Agachamento Livre',
    primaryMuscle: MUSCLE_GROUPS.LEGS,
    secondaryMuscles: [MUSCLE_GROUPS.GLUTES, MUSCLE_GROUPS.CORE],
    category: 'compound',
    movementPattern: 'squat',
    equipment: 'barra',
    objective: 'forca',
    difficulty: 'intermediario',
    instructions: [
      'Posicione a barra estavel no tronco.',
      'Inicie descida com quadril e joelhos sincronizados.',
      'Desca ate sua amplitude segura.',
      'Suba empurrando o chao com os pes.',
    ],
    tips: ['Joelhos apontando para fora', 'Peito aberto', 'Respiracao diafragmatica'],
    commonMistakes: ['Joelhos colapsando', 'Heel rise', 'Lombar arredondando'],
    tags: ['barra', 'forca', 'pernas', 'quadriceps'],
  }),
  createExercise({
    id: 'cadeira_extensora',
    name: 'Cadeira Extensora',
    primaryMuscle: MUSCLE_GROUPS.LEGS,
    secondaryMuscles: [],
    category: 'isolation',
    movementPattern: 'knee_extension',
    equipment: 'maquina',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    instructions: [
      'Ajuste o encosto para manter joelhos alinhados ao eixo da maquina.',
      'Estenda os joelhos sem tirar quadril do banco.',
      'Controle a descida sem soltar a carga.',
    ],
    tips: ['Pause no pico da contracao', 'Nao jogue o peso'],
    commonMistakes: ['Quadril saindo do banco', 'Velocidade excessiva'],
    tags: ['quadriceps', 'maquina', 'pernas', 'isolado'],
  }),

  // ─── GLÚTEOS (glutes) ─────────────────────────────────────────────────────
  createExercise({
    id: 'glute_bridge',
    name: 'Glute Bridge',
    primaryMuscle: MUSCLE_GROUPS.GLUTES,
    secondaryMuscles: [MUSCLE_GROUPS.HAMSTRINGS, MUSCLE_GROUPS.CORE],
    category: 'isolation',
    movementPattern: 'hip_extension',
    equipment: 'peso_corporal',
    objective: 'reabilitacao',
    difficulty: 'iniciante',
    instructions: [
      'Apoie costas no chao e pes firmes.',
      'Suba quadril ate alinhar joelho, quadril e ombro.',
      'Segure 1 segundo e retorne.',
    ],
    tips: ['Contraia gluteo no topo', 'Nao arquear lombar excessivamente'],
    commonMistakes: ['Usar lombar em vez de gluteo', 'Amplitude incompleta'],
    tags: ['gluteo', 'reabilitacao', 'peso_corporal'],
  }),
  createExercise({
    id: 'abdutora_maquina',
    name: 'Abdutora Maquina',
    primaryMuscle: MUSCLE_GROUPS.GLUTES,
    secondaryMuscles: [],
    category: 'isolation',
    movementPattern: 'hip_abduction',
    equipment: 'maquina',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    instructions: [
      'Mantenha tronco estavel e quadril bem apoiado.',
      'Abra as pernas com controle ate sua amplitude segura.',
      'Retorne devagar mantendo tensao no gluteo.',
    ],
    tips: ['Incline levemente o tronco para ativar mais gluteo medio'],
    commonMistakes: ['Tronco desestabilizando', 'Velocidade excessiva'],
    tags: ['gluteo', 'abdutora', 'maquina'],
  }),

  // ─── PEITO (chest) ────────────────────────────────────────────────────────
  createExercise({
    id: 'supino_inclinado_halter',
    name: 'Supino Inclinado Halter',
    primaryMuscle: MUSCLE_GROUPS.CHEST,
    secondaryMuscles: [MUSCLE_GROUPS.SHOULDERS, MUSCLE_GROUPS.TRICEPS],
    category: 'compound',
    movementPattern: 'horizontal_push',
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
    primaryMuscle: MUSCLE_GROUPS.CHEST,
    secondaryMuscles: [MUSCLE_GROUPS.SHOULDERS, MUSCLE_GROUPS.TRICEPS],
    category: 'compound',
    movementPattern: 'horizontal_push',
    equipment: 'maquina',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    instructions: [
      'Ajuste banco para alinhar pegada ao meio do peito.',
      'Empurre sem travar completamente os cotovelos.',
      'Retorne com controle mantendo peito ativo.',
    ],
    tags: ['maquina', 'peito', 'seguro'],
  }),

  // ─── COSTAS (back) ────────────────────────────────────────────────────────
  createExercise({
    id: 'remada_sentada_maquina',
    name: 'Remada Sentada Maquina',
    primaryMuscle: MUSCLE_GROUPS.BACK,
    secondaryMuscles: [MUSCLE_GROUPS.BICEPS],
    category: 'compound',
    movementPattern: 'horizontal_pull',
    equipment: 'maquina',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    instructions: [
      'Mantenha peito aberto e coluna neutra.',
      'Puxe em direcao ao abdomen.',
      'Aproxime escapulas no final do movimento.',
      'Retorne sem perder postura.',
    ],
    tags: ['costas', 'maquina'],
  }),
  createExercise({
    id: 'puxada_frontal_polia',
    name: 'Puxada Frontal Polia',
    primaryMuscle: MUSCLE_GROUPS.BACK,
    secondaryMuscles: [MUSCLE_GROUPS.BICEPS],
    category: 'compound',
    movementPattern: 'vertical_pull',
    equipment: 'cabo',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    instructions: [
      'Segure a barra pouco mais aberto que os ombros.',
      'Puxe em direcao ao peito sem jogar tronco para tras.',
      'Suba controlando a fase excentrica.',
    ],
    tags: ['cabo', 'costas'],
  }),

  // ─── OMBROS (shoulders) ───────────────────────────────────────────────────
  createExercise({
    id: 'desenvolvimento_halter',
    name: 'Desenvolvimento Halter',
    primaryMuscle: MUSCLE_GROUPS.SHOULDERS,
    secondaryMuscles: [MUSCLE_GROUPS.TRICEPS],
    category: 'compound',
    movementPattern: 'vertical_push',
    equipment: 'halter',
    objective: 'hipertrofia',
    difficulty: 'intermediario',
    instructions: [
      'Inicie com halteres na altura das orelhas.',
      'Empurre para cima sem arquear lombar.',
      'Desca de forma controlada.',
    ],
    tags: ['ombro', 'halter'],
  }),
  createExercise({
    id: 'elevacao_lateral_halter',
    name: 'Elevacao Lateral Halter',
    primaryMuscle: MUSCLE_GROUPS.SHOULDERS,
    secondaryMuscles: [],
    category: 'isolation',
    movementPattern: 'lateral_raise',
    equipment: 'halter',
    objective: 'definicao',
    difficulty: 'iniciante',
    instructions: [
      'Mantenha cotovelos levemente flexionados.',
      'Eleve halteres ate linha dos ombros.',
      'Desca lentamente sem balancar o corpo.',
    ],
    tags: ['ombro', 'isolado'],
  }),
  createExercise({
    id: 'face_pull',
    name: 'Face Pull',
    primaryMuscle: MUSCLE_GROUPS.SHOULDERS,
    secondaryMuscles: [MUSCLE_GROUPS.BACK],
    category: 'isolation',
    movementPattern: 'horizontal_pull',
    equipment: 'cabo',
    objective: 'reabilitacao',
    difficulty: 'intermediario',
    instructions: [
      'Puxe a corda na direcao do rosto com cotovelos altos.',
      'Finalize com rotacao externa dos ombros.',
      'Retorne com controle.',
    ],
    tags: ['ombro', 'postura', 'cabo', 'reabilitacao'],
  }),

  // ─── BÍCEPS (biceps) ──────────────────────────────────────────────────────
  createExercise({
    id: 'rosca_direta_barra',
    name: 'Rosca Direta Barra',
    primaryMuscle: MUSCLE_GROUPS.BICEPS,
    secondaryMuscles: [],
    category: 'isolation',
    movementPattern: 'elbow_flexion',
    equipment: 'barra',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    instructions: [
      'Mantenha cotovelos fixos ao lado do corpo.',
      'Suba contraindo o biceps sem embalar tronco.',
      'Retorne controlando o peso.',
    ],
    tags: ['biceps', 'barra'],
  }),

  // ─── TRÍCEPS (triceps) ────────────────────────────────────────────────────
  createExercise({
    id: 'triceps_corda_polia',
    name: 'Triceps Corda Polia',
    primaryMuscle: MUSCLE_GROUPS.TRICEPS,
    secondaryMuscles: [],
    category: 'isolation',
    movementPattern: 'elbow_extension',
    equipment: 'cabo',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    instructions: [
      'Mantenha cotovelos junto ao tronco.',
      'Empurre a corda para baixo separando as pontas no final.',
      'Retorne sem perder controle.',
    ],
    tags: ['triceps', 'cabo'],
  }),

  // ─── PANTURRILHA (calves) ─────────────────────────────────────────────────
  createExercise({
    id: 'panturrilha_em_pe_maquina',
    name: 'Panturrilha em Pe Maquina',
    primaryMuscle: MUSCLE_GROUPS.CALVES,
    secondaryMuscles: [],
    category: 'isolation',
    movementPattern: 'plantarflexion',
    equipment: 'maquina',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    instructions: [
      'Posicione a ponta dos pes na plataforma com calcanhar livre.',
      'Eleve o calcanhar ate contrair a panturrilha.',
      'Desca controlando sem quicar.',
    ],
    tags: ['panturrilha', 'maquina'],
  }),
  createExercise({
    id: 'panturrilha_no_leg_press',
    name: 'Panturrilha no Leg Press',
    primaryMuscle: MUSCLE_GROUPS.CALVES,
    secondaryMuscles: [],
    category: 'isolation',
    movementPattern: 'plantarflexion',
    equipment: 'maquina',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    instructions: [
      'Use apenas ponta dos pes na parte baixa da plataforma.',
      'Empurre com a panturrilha sem mover joelhos excessivamente.',
      'Controle a fase de alongamento na descida.',
    ],
    tags: ['panturrilha', 'leg press', 'maquina'],
  }),

  // ─── CORE / ABDÔMEN (core) ────────────────────────────────────────────────
  createExercise({
    id: 'prancha',
    name: 'Prancha',
    primaryMuscle: MUSCLE_GROUPS.CORE,
    secondaryMuscles: [MUSCLE_GROUPS.SHOULDERS],
    category: 'isolation',
    movementPattern: 'anti_extension',
    equipment: 'peso_corporal',
    objective: 'definicao',
    difficulty: 'iniciante',
    instructions: [
      'Apoie antebracos e pontas dos pes no chao.',
      'Mantenha quadril alinhado e abdomen contraido.',
      'Respire continuamente durante o tempo alvo.',
    ],
    tags: ['abdomen', 'core', 'peso_corporal'],
  }),
  createExercise({
    id: 'abdominal_crunch',
    name: 'Abdominal Crunch',
    primaryMuscle: MUSCLE_GROUPS.CORE,
    secondaryMuscles: [],
    category: 'isolation',
    movementPattern: 'spinal_flexion',
    equipment: 'peso_corporal',
    objective: 'definicao',
    difficulty: 'iniciante',
    instructions: [
      'Eleve o tronco ativando o abdomen.',
      'Evite puxar o pescoco com as maos.',
      'Desca de forma lenta.',
    ],
    tags: ['abdomen'],
  }),

  // ─── GLÚTEOS — novos (BLOCO 3) ────────────────────────────────────────────
  createExercise({
    id: 'hip_thrust',
    name: 'Hip Thrust',
    primaryMuscle: MUSCLE_GROUPS.GLUTES,
    secondaryMuscles: [MUSCLE_GROUPS.HAMSTRINGS, MUSCLE_GROUPS.CORE],
    category: 'compound',
    movementPattern: 'hip_extension',
    equipment: 'barra',
    objective: 'hipertrofia',
    difficulty: 'intermediario',
    instructions: [
      'Apoie as costas no banco e posicione a barra sobre o quadril.',
      'Pes na largura dos ombros, planta inteira no chao.',
      'Empurre o quadril para cima contraindo o gluteo no topo.',
      'Segure 1 segundo e desca de forma controlada.',
    ],
    tips: ['Queixo no peito durante o movimento', 'Joelhos alinhados aos pes'],
    commonMistakes: ['Arquear lombar excessivamente', 'Nao contrair gluteo no topo'],
    tags: ['gluteo', 'barra', 'hip thrust', 'glutes'],
  }),
  createExercise({
    id: 'coice_kickback',
    name: 'Coice (Kickback)',
    primaryMuscle: MUSCLE_GROUPS.GLUTES,
    secondaryMuscles: [MUSCLE_GROUPS.HAMSTRINGS],
    category: 'isolation',
    movementPattern: 'hip_extension',
    equipment: 'cabo',
    objective: 'definicao',
    difficulty: 'iniciante',
    instructions: [
      'Fixe o tornozelo no cabo e posicione-se de frente para a maquina.',
      'Mantenha o tronco estavel e empurre a perna para tras.',
      'Contraia o gluteo no ponto mais alto.',
      'Retorne de forma controlada.',
    ],
    tips: ['Nao gire o quadril', 'Amplitude moderada para isolar o gluteo'],
    commonMistakes: ['Usar impulso do tronco', 'Amplitude excessiva com compensacao lombar'],
    tags: ['gluteo', 'cabo', 'coice', 'kickback', 'isolado'],
  }),

  // ─── POSTERIOR DA COXA — novos (BLOCO 3) ─────────────────────────────────
  createExercise({
    id: 'mesa_flexora',
    name: 'Mesa Flexora',
    primaryMuscle: MUSCLE_GROUPS.HAMSTRINGS,
    secondaryMuscles: [MUSCLE_GROUPS.CALVES],
    category: 'isolation',
    movementPattern: 'knee_flexion',
    equipment: 'maquina',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    instructions: [
      'Deite de brucos na maquina e posicione o rolo atras do calcanhar.',
      'Flexione os joelhos trazendo o rolo em direcao ao gluteo.',
      'Segure 1 segundo no pico e retorne lentamente.',
    ],
    tips: ['Quadril firme na maquina', 'Nao solte o peso na descida'],
    commonMistakes: ['Levantar o quadril', 'Usar impulso para subir'],
    tags: ['posterior', 'hamstrings', 'maquina', 'mesa flexora'],
  }),
  createExercise({
    id: 'good_morning',
    name: 'Good Morning',
    primaryMuscle: MUSCLE_GROUPS.HAMSTRINGS,
    secondaryMuscles: [MUSCLE_GROUPS.GLUTES, MUSCLE_GROUPS.BACK],
    category: 'compound',
    movementPattern: 'hip_hinge',
    equipment: 'barra',
    objective: 'forca',
    difficulty: 'avancado',
    instructions: [
      'Posicione a barra nos trapezios (nuca).',
      'Joelhos levemente flexionados e coluna neutra.',
      'Incline o tronco para frente projetando o quadril para tras.',
      'Retorne ativando gluteo e posterior da coxa.',
    ],
    tips: ['Comece com carga leve para dominar o padrao', 'Coluna neutra e obrigatoria'],
    commonMistakes: ['Arredondar lombar', 'Dobrar demais os joelhos'],
    tags: ['posterior', 'hamstrings', 'barra', 'hip hinge', 'avancado'],
  }),

  // ─── PANTURRILHA — nova (BLOCO 3) ─────────────────────────────────────────
  createExercise({
    id: 'panturrilha_sentado',
    name: 'Panturrilha Sentado',
    primaryMuscle: MUSCLE_GROUPS.CALVES,
    secondaryMuscles: [],
    category: 'isolation',
    movementPattern: 'plantarflexion',
    equipment: 'maquina',
    objective: 'hipertrofia',
    difficulty: 'iniciante',
    instructions: [
      'Sente-se na maquina com as almofadas sobre os joelhos.',
      'Posicione apenas a ponta dos pes na plataforma.',
      'Eleve os calcanhares ao maximo e segure 1 segundo.',
      'Desca completamente para alongar o soleo.',
    ],
    tips: ['Movimento lento e controlado', 'Amplitude completa e essencial para o soleo'],
    commonMistakes: ['Amplitude parcial', 'Velocidade excessiva'],
    tags: ['panturrilha', 'soleo', 'maquina', 'sentado'],
  }),

  // ─── QUADRÍCEPS — nova (BLOCO 3) ──────────────────────────────────────────
  createExercise({
    id: 'hack_machine',
    name: 'Hack Machine',
    primaryMuscle: MUSCLE_GROUPS.LEGS,
    secondaryMuscles: [MUSCLE_GROUPS.GLUTES],
    category: 'compound',
    movementPattern: 'squat',
    equipment: 'maquina',
    objective: 'hipertrofia',
    difficulty: 'intermediario',
    instructions: [
      'Posicione os ombros sob os apoios e pes na plataforma.',
      'Destrave e desca com joelhos na linha dos pes.',
      'Amplitude segura sem tirar os calcanhares da plataforma.',
      'Suba empurrando a plataforma com toda a planta do pe.',
    ],
    tips: ['Pes posicionados mais alto foca mais no gluteo', 'Joelhos nao devem colapsar'],
    commonMistakes: ['Arredondar lombar', 'Joelhos colapsando para dentro'],
    tags: ['quadriceps', 'pernas', 'maquina', 'hack squat'],
  }),

  // ─── CARDIO — expansão solicitada ───────────────────────────────────────
  createExercise({
    id: 'simulador_escada',
    name: 'Simulador de Escada',
    primaryMuscle: MUSCLE_GROUPS.LEGS,
    secondaryMuscles: [MUSCLE_GROUPS.GLUTES, MUSCLE_GROUPS.CALVES],
    category: 'cardio',
    movementPattern: 'stair_climb',
    equipment: 'maquina',
    objective: 'condicionamento',
    difficulty: 'iniciante',
    instructions: [
      'Mantenha o tronco ereto e o abdomen ativo.',
      'Pise completo no degrau para estabilizar joelho e quadril.',
      'Sustente um ritmo continuo sem apoiar excessivamente nas barras.',
    ],
    tags: ['cardio', 'escada', 'condicionamento', 'quadriceps', 'gluteo'],
  }),
  createExercise({
    id: 'eliptico',
    name: 'Eliptico',
    primaryMuscle: MUSCLE_GROUPS.LEGS,
    secondaryMuscles: [MUSCLE_GROUPS.GLUTES, MUSCLE_GROUPS.CORE],
    category: 'cardio',
    movementPattern: 'elliptical_stride',
    equipment: 'maquina',
    objective: 'condicionamento',
    difficulty: 'iniciante',
    instructions: [
      'Mantenha o ritmo constante e a passada fluida.',
      'Distribua a forca entre pernas e bracos quando houver alavancas.',
      'Evite projetar o tronco para frente durante o esforco.',
    ],
    tags: ['cardio', 'eliptico', 'baixo impacto', 'condicionamento'],
  }),
  createExercise({
    id: 'esteira',
    name: 'Esteira',
    primaryMuscle: MUSCLE_GROUPS.LEGS,
    secondaryMuscles: [MUSCLE_GROUPS.CALVES, MUSCLE_GROUPS.CORE],
    category: 'cardio',
    movementPattern: 'run_walk',
    equipment: 'maquina',
    objective: 'condicionamento',
    difficulty: 'iniciante',
    instructions: [
      'Comece com aquecimento leve antes de elevar velocidade ou inclinacao.',
      'Mantenha cadencia estavel e aterrissagem controlada.',
      'Use os apoios apenas para seguranca, nao para descarregar o corpo.',
    ],
    tags: ['cardio', 'esteira', 'corrida', 'caminhada'],
  }),
  createExercise({
    id: 'bicicleta_ergometrica',
    name: 'Bicicleta Ergometrica',
    primaryMuscle: MUSCLE_GROUPS.LEGS,
    secondaryMuscles: [MUSCLE_GROUPS.CALVES, MUSCLE_GROUPS.CORE],
    category: 'cardio',
    movementPattern: 'cycling',
    equipment: 'maquina',
    objective: 'condicionamento',
    difficulty: 'iniciante',
    instructions: [
      'Ajuste a altura do banco para pedalar sem hiperestender o joelho.',
      'Empurre e puxe o pedal em ciclo continuo, mantendo o quadril estavel.',
      'Respire de forma ritmada e controle a resistencia.',
    ],
    tags: ['cardio', 'bicicleta', 'ergometrica', 'condicionamento'],
  }),
  createExercise({
    id: 'corda_naval',
    name: 'Corda Naval',
    primaryMuscle: MUSCLE_GROUPS.SHOULDERS,
    secondaryMuscles: [MUSCLE_GROUPS.CORE, MUSCLE_GROUPS.BACK, MUSCLE_GROUPS.LEGS],
    category: 'cardio',
    movementPattern: 'battle_rope',
    equipment: 'corda',
    objective: 'condicionamento',
    difficulty: 'intermediario',
    instructions: [
      'Flexione levemente joelhos e mantenha base firme.',
      'Gere ondas com os bracos sem perder estabilidade do tronco.',
      'Sustente intensidade alta por blocos curtos com respiracao ativa.',
    ],
    tags: ['cardio', 'corda naval', 'metabolico', 'ombro', 'core'],
  }),

  // ─── EXPANSÃO MASSIVA — PADRÃO ACADEMIA (BLOCO 1) ───────────────────────
  // PEITO (chest)
  createExercise({ name: 'Supino Reto Barra', primaryMuscle: MUSCLE_GROUPS.CHEST, secondaryMuscles: [MUSCLE_GROUPS.SHOULDERS, MUSCLE_GROUPS.TRICEPS], equipment: 'barra', category: 'compound', movementPattern: 'horizontal_push', tags: ['supino', 'peito', 'barra'] }),
  createExercise({ name: 'Supino Reto Halter', primaryMuscle: MUSCLE_GROUPS.CHEST, secondaryMuscles: [MUSCLE_GROUPS.SHOULDERS, MUSCLE_GROUPS.TRICEPS], equipment: 'halter', category: 'compound', movementPattern: 'horizontal_push', tags: ['supino', 'peito', 'halter'] }),
  createExercise({ name: 'Supino Inclinado Barra', primaryMuscle: MUSCLE_GROUPS.CHEST, secondaryMuscles: [MUSCLE_GROUPS.SHOULDERS, MUSCLE_GROUPS.TRICEPS], equipment: 'barra', category: 'compound', movementPattern: 'incline_press', tags: ['supino', 'inclinado', 'barra'] }),
  createExercise({ name: 'Crossover Polia Alta', primaryMuscle: MUSCLE_GROUPS.CHEST, secondaryMuscles: [MUSCLE_GROUPS.SHOULDERS], equipment: 'cabo', category: 'isolation', movementPattern: 'horizontal_adduction', tags: ['crossover', 'polia', 'peito'] }),
  createExercise({ name: 'Crossover Polia Baixa', primaryMuscle: MUSCLE_GROUPS.CHEST, secondaryMuscles: [MUSCLE_GROUPS.SHOULDERS], equipment: 'cabo', category: 'isolation', movementPattern: 'horizontal_adduction', tags: ['crossover', 'polia', 'peito'] }),
  createExercise({ name: 'Voador (Peck Deck)', primaryMuscle: MUSCLE_GROUPS.CHEST, secondaryMuscles: [MUSCLE_GROUPS.SHOULDERS], equipment: 'maquina', category: 'isolation', movementPattern: 'horizontal_adduction', tags: ['voador', 'peck deck', 'peito'] }),
  createExercise({ name: 'Crucifixo Reto Halter', primaryMuscle: MUSCLE_GROUPS.CHEST, secondaryMuscles: [MUSCLE_GROUPS.SHOULDERS], equipment: 'halter', category: 'isolation', movementPattern: 'horizontal_adduction', tags: ['crucifixo', 'halter', 'peito'] }),

  // COSTAS (back)
  createExercise({ name: 'Puxada Frontal', primaryMuscle: MUSCLE_GROUPS.BACK, secondaryMuscles: [MUSCLE_GROUPS.BICEPS], equipment: 'cabo', category: 'compound', movementPattern: 'vertical_pull', tags: ['puxada', 'costas'] }),
  createExercise({ name: 'Remada Curvada Barra', primaryMuscle: MUSCLE_GROUPS.BACK, secondaryMuscles: [MUSCLE_GROUPS.BICEPS], equipment: 'barra', category: 'compound', movementPattern: 'horizontal_pull', tags: ['remada', 'barra', 'costas'] }),
  createExercise({ name: 'Remada Baixa Polia', primaryMuscle: MUSCLE_GROUPS.BACK, secondaryMuscles: [MUSCLE_GROUPS.BICEPS], equipment: 'cabo', category: 'compound', movementPattern: 'horizontal_pull', tags: ['remada', 'polia', 'costas'] }),
  createExercise({ name: 'Remada Baixa Triangulo', primaryMuscle: MUSCLE_GROUPS.BACK, secondaryMuscles: [MUSCLE_GROUPS.BICEPS], equipment: 'cabo', category: 'compound', movementPattern: 'horizontal_pull', tags: ['remada', 'triangulo', 'costas'] }),
  createExercise({ name: 'Pulldown', primaryMuscle: MUSCLE_GROUPS.BACK, secondaryMuscles: [MUSCLE_GROUPS.BICEPS], equipment: 'cabo', category: 'isolation', movementPattern: 'shoulder_extension', tags: ['pulldown', 'costas'] }),
  createExercise({ name: 'Remada Unilateral (Serrote)', primaryMuscle: MUSCLE_GROUPS.BACK, secondaryMuscles: [MUSCLE_GROUPS.BICEPS], equipment: 'halter', category: 'compound', movementPattern: 'horizontal_pull', tags: ['remada', 'serrote', 'costas'] }),
  createExercise({ name: 'Barra Fixa', primaryMuscle: MUSCLE_GROUPS.BACK, secondaryMuscles: [MUSCLE_GROUPS.BICEPS, MUSCLE_GROUPS.CORE], equipment: 'peso_corporal', category: 'compound', movementPattern: 'vertical_pull', tags: ['barra fixa', 'costas'] }),

  // OMBROS (shoulders)
  createExercise({ name: 'Desenvolvimento Maquina', primaryMuscle: MUSCLE_GROUPS.SHOULDERS, secondaryMuscles: [MUSCLE_GROUPS.TRICEPS], equipment: 'maquina', category: 'compound', movementPattern: 'vertical_push', tags: ['ombro', 'desenvolvimento', 'maquina'] }),
  createExercise({ name: 'Elevacao Lateral Polia', primaryMuscle: MUSCLE_GROUPS.SHOULDERS, secondaryMuscles: [], equipment: 'cabo', category: 'isolation', movementPattern: 'lateral_raise', tags: ['ombro', 'elevacao lateral', 'polia'] }),
  createExercise({ name: 'Elevacao Frontal', primaryMuscle: MUSCLE_GROUPS.SHOULDERS, secondaryMuscles: [], equipment: 'halter', category: 'isolation', movementPattern: 'front_raise', tags: ['ombro', 'elevacao frontal'] }),
  createExercise({ name: 'Crucifixo Inverso Maquina', primaryMuscle: MUSCLE_GROUPS.SHOULDERS, secondaryMuscles: [MUSCLE_GROUPS.BACK], equipment: 'maquina', category: 'isolation', movementPattern: 'reverse_fly', tags: ['ombro', 'posterior', 'crucifixo inverso'] }),
  createExercise({ name: 'Crucifixo Inverso Polia', primaryMuscle: MUSCLE_GROUPS.SHOULDERS, secondaryMuscles: [MUSCLE_GROUPS.BACK], equipment: 'cabo', category: 'isolation', movementPattern: 'reverse_fly', tags: ['ombro', 'posterior', 'crucifixo inverso'] }),

  // PERNAS / QUADRÍCEPS (legs)
  createExercise({ name: 'Agachamento Bulgaro', primaryMuscle: MUSCLE_GROUPS.LEGS, secondaryMuscles: [MUSCLE_GROUPS.GLUTES, MUSCLE_GROUPS.CORE], equipment: 'halter', category: 'compound', movementPattern: 'split_squat', tags: ['pernas', 'quadriceps', 'bulgaro'] }),

  // POSTERIOR (hamstrings)
  createExercise({ name: 'Cadeira Abdutora', primaryMuscle: MUSCLE_GROUPS.HAMSTRINGS, secondaryMuscles: [MUSCLE_GROUPS.GLUTES], equipment: 'maquina', category: 'isolation', movementPattern: 'hip_abduction', tags: ['posterior', 'abdutora'] }),

  // GLÚTEOS (glutes)
  createExercise({ name: 'Elevacao de Pelvica', primaryMuscle: MUSCLE_GROUPS.GLUTES, secondaryMuscles: [MUSCLE_GROUPS.HAMSTRINGS, MUSCLE_GROUPS.CORE], equipment: 'barra', category: 'compound', movementPattern: 'hip_extension', tags: ['gluteo', 'hip thrust', 'elevacao pelvica'] }),
  createExercise({ name: 'Coice na Polia', primaryMuscle: MUSCLE_GROUPS.GLUTES, secondaryMuscles: [MUSCLE_GROUPS.HAMSTRINGS], equipment: 'cabo', category: 'isolation', movementPattern: 'hip_extension', tags: ['gluteo', 'coice', 'polia'] }),

  // BRAÇOS (biceps / triceps)
  createExercise({ name: 'Rosca Direta Barra W', primaryMuscle: MUSCLE_GROUPS.BICEPS, secondaryMuscles: [], equipment: 'barra', category: 'isolation', movementPattern: 'elbow_flexion', tags: ['biceps', 'rosca direta', 'barra w'] }),
  createExercise({ name: 'Rosca Martelo', primaryMuscle: MUSCLE_GROUPS.BICEPS, secondaryMuscles: [], equipment: 'halter', category: 'isolation', movementPattern: 'elbow_flexion', tags: ['biceps', 'rosca martelo'] }),
  createExercise({ name: 'Rosca Scott', primaryMuscle: MUSCLE_GROUPS.BICEPS, secondaryMuscles: [], equipment: 'barra', category: 'isolation', movementPattern: 'elbow_flexion', tags: ['biceps', 'rosca scott'] }),
  createExercise({ name: 'Triceps Polia Barra', primaryMuscle: MUSCLE_GROUPS.TRICEPS, secondaryMuscles: [], equipment: 'cabo', category: 'isolation', movementPattern: 'elbow_extension', tags: ['triceps', 'polia', 'barra'] }),
  createExercise({ name: 'Triceps Testa', primaryMuscle: MUSCLE_GROUPS.TRICEPS, secondaryMuscles: [], equipment: 'barra', category: 'isolation', movementPattern: 'elbow_extension', tags: ['triceps', 'testa'] }),
  createExercise({ name: 'Triceps Frances', primaryMuscle: MUSCLE_GROUPS.TRICEPS, secondaryMuscles: [], equipment: 'halter', category: 'isolation', movementPattern: 'elbow_extension', tags: ['triceps', 'frances'] }),

  // PANTURRILHA (calves)
  createExercise({ name: 'Panturrilha em Pe', primaryMuscle: MUSCLE_GROUPS.CALVES, secondaryMuscles: [], equipment: 'maquina', category: 'isolation', movementPattern: 'plantarflexion', tags: ['panturrilha', 'em pe'] }),
];

// ─────────────────────────────────────────────────────────────────────────────
// FILTROS PARA UI
// Os valores são os mesmos de MUSCLE_GROUPS — fonte única de verdade.
// ─────────────────────────────────────────────────────────────────────────────
export const EXERCISE_MUSCLE_FILTERS = Object.values(MUSCLE_GROUPS);

export const EXERCISE_EQUIPMENT_FILTERS = ['maquina', 'halter', 'barra', 'peso_corporal', 'cabo'];
export const EXERCISE_OBJECTIVE_FILTERS = ['hipertrofia', 'forca', 'definicao', 'reabilitacao'];

// ─────────────────────────────────────────────────────────────────────────────
// BUSCA POR ID / NOME
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// FILTRO MUSCULAR — usa SOMENTE primaryMuscle (regra global do sistema)
//
// Regra:
//   - Filtrar por muscle NUNCA usa secondaryMuscles
//   - 'legs' cobre apenas quadríceps (LEGS); para posterior usar 'hamstrings'
//   - Retrocompatibilidade: aliases em PT-BR são aceitos como entrada
// ─────────────────────────────────────────────────────────────────────────────
const MUSCLE_ALIAS_MAP = {
  // PT-BR → MUSCLE_GROUPS value
  peito:         MUSCLE_GROUPS.CHEST,
  peitoral:      MUSCLE_GROUPS.CHEST,
  costas:        MUSCLE_GROUPS.BACK,
  ombro:         MUSCLE_GROUPS.SHOULDERS,
  ombros:        MUSCLE_GROUPS.SHOULDERS,
  biceps:        MUSCLE_GROUPS.BICEPS,
  triceps:       MUSCLE_GROUPS.TRICEPS,
  pernas:        MUSCLE_GROUPS.LEGS,
  quadriceps:    MUSCLE_GROUPS.LEGS,
  posterior:     MUSCLE_GROUPS.HAMSTRINGS,
  posterior_coxa: MUSCLE_GROUPS.HAMSTRINGS,
  hamstrings:    MUSCLE_GROUPS.HAMSTRINGS,
  gluteo:        MUSCLE_GROUPS.GLUTES,
  gluteos:       MUSCLE_GROUPS.GLUTES,
  panturrilha:   MUSCLE_GROUPS.CALVES,
  calves:        MUSCLE_GROUPS.CALVES,
  abdomen:       MUSCLE_GROUPS.CORE,
  abs:           MUSCLE_GROUPS.CORE,
  core:          MUSCLE_GROUPS.CORE,
};

function resolveMuscleKey(muscle) {
  if (!muscle || muscle === 'all') return null;
  const safe = slugify(muscle);
  // Se já é um valor canônico do enum, retorna direto
  if (VALID_MUSCLE_SET.has(safe)) return safe;
  // Tenta alias PT-BR
  return MUSCLE_ALIAS_MAP[safe] || safe;
}

function matchesMuscle(exercise, muscle) {
  if (!muscle || muscle === 'all') return true;
  const canonical = resolveMuscleKey(muscle);
  // Filtra SOMENTE por primaryMuscle — secundários nunca definem categoria
  return exercise.primaryMuscle === canonical;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSCA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export function searchExercises({ query = '', muscle = 'all', equipment = 'all', objective = 'all' } = {}) {
  const q             = slugify(query);
  const equipmentKey  = slugify(equipment);
  const objectiveKey  = slugify(objective);

  const baseResult = EXERCISES.filter((exercise) => {
    const textBlob = [
      exercise.name,
      exercise.primaryMuscle,
      ...(exercise.secondaryMuscles || []),
      ...(exercise.tags || []),
    ]
      .map(slugify)
      .join(' ');

    const queryOk     = !q || textBlob.includes(q);
    const muscleOk    = matchesMuscle(exercise, muscle);
    const equipmentOk = equipmentKey === 'all' || slugify(exercise.equipment) === equipmentKey;
    const objectiveOk = objectiveKey === 'all' || slugify(exercise.objective) === objectiveKey;

    return queryOk && muscleOk && equipmentOk && objectiveOk;
  });

  let result = baseResult;

  // Fallback 1: ignora filtro de equipamento se sem resultados
  if (!result.length && equipmentKey !== 'all') {
    result = EXERCISES.filter((exercise) => {
      const textBlob = [exercise.name, exercise.primaryMuscle, ...(exercise.tags || [])]
        .map(slugify)
        .join(' ');
      const queryOk     = !q || textBlob.includes(q);
      const muscleOk    = matchesMuscle(exercise, muscle);
      const objectiveOk = objectiveKey === 'all' || slugify(exercise.objective) === objectiveKey;
      return queryOk && muscleOk && objectiveOk;
    });
  }

  // Fallback 2: só pelo músculo
  if (!result.length && muscle && muscle !== 'all') {
    result = EXERCISES.filter((exercise) => matchesMuscle(exercise, muscle));
  }

  // Fallback 3: retorna tudo
  if (!result.length) {
    result = EXERCISES;
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function getExerciseFilters() {
  return {
    muscles:    EXERCISE_MUSCLE_FILTERS,
    equipments: EXERCISE_EQUIPMENT_FILTERS,
    objectives: EXERCISE_OBJECTIVE_FILTERS,
  };
}
