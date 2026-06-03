import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeWorkoutLogIntegrity,
  getBestWeightFromLogs,
  getLastPlausibleSet,
  RECOMMENDED_INTEGRITY_ACTION,
  sanitizeWorkoutLogsForRead,
} from '../src/services/workoutLogIntegrity.js';
import { suggestNextWeight } from '../src/utils/suggestNextWeight.js';

const validLog = {
  id: 'valid-1',
  date: '2026-05-28',
  exerciseName: 'Supino Reto',
  weight: 40,
  reps: 10,
  rpe: 8,
  failed: false,
  mode: 'guided',
};

const invalidLog = {
  id: 'invalid-1',
  date: '2026-05-28',
  exerciseName: 'Supino Reto',
  weight: 2060,
  reps: 1010,
  rpe: 8,
  failed: false,
  mode: 'guided',
};

test('valid log 40kg x 10 passes sanitizeWorkoutLogsForRead', () => {
  const result = sanitizeWorkoutLogsForRead([validLog]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'valid-1');
});

test('invalid log 2060kg x 1010 is detected by analyzeWorkoutLogIntegrity', () => {
  const report = analyzeWorkoutLogIntegrity([validLog, invalidLog]);
  assert.equal(report.totalLogs, 2);
  assert.equal(report.validLogs, 1);
  assert.equal(report.invalidLogs, 1);
  assert.ok(report.invalidIds.includes('invalid-1'));
  assert.ok(report.invalidByReason.invalid_weight >= 1);
  assert.ok(report.invalidByReason.invalid_reps >= 1);
});

test('getBestWeightFromLogs ignores invalid high weight', () => {
  const best = getBestWeightFromLogs([invalidLog, validLog]);
  assert.equal(best, 40);
});

test('getLastPlausibleSet skips newer invalid log', () => {
  const last = getLastPlausibleSet([invalidLog, validLog], { exerciseName: 'Supino Reto' });
  assert.equal(last?.id, 'valid-1');
  assert.equal(last?.weight, 40);
});

test('progression suggestion path ignores invalid logs when using last plausible weight', () => {
  const sanitized = sanitizeWorkoutLogsForRead([invalidLog, validLog]);
  const last = getLastPlausibleSet(sanitized, { exerciseName: 'Supino Reto' });
  const nextWeight = suggestNextWeight(last?.weight);
  assert.equal(nextWeight, 42.5);
  assert.notEqual(nextWeight, 2163);
});

test('analyzeWorkoutLogIntegrity returns correct counts', () => {
  const logs = [validLog, invalidLog, { ...validLog, id: 'valid-2', weight: 50 }];
  const report = analyzeWorkoutLogIntegrity(logs);
  assert.equal(report.totalLogs, 3);
  assert.equal(report.validLogs, 2);
  assert.equal(report.invalidLogs, 1);
});

test('sanitize and analyze do not mutate original array', () => {
  const logs = [validLog, invalidLog];
  const snapshot = JSON.stringify(logs);
  sanitizeWorkoutLogsForRead(logs);
  analyzeWorkoutLogIntegrity(logs);
  assert.equal(JSON.stringify(logs), snapshot);
  assert.equal(logs.length, 2);
});

test('recommendedAction is read_filter_only by default', () => {
  const report = analyzeWorkoutLogIntegrity([invalidLog]);
  assert.equal(report.recommendedAction, RECOMMENDED_INTEGRITY_ACTION);
  assert.equal(report.recommendedAction, 'read_filter_only');
});
