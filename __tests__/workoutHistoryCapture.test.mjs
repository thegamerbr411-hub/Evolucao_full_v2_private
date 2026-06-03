import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkoutHistoryPresentation,
  buildIgnoredHint,
} from '../src/services/workoutHistoryPresentation.js';
import { buildEmptyWorkoutHistorySummary } from '../src/services/workoutHistoryFlow.js';

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

test('1: lastSet correto com log valido', () => {
  const presentation = buildWorkoutHistoryPresentation({
    workoutLogs: [validAgachamento, validSupino],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.equal(presentation.summary.lastSet?.id, 'valid-supino-1');
  assert.equal(presentation.summary.lastSet?.weight, 40);
  assert.equal(presentation.summary.lastSet?.reps, 10);
  assert.equal(presentation.isEmpty, false);
});

test('2: bestWeight correto', () => {
  const presentation = buildWorkoutHistoryPresentation({
    workoutLogs: [olderValidSupino, validSupino],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.equal(presentation.summary.bestWeight, 40);
});

test('3: log 2060kg ignorado', () => {
  const presentation = buildWorkoutHistoryPresentation({
    workoutLogs: [validSupino, invalidSupino],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.equal(presentation.summary.lastSet?.weight, 40);
  assert.ok(!presentation.recentEntries.some((entry) => entry.lineText.includes('2060')));
});

test('4: ignoredCount incrementa', () => {
  const presentation = buildWorkoutHistoryPresentation({
    workoutLogs: [validSupino, invalidSupino],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.equal(presentation.summary.ignoredCount, 1);
  assert.equal(presentation.hasInvalidIgnored, true);
  assert.equal(presentation.ignoredHint, buildIgnoredHint(1));
});

test('5: exerciseId correto isola exercicio', () => {
  const presentation = buildWorkoutHistoryPresentation({
    workoutLogs: [validAgachamento, validSupino],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.equal(presentation.summary.totalSets, 1);
  assert.equal(presentation.summary.lastSet?.exerciseId, 'supino-reto');
});

test('6: exerciseId diferente nao match por nome', () => {
  const sameNameDifferentId = {
    ...validSupino,
    id: 'legacy-supino',
    exerciseId: 'supino-legado',
    weight: 99,
  };

  const presentation = buildWorkoutHistoryPresentation({
    workoutLogs: [validSupino, sameNameDifferentId],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.equal(presentation.summary.totalSets, 1);
  assert.equal(presentation.summary.lastSet?.exerciseId, 'supino-reto');
});

test('7: fallback nome sem exerciseId', () => {
  const logWithoutId = {
    ...validSupino,
    id: 'no-id-log',
    exerciseId: undefined,
  };

  const presentation = buildWorkoutHistoryPresentation({
    workoutLogs: [logWithoutId],
    exerciseName: 'Supino Reto',
  });

  assert.equal(presentation.summary.totalSets, 1);
  assert.equal(presentation.summary.lastSet?.exerciseName, 'Supino Reto');
});

test('8: ordem recente -> antiga', () => {
  const presentation = buildWorkoutHistoryPresentation({
    workoutLogs: [olderValidSupino, validSupino],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
    limit: 5,
  });

  assert.equal(presentation.recentEntries[0]?.lineText, '05/28 40kg x 10');
  assert.equal(presentation.recentEntries[1]?.lineText, '05/28 35kg x 10');
  assert.ok(presentation.recentEntries[0]?.lineText.includes('40kg'));
  assert.ok(presentation.recentEntries[1]?.lineText.includes('35kg'));
});

test('9: totalVolume ignora invalidos', () => {
  const presentation = buildWorkoutHistoryPresentation({
    workoutLogs: [validSupino, invalidSupino],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  assert.equal(presentation.summary.totalVolume, 400);
});

test('10: vazio -> buildEmptyWorkoutHistorySummary / presentation segura', () => {
  const presentation = buildWorkoutHistoryPresentation({
    workoutLogs: [],
    exerciseName: 'Supino Reto',
    exerciseId: 'supino-reto',
  });

  const empty = buildEmptyWorkoutHistorySummary();
  assert.equal(presentation.isEmpty, true);
  assert.equal(presentation.emptyCopy, 'Sem historico valido para este exercicio');
  assert.deepEqual(presentation.summary.logs, empty.logs);
  assert.equal(presentation.summary.lastSet, null);
  assert.equal(presentation.ignoredHint, '');
});
