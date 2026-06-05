import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkoutDraftScopeKey,
  buildSetCountMapFromExercises,
  incrementExerciseSetCount,
  parseWorkoutDraftBundle,
  resolveExercisePlannedSetCount,
  serializeWorkoutDraftBundle,
} from '../src/services/workoutDraftStorage.js';

test('rotina com 3 series continua 3 no mapa de sessao', () => {
  const map = buildSetCountMapFromExercises([
    { name: 'Supino', sets: 3 },
    { name: 'Remada', sets: 3 },
  ]);
  assert.equal(map.Supino, 3);
  assert.equal(map.Remada, 3);
});

test('adicionar 4a serie incrementa a partir do planejado, nao de zero', () => {
  const next = incrementExerciseSetCount({ Supino: 3 }, 'Supino', 3);
  assert.equal(next.Supino, 4);
});

test('resolveExercisePlannedSetCount usa exercise.sets quando state vazio', () => {
  const count = resolveExercisePlannedSetCount('Agachamento', {
    setCountByExercise: {},
    exerciseSets: 3,
  });
  assert.equal(count, 3);
});

test('bundle v2 so reidrata quando scopeKey coincide', () => {
  const scopeKey = buildWorkoutDraftScopeKey({
    sessionDayKey: '2026-06-04',
    workoutSessionId: 'sess-1',
    routineId: 'routine-1',
  });
  const raw = serializeWorkoutDraftBundle({
    scopeKey,
    draftSetsByExercise: { Supino: [{ weight: '60', reps: '10', rpe: '8' }] },
    setCountByExercise: { Supino: 3 },
  });
  const parsed = parseWorkoutDraftBundle(raw);
  assert.equal(parsed.scopeKey, scopeKey);
  assert.equal(parsed.setCountByExercise.Supino, 3);
  assert.equal(parsed.draftSetsByExercise.Supino.length, 1);
});

test('alterar series nao concatena reps no bundle', () => {
  const scopeKey = buildWorkoutDraftScopeKey({ sessionDayKey: '2026-06-04' });
  const raw = serializeWorkoutDraftBundle({
    scopeKey,
    setCountByExercise: { Supino: 3 },
    draftSetsByExercise: {
      Supino: [{ weight: '60', reps: '10', rpe: '8' }],
    },
  });
  const parsed = parseWorkoutDraftBundle(raw);
  assert.equal(parsed.setCountByExercise.Supino, 3);
  assert.equal(parsed.draftSetsByExercise.Supino[0].reps, '10');
});
