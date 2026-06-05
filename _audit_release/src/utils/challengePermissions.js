/**
 * RBAC: criar desafio social — somente administradores validados (role/isAdmin).
 */
export function isChallengeAdmin(user) {
  if (!user) {
    return false;
  }
  const role = String(user?.role || '').toLowerCase();
  return role === 'admin' || Boolean(user?.isAdmin);
}

export const CHALLENGE_ADMIN_REQUIRED_MESSAGE =
  'Apenas administradores podem criar desafios.';

/** @returns {'admin_required'|null} */
export function getChallengeCreateGuardError(user) {
  if (!isChallengeAdmin(user)) {
    return 'admin_required';
  }
  return null;
}
