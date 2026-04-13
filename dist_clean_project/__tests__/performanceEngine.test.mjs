import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculate1RM,
  calculateVolume,
  calculateSRPE,
  getProgression,
  getDailyPriority,
} from '../src/services/performanceEngine.js';

test('calculate1RM calcula valor esperado', () => {
  const value = calculate1RM(80, 10);
  assert.ok(value > 106 && value < 108);
});

test('calculateVolume soma carga total da sessao', () => {
  const value = calculateVolume([
    { weight: 80, reps: 10 },
    { weight: 80, reps: 8 },
  ]);
  assert.equal(value, 1440);
});

test('calculateSRPE retorna rpe x duracao', () => {
  assert.equal(calculateSRPE(8, 45), 360);
});

test('getProgression aplica 2.5% quando reps atingem meta', () => {
  const value = getProgression(12, 12, 100);
  assert.equal(Number(value.toFixed(1)), 102.5);
});

test('getDailyPriority prioriza treino quando nao treinou', () => {
  const value = getDailyPriority({ trained: false, protein: 180, water: 2500 });
  assert.equal(value, 'Treinar');
});
