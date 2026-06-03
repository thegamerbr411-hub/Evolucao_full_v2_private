import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyState,
  canFinishWorkout,
  computeWorkoutSessionStatus,
  computeXpTodayFromLogs,
  formatStreakLabel,
  getDailyTodayKey,
} from '../src/services/dailyState.js';
import { getTodayKey } from '../src/context/modules/utils.ts';

test('getTodayKey matches getDailyTodayKey for local calendar day', () => {
  assert.equal(getTodayKey(), getDailyTodayKey());
});

test('buildDailyState proteinToday includes logs for AppContext today key', () => {
  const todayKey = getTodayKey();
  const state = buildDailyState({
    todayKey,
    plan: { calories: 2200 },
    profile: { currentWeight: 80, goal: 'recomposicao' },
    gamification: { xp: 0, streakDays: 0 },
    nutritionLogs: [
      { date: todayKey, protein: 42, calories: 300, carbs: 10, fats: 5 },
      { date: '2020-01-01', protein: 99, calories: 500, carbs: 0, fats: 0 },
    ],
    history: [],
    workoutLogs: [],
    todayWorkout: [{ name: 'Supino', sets: 4 }],
    workoutSummary: { guidedSets: 0, plannedSets: 4, completionRate: 0 },
    recovery: null,
  });
  assert.equal(state.proteinToday, 42);
});

test('formatStreakLabel shows zero state without forcing day 1', () => {
  assert.equal(formatStreakLabel(0), 'Sem sequencia ativa');
  assert.equal(formatStreakLabel(1), 'Dia 1 de sequencia');
  assert.equal(formatStreakLabel(3), '3 dias de sequencia');
});

test('computeXpTodayFromLogs sums guided set xp deltas', () => {
  const xp = computeXpTodayFromLogs([
    { date: '2026-05-30', mode: 'guided', failed: false },
    { date: '2026-05-30', mode: 'guided', failed: true },
    { date: '2026-05-29', mode: 'guided', failed: false },
  ], '2026-05-30');
  assert.equal(xp, 13);
});

test('canFinishWorkout requires all planned sets completed', () => {
  assert.equal(canFinishWorkout({ plannedSets: 17, completedSets: 1 }), false);
  assert.equal(canFinishWorkout({ plannedSets: 17, completedSets: 17 }), true);
  assert.equal(canFinishWorkout({ plannedSets: 0, completedSets: 0 }), false);
  assert.equal(canFinishWorkout({ plannedSets: 4, completedSets: 3 }), false);
});

test('computeWorkoutSessionStatus stays in_progress below full completion', () => {
  const partial = computeWorkoutSessionStatus({
    plannedExerciseCount: 5,
    guidedSets: 1,
    plannedSets: 17,
    hasResumableSession: true,
  });
  assert.equal(partial.status, 'in_progress');
  assert.equal(partial.ctaLabel, 'CONTINUAR TREINO');
  assert.equal(partial.isCompleted, false);
  assert.equal(partial.isPartial, true);
});

test('workout state machine: not_started when zero sets', () => {
  const state = computeWorkoutSessionStatus({
    guidedSets: 0,
    plannedSets: 17,
    plannedExerciseCount: 5,
  });
  assert.equal(state.status, 'not_started');
  assert.equal(state.ctaLabel, 'INICIAR TREINO');
  assert.equal(state.isContinue, false);
});

test('workout state machine: partial stays in_progress not completed', () => {
  const state = computeWorkoutSessionStatus({
    guidedSets: 1,
    plannedSets: 17,
    plannedExerciseCount: 5,
  });
  assert.equal(state.status, 'in_progress');
  assert.equal(state.ctaLabel, 'CONTINUAR TREINO');
  assert.notEqual(state.status, 'completed');
  assert.equal(state.isPartial, true);
});

test('workout state machine: all sets completed', () => {
  const state = computeWorkoutSessionStatus({
    guidedSets: 17,
    plannedSets: 17,
    plannedExerciseCount: 5,
  });
  assert.equal(state.status, 'completed');
  assert.equal(state.ctaLabel, 'VER RESUMO DO TREINO');
  assert.equal(state.isContinue, false);
  assert.equal(state.isCompleted, true);
});

test('workout state machine: recovery ignored when completed', () => {
  const state = computeWorkoutSessionStatus({
    guidedSets: 17,
    plannedSets: 17,
    plannedExerciseCount: 5,
    hasResumableSession: true,
  });
  assert.equal(state.status, 'completed');
  assert.equal(state.isContinue, false);
});

test('workout state machine: recovery keeps in_progress for partial', () => {
  const state = computeWorkoutSessionStatus({
    guidedSets: 1,
    plannedSets: 17,
    plannedExerciseCount: 5,
    hasResumableSession: true,
  });
  assert.equal(state.status, 'in_progress');
  assert.equal(state.ctaLabel, 'CONTINUAR TREINO');
});

test('buildDailyState ignores recovery when session is completed', () => {
  const state = buildDailyState({
    todayKey: '2026-05-30',
    plan: { calories: 2200 },
    profile: { currentWeight: 80, goal: 'recomposicao' },
    gamification: { xp: 500, streakDays: 0 },
    nutritionLogs: [],
    history: [],
    workoutLogs: [],
    todayWorkout: [{ name: 'Agachamento Livre', sets: 4 }],
    workoutSummary: { guidedSets: 17, plannedSets: 17, completionRate: 0.5 },
    recovery: { message: 'continue' },
  });

  assert.equal(state.workoutSession.status, 'completed');
  assert.equal(state.workoutCompletedToday, true);
  assert.equal(state.completionRate, 1);
});

test('computeWorkoutSessionStatus aligns continue vs start CTAs', () => {
  const notStarted = computeWorkoutSessionStatus({ plannedExerciseCount: 5, guidedSets: 0 });
  assert.equal(notStarted.status, 'not_started');
  assert.equal(notStarted.ctaLabel, 'INICIAR TREINO');

  const inProgress = computeWorkoutSessionStatus({
    plannedExerciseCount: 5,
    guidedSets: 1,
    plannedSets: 4,
    hasResumableSession: true,
  });
  assert.equal(inProgress.status, 'in_progress');
  assert.equal(inProgress.ctaLabel, 'CONTINUAR TREINO');
  assert.equal(inProgress.isContinue, true);
});

test('buildDailyState uses single protein target for all screens', () => {
  const state = buildDailyState({
    todayKey: '2026-05-30',
    plan: { calories: 2200, caloriesPerDay: 2200, waterLitersPerDay: 3 },
    profile: { currentWeight: 80, goal: 'recomposicao' },
    gamification: { xp: 500, streakDays: 0 },
    nutritionLogs: [{ date: '2026-05-30', protein: 20, calories: 100, carbs: 0, fats: 0 }],
    history: [],
    workoutLogs: [],
    todayWorkout: [{ name: 'Agachamento Livre', sets: 4 }],
    workoutSummary: { guidedSets: 0, plannedSets: 4, completionRate: 0 },
    recovery: { message: 'continue' },
  });

  assert.ok(state.proteinTarget >= 150);
  assert.equal(state.proteinToday, 20);
  assert.equal(state.streakDays, 0);
  assert.equal(state.xpToday, 0);
  assert.equal(state.workoutSession.isContinue, true);
  assert.equal(state.proteinTarget, state.macroTargets.protein);
});
