// src/features/betaFeedback/permissions.js

// Admin inicial: allowlist por email/adminIds em config segura
// TODO: Será preenchido por env/config segura depois
const ADMIN_EMAIL_ALLOWLIST = [];

/**
 * Verifica se o usuário é admin baseado em allowlist de email
 * Futuro: evoluir para custom claims do Firebase Auth
 */
export function isAdminUser(user) {
  if (!user?.email) return false;
  return ADMIN_EMAIL_ALLOWLIST.includes(user.email.toLowerCase());
}

/**
 * Beta comum pode criar feedback próprio
 */
export function canCreateBetaFeedback(user) {
  return !!user?.id;
}

/**
 * Beta pode ler feedback próprio
 * Admin pode ler qualquer feedback
 */
export function canReadBetaFeedback(user, report) {
  if (!user?.id) return false;
  if (isAdminUser(user)) return true;
  return user.id === report.userId;
}

/**
 * Beta pode listar apenas feedbacks próprios
 * Admin pode listar todos
 */
export function canListAllBetaFeedback(user) {
  return isAdminUser(user);
}

/**
 * Apenas admin pode mudar status de feedback
 */
export function canUpdateBetaFeedbackStatus(user) {
  return isAdminUser(user);
}

/**
 * Apenas admin pode adicionar nota interna
 */
export function canAddAdminFeedbackNote(user) {
  return isAdminUser(user);
}

/**
 * Beta pode ver anexos próprios
 * Admin pode ver anexos de qualquer feedback
 */
export function canViewFeedbackAttachment(user, report) {
  if (!user?.id) return false;
  if (isAdminUser(user)) return true;
  return user.id === report.userId;
}
