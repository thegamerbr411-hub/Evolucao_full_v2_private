import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkoutSessionStatsCopy,
  formatSessionDuration,
} from '../src/services/workoutSessionStatsCopy.js';

test('formatSessionDuration handles zero and invalid ms', () => {
  assert.equal(formatSessionDuration(0), '0 min');
  assert.equal(formatSessionDuration(-100), '0 min');
  assert.equal(formatSessionDuration('bad'), '0 min');
});

test('formatSessionDuration shows seconds under one minute', () => {
  assert.equal(formatSessionDuration(45000), '45s');
});

test('formatSessionDuration shows minutes', () => {
  assert.equal(formatSessionDuration(5 * 60 * 1000), '5 min');
});

test('buildWorkoutSessionStatsCopy with planned sets', () => {
  const copy = buildWorkoutSessionStatsCopy({
    startedAtMs: 1000,
    nowMs: 61000,
    completedSets: 3,
    plannedSets: 12,
    exerciseIndex: 1,
    totalExercises: 5,
  });

  assert.equal(copy.durationLabel, '1 min');
  assert.equal(copy.setsLabel, '3/12');
  assert.equal(copy.exerciseLabel, '2/5');
});

test('buildWorkoutSessionStatsCopy without planned sets', () => {
  const copy = buildWorkoutSessionStatsCopy({
    startedAtMs: 0,
    nowMs: 0,
    completedSets: 2,
    plannedSets: 0,
    exerciseIndex: 0,
    totalExercises: 0,
  });

  assert.equal(copy.setsLabel, '2');
  assert.equal(copy.exerciseLabel, '—');
});
