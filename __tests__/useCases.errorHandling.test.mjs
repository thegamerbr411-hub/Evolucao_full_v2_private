import test from 'node:test';
import assert from 'node:assert/strict';
import { getMacroTargetsUseCase } from '../src/domains/nutrition/useCases/getMacroTargets.js';
import { getTodayWorkoutUseCase } from '../src/domains/workout/useCases/getTodayWorkout.js';

test('getMacroTargetsUseCase retorna erro estruturado quando entrada invalida', () => {
  const result = getMacroTargetsUseCase({ weight: 0, calories: 0, goal: 'emagrecer' });
  assert.equal(result.error, 'WEIGHT_REQUIRED');
});

test('getTodayWorkoutUseCase retorna UNKNOWN_ERROR em falha inesperada', () => {
  const result = getTodayWorkoutUseCase({
    trainingSplit: 'Full body 3x semana',
    exerciseTargets: {},
    profile: {},
    workoutLogs: [],
    library: {
      fullBody: [{ name: 'Supino', sets: 4, reps: '6-10' }],
      upper: [{ name: 'Supino', sets: 4, reps: '6-10' }],
      lower: [{ name: 'Agachamento', sets: 4, reps: '6-10' }],
      push: [{ name: 'Supino', sets: 4, reps: '6-10' }],
      pull: [{ name: 'Remada', sets: 4, reps: '8-12' }],
      legs: [{ name: 'Agachamento', sets: 4, reps: '6-10' }],
    },
    applyPainAdaptiveWorkout: () => {
      throw new Error('boom');
    },
    getExerciseCatalogFromSources: () => [],
  });

  assert.equal(result.error, 'UNKNOWN_ERROR');
});
