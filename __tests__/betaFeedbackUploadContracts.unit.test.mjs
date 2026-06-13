// __tests__/betaFeedbackUploadContracts.unit.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

// Testes unitários para contratos de upload (sem Firebase real)
import {
  generateStoragePath,
  buildAttachmentMetadata,
  validateAttachmentCandidate,
  createNotImplementedUploadService,
  isUploadEnabled,
} from '../src/features/betaFeedback/uploadContracts.js';

test('generateStoragePath cria path determinístico', () => {
  const path = generateStoragePath('user-123', 'feedback-456', 'att-789', 'screenshot.jpg');
  assert.strictEqual(path, 'beta-feedback/user-123/feedback-456/att-789-screenshot.jpg');
});

test('generateStoragePath é determinístico para mesmos inputs', () => {
  const path1 = generateStoragePath('user-123', 'feedback-456', 'att-789', 'screenshot.jpg');
  const path2 = generateStoragePath('user-123', 'feedback-456', 'att-789', 'screenshot.jpg');
  assert.strictEqual(path1, path2);
});

test('buildAttachmentMetadata cria metadata mínima', () => {
  const metadata = buildAttachmentMetadata({
    id: 'att-001',
    type: 'image',
    fileName: 'screenshot.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1024 * 1024,
    localUri: 'file:///tmp/screenshot.jpg',
    storagePath: 'beta-feedback/user-123/feedback-456/att-001-screenshot.jpg',
  });

  assert.strictEqual(metadata.id, 'att-001');
  assert.strictEqual(metadata.type, 'image');
  assert.strictEqual(metadata.fileName, 'screenshot.jpg');
  assert.strictEqual(metadata.mimeType, 'image/jpeg');
  assert.strictEqual(metadata.sizeBytes, 1024 * 1024);
  assert.strictEqual(metadata.localUri, 'file:///tmp/screenshot.jpg');
  assert.strictEqual(metadata.storagePath, 'beta-feedback/user-123/feedback-456/att-001-screenshot.jpg');
  assert.ok(metadata.uploadedAt);
});

test('validateAttachmentCandidate aceita arquivo válido', () => {
  const result = validateAttachmentCandidate({
    fileName: 'screenshot.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1024 * 1024,
  }, 0);

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.error, undefined);
});

test('validateAttachmentCandidate rejeita sem nome', () => {
  const result = validateAttachmentCandidate({
    fileName: '',
    mimeType: 'image/jpeg',
    sizeBytes: 1024 * 1024,
  }, 0);

  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'Nome de arquivo é obrigatório');
});

test('validateAttachmentCandidate rejeita sem MIME type', () => {
  const result = validateAttachmentCandidate({
    fileName: 'screenshot.jpg',
    mimeType: '',
    sizeBytes: 1024 * 1024,
  }, 0);

  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'MIME type é obrigatório');
});

test('validateAttachmentCandidate rejeita tipo não suportado', () => {
  const result = validateAttachmentCandidate({
    fileName: 'document.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024 * 1024,
  }, 0);

  assert.strictEqual(result.valid, false);
  assert.strictEqual(result.error, 'Tipo de arquivo não suportado (apenas imagem ou vídeo)');
});

test('validateAttachmentCandidate rejeita imagem muito grande', () => {
  const result = validateAttachmentCandidate({
    fileName: 'huge.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 20 * 1024 * 1024, // 20 MB
  }, 0);

  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('muito grande'));
});

test('validateAttachmentCandidate rejeita vídeo muito grande', () => {
  const result = validateAttachmentCandidate({
    fileName: 'huge.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 100 * 1024 * 1024, // 100 MB
  }, 0);

  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('muito grande'));
});

test('validateAttachmentCandidate rejeita muitos anexos', () => {
  const result = validateAttachmentCandidate({
    fileName: 'screenshot.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1024 * 1024,
  }, 5); // Já tem 5 anexos

  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('Máximo de 5'));
});

test('createNotImplementedUploadService lança erro em uploadAttachment', async () => {
  const service = createNotImplementedUploadService();
  await assert.rejects(
    async () => service.uploadAttachment(),
    /not implemented/i,
  );
});

test('createNotImplementedUploadService lança erro em deleteAttachment', async () => {
  const service = createNotImplementedUploadService();
  await assert.rejects(
    async () => service.deleteAttachment(),
    /not implemented/i,
  );
});

test('createNotImplementedUploadService lança erro em getDownloadUrl', async () => {
  const service = createNotImplementedUploadService();
  await assert.rejects(
    async () => service.getDownloadUrl(),
    /not implemented/i,
  );
});

test('isUploadEnabled retorna false', () => {
  assert.strictEqual(isUploadEnabled(), false);
});

test('validateAttachmentCandidate aceita vídeo válido', () => {
  const result = validateAttachmentCandidate({
    fileName: 'video.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 10 * 1024 * 1024, // 10 MB
  }, 0);

  assert.strictEqual(result.valid, true);
});

test('validateAttachmentCandidate aceita PNG', () => {
  const result = validateAttachmentCandidate({
    fileName: 'screenshot.png',
    mimeType: 'image/png',
    sizeBytes: 1024 * 1024,
  }, 0);

  assert.strictEqual(result.valid, true);
});

test('validateAttachmentCandidate aceita WebP', () => {
  const result = validateAttachmentCandidate({
    fileName: 'screenshot.webp',
    mimeType: 'image/webp',
    sizeBytes: 1024 * 1024,
  }, 0);

  assert.strictEqual(result.valid, true);
});
