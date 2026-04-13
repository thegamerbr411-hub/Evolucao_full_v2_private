function normalize(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export const parseWorkoutText = (text) => {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const exercises = [];

  lines.forEach((line) => {
    const lower = normalize(line);

    if (lower.includes('supino')) {
      exercises.push({
        name: 'Supino',
        sets: [{ reps: '10', weight: '40', done: false }],
      });
    }

    if (lower.includes('leg')) {
      exercises.push({
        name: 'Leg Press',
        sets: [{ reps: '12', weight: '100', done: false }],
      });
    }

    if (lower.includes('agach')) {
      exercises.push({
        name: 'Agachamento Livre',
        sets: [{ reps: '10', weight: '60', done: false }],
      });
    }
  });

  return {
    name: 'Treino importado',
    exercises,
  };
};
