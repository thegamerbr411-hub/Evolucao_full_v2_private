import test from 'node:test';
import assert from 'node:assert/strict';
import { validateWorkoutSetInput } from '../src/services/workoutInputValidation.js';

const TODAY_KEY = '2026-06-02';

function simulateSaveFreeWorkoutSet(logs, data) {
  const validation = validateWorkoutSetInput({
    weight: data?.weight,
    reps: data?.reps,
    rpe: data?.rpe,
    isCardio: Boolean(data?.isCardio),
  });
  if (!validation.ok || !validation.sanitized) {
    return { ok: false, errors: validation.errors, logs };
  }

  const log = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: data.date || TODAY_KEY,
    createdAt: new Date().toISOString(),
    exerciseId: data.exerciseId || null,
    exerciseName: data.exerciseName,
    weight: validation.sanitized.weight,
    reps: validation.sanitized.reps,
    rpe: validation.sanitized.rpe,
    failed: Boolean(data.failed),
    mode: 'free',
  };

  return {
    ok: true,
    xpDelta: Number(data?.failed ? 2 : 6),
    logs: [log, ...logs],
    savedLog: log,
  };
}

function filterFreeLogsToday(logs, todayKey, exerciseName) {
  return logs.filter(
    (item) =>
      item.date === todayKey &&
      item.exerciseName === exerciseName &&
      (item.mode || 'guided') === 'free'
  );
}

function getExerciseSetProgress(logs, exerciseName, plannedSets = 3, todayKey = TODAY_KEY) {
  const todayExerciseLogs = logs.filter(
    (item) => item.date === todayKey && item.exerciseName === exerciseName
  );
  const completedSets = todayExerciseLogs.length;
  const totalSets = Math.max(1, Number(plannedSets) || 1);
  return {
    completedSets,
    totalSets,
    nextSet: Math.min(totalSets, completedSets + 1),
    isDone: completedSets >= totalSets,
  };
}

function serializeWorkoutLogs(logs) {
  return JSON.stringify({ workoutLogs: logs });
}

function hydrateWorkoutLogs(serialized) {
  const parsed = JSON.parse(serialized);
  return Array.isArray(parsed.workoutLogs) ? parsed.workoutLogs : [];
}

test('treino livre salva serie valida com kg=20 reps=10', () => {
  const result = simulateSaveFreeWorkoutSet([], {
    exerciseName: 'Supino Reto',
    weight: 20,
    reps: 10,
    date: TODAY_KEY,
  });

  assert.equal(result.ok, true);
  assert.equal(result.xpDelta, 6);
  assert.equal(result.logs.length, 1);
  assert.equal(result.savedLog.mode, 'free');
  assert.equal(result.savedLog.weight, 20);
  assert.equal(result.savedLog.reps, 10);
  assert.equal(result.savedLog.exerciseName, 'Supino Reto');
});

test('treino livre rejeita reps invalidas e nao altera logs', () => {
  const before = [{ id: 'seed', date: TODAY_KEY, exerciseName: 'Remada', weight: 30, reps: 8, mode: 'free' }];
  const result = simulateSaveFreeWorkoutSet(before, {
    exerciseName: 'Supino Reto',
    weight: 20,
    reps: 0,
    date: TODAY_KEY,
  });

  assert.equal(result.ok, false);
  assert.equal(result.logs.length, 1);
  assert.equal(result.logs[0].exerciseName, 'Remada');
});

test('serie free persiste apos reidratar workoutLogs serializados', () => {
  const first = simulateSaveFreeWorkoutSet([], {
    exerciseName: 'Supino Reto',
    weight: 20,
    reps: 10,
    date: TODAY_KEY,
  });
  const serialized = serializeWorkoutLogs(first.logs);
  const rehydrated = hydrateWorkoutLogs(serialized);
  const freeSets = filterFreeLogsToday(rehydrated, TODAY_KEY, 'Supino Reto');

  assert.equal(freeSets.length, 1);
  assert.equal(freeSets[0].weight, 20);
  assert.equal(freeSets[0].reps, 10);
  assert.equal(freeSets[0].mode, 'free');
});

test('getExerciseSetProgress incrementa completedSets apos save free', () => {
  const emptyProgress = getExerciseSetProgress([], 'Supino Reto');
  assert.equal(emptyProgress.completedSets, 0);

  const saved = simulateSaveFreeWorkoutSet([], {
    exerciseName: 'Supino Reto',
    weight: 20,
    reps: 10,
    date: TODAY_KEY,
  });
  const progress = getExerciseSetProgress(saved.logs, 'Supino Reto');

  assert.equal(progress.completedSets, 1);
  assert.equal(progress.nextSet, 2);
  assert.equal(progress.isDone, false);
});
