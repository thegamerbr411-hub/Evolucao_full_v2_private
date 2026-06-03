import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesExerciseLog, resolveExerciseIdentity } from '../src/services/workoutExerciseIdentity.js';
import {
  buildEmptyWorkoutHistorySummary,
  buildWorkoutHistorySummary,
  getSafeExerciseHistory,
  sortWorkoutLogsNewestFirst,
} from '../src/services/workoutHistoryFlow.js';

const validSupino = {
  id: 'valid-supino-1',
  date: '2026-05-28',
  createdAt: '2026-05-28T18:00:00.000Z',
  exerciseName: 'Supino Reto',
  exerciseId: 'supino-reto',
  weight: 40,
  reps: 10,
  rpe: 8,
  failed: false,
  mode: 'guided',
};

const validAgachamento = {
  id: 'valid-agachamento-1',
  date: '2026-05-28',
  createdAt: '2026-05-28T17:00:00.000Z',
  exerciseName: 'Agachamento Livre',
  exerciseId: 'agachamento-livre',
  weight: 80,
  reps: 8,
  rpe: 8,
  failed: false,
  mode: 'guided',
};

const invalidSupino = {
  id: 'invalid-supino-1',
  date: '2026-05-28',
  createdAt: '2026-05-28T19:00:00.000Z',
  exerciseName: 'Supino Reto',
  exerciseId: 'supino-reto',
  weight: 2060,
  reps: 1010,
  rpe: 8,
  failed: false,
  mode: 'guided',
};

const olderValidSupino = {
  ...validSupino,
  id: 'valid-supino-0',
  createdAt: '2026-05-27T18:00:00.000Z',
  weight: 35,
  reps: 10,
};

test('1: valid log 40kg x 10 enters correct exercise history', () => {
  const summary = buildWorkoutHistorySummary({
    workoutLogs: [validAgachamento, validSupino],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.equal(summary.totalSets, 1);
  assert.equal(summary.lastSet?.id, 'valid-supino-1');
  assert.equal(summary.lastSet?.weight, 40);
  assert.equal(summary.lastSet?.reps, 10);
});

test('2: other exercise log is excluded from current exercise history', () => {
  const summary = buildWorkoutHistorySummary({
    workoutLogs: [validAgachamento, validSupino],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.ok(!summary.logs.some((item) => item.exerciseName === 'Agachamento Livre'));
});

test('3: invalid log 2060kg x 1010 is ignored', () => {
  const summary = buildWorkoutHistorySummary({
    workoutLogs: [validSupino, invalidSupino],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.equal(summary.totalSets, 1);
  assert.equal(summary.lastSet?.weight, 40);
  assert.equal(summary.ignoredCount, 1);
  assert.equal(summary.hasInvalidIgnored, true);
});

test('4: lastSet uses most recent valid log', () => {
  const summary = buildWorkoutHistorySummary({
    workoutLogs: [olderValidSupino, validSupino],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.equal(summary.lastSet?.id, 'valid-supino-1');
  assert.equal(summary.lastSet?.weight, 40);
});

test('5: bestWeight uses only valid logs', () => {
  const summary = buildWorkoutHistorySummary({
    workoutLogs: [olderValidSupino, validSupino, invalidSupino],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.equal(summary.bestWeight, 40);
  assert.notEqual(summary.bestWeight, 2060);
});

test('6: totalVolume ignores invalid log', () => {
  const summary = buildWorkoutHistorySummary({
    workoutLogs: [validSupino, invalidSupino],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.equal(summary.totalVolume, 400);
});

test('7: exerciseId has priority over name when ids differ', () => {
  const sameNameDifferentId = {
    ...validSupino,
    id: 'legacy-supino',
    exerciseId: 'supino-legado',
    exerciseName: 'Supino Reto',
    weight: 99,
  };

  const identity = resolveExerciseIdentity('Supino Reto', 'supino-reto');
  assert.equal(matchesExerciseLog(validSupino, identity), true);
  assert.equal(matchesExerciseLog(sameNameDifferentId, identity), false);

  const summary = buildWorkoutHistorySummary({
    workoutLogs: [validSupino, sameNameDifferentId],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.equal(summary.totalSets, 1);
  assert.equal(summary.lastSet?.exerciseId, 'supino-reto');
});

test('8: name fallback works when exerciseId is missing', () => {
  const logWithoutId = {
    ...validSupino,
    id: 'no-id-log',
    exerciseId: undefined,
  };

  const summary = buildWorkoutHistorySummary({
    workoutLogs: [logWithoutId],
    exerciseName: 'Supino Reto',
  });

  assert.equal(summary.totalSets, 1);
  assert.equal(summary.lastSet?.exerciseName, 'Supino Reto');
});

test('9: history flow does not mutate original workoutLogs array', () => {
  const logs = [validSupino, validAgachamento];
  const snapshot = JSON.stringify(logs);

  buildWorkoutHistorySummary({
    workoutLogs: logs,
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  sortWorkoutLogsNewestFirst(logs);

  assert.equal(JSON.stringify(logs), snapshot);
});

test('10: exercise swap does not transfer old logs to new exercise history', () => {
  const oldExerciseLog = {
    ...validSupino,
    id: 'old-supino-log',
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  };

  const newExerciseLog = {
    id: 'new-leg-press-log',
    date: '2026-05-29',
    createdAt: '2026-05-29T10:00:00.000Z',
    exerciseName: 'Leg Press',
    exerciseId: 'leg-press',
    weight: 120,
    reps: 10,
    rpe: 8,
    failed: false,
    mode: 'guided',
  };

  const newSummary = buildWorkoutHistorySummary({
    workoutLogs: [oldExerciseLog, newExerciseLog],
    exerciseName: 'Leg Press',
    exerciseId: 'leg-press',
  });

  assert.equal(newSummary.totalSets, 1);
  assert.equal(newSummary.lastSet?.exerciseName, 'Leg Press');
  assert.ok(!newSummary.logs.some((item) => item.exerciseId === 'supino-reto'));
});

test('11: ignoredCount is reported when invalid logs exist in scope', () => {
  const { ignoredCount, hasInvalidIgnored } = getSafeExerciseHistory({
    workoutLogs: [validSupino, invalidSupino],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.equal(ignoredCount, 1);
  assert.equal(hasInvalidIgnored, true);
});

test('12: empty history returns safe structure without crash', () => {
  const summary = buildWorkoutHistorySummary({
    workoutLogs: [],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.deepEqual(summary.logs, []);
  assert.equal(summary.lastSet, null);
  assert.equal(summary.bestSet, null);
  assert.equal(summary.bestWeight, 0);
  assert.equal(summary.totalVolume, 0);
  assert.equal(summary.totalSets, 0);
  assert.equal(summary.ignoredCount, 0);

  const empty = buildEmptyWorkoutHistorySummary();
  assert.equal(empty.totalSets, 0);
  assert.equal(empty.bestWeight, 0);
});
