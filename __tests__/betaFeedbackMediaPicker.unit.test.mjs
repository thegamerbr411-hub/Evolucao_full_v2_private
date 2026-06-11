// __tests__/betaFeedbackMediaPicker.unit.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

// Testes unitários para media picker wrapper (sem expo-image-picker real)
import {
  isMediaPickerEnabled,
  isMediaPickerAvailable,
  requestMediaLibraryPermission,
  mapPermissionError,
} from '../src/features/betaFeedback/mediaPermissions.js';

import {
  pickBetaFeedbackMedia,
  normalizePickedAsset,
  mapImagePickerError,
  validatePickedAsset,
} from '../src/features/betaFeedback/mediaPicker.js';

test('isMediaPickerEnabled retorna false por padrão', () => {
  assert.strictEqual(isMediaPickerEnabled(), false);
});

test('isMediaPickerAvailable retorna true (expo-image-picker instalado)', () => {
  assert.strictEqual(isMediaPickerAvailable(), true);
});

test('requestMediaLibraryPermission lança not implemented', async () => {
  await assert.rejects(
    async () => requestMediaLibraryPermission(),
    /not implemented/i,
  );
});

test('mapPermissionError mapeia erro not implemented', () => {
  const error = new Error('not implemented');
  const message = mapPermissionError(error);
  assert.ok(message.includes('não estão implementadas'));
});

test('mapPermissionError mapeia erro genérico', () => {
  const error = new Error('generic error');
  const message = mapPermissionError(error);
  assert.ok(message.includes('Erro ao solicitar'));
});

test('pickBetaFeedbackMedia lança disabled por padrão', async () => {
  await assert.rejects(
    async () => pickBetaFeedbackMedia(),
    /disabled/i,
  );
});

test('pickBetaFeedbackMedia lança not implemented se flag true mas picker não implementado', async () => {
  // Simular flag true (mas picker ainda não implementado)
  const originalEnv = process.env.EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_MEDIA_PICKER;
  process.env.EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_MEDIA_PICKER = '1';

  try {
    await assert.rejects(
      async () => pickBetaFeedbackMedia(),
      /not implemented/i,
    );
  } finally {
    process.env.EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_MEDIA_PICKER = originalEnv;
  }
});

test('normalizePickedAsset normaliza asset básico', () => {
  const asset = {
    id: 'asset-123',
    type: 'image',
    fileName: 'screenshot.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1024 * 1024,
    localUri: 'file:///tmp/screenshot.jpg',
  };

  const normalized = normalizePickedAsset(asset);

  assert.strictEqual(normalized.id, 'asset-123');
  assert.strictEqual(normalized.type, 'image');
  assert.strictEqual(normalized.fileName, 'screenshot.jpg');
  assert.strictEqual(normalized.mimeType, 'image/jpeg');
  assert.strictEqual(normalized.sizeBytes, 1024 * 1024);
  assert.strictEqual(normalized.localUri, 'file:///tmp/screenshot.jpg');
});

test('normalizePickedAsset lida com asset vazio', () => {
  const asset = {};

  const normalized = normalizePickedAsset(asset);

  assert.strictEqual(normalized.id, 'unknown');
  assert.strictEqual(normalized.type, 'image');
  assert.strictEqual(normalized.fileName, 'unknown');
  assert.strictEqual(normalized.mimeType, 'image/jpeg');
  assert.strictEqual(normalized.sizeBytes, 0);
  assert.strictEqual(normalized.localUri, '');
});

test('mapImagePickerError mapeia disabled', () => {
  const error = new Error('Beta feedback media picker is disabled.');
  const message = mapImagePickerError(error);
  assert.ok(message.includes('desabilitada'));
});

test('mapImagePickerError mapeia not implemented', () => {
  const error = new Error('not implemented');
  const message = mapImagePickerError(error);
  assert.ok(message.includes('não está implementada'));
});

test('mapImagePickerError mapeia cancelled', () => {
  const error = new Error('cancelled');
  const message = mapImagePickerError(error);
  assert.ok(message.includes('cancelada'));
});

