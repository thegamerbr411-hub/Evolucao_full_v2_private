import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkoutSetInput } from '../src/services/workoutInputValidation.js';
import { buildLocalWorkoutLogsPresentation } from '../src/services/workoutHistoryPresentation.js';

const TODAY_KEY = '2026-06-12';

function resolveSetRowForSave(draftSetsByExercise, exerciseName, setIndex, rowOverride) {
  return rowOverride
    || (draftSetsByExercise[exerciseName] || [])[setIndex]
    || { weight: '', reps: '', rpe: '8' };
}

function simulateSaveSetLine(draftSetsByExercise, { exerciseName, setIndex, rowOverride } = {}) {
  const row = resolveSetRowForSave(draftSetsByExercise, exerciseName, setIndex, rowOverride);
  const validation = validateWorkoutSetInput({
    weight: row.weight,
    reps: row.reps,
    rpe: row.rpe || '8',
    isCardio: false,
  });

  if (!validation.ok || !validation.sanitized) {
    return { ok: false, errors: validation.errors, logs: [] };
  }

  const log = {
    id: `${Date.now()}-agachamento`,
    date: TODAY_KEY,
    createdAt: new Date().toISOString(),
    exerciseName,
    exerciseId: 'agachamento-livre',
    weight: validation.sanitized.weight,
    reps: validation.sanitized.reps,
    rpe: validation.sanitized.rpe ?? 8,
    failed: false,
    mode: 'guided',
  };

  return { ok: true, logs: [log], savedLog: log };
}

test('historico local exibe 40kg x 12 apos save valido de Agachamento Livre', () => {
  const saveResult = simulateSaveSetLine({}, {
    exerciseName: 'Agachamento Livre',
    setIndex: 0,
    rowOverride: { weight: '40', reps: '12', rpe: '8' },
  });

  assert.equal(saveResult.ok, true);
  assert.equal(saveResult.savedLog.weight, 40);
  assert.equal(saveResult.savedLog.reps, 12);

  const presentation = buildLocalWorkoutLogsPresentation(saveResult.logs);
  assert.equal(presentation.isEmpty, false);
  assert.ok(presentation.entries.some((entry) => entry.lineText.includes('40kg x 12')));
  assert.ok(presentation.entries.some((entry) => entry.lineText.includes('Agachamento Livre')));
});

test('draft stale sem reps falha validacao e nao persiste serie', () => {
  const draftSetsByExercise = {
    'Agachamento Livre': [{ weight: '40', reps: '', rpe: '8' }],
  };

  const staleResult = simulateSaveSetLine(draftSetsByExercise, {
    exerciseName: 'Agachamento Livre',
    setIndex: 0,
  });

  assert.equal(staleResult.ok, false);
  assert.ok(Array.isArray(staleResult.errors));
  assert.ok(staleResult.errors.some((item) => item?.field === 'reps'));
});

test('mergedRow com reps confirmado passa validacao mesmo com draft stale', () => {
  const draftSetsByExercise = {
    'Agachamento Livre': [{ weight: '40', reps: '', rpe: '8' }],
  };

  const mergedResult = simulateSaveSetLine(draftSetsByExercise, {
    exerciseName: 'Agachamento Livre',
    setIndex: 0,
    rowOverride: { weight: '40', reps: '12', rpe: '8' },
  });

  assert.equal(mergedResult.ok, true);
  assert.equal(mergedResult.savedLog.weight, 40);
  assert.equal(mergedResult.savedLog.reps, 12);

  const presentation = buildLocalWorkoutLogsPresentation(mergedResult.logs);
  assert.ok(presentation.entries[0]?.lineText.includes('40kg x 12'));
});

test('confirmKeypad stale value sobrescreve draft correto com 0x1 se nao usar ref', () => {
  const draftAfterDigits = { weight: '40', reps: '12', rpe: '8' };
  const staleConfirmValue = '1';
  const staleMerged = { ...draftAfterDigits, reps: staleConfirmValue };

  const wrongSave = simulateSaveSetLine({}, {
    exerciseName: 'Agachamento Livre',
    setIndex: 0,
    rowOverride: staleMerged,
  });

  assert.equal(wrongSave.ok, true);
  assert.equal(wrongSave.savedLog.weight, 40);
  assert.equal(wrongSave.savedLog.reps, 1);

  const correctMerged = { ...draftAfterDigits, reps: '12' };
  const goodSave = simulateSaveSetLine({}, {
    exerciseName: 'Agachamento Livre',
    setIndex: 0,
    rowOverride: correctMerged,
  });

  assert.equal(goodSave.savedLog.weight, 40);
  assert.equal(goodSave.savedLog.reps, 12);
  assert.ok(goodSave.logs[0] && buildLocalWorkoutLogsPresentation(goodSave.logs).entries[0].lineText.includes('40kg x 12'));
});

test('valores 0kg x 1 sao validos mas distintos do smoke 40x12', () => {
  const wrongResult = simulateSaveSetLine({}, {
    exerciseName: 'Agachamento Livre',
    setIndex: 0,
    rowOverride: { weight: '0', reps: '1', rpe: '8' },
  });

  assert.equal(wrongResult.ok, true);
  assert.equal(wrongResult.savedLog.weight, 0);
  assert.equal(wrongResult.savedLog.reps, 1);

  const presentation = buildLocalWorkoutLogsPresentation(wrongResult.logs);
  assert.ok(presentation.entries[0]?.lineText.includes('0kg x 1'));
  assert.ok(!presentation.entries[0]?.lineText.includes('40kg x 12'));
});
