import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTodayWorkout,
  getWorkoutBySplitForDate,
  getWorkoutDayIndex,
} from '../src/domains/workout/workoutService.js';

test('getWorkoutDayIndex converte domingo para indice 6', () => {
  const sunday = new Date('2026-04-05T12:00:00');
  assert.equal(getWorkoutDayIndex(sunday), 6);
});

test('getWorkoutBySplitForDate escolhe upper/lower pela paridade do dia', () => {
  const library = {
    fullBody: [{ name: 'FB' }],
    upper: [{ name: 'UP' }],
    lower: [{ name: 'LOW' }],
    push: [{ name: 'PUSH' }],
    pull: [{ name: 'PULL' }],
    legs: [{ name: 'LEGS' }],
  };

  const monday = new Date('2026-04-06T12:00:00');
  const tuesday = new Date('2026-04-07T12:00:00');

  assert.equal(getWorkoutBySplitForDate('Superior/Inferior 4x semana', library, monday)[0].name, 'UP');
  assert.equal(getWorkoutBySplitForDate('Superior/Inferior 4x semana', library, tuesday)[0].name, 'LOW');
});

test('buildTodayWorkout aplica alvo de carga e passa por adaptacao de dor', () => {
  const library = {
    fullBody: [{ name: 'Supino', sets: 4, reps: '6-10' }],
    upper: [{ name: 'Supino', sets: 4, reps: '6-10' }],
    lower: [{ name: 'Agachamento', sets: 4, reps: '6-10' }],
    push: [{ name: 'Supino', sets: 4, reps: '6-10' }],
    pull: [{ name: 'Remada', sets: 4, reps: '8-12' }],
    legs: [{ name: 'Agachamento', sets: 4, reps: '6-10' }],
  };

  const result = buildTodayWorkout({
    trainingSplit: 'Full body 3x semana',
    exerciseTargets: { Supino: { targetWeight: 72.5 } },
    profile: { pain: 'ombro' },
    workoutLogs: [{ exerciseName: 'Supino' }],
    library,
    applyPainAdaptiveWorkout: (base) => ({
      exercises: base,
      replacements: [{ from: 'Supino', to: 'Maquina peitoral' }],
    }),
    getExerciseCatalogFromSources: () => ['Supino'],
    date: new Date('2026-04-06T12:00:00'),
  });

  assert.equal(result.exercises.length, 1);
  assert.equal(result.exercises[0].targetWeight, 72.5);
  assert.equal(result.replacements.length, 1);
});
