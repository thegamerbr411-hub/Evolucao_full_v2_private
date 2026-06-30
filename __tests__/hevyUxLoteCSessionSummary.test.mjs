import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKOUT_COMPLETE_COPY,
  WORKOUT_COMPLETE_TEST_IDS,
  buildCompactExerciseList,
  buildWorkoutCompleteSummary,
  formatWorkoutFinishedAt,
} from '../src/services/workoutSessionSummary.js';

test('buildWorkoutCompleteSummary with all fields', () => {
  const summary = buildWorkoutCompleteSummary({
    exerciseCount: 4,
    plannedExercises: 5,
    completedSets: 12,
    plannedSets: 16,
    totalVolume: 3200,
    sessionDurationMinutes: 45,
    finishedAt: '2026-06-30T18:30:00.000Z',
    exerciseNames: ['Supino', 'Agachamento', 'Remada'],
    streak: 3,
    sessionXp: 120,
    nowMs: Date.parse('2026-06-30T18:30:00.000Z'),
  });

  assert.equal(summary.title, 'Treino concluído');
  assert.equal(summary.subtitle, 'Resumo do treino');
  assert.equal(summary.durationValue, '45 min');
  assert.equal(summary.exercisesValue, '4');
  assert.equal(summary.setsValue, '12/16');
  assert.equal(summary.volumeValue, '3.200 kg');
  assert.equal(summary.showVolume, true);
  assert.equal(summary.exerciseList.displayText, 'Supino · Agachamento · Remada');
  assert.equal(summary.isPureSummaryModule, true);
});

test('fallbacks: volume 0 hides volume', () => {
  const summary = buildWorkoutCompleteSummary({
    completedSets: 2,
    plannedSets: 0,
    totalVolume: 0,
    sessionDurationMinutes: 0,
    exerciseNames: [],
  });

  assert.equal(summary.showVolume, false);
  assert.equal(summary.volumeValue, '—');
  assert.equal(summary.setsValue, '2');
  assert.equal(summary.durationValue, '0 min');
  assert.equal(summary.exerciseList.displayText, '—');
});

test('fallbacks: plannedSets 0 shows completed only', () => {
  const summary = buildWorkoutCompleteSummary({ completedSets: 5, plannedSets: 0 });
  assert.equal(summary.setsValue, '5');
});

test('fallbacks: exerciseCount 0 uses plannedExercises', () => {
  const summary = buildWorkoutCompleteSummary({ exerciseCount: 0, plannedExercises: 3 });
  assert.equal(summary.exercisesValue, '3');
});

test('copy PT-BR exported constants', () => {
  assert.equal(WORKOUT_COMPLETE_COPY.btnHistory, 'Ver histórico');
  assert.equal(WORKOUT_COMPLETE_COPY.btnHome, 'Voltar ao início');
  assert.equal(WORKOUT_COMPLETE_COPY.sets, 'Séries concluídas');
});

test('testIDs exported', () => {
  assert.equal(WORKOUT_COMPLETE_TEST_IDS.screen, 'screen-workout-complete');
  assert.equal(WORKOUT_COMPLETE_TEST_IDS.summaryCard, 'workout-summary-card');
  assert.equal(WORKOUT_COMPLETE_TEST_IDS.btnHistory, 'btn-workout-summary-history');
  assert.equal(WORKOUT_COMPLETE_TEST_IDS.btnHome, 'btn-workout-summary-home');
});

test('buildCompactExerciseList max 6 + overflow', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const list = buildCompactExerciseList(names);
  assert.equal(list.items.length, 6);
  assert.equal(list.overflowCount, 2);
  assert.ok(list.displayText.includes('+2'));
});

test('formatWorkoutFinishedAt handles invalid date', () => {
  const formatted = formatWorkoutFinishedAt('invalid', Date.parse('2026-06-30T12:00:00.000Z'));
  assert.ok(typeof formatted === 'string' && formatted.length > 0);
});

test('formatWorkoutFinishedAt PT-BR format', () => {
  const formatted = formatWorkoutFinishedAt('2026-06-30T15:45:00.000Z');
  assert.ok(formatted.includes('30'));
});

test('module is pure — no save/api/navigation exports', async () => {
  const mod = await import('../src/services/workoutSessionSummary.js');
  const keys = Object.keys(mod);
  assert.ok(!keys.some((k) => /save|api|navigate|storage/i.test(k)));
  assert.equal(typeof mod.buildWorkoutCompleteSummary, 'function');
});
