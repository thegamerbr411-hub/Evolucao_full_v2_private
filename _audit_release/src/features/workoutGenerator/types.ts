import type { Exercise } from '../../data/exercises';

export type UserLevel = 'iniciante' | 'intermediario' | 'avancado';

export type WorkoutGeneratorInput = {
  muscleGroups: Array<'peito' | 'costas' | 'pernas' | 'ombro' | 'bracos'>;
  availableCategories: Array<'machine' | 'free' | 'cable'>;
  level: UserLevel;
  sessionMinutes?: number;
};

export type WorkoutGeneratorExercise = {
  exercise: Exercise;
  sets: number;
  reps: string;
  restSeconds: number;
};

export type WorkoutGeneratorResult = {
  exercises: WorkoutGeneratorExercise[];
  metadata: {
    generatedAt: string;
    level: UserLevel;
    muscleGroups: string[];
  };
};
