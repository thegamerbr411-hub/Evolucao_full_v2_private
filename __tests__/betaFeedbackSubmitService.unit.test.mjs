// __tests__/betaFeedbackSubmitService.unit.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

// Testes unitários para Firestore submit service (mas desligado por padrão)
import {
  createSubmitService,
  isSubmitEnabled,
  mapSubmitError,
} from '../src/features/betaFeedback/feedbackSubmitService.js';

test('isSubmitEnabled retorna false por padrão', () => {
  assert.strictEqual(isSubmitEnabled(), false);
});

test('createSubmitService lança disabled por padrão', async () => {
  const service = createSubmitService();
  await assert.rejects(
    async () => service.submitFeedback({
      userId: 'user-123',
      draft: {
        type: 'bug',
        severity: 'low',
        title: 'Test feedback',
        description: 'Test description',
      },
      attachments: [],
    }),
    /disabled/i,
  );
});

test('createSubmitService com flag true e db null lança not configured', async () => {
  const originalEnv = process.env.EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_SUBMIT;
  process.env.EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_SUBMIT = '1';

  try {
    const service = createSubmitService({ db: null });
    await assert.rejects(
      async () => service.submitFeedback({
        userId: 'user-123',
        draft: {
          type: 'bug',
          severity: 'low',
          title: 'Test feedback',
          description: 'Test description',
        },
        attachments: [],
      }),
      /not configured/i,
    );
  } finally {
    process.env.EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_SUBMIT = originalEnv;
  }
});

test('createSubmitService updateStatus lança disabled por padrão', async () => {
  const service = createSubmitService();
  await assert.rejects(
    async () => service.updateStatus('feedback-123', 'resolved'),
    /disabled/i,
  );
});

test('mapSubmitError mapeia disabled', () => {
  const error = new Error('Beta feedback submit is disabled.');
  const message = mapSubmitError(error);
  assert.ok(message.includes('desabilitado'));
});

test('mapSubmitError mapeia not configured', () => {
  const error = new Error('Firestore not configured.');
  const message = mapSubmitError(error);
  assert.ok(message.includes('Firestore não configurado'));
});

test('mapSubmitError mapeia validation failed', () => {
  const error = new Error('Draft validation failed: Title is required');
  const message = mapSubmitError(error);
  assert.ok(message.includes('Validação falhou'));
});

test('mapSubmitError mapeia User ID mismatch', () => {
  const error = new Error('User ID mismatch.');
  const message = mapSubmitError(error);
  assert.ok(message.includes('autenticação'));
});

test('mapSubmitError mapeia erro genérico', () => {
  const error = new Error('generic error');
  const message = mapSubmitError(error);
  assert.ok(message.includes('Erro ao enviar feedback'));
});
