import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWorkoutSetRowState } from '../src/services/workoutSetRowState.js';

test('1: empty set -> pending', () => {
  const rowState = buildWorkoutSetRowState();
  assert.equal(rowState.status, 'pending');
  assert.equal(rowState.label, 'Pendente');
  assert.equal(rowState.canSave, false);
});

test('2: future set -> pending and cannot save', () => {
  const rowState = buildWorkoutSetRowState({
    weight: '80',
    reps: '10',
    isFuture: true,
    isActiveSet: false,
  });
  assert.equal(rowState.status, 'pending');
  assert.equal(rowState.canSave, false);
  assert.equal(rowState.showAction, false);
});

test('3: valid active set -> ready with save action', () => {
  const rowState = buildWorkoutSetRowState({
    weight: '80',
    reps: '10',
    rpe: '8',
    isActiveSet: true,
  });
  assert.equal(rowState.status, 'ready');
  assert.equal(rowState.label, 'Pronta');
  assert.equal(rowState.canSave, true);
  assert.equal(rowState.actionLabel, 'Salvar serie');
  assert.equal(rowState.showAction, true);
});

test('4: invalid weight -> invalid', () => {
  const rowState = buildWorkoutSetRowState({
    weight: '999',
    reps: '10',
    isActiveSet: true,
  });
  assert.equal(rowState.status, 'invalid');
  assert.equal(rowState.canSave, false);
  assert.equal(rowState.helperText, 'Confira carga e reps');
});

test('5: invalid reps -> invalid', () => {
  const rowState = buildWorkoutSetRowState({
    weight: '80',
    reps: '0',
    isActiveSet: true,
  });
  assert.equal(rowState.status, 'invalid');
  assert.equal(rowState.canSave, false);
});

test('6: saved set -> saved and cannot save again', () => {
  const rowState = buildWorkoutSetRowState({
    weight: '80',
    reps: '10',
    isSaved: true,
    isActiveSet: true,
  });
  assert.equal(rowState.status, 'saved');
  assert.equal(rowState.label, 'Salva');
  assert.equal(rowState.canSave, false);
});

test('7: saved and pending labels differ', () => {
  const saved = buildWorkoutSetRowState({ isSaved: true });
  const pending = buildWorkoutSetRowState();
  assert.notEqual(saved.label, pending.label);
});

test('8: labels are clear and do not use check or concluida copy', () => {
  const ready = buildWorkoutSetRowState({
    weight: '80',
    reps: '10',
    isActiveSet: true,
  });
  const saved = buildWorkoutSetRowState({ isSaved: true });

  assert.match(ready.actionLabel, /Salvar serie/i);
  assert.doesNotMatch(ready.label, /conclu/i);
  assert.doesNotMatch(saved.label, /conclu/i);
  assert.doesNotMatch(ready.actionLabel, /✔/);
});

test('9: row state exposes only visual fields', () => {
  const rowState = buildWorkoutSetRowState({
    weight: '80',
    reps: '10',
    isActiveSet: true,
  });
  const keys = Object.keys(rowState).sort();
  assert.deepEqual(keys, [
    'accessibilityLabel',
    'actionLabel',
    'canSave',
    'helperText',
    'label',
    'showAction',
    'status',
  ]);
});

test('10: unknown input falls back to safe pending', () => {
  const rowState = buildWorkoutSetRowState(undefined);
  assert.equal(rowState.status, 'pending');
  assert.equal(rowState.canSave, false);
  assert.equal(rowState.showAction, false);
});
