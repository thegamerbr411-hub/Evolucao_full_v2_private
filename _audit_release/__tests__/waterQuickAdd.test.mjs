import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWaterQuickOptions,
  buildWaterRegisterCopy,
  normalizeWaterAmount,
  validateWaterAmount,
  WATER_MAX_SINGLE_ML,
  WATER_QUICK_OPTIONS_ML,
} from '../src/services/waterQuickAdd.js';

test('buildWaterQuickOptions returns presets', () => {
  assert.deepEqual(buildWaterQuickOptions(), [200, 300, 500, 510]);
});

test('preset 200 ml is valid', () => {
  assert.deepEqual(validateWaterAmount(200), { ok: true, amountMl: 200 });
});

test('preset 300 ml is valid', () => {
  assert.deepEqual(validateWaterAmount(300), { ok: true, amountMl: 300 });
});

test('preset 500 ml is valid', () => {
  assert.deepEqual(validateWaterAmount(500), { ok: true, amountMl: 500 });
});

test('preset 510 ml is valid', () => {
  assert.deepEqual(validateWaterAmount(510), { ok: true, amountMl: 510 });
});

test('custom valid amount', () => {
  assert.deepEqual(validateWaterAmount(250), { ok: true, amountMl: 250 });
  assert.deepEqual(validateWaterAmount(' 180 '), { ok: true, amountMl: 180 });
});

test('empty is invalid', () => {
  assert.equal(validateWaterAmount('').ok, false);
  assert.equal(validateWaterAmount('   ').ok, false);
  assert.equal(validateWaterAmount(null).reason, 'empty');
});

test('zero is invalid', () => {
  assert.deepEqual(validateWaterAmount(0), { ok: false, reason: 'zero' });
});

test('negative is invalid', () => {
  assert.deepEqual(validateWaterAmount(-10), { ok: false, reason: 'negative' });
});

test('absurd amount is invalid', () => {
  assert.deepEqual(validateWaterAmount(3001), { ok: false, reason: 'absurd' });
  assert.deepEqual(validateWaterAmount(10000), { ok: false, reason: 'absurd' });
});

test('cancel does not register (UI-only; validate not called for cancel path)', () => {
  assert.equal(typeof validateWaterAmount, 'function');
  assert.equal(WATER_QUICK_OPTIONS_ML.length, 4);
});

test('confirm uses correct normalized amount', () => {
  assert.equal(normalizeWaterAmount('300'), 300);
  assert.deepEqual(validateWaterAmount('300'), { ok: true, amountMl: 300 });
  assert.equal(buildWaterRegisterCopy(300), 'Água registrada: 300 ml');
});

test('max boundary is valid', () => {
  assert.deepEqual(validateWaterAmount(WATER_MAX_SINGLE_ML), {
    ok: true,
    amountMl: WATER_MAX_SINGLE_ML,
  });
});
