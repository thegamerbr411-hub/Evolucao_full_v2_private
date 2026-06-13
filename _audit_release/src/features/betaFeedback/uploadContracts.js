// src/features/betaFeedback/uploadContracts.js

/**
 * Upload contracts and stubs for Beta Feedback Phase 4.
 * This file contains safe stubs that throw explicit errors.
 * Real Firebase Storage integration will be added in a future PR.
 */

import {
  BETA_FEEDBACK_LIMITS,
} from './constants.js';

/**
 * Attachment metadata structure (not implemented yet)
 * @typedef {Object} BetaFeedbackAttachment
 * @property {string} id - Unique attachment ID
 * @property {'image'|'video'} type - Attachment type
 * @property {string} fileName - Original file name
 * @property {string} mimeType - MIME type (image/jpeg, video/mp4, etc.)
 * @property {number} sizeBytes - File size in bytes
 * @property {string} localUri - Local URI from device
 * @property {string} storagePath - Path in Firebase Storage
 * @property {string} [downloadUrl] - Temporary download URL after upload
 * @property {string} [thumbnailPath] - Thumbnail path (for video)
 * @property {number} [durationMs] - Video duration in milliseconds
 * @property {number} [width] - Image/video width
 * @property {number} [height] - Image/video height
 * @property {string} uploadedAt - ISO timestamp
 */

/**
 * Upload result structure (not implemented yet)
 * @typedef {Object} UploadResult
 * @property {boolean} success - Whether upload succeeded
 * @property {BetaFeedbackAttachment} [attachment] - Attachment metadata if successful
 * @property {Error} [error] - Error if failed
 * @property {number} [progress] - Upload progress (0-1)
 */

/**
 * Generate storage path for attachment (deterministic, no Firebase call)
 * @param {string} userId - User ID
 * @param {string} feedbackId - Feedback ID
 * @param {string} attachmentId - Attachment ID
 * @param {string} fileName - Original file name
 * @returns {string} Storage path
 */
export function generateStoragePath(userId, feedbackId, attachmentId, fileName) {
  return `beta-feedback/${userId}/${feedbackId}/${attachmentId}-${fileName}`;
}

/**
 * Build minimal attachment metadata (no Firebase call)
 * @param {Object} params
 * @param {string} params.id - Attachment ID
 * @param {'image'|'video'} params.type - Attachment type
 * @param {string} params.fileName - File name
 * @param {string} params.mimeType - MIME type
 * @param {number} params.sizeBytes - File size
 * @param {string} params.localUri - Local URI
 * @param {string} params.storagePath - Storage path
 * @returns {BetaFeedbackAttachment} Attachment metadata
 */
export function buildAttachmentMetadata({
  id,
  type,
  fileName,
  mimeType,
  sizeBytes,
  localUri,
  storagePath,
}) {
  return {
    id,
    type,
    fileName,
    mimeType,
    sizeBytes,
    localUri,
    storagePath,
    uploadedAt: new Date().toISOString(),
  };
}

/**
 * Validate attachment candidate (no Firebase call)
 * @param {Object} candidate
 * @param {string} candidate.fileName - File name
 * @param {string} candidate.mimeType - MIME type
 * @param {number} candidate.sizeBytes - File size
 * @param {number} currentCount - Current number of attachments
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validateAttachmentCandidate({
  fileName,
  mimeType,
  sizeBytes,
}, currentCount = 0) {
  if (!fileName || fileName.trim().length === 0) {
    return { valid: false, error: 'Nome de arquivo é obrigatório' };
  }

  if (!mimeType || mimeType.trim().length === 0) {
    return { valid: false, error: 'MIME type é obrigatório' };
  }

  if (currentCount >= BETA_FEEDBACK_LIMITS.MAX_ATTACHMENTS_PER_REPORT) {
    return {
      valid: false,
      error: `Máximo de ${BETA_FEEDBACK_LIMITS.MAX_ATTACHMENTS_PER_REPORT} anexos por feedback`,
    };
  }

  const isImage = mimeType.startsWith('image/');
  const isVideo = mimeType.startsWith('video/');

  if (!isImage && !isVideo) {
    return { valid: false, error: 'Tipo de arquivo não suportado (apenas imagem ou vídeo)' };
  }

  if (isImage && sizeBytes > BETA_FEEDBACK_LIMITS.MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `Imagem muito grande (máximo ${BETA_FEEDBACK_LIMITS.MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB)`,
    };
  }

  if (isVideo && sizeBytes > BETA_FEEDBACK_LIMITS.MAX_VIDEO_SIZE_BYTES) {
    return {
      valid: false,
      error: `Vídeo muito grande (máximo ${BETA_FEEDBACK_LIMITS.MAX_VIDEO_SIZE_BYTES / (1024 * 1024)} MB)`,
    };
  }

  return { valid: true };
}

/**
 * Create not-implemented upload service (safe stub)
 * @returns {Object} Upload service stub
 */
export function createNotImplementedUploadService() {
  return {
    /**
     * Upload attachment (not implemented)
     * @throws {Error} Always throws "not implemented"
     */
    async uploadAttachment() {
      throw new Error('Beta feedback media upload is not implemented yet.');
    },

    /**
     * Delete attachment (not implemented)
     * @throws {Error} Always throws "not implemented"
     */
    async deleteAttachment() {
      throw new Error('Beta feedback media upload is not implemented yet.');
    },

    /**
     * Get download URL (not implemented)
     * @throws {Error} Always throws "not implemented"
     */
    async getDownloadUrl() {
      throw new Error('Beta feedback media upload is not implemented yet.');
    },
  };
}

/**
 * Feature flag check for upload (not implemented yet)
 * @returns {boolean} Always false until implemented
 */
export function isUploadEnabled() {
  return false;
}
