import { exercises } from '../../data/exercises';
import type {
  WorkoutGeneratorInput,
  WorkoutGeneratorResult,
  WorkoutGeneratorExercise,
} from './types';

function estimatePrescription(level: WorkoutGeneratorInput['level']): Pick<WorkoutGeneratorExercise, 'sets' | 'reps' | 'restSeconds'> {
  if (level === 'avancado') {
    return { sets: 4, reps: '6-10', restSeconds: 90 };
  }
  if (level === 'intermediario') {
    return { sets: 3, reps: '8-12', restSeconds: 75 };
  }
  return { sets: 3, reps: '10-15', restSeconds: 60 };
}

// Base preparatoria: retorna estrutura valida sem algoritmo inteligente definitivo.
export function createWorkoutDraft(input: WorkoutGeneratorInput): WorkoutGeneratorResult {
  const prescription = estimatePrescription(input.level);
  const selected = input.muscleGroups
    .flatMap((group) => exercises[group] || [])
    .filter((item) => input.availableCategories.includes(item.category))
    .slice(0, 6)
    .map((exercise) => ({
      exercise,
      ...prescription,
    }));

  return {
    exercises: selected,
    metadata: {
      generatedAt: new Date().toISOString(),
      level: input.level,
      muscleGroups: input.muscleGroups,
    },
  };
}
