import { create } from 'zustand';
import { getLocal, setLocal } from '../storage/mmkv';

const WORKOUT_STORE_KEY = 'workout.store.v1';

export type WorkoutLog = {
  id: string;
  date: string;
  createdAt: string;
  sessionId?: string;
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
  currentExercise: any | null;
  currentSet: number;
  isResting: boolean;
  workoutSessionId: string | null;

  setWorkout: (workout: WorkoutData) => void;
  setWorkoutSessionId: (id: string | null) => void;
  addExercise: (exercise: any) => void;
  updateSet: (exerciseIndex: number, setIndex: number, field: string, value: any) => void;
  addWorkoutLog: (log: WorkoutLog) => void;
  removeWorkoutLog: (id: string) => void;
  setWorkoutLogs: (logs: WorkoutLog[]) => void;
  setExerciseTargets: (targets: Record<string, ExerciseTarget>) => void;
  updateExerciseTarget: (exerciseName: string, target: ExerciseTarget) => void;
  setCurrentExerciseState: (exercise: any | null, currentSet?: number) => void;
  advanceCurrentSet: (exercise: any | null, completedSetIndex: number) => void;
  setRestingState: (isResting: boolean) => void;
};

const persistWorkoutState = (state: Pick<WorkoutStore, 'workoutLogs' | 'exerciseTargets'>) => {
  setLocal(WORKOUT_STORE_KEY, {
    workoutLogs: state.workoutLogs,
    exerciseTargets: state.exerciseTargets,
  });
};

const initialPersistedState = getLocal(WORKOUT_STORE_KEY) || {};

export const useWorkoutStore = create<WorkoutStore>((set) => ({
  workout: { exercises: [] },
  workoutLogs: Array.isArray(initialPersistedState.workoutLogs) ? initialPersistedState.workoutLogs : [],
  exerciseTargets: initialPersistedState.exerciseTargets && typeof initialPersistedState.exerciseTargets === 'object'
    ? initialPersistedState.exerciseTargets
    : {},
  currentExercise: null,
  currentSet: 1,
  isResting: false,
  workoutSessionId: null,

  setWorkout: (workout) => set({ workout }),
  setWorkoutSessionId: (id) => set({ workoutSessionId: id }),
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
    set((state) => {
      const next = { ...state, workoutLogs: [log, ...state.workoutLogs] };
      persistWorkoutState(next);
      return next;
    }),
  removeWorkoutLog: (id) =>
    set((state) => {
      const next = { ...state, workoutLogs: state.workoutLogs.filter((l) => l.id !== id) };
      persistWorkoutState(next);
      return next;
    }),
  setWorkoutLogs: (logs) =>
    set((state) => {
      const next = { ...state, workoutLogs: logs };
      persistWorkoutState(next);
      return next;
    }),
  setExerciseTargets: (targets) =>
    set((state) => {
      const next = { ...state, exerciseTargets: targets };
      persistWorkoutState(next);
      return next;
    }),
  updateExerciseTarget: (exerciseName, target) =>
    set((state) => {
      const next = {
        ...state,
        exerciseTargets: { ...state.exerciseTargets, [exerciseName]: target },
      };
      persistWorkoutState(next);
      return next;
    }),
  setCurrentExerciseState: (exercise, currentSet = 1) =>
    set(() => ({
      currentExercise: exercise || null,
      currentSet: Math.max(1, Number(currentSet || 1)),
    })),
  advanceCurrentSet: (exercise, completedSetIndex) =>
    set((state) => {
      const safeExercise = exercise || state.currentExercise || null;
      const plannedSets = Math.max(1, Number(safeExercise?.sets || 1));
      const nextSet = Math.max(1, Number(completedSetIndex || 0) + 2);
      return {
        currentExercise: safeExercise,
        currentSet: Math.min(nextSet, plannedSets),
      };
    }),
  setRestingState: (isResting) =>
    set(() => ({ isResting: Boolean(isResting) })),
}));
