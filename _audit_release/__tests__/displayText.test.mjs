import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeDisplayText,
  formatCountPt,
  formatExerciseName,
  formatSocialParticipantLabel,
  looksLikeTechnicalUserId,
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

test('formatCountPt pluralizes treino', () => {
  assert.equal(formatCountPt(1, 'treino', 'treinos'), '1 treino');
  assert.equal(formatCountPt(2, 'treino', 'treinos'), '2 treinos');
  assert.equal(formatCountPt(0, 'treino', 'treinos'), '0 treinos');
});

test('formatSocialParticipantLabel hides technical uid', () => {
  assert.equal(
    formatSocialParticipantLabel(2, 'vFL43VXHTmcXkIrsueWlycHIBQb2'),
    'Participante #2',
  );
  assert.equal(formatSocialParticipantLabel(1, 'Felipe'), 'Felipe');
});

test('looksLikeTechnicalUserId detects firebase-like ids', () => {
  assert.equal(looksLikeTechnicalUserId('vFL43VXHTmcXkIrsueWlycHIBQb2'), true);
  assert.equal(looksLikeTechnicalUserId('Felipe'), false);
});
