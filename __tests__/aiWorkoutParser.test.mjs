import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkoutText } from '../src/services/aiWorkoutParser.js';

test('parser de treino converte texto em estrutura de treino', () => {
  const parsed = parseWorkoutText('Supino 4x10\nLeg press 4x12\nAgachamento livre');

  assert.equal(parsed.name, 'Treino importado');
  assert.ok(Array.isArray(parsed.exercises));
  assert.ok(parsed.exercises.length >= 3);
  assert.equal(parsed.exercises[0].sets[0].done, false);
});
