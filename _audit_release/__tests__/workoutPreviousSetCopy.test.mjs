import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPreviousSetLabel,
  resolvePreviousSetForRow,
} from '../src/services/workoutPreviousSetCopy.js';

test('formatPreviousSetLabel with valid kg/reps', () => {
  assert.equal(
    formatPreviousSetLabel({ weight: '10', reps: '15', isCardio: false }),
    '10 kg × 15'
  );
});

test('formatPreviousSetLabel with missing data', () => {
  assert.equal(formatPreviousSetLabel({ weight: '', reps: '', isCardio: false }), '—');
  assert.equal(formatPreviousSetLabel({ weight: '10', reps: '', isCardio: false }), '—');
});

test('formatPreviousSetLabel with cardio values', () => {
  assert.equal(
    formatPreviousSetLabel({ weight: '3.5', reps: '20', isCardio: true }),
    '20 min · 3.5 km'
  );
});

test('resolvePreviousSetForRow series 1 uses historical set', () => {
  const label = resolvePreviousSetForRow({
    setIndex: 0,
    todaySets: [],
    lastHistoricalSet: { weight: '40', reps: '8' },
    isCardio: false,
  });

  assert.equal(label, '40 kg × 8');
});

test('resolvePreviousSetForRow series N uses previous saved set', () => {
  const label = resolvePreviousSetForRow({
    setIndex: 2,
    todaySets: [
      { weight: '40', reps: '10', done: true },
      { weight: '42.5', reps: '8', done: true },
      { weight: '', reps: '', done: false },
    ],
    lastHistoricalSet: null,
    isCardio: false,
  });

  assert.equal(label, '42.5 kg × 8');
});

test('resolvePreviousSetForRow without data returns dash', () => {
  assert.equal(
    resolvePreviousSetForRow({
      setIndex: 0,
      todaySets: [],
      lastHistoricalSet: null,
      isCardio: false,
    }),
    '—'
  );
});
