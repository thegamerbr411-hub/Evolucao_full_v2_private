import test from 'node:test';
import assert from 'node:assert/strict';
import {
  REST_TIMER_ADJUST_STEP_SEC,
  buildRestTimerActionLabels,
  buildRestTimerStatusCopy,
  clampRestSecondsAfterAdjust,
  formatRestTimerCountdown,
} from '../src/services/workoutRestTimerCopy.js';

test('formatRestTimerCountdown formats seconds and minutes', () => {
  assert.equal(formatRestTimerCountdown(45), '45s');
  assert.equal(formatRestTimerCountdown(90), '1:30');
  assert.equal(formatRestTimerCountdown(0), '0s');
});

test('buildRestTimerActionLabels returns PT-BR labels', () => {
  const labels = buildRestTimerActionLabels();
  assert.equal(labels.title, 'Descanso');
  assert.equal(labels.skip, 'Pular');
  assert.equal(labels.plus15, '+15s');
  assert.equal(labels.minus15, '-15s');
});

test('buildRestTimerStatusCopy marks low time under 15s', () => {
  const low = buildRestTimerStatusCopy({ secondsRemaining: 10, isRunning: true });
  assert.equal(low.isLowTime, true);
  assert.equal(low.statusCopy, 'Quase la');

  const ok = buildRestTimerStatusCopy({ secondsRemaining: 30, isRunning: true });
  assert.equal(ok.isLowTime, false);
  assert.equal(ok.statusCopy, 'Descanso em andamento');
});

test('clampRestSecondsAfterAdjust respects minimum one second', () => {
  const now = 1_000_000;
  const end = now + 5000;
  const minus = clampRestSecondsAfterAdjust(end, -REST_TIMER_ADJUST_STEP_SEC, now);
  assert.equal(minus.secondsRemaining, 1);
  assert.ok(minus.endAtMs >= now + 1000);

  const plus = clampRestSecondsAfterAdjust(end, REST_TIMER_ADJUST_STEP_SEC, now);
  assert.equal(plus.secondsRemaining, 20);
});
