import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateSessionState, serializeSessionState } from '../src/services/persistenceEngine.js';

test('persistência: serializa e hidrata estado de sessão', () => {
  const raw = serializeSessionState({
    workoutDrafts: { supino: [{ weight: '80', reps: '8' }] },
    nutritionDraft: [{ label: 'frango', quantity: 1 }],
    lastUpdatedAt: '2026-04-08T10:00:00.000Z',
  });

  const parsed = hydrateSessionState(raw);
  assert.equal(parsed.workoutDrafts.supino[0].weight, '80');
  assert.equal(parsed.nutritionDraft[0].label, 'frango');
});
