const crypto = require('crypto');

const MAX_MESSAGE_LENGTH = 320;
const MAX_SCREEN_LENGTH = 120;
const MAX_STACK_LENGTH = 2200;
const VALID_SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

function safeText(value, fallback = '') {
  const text = String(value ?? fallback).replace(/\s+/g, ' ').trim();
  return text || fallback;
}

function normalizeTimestamp(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function cleanStack(stack) {
  if (!stack) return '';

  return String(stack)
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.includes('node_modules'))
    .slice(0, 5)
    .join('\n')
    .slice(0, MAX_STACK_LENGTH);
}

function getSeverity(message) {
  if (!message) return 'LOW';

  const text = String(message).toLowerCase();
  if (text.includes('crash') || text.includes('fatal')) return 'CRITICAL';
  if (text.includes('error')) return 'HIGH';
  if (text.includes('fail')) return 'MEDIUM';
  return 'LOW';
}

function inferSeverity(message, providedSeverity = '') {
  const normalizedProvided = safeText(providedSeverity, '').toUpperCase();
  if (VALID_SEVERITIES.has(normalizedProvided)) {
    return normalizedProvided;
  }

  return getSeverity(message);
}

function buildFingerprint(message) {
  const normalized = String(message || '')
    .toLowerCase()
    .replace(/[0-9]/g, '')
    .slice(0, 100);

  return crypto.createHash('sha1').update(normalized).digest('hex');
}

function normalizeIncomingLog(payload = {}) {
  const message = safeText(payload.message, 'unknown_error').slice(0, MAX_MESSAGE_LENGTH);
  const screen = safeText(payload.screen, 'unknown').slice(0, MAX_SCREEN_LENGTH);
  const stack = cleanStack(payload.stack);
  const severity = inferSeverity(message, payload.severity);
  const timestamp = normalizeTimestamp(payload.timestamp || payload.createdAt);

  return {
    message,
    screen,
    severity,
    stack,
    timestamp,
    fingerprint: buildFingerprint(message),
  };
}

module.exports = {
  normalizeIncomingLog,
};
