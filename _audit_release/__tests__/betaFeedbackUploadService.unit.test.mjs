// __tests__/betaFeedbackUploadService.unit.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

// Mock fetch for Node.js test environment
global.fetch = async (url) => {
  return {
    blob: async () => new Blob(['test']),
  };
};

// Testes unitários para upload service com Firebase Storage real (mas desligado por padrão)
import {
  createUploadService,
  isUploadEnabled,
  mapUploadError,
  validateAttachmentForUpload,
} from '../src/features/betaFeedback/uploadService.js';

import {
  UploadErrorCode,
  createUploadError,
  isUploadError,
  getUploadErrorMessage,
} from '../src/features/betaFeedback/uploadErrors.js';

test('isUploadEnabled retorna false por padrão', () => {
  assert.strictEqual(isUploadEnabled(), false);
});

test('createUploadService lança disabled por padrão', async () => {
  const service = createUploadService();
  await assert.rejects(
    async () => service.uploadAttachment({
      userId: 'user-123',
      feedbackId: 'feedback-456',
      attachment: { localUri: 'file:///tmp/test.jpg' },
    }),
    /disabled/i,
  );
});

test('createUploadService lança disabled por padrão mesmo com storage fornecido', async () => {
  const service = createUploadService({ storage: {} });
  await assert.rejects(
    async () => service.uploadAttachment({
      userId: 'user-123',
      feedbackId: 'feedback-456',
      attachment: { localUri: 'file:///tmp/test.jpg' },
    }),
    /disabled/i,
  );
});

test('createUploadService com flag true e storage null lança not configured', async () => {
  const originalEnv = process.env.EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_UPLOAD;
  process.env.EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_UPLOAD = '1';

  try {
    const service = createUploadService({ storage: null });
    await assert.rejects(
      async () => service.uploadAttachment({
        userId: 'user-123',
        feedbackId: 'feedback-456',
        attachment: { localUri: 'file:///tmp/test.jpg' },
      }),
      /not configured/i,
    );
  } finally {
    process.env.EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_UPLOAD = originalEnv;
  }
});

test('createUploadService deleteAttachment lança disabled por padrão', async () => {
  const service = createUploadService();
  await assert.rejects(
    async () => service.deleteAttachment('beta-feedback/user-123/feedback-456/test.jpg'),
    /disabled/i,
  );
});

test('createUploadService getDownloadUrl lança disabled por padrão', async () => {
  const service = createUploadService();
  await assert.rejects(
    async () => service.getDownloadUrl('beta-feedback/user-123/feedback-456/test.jpg'),
    /disabled/i,
  );
});

test('mapUploadError mapeia disabled', () => {
  const error = new Error('Beta feedback upload is disabled.');
  const message = mapUploadError(error);
  assert.ok(message.includes('desabilitado'));
});

test('mapUploadError mapeia not configured', () => {
  const error = new Error('Firebase Storage not configured.');
  const message = mapUploadError(error);
  assert.ok(message.includes('Erro ao fazer upload'));
});

test('mapUploadError mapeia erro genérico', () => {
  const error = new Error('generic error');
  const message = mapUploadError(error);
  assert.ok(message.includes('Erro ao fazer upload'));
});

test('validateAttachmentForUpload aceita anexo válido', () => {
  const attachment = {
    localUri: 'file:///tmp/test.jpg',
    fileName: 'test.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1024 * 1024,
  };

  const result = validateAttachmentForUpload(attachment);

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.error, undefined);
});

test('validateAttachmentForUpload rejeita anexo sem localUri', () => {
  const attachment = {
    fileName: 'test.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1024 * 1024,
  };

  const result = validateAttachmentForUpload(attachment);

  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('inválido'));
});

test('validateAttachmentForUpload rejeita anexo sem fileName', () => {
  const attachment = {
    localUri: 'file:///tmp/test.jpg',
    fileName: '',
    mimeType: 'image/jpeg',
    sizeBytes: 1024 * 1024,
  };

  const result = validateAttachmentForUpload(attachment);

  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('Nome de arquivo'));
});

