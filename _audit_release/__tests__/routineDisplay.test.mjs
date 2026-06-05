import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canStartRoutine,
  clampRoutineFrequency,
  formatRoutineWeeklyFrequency,
  getRoutineStartBlockReason,
} from '../src/services/routineDisplay.js';

test('formatRoutineWeeklyFrequency uses explicit frequency', () => {
  assert.equal(formatRoutineWeeklyFrequency(3), '3x por semana');
  assert.equal(formatRoutineWeeklyFrequency(1), '1x por semana');
});

test('formatRoutineWeeklyFrequency never shows bare x por semana', () => {
  assert.notEqual(formatRoutineWeeklyFrequency(undefined), 'x por semana');
  assert.notEqual(formatRoutineWeeklyFrequency(null), 'x por semana');
  assert.notEqual(formatRoutineWeeklyFrequency(0), 'x por semana');
  assert.notEqual(formatRoutineWeeklyFrequency(undefined, undefined), 'x por semana');
});

test('formatRoutineWeeklyFrequency falls back to profile days', () => {
  assert.equal(formatRoutineWeeklyFrequency(undefined, 4), '4x por semana');
});

test('formatRoutineWeeklyFrequency without value shows undefined label', () => {
  assert.equal(formatRoutineWeeklyFrequency(undefined, undefined), 'Frequencia nao definida');
});

test('clampRoutineFrequency bounds', () => {
  assert.equal(clampRoutineFrequency(0, 3), 3);
  assert.equal(clampRoutineFrequency(12), 7);
  assert.equal(clampRoutineFrequency(-2, 2), 2);
});

test('canStartRoutine requires at least one exercise', () => {
  assert.equal(canStartRoutine({ exercises: [] }), false);
  assert.equal(canStartRoutine({ exercises: [{ name: 'Supino' }] }), true);
  assert.equal(canStartRoutine({ exercises: ['Agachamento'] }), true);
});

test('getRoutineStartBlockReason explains blocked start', () => {
  assert.equal(getRoutineStartBlockReason({ exercises: [] }), 'Adicione exercicios para iniciar');
  assert.equal(getRoutineStartBlockReason({ exercises: [{ name: 'Rosca' }] }), '');
});
