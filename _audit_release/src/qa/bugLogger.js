/**
 * qa/bugLogger.js
 * Logger leve de bugs para QA — envia para cloud e nunca interrompe o app.
 */
const { sendBugToCloud } = require('../services/cloudQaService');

const MAX_STACK_CHARS = 500;

function buildFingerprint(bug) {
  const raw = `${bug.screen || 'unknown'}::${bug.message || 'no_message'}`;
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9:_\-]/g, '_')
    .slice(0, 100);
}

function sanitizeStack(stack) {
  if (!stack) return '';
  return String(stack)
    .split('\n')
    .slice(0, 6)
    .join('\n')
    .slice(0, MAX_STACK_CHARS);
}

/**
 * Registra um bug leve no cloud (Firebase ou REST fallback).
 *
 * @param {object} options
 * @param {string} options.screen    - Tela ou módulo onde ocorreu
 * @param {string} options.message   - Mensagem do erro
 * @param {string} [options.severity] - 'LOW' | 'MEDIUM' | 'HIGH'
 * @param {Error|null} [options.error] - Objeto Error opcional
 * @param {object} [options.meta]    - Dados extras (sem dados PII)
 */
async function logBug({ screen, message, severity = 'LOW', error = null, meta = {} } = {}) {
  try {
    const bug = {
      screen:      String(screen || 'unknown').slice(0, 80),
      message:     String(message || (error?.message) || 'unknown_error').slice(0, 200),
      severity:    ['LOW', 'MEDIUM', 'HIGH'].includes(String(severity).toUpperCase())
        ? String(severity).toUpperCase()
        : 'LOW',
      stack:       sanitizeStack(error?.stack || ''),
      meta:        meta && typeof meta === 'object' ? meta : {},
      createdAt:   Date.now(),
    };
    bug.fingerprint = buildFingerprint(bug);

    await sendBugToCloud(bug);
  } catch {
    // nunca lança
  }
}

/**
 * Wrapper para capturar erros de uma função assíncrona sem parar o fluxo.
 */
async function withBugCapture(fn, screen = 'unknown') {
  try {
    return await fn();
  } catch (error) {
    await logBug({
      screen,
      message: error?.message || 'caught_exception',
      severity: 'HIGH',
      error,
      meta: { caught: true },
    });
    return null;
  }
}

module.exports = { logBug, withBugCapture };