test('validateAttachmentForUpload rejeita anexo sem mimeType', () => {
  const attachment = {
    localUri: 'file:///tmp/test.jpg',
    fileName: 'test.jpg',
    mimeType: '',
    sizeBytes: 1024 * 1024,
  };

  const result = validateAttachmentForUpload(attachment);

  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('Tipo de arquivo'));
});

test('validateAttachmentForUpload rejeita tipo não suportado', () => {
  const attachment = {
    localUri: 'file:///tmp/test.pdf',
    fileName: 'test.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024 * 1024,
  };

  const result = validateAttachmentForUpload(attachment);

  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('não suportado'));
});

test('validateAttachmentForUpload rejeita imagem muito grande', () => {
  const attachment = {
    localUri: 'file:///tmp/huge.jpg',
    fileName: 'huge.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 20 * 1024 * 1024, // 20 MB
  };

  const result = validateAttachmentForUpload(attachment);

  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('muito grande'));
});

test('validateAttachmentForUpload rejeita vídeo muito grande', () => {
  const attachment = {
    localUri: 'file:///tmp/huge.mp4',
    fileName: 'huge.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 100 * 1024 * 1024, // 100 MB
  };

  const result = validateAttachmentForUpload(attachment);

  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('muito grande'));
});

test('validateAttachmentForUpload aceita vídeo válido', () => {
  const attachment = {
    localUri: 'file:///tmp/video.mp4',
    fileName: 'video.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 10 * 1024 * 1024, // 10 MB
  };

  const result = validateAttachmentForUpload(attachment);

  assert.strictEqual(result.valid, true);
});

test('createUploadError cria erro com código', () => {
  const error = createUploadError(
    UploadErrorCode.DISABLED,
    'Upload disabled',
  );

  assert.strictEqual(error.code, UploadErrorCode.DISABLED);
  assert.strictEqual(error.message, 'Upload disabled');
});

test('createUploadError cria erro com erro original', () => {
  const originalError = new Error('original');
  const error = createUploadError(
    UploadErrorCode.NETWORK_ERROR,
    'Network error',
    originalError,
  );

  assert.strictEqual(error.code, UploadErrorCode.NETWORK_ERROR);
  assert.strictEqual(error.originalError, originalError);
});

test('isUploadError retorna true para upload error', () => {
  const error = createUploadError(
    UploadErrorCode.DISABLED,
    'Upload disabled',
  );

  assert.strictEqual(isUploadError(error), true);
});

test('isUploadError retorna false para erro genérico', () => {
  const error = new Error('generic error');
  assert.strictEqual(isUploadError(error), false);
});

test('isUploadError retorna false para erro sem código', () => {
  const error = new Error('generic error');
  error.code = 'GENERIC_ERROR';
  assert.strictEqual(isUploadError(error), false);
});

test('getUploadErrorMessage retorna mensagem para código DISABLED', () => {
  const error = createUploadError(
    UploadErrorCode.DISABLED,
    'Upload disabled',
  );

  const message = getUploadErrorMessage(error);
  assert.ok(message.includes('desabilitado'));
});

test('getUploadErrorMessage retorna mensagem para código NOT_IMPLEMENTED', () => {
  const error = createUploadError(
    UploadErrorCode.NOT_IMPLEMENTED,
    'Not implemented',
  );

  const message = getUploadErrorMessage(error);
  assert.ok(message.includes('não está implementado'));
});

test('getUploadErrorMessage retorna mensagem genérica para erro desconhecido', () => {
  const error = new Error('generic error');
  const message = getUploadErrorMessage(error);
  assert.ok(message.includes('desconhecido'));
});

test('getUploadErrorMessage retorna mensagem para código FILE_TOO_LARGE', () => {
  const error = createUploadError(
    UploadErrorCode.FILE_TOO_LARGE,
    'File too large',
  );

  const message = getUploadErrorMessage(error);
  assert.ok(message.includes('muito grande'));
});

test('getUploadErrorMessage retorna mensagem para código UNSUPPORTED_TYPE', () => {
  const error = createUploadError(
    UploadErrorCode.UNSUPPORTED_TYPE,
    'Unsupported type',
  );

  const message = getUploadErrorMessage(error);
  assert.ok(message.includes('não suportado'));
});
