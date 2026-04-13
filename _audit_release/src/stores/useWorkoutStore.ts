import { create } from 'zustand';

export type WorkoutLog = {
  id: string;
  date: string;
  createdAt: string;
  exerciseId?: string;
  exerciseName: string;
  weight: number;
  reps: number;
  rpe?: number;
  failed: boolean;
  mode: 'guided' | 'free';
};

export type ExerciseTarget = {
  targetWeight?: number;
  lastAutoAppliedDate?: string;
  lastSuggestionLevel?: string;
};

export type WorkoutData = {
  exercises: any[];
};

type WorkoutStore = {
  workout: WorkoutData;
  workoutLogs: WorkoutLog[];
  exerciseTargets: Record<string, ExerciseTarget>;

  setWorkout: (workout: WorkoutData) => void;
  addExercise: (exercise: any) => void;
  updateSet: (exerciseIndex: number, setIndex: number, field: string, value: any) => void;
  addWorkoutLog: (log: WorkoutLog) => void;
  removeWorkoutLog: (id: string) => void;
  setWorkoutLogs: (logs: WorkoutLog[]) => void;
  setExerciseTargets: (targets: Record<string, ExerciseTarget>) => void;
  updateExerciseTarget: (exerciseName: string, target: ExerciseTarget) => void;
};

export const useWorkoutStore = create<WorkoutStore>((set) => ({
  workout: { exercises: [] },
  workoutLogs: [],
  exerciseTargets: {},

  setWorkout: (workout) => set({ workout }),
  addExercise: (exercise) =>
    set((state) => ({
      workout: {
        ...state.workout,
        exercises: [
          ...(Array.isArray(state.workout?.exercises) ? state.workout.exercises : []),
          { ...exercise, sets: [{ reps: '', weight: '', done: false }] },
        ],
      },
    })),
  updateSet: (exerciseIndex, setIndex, field, value) =>
    set((state) => {
      const safeExercises = Array.isArray(state.workout?.exercises) ? state.workout.exercises : [];
      const updated = [...safeExercises];
      if (!updated[exerciseIndex] || !Array.isArray(updated[exerciseIndex].sets) || !updated[exerciseIndex].sets[setIndex]) {
        return state;
      }

      updated[exerciseIndex] = {
        ...updated[exerciseIndex],
        sets: updated[exerciseIndex].sets.map((setItem, idx) =>
          idx === setIndex ? { ...setItem, [field]: value } : setItem
        ),
      };

      return { workout: { ...state.workout, exercises: updated } };
    }),
  addWorkoutLog: (log) =>
    set((state) => ({
      workoutLogs: [log, ...state.workoutLogs],
    })),
  removeWorkoutLog: (id) =>
    set((state) => ({
      workoutLogs: state.workoutLogs.filter((log) => log.id !== id),
    })),
  setWorkoutLogs: (logs) => set({ workoutLogs: logs }),
  setExerciseTargets: (targets) => set({ exerciseTargets: targets }),
  updateExerciseTarget: (exerciseName, target) =>
    set((state) => ({
      exerciseTargets: {
        ...state.exerciseTargets,
        [exerciseName]: target,
      },
    })),
}));
