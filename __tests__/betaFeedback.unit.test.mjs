// __tests__/betaFeedback.unit.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateFeedbackDraft,
  validateAttachmentCandidate,
  isSupportedImageMimeType,
  isSupportedVideoMimeType,
} from '../src/features/betaFeedback/validation.js';
import {
  isAdminUser,
  canCreateBetaFeedback,
  canReadBetaFeedback,
  canListAllBetaFeedback,
  canUpdateBetaFeedbackStatus,
  canAddAdminFeedbackNote,
  canViewFeedbackAttachment,
} from '../src/features/betaFeedback/permissions.js';
import { BETA_FEEDBACK_LIMITS } from '../src/features/betaFeedback/constants.js';

test('validateFeedbackDraft deve validar rascunho válido', () => {
  const draft = {
    userId: 'user-123',
    type: 'visual_bug',
    severity: 'medium',
    title: 'Bug na tela de treino',
    description: 'O botão não está visível',
    attachments: [],
  };

  const errors = validateFeedbackDraft(draft);
  assert.strictEqual(errors.length, 0);
});

test('validateFeedbackDraft deve rejeitar rascunho sem título', () => {
  const draft = {
    userId: 'user-123',
    type: 'visual_bug',
    severity: 'medium',
    title: '',
    description: 'O botão não está visível',
    attachments: [],
  };

  const errors = validateFeedbackDraft(draft);
  assert.ok(errors.length > 0);
  assert.ok(errors.some(e => e.field === 'title'));
});

test('validateFeedbackDraft deve rejeitar rascunho sem descrição', () => {
  const draft = {
    userId: 'user-123',
    type: 'visual_bug',
    severity: 'medium',
    title: 'Bug na tela de treino',
    description: '',
    attachments: [],
  };

  const errors = validateFeedbackDraft(draft);
  assert.ok(errors.length > 0);
  assert.ok(errors.some(e => e.field === 'description'));
});

test('validateFeedbackDraft deve rejeitar rascunho com muitos anexos', () => {
  const draft = {
    userId: 'user-123',
    type: 'visual_bug',
    severity: 'medium',
    title: 'Bug na tela de treino',
    description: 'O botão não está visível',
    attachments: Array(6).fill({
      name: 'test.jpg',
      type: 'image/jpeg',
      size: 1024,
    }),
  };

  const errors = validateFeedbackDraft(draft);
  assert.ok(errors.length > 0);
  assert.ok(errors.some(e => e.field === 'attachments'));
});

test('validateAttachmentCandidate deve validar anexo de imagem válido', () => {
  const file = {
    name: 'screenshot.jpg',
    type: 'image/jpeg',
    size: 1024 * 1024, // 1 MB
  };

  const errors = validateAttachmentCandidate(file);
  assert.strictEqual(errors.length, 0);
});

test('validateAttachmentCandidate deve rejeitar anexo sem nome', () => {
  const file = {
    name: '',
    type: 'image/jpeg',
    size: 1024,
  };

  const errors = validateAttachmentCandidate(file);
  assert.ok(errors.length > 0);
  assert.ok(errors.some(e => e.field === 'name'));
});

test('validateAttachmentCandidate deve rejeitar anexo de imagem muito grande', () => {
  const file = {
    name: 'big.jpg',
    type: 'image/jpeg',
    size: BETA_FEEDBACK_LIMITS.MAX_IMAGE_SIZE_BYTES + 1,
  };

  const errors = validateAttachmentCandidate(file);
  assert.ok(errors.length > 0);
  assert.ok(errors.some(e => e.field === 'size'));
});

test('validateAttachmentCandidate deve rejeitar anexo de vídeo muito grande', () => {
  const file = {
    name: 'big.mp4',
    type: 'video/mp4',
    size: BETA_FEEDBACK_LIMITS.MAX_VIDEO_SIZE_BYTES + 1,
  };

  const errors = validateAttachmentCandidate(file);
  assert.ok(errors.length > 0);
  assert.ok(errors.some(e => e.field === 'size'));
});

test('isSupportedImageMimeType deve aceitar MIME types de imagem suportados', () => {
  assert.strictEqual(isSupportedImageMimeType('image/jpeg'), true);
  assert.strictEqual(isSupportedImageMimeType('image/jpg'), true);
  assert.strictEqual(isSupportedImageMimeType('image/png'), true);
  assert.strictEqual(isSupportedImageMimeType('image/webp'), true);
});

test('isSupportedImageMimeType deve rejeitar MIME types não suportados', () => {
  assert.strictEqual(isSupportedImageMimeType('image/gif'), false);
  assert.strictEqual(isSupportedImageMimeType('application/pdf'), false);
  assert.strictEqual(isSupportedImageMimeType('video/mp4'), false);
});

test('isSupportedVideoMimeType deve aceitar MIME types de vídeo suportados', () => {
  assert.strictEqual(isSupportedVideoMimeType('video/mp4'), true);
  assert.strictEqual(isSupportedVideoMimeType('video/quicktime'), true);
  assert.strictEqual(isSupportedVideoMimeType('video/webm'), true);
});

test('isSupportedVideoMimeType deve rejeitar MIME types não suportados', () => {
  assert.strictEqual(isSupportedVideoMimeType('video/avi'), false);
  assert.strictEqual(isSupportedVideoMimeType('image/jpeg'), false);
  assert.strictEqual(isSupportedVideoMimeType('application/pdf'), false);
});