test('mapImagePickerError mapeia erro genérico', () => {
  const error = new Error('generic error');
  const message = mapImagePickerError(error);
  assert.ok(message.includes('Erro ao selecionar'));
});

test('validatePickedAsset aceita asset válido', () => {
  const asset = {
    id: 'asset-123',
    type: 'image',
    fileName: 'screenshot.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1024 * 1024,
    localUri: 'file:///tmp/screenshot.jpg',
  };

  const result = validatePickedAsset(asset);

  assert.strictEqual(result.valid, true);
  assert.strictEqual(result.error, undefined);
});

test('validatePickedAsset rejeita asset sem localUri', () => {
  const asset = {
    id: 'asset-123',
    type: 'image',
    fileName: 'screenshot.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1024 * 1024,
  };

  const result = validatePickedAsset(asset);

  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('inválido'));
});

test('validatePickedAsset rejeita asset sem fileName', () => {
  const asset = {
    id: 'asset-123',
    type: 'image',
    fileName: '',
    mimeType: 'image/jpeg',
    sizeBytes: 1024 * 1024,
    localUri: 'file:///tmp/screenshot.jpg',
  };

  const result = validatePickedAsset(asset);

  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('Nome de arquivo'));
});

test('validatePickedAsset rejeita asset sem mimeType', () => {
  const asset = {
    id: 'asset-123',
    type: 'image',
    fileName: 'screenshot.jpg',
    mimeType: '',
    sizeBytes: 1024 * 1024,
    localUri: 'file:///tmp/screenshot.jpg',
  };

  const result = validatePickedAsset(asset);

  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('Tipo de arquivo'));
});

test('validatePickedAsset rejeita tipo não suportado', () => {
  const asset = {
    id: 'asset-123',
    type: 'document',
    fileName: 'document.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024 * 1024,
    localUri: 'file:///tmp/document.pdf',
  };

  const result = validatePickedAsset(asset);

  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('não suportado'));
});

test('validatePickedAsset rejeita imagem muito grande', () => {
  const asset = {
    id: 'asset-123',
    type: 'image',
    fileName: 'huge.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 20 * 1024 * 1024, // 20 MB
    localUri: 'file:///tmp/huge.jpg',
  };

  const result = validatePickedAsset(asset);

  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('muito grande'));
});

test('validatePickedAsset rejeita vídeo muito grande', () => {
  const asset = {
    id: 'asset-123',
    type: 'video',
    fileName: 'huge.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 100 * 1024 * 1024, // 100 MB
    localUri: 'file:///tmp/huge.mp4',
  };

  const result = validatePickedAsset(asset);

  assert.strictEqual(result.valid, false);
  assert.ok(result.error.includes('muito grande'));
});

test('validatePickedAsset aceita vídeo válido', () => {
  const asset = {
    id: 'asset-123',
    type: 'video',
    fileName: 'video.mp4',
    mimeType: 'video/mp4',
    sizeBytes: 10 * 1024 * 1024, // 10 MB
    localUri: 'file:///tmp/video.mp4',
  };

  const result = validatePickedAsset(asset);

  assert.strictEqual(result.valid, true);
});

test('validatePickedAsset aceita PNG', () => {
  const asset = {
    id: 'asset-123',
    type: 'image',
    fileName: 'screenshot.png',
    mimeType: 'image/png',
    sizeBytes: 1024 * 1024,
    localUri: 'file:///tmp/screenshot.png',
  };

  const result = validatePickedAsset(asset);

  assert.strictEqual(result.valid, true);
});

test('validatePickedAsset aceita WebP', () => {
  const asset = {
    id: 'asset-123',
    type: 'image',
    fileName: 'screenshot.webp',
    mimeType: 'image/webp',
    sizeBytes: 1024 * 1024,
    localUri: 'file:///tmp/screenshot.webp',
  };

  const result = validatePickedAsset(asset);

  assert.strictEqual(result.valid, true);
});
