// src/features/betaFeedback/uploadService.js

/**
 * Upload service for Beta Feedback with dependency injection.
 * This file provides an injectable upload service with mocked test coverage.
 * Real Firebase Storage integration will be added in a future phase.
 */

import {
  generateStoragePath,
  buildAttachmentMetadata,
} from './uploadContracts.js';

/**
 * Upload error types
 * @typedef {Object} UploadError
 * @property {string} code - Error code
 * @property {string} message - Error message
 * @property {Error} [originalError] - Original error
 */

/**
 * Upload progress callback
 * @typedef {Function} ProgressCallback
 * @param {number} progress - Progress (0-1)
 */

/**
 * Upload service dependencies
 * @typedef {Object} UploadServiceDependencies
 * @property {Object} storage - Firebase Storage instance (optional)
 * @property {Function} [onProgress] - Progress callback
 */

/**
 * Create upload service with dependencies
 * @param {UploadServiceDependencies} dependencies
 * @returns {Object} Upload service
 */
export function createUploadService({ storage, onProgress } = {}) {
  return {
    /**
     * Upload attachment (not implemented yet)
     * @param {Object} params
     * @param {string} params.userId - User ID
     * @param {string} params.feedbackId - Feedback ID
     * @param {Object} params.attachment - Attachment metadata
     * @returns {Promise<Object>} Upload result
     * @throws {Error} Always throws "not implemented" or "disabled"
     */
    async uploadAttachment({ userId, feedbackId, attachment }) {
      if (!isUploadEnabled()) {
        throw new Error('Beta feedback upload is disabled.');
      }

      if (!storage) {
        throw new Error('Firebase Storage not provided.');
      }

      throw new Error('Beta feedback upload is not implemented yet.');
    },

    /**
     * Delete attachment (not implemented yet)
     * @param {string} storagePath - Storage path
     * @returns {Promise<void>}
     * @throws {Error} Always throws "not implemented"
     */
    async deleteAttachment(storagePath) {
      if (!isUploadEnabled()) {
        throw new Error('Beta feedback upload is disabled.');
      }

      throw new Error('Beta feedback upload is not implemented yet.');
    },

    /**
     * Get download URL (not implemented yet)
     * @param {string} storagePath - Storage path
     * @returns {Promise<string>} Download URL
     * @throws {Error} Always throws "not implemented"
     */
    async getDownloadUrl(storagePath) {
      if (!isUploadEnabled()) {
        throw new Error('Beta feedback upload is disabled.');
      }

      throw new Error('Beta feedback upload is not implemented yet.');
    },
  };
}

/**
 * Check if upload is enabled via environment flag
 * @returns {boolean} Always false until implemented
 */
export function isUploadEnabled() {
  const flag = process.env.EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_UPLOAD;
  return String(flag || '').trim() === '1';
}

/**
 * Map upload error to user-friendly message
 * @param {Error} error
 * @returns {string} User-friendly error message
 */
export function mapUploadError(error) {
  if (error.message.includes('disabled')) {
    return 'Upload está desabilitado.';
  }
  if (error.message.includes('not implemented')) {
    return 'Upload não está implementado ainda.';
  }
  return 'Erro ao fazer upload.';
}

/**
 * Validate attachment before upload
 * @param {Object} attachment
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateAttachmentForUpload(attachment) {
  if (!attachment || !attachment.localUri) {
    return { valid: false, error: 'Anexo inválido.' };
  }

  if (!attachment.fileName || attachment.fileName.trim().length === 0) {
    return { valid: false, error: 'Nome de arquivo é obrigatório.' };
  }

  if (!attachment.mimeType || attachment.mimeType.trim().length === 0) {
    return { valid: false, error: 'Tipo de arquivo é obrigatório.' };
  }

  const isImage = attachment.mimeType.startsWith('image/');
  const isVideo = attachment.mimeType.startsWith('video/');

  if (!isImage && !isVideo) {
    return { valid: false, error: 'Tipo de arquivo não suportado.' };
  }

  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
  const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

  if (isImage && attachment.sizeBytes > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'Imagem muito grande (máximo 10 MB).' };
  }

  if (isVideo && attachment.sizeBytes > MAX_VIDEO_SIZE) {
    return { valid: false, error: 'Vídeo muito grande (máximo 50 MB).' };
  }

  return { valid: true };
}