test('isAdminUser deve retornar false para usuário comum', () => {
  const betaUser = { id: 'beta-123', email: 'beta@example.com', role: 'user' };
  assert.strictEqual(isAdminUser(betaUser), false);
});

test('isAdminUser deve retornar false para usuário null', () => {
  assert.strictEqual(isAdminUser(null), false);
});

test('canCreateBetaFeedback deve permitir usuário autenticado criar feedback', () => {
  const betaUser = { id: 'beta-123', email: 'beta@example.com', role: 'user' };
  assert.strictEqual(canCreateBetaFeedback(betaUser), true);
});

test('canCreateBetaFeedback deve bloquear usuário não autenticado', () => {
  assert.strictEqual(canCreateBetaFeedback(null), false);
});

test('canReadBetaFeedback deve permitir usuário ler feedback próprio', () => {
  const betaUser = { id: 'beta-123', email: 'beta@example.com', role: 'user' };
  const mockReport = {
    id: 'report-1',
    userId: 'beta-123',
    type: 'visual_bug',
    severity: 'medium',
    status: 'new',
    title: 'Bug',
    description: 'Test',
    attachments: [],
    createdAt: '2026-06-11',
    updatedAt: '2026-06-11',
  };
  assert.strictEqual(canReadBetaFeedback(betaUser, mockReport), true);
});

test('canReadBetaFeedback deve bloquear usuário ler feedback de outro', () => {
  const otherUser = { id: 'other-456', email: 'other@example.com', role: 'user' };
  const mockReport = {
    id: 'report-1',
    userId: 'beta-123',
    type: 'visual_bug',
    severity: 'medium',
    status: 'new',
    title: 'Bug',
    description: 'Test',
    attachments: [],
    createdAt: '2026-06-11',
    updatedAt: '2026-06-11',
  };
  assert.strictEqual(canReadBetaFeedback(otherUser, mockReport), false);
});

test('canReadBetaFeedback deve bloquear usuário não autenticado', () => {
  const mockReport = {
    id: 'report-1',
    userId: 'beta-123',
    type: 'visual_bug',
    severity: 'medium',
    status: 'new',
    title: 'Bug',
    description: 'Test',
    attachments: [],
    createdAt: '2026-06-11',
    updatedAt: '2026-06-11',
  };
  assert.strictEqual(canReadBetaFeedback(null, mockReport), false);
});

test('canListAllBetaFeedback deve bloquear usuário comum listar todos', () => {
  const betaUser = { id: 'beta-123', email: 'beta@example.com', role: 'user' };
  assert.strictEqual(canListAllBetaFeedback(betaUser), false);
});

test('canListAllBetaFeedback deve bloquear usuário não autenticado', () => {
  assert.strictEqual(canListAllBetaFeedback(null), false);
});

test('canUpdateBetaFeedbackStatus deve bloquear usuário comum mudar status', () => {
  const betaUser = { id: 'beta-123', email: 'beta@example.com', role: 'user' };
  assert.strictEqual(canUpdateBetaFeedbackStatus(betaUser), false);
});

test('canUpdateBetaFeedbackStatus deve bloquear usuário não autenticado', () => {
  assert.strictEqual(canUpdateBetaFeedbackStatus(null), false);
});

test('canAddAdminFeedbackNote deve bloquear usuário comum adicionar nota', () => {
  const betaUser = { id: 'beta-123', email: 'beta@example.com', role: 'user' };
  assert.strictEqual(canAddAdminFeedbackNote(betaUser), false);
});

test('canAddAdminFeedbackNote deve bloquear usuário não autenticado', () => {
  assert.strictEqual(canAddAdminFeedbackNote(null), false);
});

test('canViewFeedbackAttachment deve permitir usuário ver anexo próprio', () => {
  const betaUser = { id: 'beta-123', email: 'beta@example.com', role: 'user' };
  const mockReport = {
    id: 'report-1',
    userId: 'beta-123',
    type: 'visual_bug',
    severity: 'medium',
    status: 'new',
    title: 'Bug',
    description: 'Test',
    attachments: [],
    createdAt: '2026-06-11',
    updatedAt: '2026-06-11',
  };
  assert.strictEqual(canViewFeedbackAttachment(betaUser, mockReport), true);
});

test('canViewFeedbackAttachment deve bloquear usuário ver anexo de outro', () => {
  const otherUser = { id: 'other-456', email: 'other@example.com', role: 'user' };
  const mockReport = {
    id: 'report-1',
    userId: 'beta-123',
    type: 'visual_bug',
    severity: 'medium',
    status: 'new',
    title: 'Bug',
    description: 'Test',
    attachments: [],
    createdAt: '2026-06-11',
    updatedAt: '2026-06-11',
  };
  assert.strictEqual(canViewFeedbackAttachment(otherUser, mockReport), false);
});

test('canViewFeedbackAttachment deve bloquear usuário não autenticado', () => {
  const mockReport = {
    id: 'report-1',
    userId: 'beta-123',
    type: 'visual_bug',
    severity: 'medium',
    status: 'new',
    title: 'Bug',
    description: 'Test',
    attachments: [],
    createdAt: '2026-06-11',
    updatedAt: '2026-06-11',
  };
  assert.strictEqual(canViewFeedbackAttachment(null, mockReport), false);
});
