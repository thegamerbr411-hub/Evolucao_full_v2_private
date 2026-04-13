import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDailyMacros } from '../src/domains/nutrition/nutritionService.js';
import { DomainError } from '../src/core/errors/DomainError.js';

test('calculateDailyMacros calcula macros corretamente para peso base', () => {
  const result = calculateDailyMacros({ weight: 70 });

  assert.equal(result.protein, 140);
  assert.equal(result.fat, 56);
  assert.equal(result.carbs, 210);
});

test('calculateDailyMacros dispara erro sem peso valido', () => {
  assert.throws(
    () => calculateDailyMacros({}),
    (error) => error instanceof DomainError && error.code === 'WEIGHT_REQUIRED'
  );
});
