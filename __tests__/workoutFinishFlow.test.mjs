import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDailyState } from '../src/services/dailyState.js';
import {
  canFinishWorkout,
  getWorkoutSessionPresentation,
  INCOMPLETE_EXIT_CONFIRMATION,
  shouldBlockWorkoutFinish,
  shouldDismissRecoveryOnFinish,
  shouldMarkPartialSessionOnExit,
} from '../src/services/workoutFinishFlow.js';

test('1: plannedSets 17 / completedSets 1 cannot finish', () => {
  assert.equal(canFinishWorkout({ plannedSets: 17, completedSets: 1 }), false);
  assert.equal(shouldBlockWorkoutFinish({ plannedSets: 17, completedSets: 1 }), true);
});

test('2: plannedSets 17 / completedSets 17 can finish', () => {
  assert.equal(canFinishWorkout({ plannedSets: 17, completedSets: 17 }), true);
  assert.equal(shouldBlockWorkoutFinish({ plannedSets: 17, completedSets: 17 }), false);
});

test('3: incomplete workout generates in_progress status', () => {
  const state = getWorkoutSessionPresentation({ guidedSets: 1, plannedSets: 17 });
  assert.equal(state.status, 'in_progress');
});

test('4: incomplete workout does not generate completed status', () => {
  const state = getWorkoutSessionPresentation({ guidedSets: 1, plannedSets: 17 });
  assert.notEqual(state.status, 'completed');
  assert.equal(state.isCompleted, false);
});

test('5: incomplete workout marks partial session on exit and keeps resumable', () => {
  assert.equal(shouldMarkPartialSessionOnExit({ plannedSets: 17, completedSets: 1 }), true);

  const daily = buildDailyState({
    todayKey: '2026-05-30',
    plan: {},
    profile: {},
    gamification: {},
    nutritionLogs: [],
    history: [],
    workoutLogs: [],
    todayWorkout: [{ name: 'Agachamento', sets: 4 }],
    workoutSummary: { guidedSets: 1, plannedSets: 17, completionRate: 1 / 17 },
    recovery: { message: 'continue' },
  });
  assert.equal(daily.workoutSession.status, 'in_progress');
  assert.equal(daily.workoutSession.isContinue, true);
});

test('6: complete workout can dismiss recovery on finish', () => {
  assert.equal(shouldDismissRecoveryOnFinish({ plannedSets: 17, completedSets: 17 }), true);
  assert.equal(shouldMarkPartialSessionOnExit({ plannedSets: 17, completedSets: 17 }), false);
});

test('7: completed session does not show Continuar CTA', () => {
  const state = getWorkoutSessionPresentation({ guidedSets: 17, plannedSets: 17, hasResumableSession: true });
  assert.equal(state.isContinue, false);
  assert.notEqual(state.ctaLabel, 'CONTINUAR TREINO');
  assert.equal(state.status, 'completed');
});

test('8: partial session shows Continuar CTA', () => {
  const state = getWorkoutSessionPresentation({ guidedSets: 1, plannedSets: 17, hasResumableSession: true });
  assert.equal(state.isContinue, true);
  assert.equal(state.ctaLabel, 'CONTINUAR TREINO');
});

test('9: completed session does not use parou no treino copy', () => {
  const state = getWorkoutSessionPresentation({ guidedSets: 17, plannedSets: 17 });
  assert.ok(!String(state.ctaSubtitle || '').toLowerCase().includes('parou no treino'));
});

test('10: partial/in_progress may use continue copy', () => {
  const state = getWorkoutSessionPresentation({ guidedSets: 1, plannedSets: 17, hasResumableSession: true });
  const subtitle = String(state.ctaSubtitle || '').toLowerCase();
  assert.ok(
    subtitle.includes('continuar') || subtitle.includes('parou') || subtitle.includes('andamento'),
    `expected continue-style copy, got: ${state.ctaSubtitle}`
  );
});

test('INCOMPLETE_EXIT_CONFIRMATION matches product copy', () => {
  assert.equal(INCOMPLETE_EXIT_CONFIRMATION.title, 'Treino em andamento');
  assert.ok(INCOMPLETE_EXIT_CONFIRMATION.message.includes('series pendentes'));
  assert.equal(INCOMPLETE_EXIT_CONFIRMATION.cancelLabel, 'Continuar treino');
  assert.equal(INCOMPLETE_EXIT_CONFIRMATION.confirmLabel, 'Sair e salvar progresso');
});
