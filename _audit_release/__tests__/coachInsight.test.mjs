import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCoachInsight } from '../src/services/coachInsight.js';

test('coach inteligente prioriza treino quando usuário não treinou', () => {
  const insight = generateCoachInsight({
    trainedToday: false,
    protein: 80,
    proteinTarget: 150,
    water: 900,
    waterTarget: 2500,
    weeklyDone: 1,
    weeklyTarget: 4,
  });

  assert.equal(insight.priority, 'treino');
  assert.ok(insight.actions.length > 0);
});
