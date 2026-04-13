import test from 'node:test';
import assert from 'node:assert/strict';
import { getRecoveryStatus } from '../src/domains/coach/coachService.js';

test('getRecoveryStatus retorna status correto por faixa', () => {
  assert.equal(getRecoveryStatus({ score: 90 }), 'otimo');
  assert.equal(getRecoveryStatus({ score: 60 }), 'moderado');
  assert.equal(getRecoveryStatus({ score: 30 }), 'baixo');
});

test('getRecoveryStatus retorna sem_dados para score invalido', () => {
  assert.equal(getRecoveryStatus({}), 'sem_dados');
});
