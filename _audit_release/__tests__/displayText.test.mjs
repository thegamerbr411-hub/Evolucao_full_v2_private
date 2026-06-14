import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeDisplayText,
  formatExerciseName,
  normalizeDisplayName,
} from '../src/utils/displayText.js';

test('decodeDisplayText decodes %20', () => {
  assert.equal(decodeDisplayText('Cadeira%20Extensora'), 'Cadeira Extensora');
});

test('decodeDisplayText decodes accented uri', () => {
  assert.equal(decodeDisplayText('Tr%C3%ADceps%20na%20Polia'), 'Tríceps na Polia');
});

test('normalizeDisplayName keeps normal strings', () => {
  assert.equal(normalizeDisplayName('Supino Reto'), 'Supino Reto');
});

test('null and undefined become empty', () => {
  assert.equal(normalizeDisplayName(null), '');
  assert.equal(normalizeDisplayName(undefined), '');
  assert.equal(formatExerciseName(null), 'Exercício');
});

test('malformed uri does not crash', () => {
  assert.equal(decodeDisplayText('%E0%A4%A'), '%E0%A4%A');
  assert.equal(normalizeDisplayName('%ZZ%20Teste'), '%ZZ Teste');
});
