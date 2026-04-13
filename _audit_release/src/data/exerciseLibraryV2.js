const GIF_FALLBACK = 'https://placehold.co/320x180/0f172a/dbeafe?text=Exercise';

const MUSCLE_PATTERNS = {
  peito: ['Supino Reto', 'Supino Inclinado', 'Crucifixo', 'Peck Deck', 'Flexao'],
  costas: ['Puxada Frontal', 'Remada Curvada', 'Remada Baixa', 'Pulldown', 'Face Pull'],
  perna: ['Agachamento', 'Leg Press', 'Stiff', 'Cadeira Extensora', 'Cadeira Flexora', 'Afundo'],
  ombro: ['Desenvolvimento', 'Elevacao Lateral', 'Elevacao Frontal', 'Remada Alta'],
  biceps: ['Rosca Direta', 'Rosca Martelo', 'Rosca Scott', 'Rosca Concentrada'],
  triceps: ['Triceps Corda', 'Triceps Testa', 'Mergulho', 'Supino Fechado'],
  core: ['Prancha', 'Abdominal Crunch', 'Abdominal Infra', 'Russian Twist'],
};

const EQUIPMENTS = ['Barra', 'Halter', 'Maquina', 'Polia'];

function buildExercise(name, muscle, equipment, index) {
  return {
    name: `${name} ${equipment}`.trim(),
    muscle,
    equipment,
    gif: `${GIF_FALLBACK}&id=${muscle}-${index}`,
  };
}

const generated = [];
Object.entries(MUSCLE_PATTERNS).forEach(([muscle, names]) => {
  names.forEach((name) => {
    EQUIPMENTS.forEach((equipment, index) => {
      generated.push(buildExercise(name, muscle, equipment, index));
    });
  });
});

const SPECIAL_EXERCISES = [
  { name: 'Leg Press 45', muscle: 'perna', equipment: 'Maquina', gif: `${GIF_FALLBACK}&id=leg-press-45` },
  { name: 'Agachamento Livre', muscle: 'perna', equipment: 'Barra', gif: `${GIF_FALLBACK}&id=agachamento-livre` },
  { name: 'Supino Reto Barra', muscle: 'peito', equipment: 'Barra', gif: `${GIF_FALLBACK}&id=supino-reto` },
  { name: 'Remada Curvada Barra', muscle: 'costas', equipment: 'Barra', gif: `${GIF_FALLBACK}&id=remada-curvada` },
  { name: 'Levantamento Terra', muscle: 'perna', equipment: 'Barra', gif: `${GIF_FALLBACK}&id=terra` },
  { name: 'Panturrilha Em Pe', muscle: 'perna', equipment: 'Maquina', gif: `${GIF_FALLBACK}&id=panturrilha` },
  { name: 'Puxada Frontal Polia', muscle: 'costas', equipment: 'Polia', gif: `${GIF_FALLBACK}&id=puxada-frontal` },
  { name: 'Triceps Corda Polia', muscle: 'triceps', equipment: 'Polia', gif: `${GIF_FALLBACK}&id=triceps-corda` },
  { name: 'Rosca Direta Barra', muscle: 'biceps', equipment: 'Barra', gif: `${GIF_FALLBACK}&id=rosca-direta` },
  { name: 'Desenvolvimento Militar', muscle: 'ombro', equipment: 'Barra', gif: `${GIF_FALLBACK}&id=desenvolvimento` },
];

const map = new Map();
[...SPECIAL_EXERCISES, ...generated].forEach((entry) => {
  const key = String(entry.name || '').toLowerCase().trim();
  if (!key) {
    return;
  }
  if (!map.has(key)) {
    map.set(key, entry);
  }
});

export const EXERCISE_LIBRARY_V2 = Array.from(map.values());
export const EXERCISE_NAMES_V2 = EXERCISE_LIBRARY_V2.map((item) => item.name);
export const EXERCISE_LIBRARY_SIMPLE = EXERCISE_LIBRARY_V2.map((item) => ({
  name: item.name,
  muscle: item.muscle,
}));

export function getExerciseMetaByName(name = '') {
  const key = String(name || '').toLowerCase().trim();
  return map.get(key) || null;
}

export function getExerciseGifFallback() {
  return GIF_FALLBACK;
}
