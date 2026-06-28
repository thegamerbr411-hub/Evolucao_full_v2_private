import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkoutSetStatePresentation,
  resolveWorkoutSetStatusKey,
} from '../src/services/workoutSetSavedStateCopy.js';

test('resolveWorkoutSetStatusKey maps known states', () => {
  assert.equal(resolveWorkoutSetStatusKey({ status: 'ready' }), 'ready');
  assert.equal(resolveWorkoutSetStatusKey({ status: 'saved' }), 'saved');
  assert.equal(resolveWorkoutSetStatusKey({ status: 'unknown' }), 'pending');
});

test('buildWorkoutSetStatePresentation exposes testIDs', () => {
  const pending = buildWorkoutSetStatePresentation({ status: 'pending', label: 'Pendente' });
  assert.equal(pending.stateTestID, 'set-pending-state');
  assert.equal(pending.checkTestID, undefined);

  const ready = buildWorkoutSetStatePresentation({ status: 'ready', label: 'Pronta' });
  assert.equal(ready.stateTestID, 'set-ready-state');

  const saved = buildWorkoutSetStatePresentation({ status: 'saved', label: 'Salva' });
  assert.equal(saved.stateTestID, 'set-saved-state');
  assert.equal(saved.checkTestID, 'set-saved-check');
  assert.equal(saved.savedFeedbackLabel, 'Série salva');
});
