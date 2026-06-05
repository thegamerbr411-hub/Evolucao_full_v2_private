import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isChallengeAdmin,
  getChallengeCreateGuardError,
  CHALLENGE_ADMIN_REQUIRED_MESSAGE,
} from '../src/utils/challengePermissions.js';

test('isChallengeAdmin returns true for role admin', () => {
  assert.equal(isChallengeAdmin({ role: 'admin', id: 'u1' }), true);
});

test('isChallengeAdmin returns true for isAdmin flag', () => {
  assert.equal(isChallengeAdmin({ role: 'user', isAdmin: true, id: 'u1' }), true);
});

test('isChallengeAdmin returns false for common user', () => {
  assert.equal(isChallengeAdmin({ role: 'user', id: 'u1' }), false);
});

test('isChallengeAdmin returns false for null', () => {
  assert.equal(isChallengeAdmin(null), false);
});

test('isChallengeAdmin returns false when role is missing', () => {
  assert.equal(isChallengeAdmin({ id: 'u1' }), false);
});

test('getChallengeCreateGuardError blocks non-admin user', () => {
  assert.equal(
    getChallengeCreateGuardError({ id: 'user_common', role: 'user' }),
    'admin_required'
  );
});

test('getChallengeCreateGuardError blocks when user is omitted', () => {
  assert.equal(getChallengeCreateGuardError(null), 'admin_required');
  assert.equal(getChallengeCreateGuardError(undefined), 'admin_required');
});

test('getChallengeCreateGuardError allows admin user', () => {
  assert.equal(
    getChallengeCreateGuardError({ id: 'admin1', role: 'admin' }),
    null
  );
});

test('CHALLENGE_ADMIN_REQUIRED_MESSAGE is defined', () => {
  assert.match(CHALLENGE_ADMIN_REQUIRED_MESSAGE, /administradores/i);
});
