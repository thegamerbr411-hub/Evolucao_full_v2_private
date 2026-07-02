import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HISTORY_SESSION_COPY,
  HISTORY_SESSION_TEST_IDS,
  buildRemoteWorkoutSessionCard,
  buildRemoteWorkoutSessionDetail,
} from '../src/services/workoutHistoryPresentation.js';
import { WORKOUT_COMPLETE_COPY } from '../src/services/workoutSessionSummary.js';

const fullWorkout = {
  id: 'workout-1',
  name: 'Treino A',
  dateKey: '2026-06-30',
  createdAt: '2026-06-30T18:30:00.000Z',
  durationMinutes: 45,
  totalSets: 12,
  totalVolume: 3200,
  exercises: [
    { name: 'Supino Reto' },
    { name: 'Agachamento Livre' },
    { name: 'Remada Curvada' },
  ],
};

test('buildRemoteWorkoutSessionCard with complete data', () => {
  const card = buildRemoteWorkoutSessionCard(fullWorkout);
  assert.equal(card.title, 'Treino A');
  assert.equal(card.durationValue, '45 min');
  assert.equal(card.exercisesValue, '3');
  assert.equal(card.setsValue, '12');
  assert.equal(card.showVolume, true);
  assert.ok(card.metaLine.includes('séries'));
  assert.equal(card.isPurePresentation, true);
});

test('buildRemoteWorkoutSessionCard fallbacks without duration/exercises/volume', () => {
  const card = buildRemoteWorkoutSessionCard({
    id: 'sparse',
    name: '',
    totalSets: 0,
    durationMinutes: 0,
    totalVolume: 0,
    exercises: [],
  });
  assert.equal(card.title, 'Treino');
  assert.equal(card.durationValue, '—');
  assert.equal(card.exercisesValue, '—');
  assert.equal(card.setsValue, '—');
  assert.equal(card.showVolume, false);
});

test('buildRemoteWorkoutSessionDetail formats exercise list', () => {
  const detail = buildRemoteWorkoutSessionDetail(fullWorkout);
  assert.equal(detail.detailTitle, 'Resumo do treino');
  assert.equal(detail.hasExerciseList, true);
  assert.ok(detail.exerciseList.displayText.includes('Supino Reto'));
  assert.equal(detail.exerciseCount, 3);
});

test('copy PT-BR acentuada', () => {
  assert.equal(HISTORY_SESSION_COPY.duration, 'Duração');
  assert.equal(HISTORY_SESSION_COPY.exercises, 'Exercícios');
  assert.equal(HISTORY_SESSION_COPY.sets, 'Séries');
  assert.equal(HISTORY_SESSION_COPY.finishedAt, 'Finalizado em');
  assert.ok(HISTORY_SESSION_COPY.emptyState.includes('histórico'));
});

test('HISTORY_SESSION_TEST_IDS contract', () => {
  assert.equal(HISTORY_SESSION_TEST_IDS.emptyState, 'history-empty-state');
  assert.equal(HISTORY_SESSION_TEST_IDS.sessionCard, 'history-session-card');
  assert.equal(HISTORY_SESSION_TEST_IDS.btnBack, 'btn-history-session-back');
});

test('label continuity with WORKOUT_COMPLETE_COPY', () => {
  assert.equal(HISTORY_SESSION_COPY.duration, WORKOUT_COMPLETE_COPY.duration);
  assert.equal(HISTORY_SESSION_COPY.exercises, WORKOUT_COMPLETE_COPY.exercises);
  assert.equal(HISTORY_SESSION_COPY.finishedAt, WORKOUT_COMPLETE_COPY.finishedAt);
});

test('helpers are pure and do not mutate input', () => {
  const input = { ...fullWorkout, exercises: [...fullWorkout.exercises] };
  const before = JSON.stringify(input);
  buildRemoteWorkoutSessionCard(input);
  buildRemoteWorkoutSessionDetail(input);
  assert.equal(JSON.stringify(input), before);
});

test('module exports are pure presentation helpers', async () => {
  const mod = await import('../src/services/workoutHistoryPresentation.js');
  const keys = Object.keys(mod);
  assert.ok(!keys.some((key) => /save|api|navigate|storage/i.test(key)));
  assert.equal(typeof mod.buildRemoteWorkoutSessionCard, 'function');
  assert.equal(typeof mod.buildRemoteWorkoutSessionDetail, 'function');
});
