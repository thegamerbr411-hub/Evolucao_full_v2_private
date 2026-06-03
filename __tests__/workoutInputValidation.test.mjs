import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getWorkoutSetValidationToast,
  validateWorkoutSetInput,
  WORKOUT_SET_LIMITS,
} from '../src/services/workoutInputValidation.js';

test('valid set: weight 40 reps 10', () => {
  const result = validateWorkoutSetInput({ weight: 40, reps: 10, rpe: 8 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.sanitized, { weight: 40, reps: 10, rpe: 8 });
  assert.equal(result.errors.length, 0);
});

test('valid set: bodyweight 0 kg reps 10', () => {
  const result = validateWorkoutSetInput({ weight: 0, reps: 10 });
  assert.equal(result.ok, true);
  assert.equal(result.sanitized.weight, 0);
  assert.equal(result.sanitized.reps, 10);
});

test('invalid weight: -1', () => {
  const result = validateWorkoutSetInput({ weight: -1, reps: 10 });
  assert.equal(result.ok, false);
  assert.equal(result.sanitized, null);
  assert.ok(result.errors.some((item) => item.field === 'weight'));
});

test('invalid weight: 2060', () => {
  const result = validateWorkoutSetInput({ weight: 2060, reps: 10 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.field === 'weight'));
});

test('invalid reps: 0', () => {
  const result = validateWorkoutSetInput({ weight: 40, reps: 0 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.field === 'reps'));
});

test('invalid reps: 1010', () => {
  const result = validateWorkoutSetInput({ weight: 40, reps: 1010 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.field === 'reps'));
});

test('invalid reps: text or NaN', () => {
  const textResult = validateWorkoutSetInput({ weight: 40, reps: 'abc' });
  assert.equal(textResult.ok, false);
  const nanResult = validateWorkoutSetInput({ weight: 40, reps: NaN });
  assert.equal(nanResult.ok, false);
});

test('invalid rpe: 11', () => {
  const result = validateWorkoutSetInput({ weight: 40, reps: 10, rpe: 11 });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((item) => item.field === 'rpe'));
});

test('invalid payload must not produce saveable sanitized values', () => {
  const result = validateWorkoutSetInput({ weight: 2060, reps: 1010, rpe: 11 });
  assert.equal(result.ok, false);
  assert.equal(result.sanitized, null);
  assert.ok(result.errors.length >= 2);
  assert.match(getWorkoutSetValidationToast(result.errors), /invalida|invalido/i);
});

test('WORKOUT_SET_LIMITS are conservative defaults', () => {
  assert.equal(WORKOUT_SET_LIMITS.weightMax, 300);
  assert.equal(WORKOUT_SET_LIMITS.repsMax, 100);
  assert.equal(WORKOUT_SET_LIMITS.rpeMax, 10);
});
