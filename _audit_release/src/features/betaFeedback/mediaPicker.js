// src/features/betaFeedback/mediaPicker.js

/**
 * Media picker wrapper for Beta Feedback.
 * This file provides a safe wrapper for selecting media files.
 * Real image picker integration will be added in a future phase.
 */

import {
  isMediaPickerEnabled,
  isMediaPickerAvailable,
  requestMediaLibraryPermission,
  mapPermissionError,
} from './mediaPermissions.js';

/**
 * Normalized asset structure (not implemented yet)
 * @typedef {Object} NormalizedAsset
 * @property {string} id - Unique asset ID
 * @property {'image'|'video'} type - Asset type
 * @property {string} fileName - File name
 * @property {string} mimeType - MIME type
 * @property {number} sizeBytes - File size in bytes
 * @property {string} localUri - Local URI
 * @property {number} [width] - Width (for image/video)
 * @property {number} [height] - Height (for image/video)
 * @property {number} [durationMs] - Duration in milliseconds (for video)
 */

/**
 * Pick media for beta feedback (not implemented yet)
 * @param {Object} options
 * @param {number} [options.maxCount=5] - Maximum number of assets
 * @returns {Promise<NormalizedAsset[]>}
 * @throws {Error} Always throws "not implemented" or "disabled"
 */
export async function pickBetaFeedbackMedia({ maxCount = 5 } = {}) {
  if (!isMediaPickerAvailable()) {
    throw new Error('Media picker is not available.');
  }

  if (!isMediaPickerEnabled()) {
    throw new Error('Beta feedback media picker is disabled.');
  }

  throw new Error('Beta feedback media picker is not implemented yet.');
}

/**
 * Normalize picked asset (not implemented yet)
 * @param {Object} asset - Raw asset from image picker
 * @returns {NormalizedAsset} Normalized asset
 */
export function normalizePickedAsset(asset) {
  // Placeholder implementation
  return {
    id: asset.id || 'unknown',
    type: asset.type || 'image',
    fileName: asset.fileName || 'unknown',
    mimeType: asset.mimeType || 'image/jpeg',
    sizeBytes: asset.sizeBytes || 0,
    localUri: asset.localUri || '',
    width: asset.width,
    height: asset.height,
    durationMs: asset.durationMs,
  };
}

/**
 * Map image picker error to user-friendly message
 * @param {Error} error
 * @returns {string} User-friendly error message
 */
export function mapImagePickerError(error) {
  if (error.message.includes('disabled')) {
    return 'Seleção de mídia está desabilitada.';
  }
  if (error.message.includes('not implemented')) {
    return 'Seleção de mídia não está implementada ainda.';
  }
  if (error.message.includes('cancelled')) {
    return 'Seleção cancelada.';
  }
  return 'Erro ao selecionar mídia.';
}

/**
 * Check if asset is valid for beta feedback
 * @param {NormalizedAsset} asset
 * @returns {{valid: boolean, error?: string}} Validation result
 */
export function validatePickedAsset(asset) {
  if (!asset || !asset.localUri) {
    return { valid: false, error: 'Arquivo inválido.' };
  }

  if (!asset.fileName || asset.fileName.trim().length === 0) {
    return { valid: false, error: 'Nome de arquivo é obrigatório.' };
  }

  if (!asset.mimeType || asset.mimeType.trim().length === 0) {
    return { valid: false, error: 'Tipo de arquivo é obrigatório.' };
  }

  const isImage = asset.mimeType.startsWith('image/');
  const isVideo = asset.mimeType.startsWith('video/');

  if (!isImage && !isVideo) {
    return { valid: false, error: 'Tipo de arquivo não suportado (apenas imagem ou vídeo).' };
  }

  const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
  const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 MB

  if (isImage && asset.sizeBytes > MAX_IMAGE_SIZE) {
    return { valid: false, error: 'Imagem muito grande (máximo 10 MB).' };
  }

  if (isVideo && asset.sizeBytes > MAX_VIDEO_SIZE) {
    return { valid: false, error: 'Vídeo muito grande (máximo 50 MB).' };
  }

  return { valid: true };
}
