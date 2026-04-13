import test from 'node:test';
import assert from 'node:assert/strict';
import { getTodayWorkoutUseCase } from '../src/domains/workout/useCases/getTodayWorkout.js';

test('getTodayWorkoutUseCase integra useCase + service e retorna treino adaptado', () => {
  const library = {
    fullBody: [{ name: 'Supino', sets: 4, reps: '6-10' }],
    upper: [{ name: 'Supino', sets: 4, reps: '6-10' }],
    lower: [{ name: 'Agachamento', sets: 4, reps: '6-10' }],
    push: [{ name: 'Supino', sets: 4, reps: '6-10' }],
    pull: [{ name: 'Remada', sets: 4, reps: '8-12' }],
    legs: [{ name: 'Agachamento', sets: 4, reps: '6-10' }],
  };

  const result = getTodayWorkoutUseCase({
    trainingSplit: 'Full body 3x semana',
    exerciseTargets: { Supino: { targetWeight: 80 } },
    profile: { pain: 'ombro' },
    workoutLogs: [{ exerciseName: 'Supino' }],
    library,
    applyPainAdaptiveWorkout: (base) => ({
      exercises: base,
      replacements: [{ from: 'Supino', to: 'Supino maquina' }],
    }),
    getExerciseCatalogFromSources: () => ['Supino'],
    date: new Date('2026-04-06T12:00:00'),
  });

  assert.equal(result.exercises.length, 1);
  assert.equal(result.exercises[0].targetWeight, 80);
  assert.equal(result.replacements[0].to, 'Supino maquina');
});
