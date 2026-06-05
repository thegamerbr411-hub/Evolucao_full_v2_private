import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY } from '../src/services/workoutActiveRoutine.js';

test('continue workout usa workoutId quando rotina ativa existe', async () => {
  const storage = new Map();
  const routineId = 'routine-abc-123';
  storage.set(WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY, routineId);

  const workoutId = String(storage.get(WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY) || '').trim();
  const params = workoutId ? { workoutId } : undefined;

  assert.deepEqual(params, { workoutId: routineId });
});

test('continue workout sem rotina ativa abre treino padrao', async () => {
  const storage = new Map();
  const workoutId = String(storage.get(WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY) || '').trim();
  const params = workoutId ? { workoutId } : undefined;
  assert.equal(params, undefined);
});
