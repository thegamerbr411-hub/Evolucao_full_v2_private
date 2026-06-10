import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY,
  resolveWorkoutNavigationParams,
} from '../src/services/workoutActiveRoutine.js';

test('continue workout usa workoutId quando rotina ativa existe', async () => {
  const storage = new Map();
  const routineId = 'routine-abc-123';
  storage.set(WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY, routineId);

  const workoutId = String(storage.get(WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY) || '').trim();
  const params = resolveWorkoutNavigationParams({
    isContinue: true,
    activeRoutineId: workoutId,
  });

  assert.deepEqual(params, { workoutId: routineId });
});

test('continue workout sem rotina ativa abre treino padrao', async () => {
  const storage = new Map();
  const workoutId = String(storage.get(WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY) || '').trim();
  const params = resolveWorkoutNavigationParams({
    isContinue: true,
    activeRoutineId: workoutId,
  });
  assert.equal(params, undefined);
});

test('iniciar treino ignora rotina stale mesmo com id no storage', async () => {
  const storage = new Map();
  const routineId = 'routine-stale-1ex';
  storage.set(WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY, routineId);

  const workoutId = String(storage.get(WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY) || '').trim();
  const params = resolveWorkoutNavigationParams({
    isContinue: false,
    activeRoutineId: workoutId,
  });

  assert.equal(params, undefined);
});
