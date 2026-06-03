import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorkoutSetInputDisplay,
  formatDisplayText,
  normalizeSetFieldValue,
} from '../src/services/workoutSetDisplayValue.js';

test('1: empty field shows placeholder', () => {
  const display = buildWorkoutSetInputDisplay({
    rawValue: '',
    placeholder: 'Kg',
  });

  assert.equal(display.showPlaceholder, true);
  assert.equal(formatDisplayText({
    displayValue: display.displayValue,
    placeholder: 'Kg',
    showPlaceholder: display.showPlaceholder,
  }), 'Kg');
});

test('2: rawValue 40 shows 40', () => {
  const display = buildWorkoutSetInputDisplay({
    rawValue: '40',
    placeholder: 'Kg',
  });

  assert.equal(display.displayValue, '40');
  assert.equal(display.showPlaceholder, false);
});

test('3: savedValue 40 shows 40', () => {
  const display = buildWorkoutSetInputDisplay({
    rawValue: '',
    savedValue: '40',
    isSaved: true,
    placeholder: 'Kg',
  });

  assert.equal(display.displayValue, '40');
  assert.equal(display.showPlaceholder, false);
});

test('4: isSaving with rawValue 40 keeps 40', () => {
  const display = buildWorkoutSetInputDisplay({
    rawValue: '40',
    isSaving: true,
    placeholder: 'Kg',
  });

  assert.equal(display.displayValue, '40');
  assert.equal(display.showPlaceholder, false);
});

test('5: isSaving with savedValue 40 keeps 40', () => {
  const display = buildWorkoutSetInputDisplay({
    rawValue: '',
    savedValue: '40',
    isSaving: true,
    isSaved: true,
    placeholder: 'Kg',
  });

  assert.equal(display.displayValue, '40');
  assert.equal(display.showPlaceholder, false);
});

test('6: isSaved with savedValue 40 shows 40', () => {
  const display = buildWorkoutSetInputDisplay({
    savedValue: '40',
    isSaved: true,
    placeholder: 'Kg',
  });

  assert.equal(display.displayValue, '40');
  assert.equal(display.showPlaceholder, false);
});

test('7: disabled empty field shows placeholder without saved look', () => {
  const display = buildWorkoutSetInputDisplay({
    rawValue: '',
    isDisabled: true,
    placeholder: 'Reps',
  });

  assert.equal(display.showPlaceholder, true);
  assert.equal(display.isPlaceholderStyle, true);
});

test('8: weight zero displays as 0 not placeholder', () => {
  assert.equal(normalizeSetFieldValue(0), '0');

  const display = buildWorkoutSetInputDisplay({
    rawValue: 0,
    placeholder: 'Kg',
  });

  assert.equal(display.displayValue, '0');
  assert.equal(display.showPlaceholder, false);
});

test('9: empty reps keeps placeholder', () => {
  const display = buildWorkoutSetInputDisplay({
    rawValue: '',
    placeholder: 'Reps',
  });

  assert.equal(display.showPlaceholder, true);
  assert.equal(formatDisplayText({
    displayValue: display.displayValue,
    placeholder: 'Reps',
    showPlaceholder: display.showPlaceholder,
  }), 'Reps');
});

test('10: isSaving with valid value never becomes placeholder', () => {
  const display = buildWorkoutSetInputDisplay({
    rawValue: '80',
    isSaving: true,
    placeholder: 'Kg',
  });

  assert.equal(display.showPlaceholder, false);
  assert.equal(display.displayValue, '80');
});
