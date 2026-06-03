import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkoutProgressCopy,
  computeWorkoutCompletionPercent,
  normalizeProgressCounts,
} from '../src/services/workoutProgressCopy.js';

test('1: 0/17 is not complete and shows 0%', () => {
  const copy = buildWorkoutProgressCopy({
    completedSets: 0,
    plannedSets: 17,
    currentExerciseIndex: 0,
    totalExercises: 5,
  });

  assert.equal(copy.completionPercent, 0);
  assert.equal(copy.isComplete, false);
  assert.match(copy.workoutProgressLabel, /0\/17/);
  assert.match(copy.workoutProgressLabel, /0%/);
});

test('2: 1/17 is partial at 6%', () => {
  const copy = buildWorkoutProgressCopy({
    completedSets: 1,
    plannedSets: 17,
    currentExerciseIndex: 0,
    totalExercises: 5,
  });

  assert.equal(copy.completionPercent, 6);
  assert.equal(copy.isComplete, false);
});

test('3: 17/17 is complete at 100%', () => {
  const copy = buildWorkoutProgressCopy({
    completedSets: 17,
    plannedSets: 17,
    currentExerciseIndex: 4,
    totalExercises: 5,
    canFinish: true,
  });

  assert.equal(copy.completionPercent, 100);
  assert.equal(copy.isComplete, true);
  assert.match(copy.workoutProgressLabel, /17\/17/);
});

test('4: plannedSets 0 does not return fake 100%', () => {
  const copy = buildWorkoutProgressCopy({
    completedSets: 0,
    plannedSets: 0,
    currentExerciseIndex: 0,
    totalExercises: 5,
  });

  assert.equal(copy.completionPercent, 0);
  assert.equal(copy.isComplete, false);
  assert.match(copy.workoutProgressLabel, /0\/0/);
  assert.match(copy.workoutProgressLabel, /0%/);
});

test('5: header shows Exercicio 1 de 5', () => {
  const copy = buildWorkoutProgressCopy({
    completedSets: 1,
    plannedSets: 17,
    currentExerciseIndex: 0,
    totalExercises: 5,
  });

  assert.equal(copy.headerLabel, 'Exercicio 1 de 5');
});

test('6: incomplete footer guides user to continue', () => {
  const copy = buildWorkoutProgressCopy({
    completedSets: 1,
    plannedSets: 17,
    canFinish: false,
  });

  assert.match(copy.footerHint, /Continue para completar o treino/);
  assert.equal(copy.isComplete, false);
});

test('7: complete footer allows finish context', () => {
  const copy = buildWorkoutProgressCopy({
    completedSets: 17,
    plannedSets: 17,
    canFinish: true,
  });

  assert.equal(copy.footerHint, 'Todas as series planejadas foram concluidas.');
  assert.equal(copy.isComplete, true);
});

test('8: footerHint does not duplicate workoutProgressLabel', () => {
  const copy = buildWorkoutProgressCopy({
    completedSets: 1,
    plannedSets: 17,
    currentExerciseIndex: 0,
    totalExercises: 5,
  });

  assert.notEqual(copy.footerHint, copy.workoutProgressLabel);
  assert.ok(!copy.footerHint.includes(copy.workoutProgressLabel));
  assert.ok(!copy.workoutProgressLabel.includes(copy.footerHint));
});

test('9: negative values normalize to zero', () => {
  const normalized = normalizeProgressCounts(-3, -5);
  assert.equal(normalized.completed, 0);
  assert.equal(normalized.planned, 0);
  assert.equal(computeWorkoutCompletionPercent(-3, -5), 0);
});

test('10: completedSets greater than plannedSets caps at 100%', () => {
  const copy = buildWorkoutProgressCopy({
    completedSets: 20,
    plannedSets: 17,
    canFinish: true,
  });

  assert.equal(copy.completionPercent, 100);
  assert.equal(copy.completedSets, 17);
  assert.equal(copy.plannedSets, 17);
});
