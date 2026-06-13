// src/features/betaFeedback/uploadService.js

/**
 * Upload service for Beta Feedback with dependency injection.
 * This file provides an injectable upload service with Firebase Storage integration.
 * Upload is disabled by default behind EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_UPLOAD flag.
 */

import {
  generateStoragePath,
  buildAttachmentMetadata,
} from './uploadContracts.js';
import { storage } from '../../services/firebase.js';

// Firebase Storage functions (lazy import to avoid Node.js test issues)
let ref, uploadBytesResumable, getDownloadURL, deleteObject;

function getFirebaseStorageFunctions() {
  if (!ref) {
    try {
      const firebaseStorage = require('firebase/storage');
      ref = firebaseStorage.ref;
      uploadBytesResumable = firebaseStorage.uploadBytesResumable;
      getDownloadURL = firebaseStorage.getDownloadURL;
      deleteObject = firebaseStorage.deleteObject;
    } catch (error) {
      // Not available in test environment
      ref = () => ({});
      uploadBytesResumable = () => ({ on: () => {} });
      getDownloadURL = async () => '';
      deleteObject = async () => {};
    }
  }
  return { ref, uploadBytesResumable, getDownloadURL, deleteObject };
}

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
     * Upload attachment with Firebase Storage
     * @param {Object} params
     * @param {string} params.userId - User ID
     * @param {string} params.feedbackId - Feedback ID
     * @param {Object} params.attachment - Attachment metadata
     * @returns {Promise<Object>} Upload result
     * @throws {Error} Throws "disabled" if flag is false
     */
    async uploadAttachment({ userId, feedbackId, attachment }) {
      if (!isUploadEnabled()) {
        throw new Error('Beta feedback upload is disabled.');
      }

      if (!storage) {
        throw new Error('Firebase Storage not configured.');
      }

      const validation = validateAttachmentForUpload(attachment);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const storagePath = generateStoragePath({ userId, feedbackId, attachment });
      const { ref: storageRefFn } = getFirebaseStorageFunctions();
      const storageRef = storageRefFn(storage, storagePath);

      try {
        // Fetch the file from local URI
        const response = await fetch(attachment.localUri);
        const blob = await response.blob();

        // Upload with progress tracking
        const { uploadBytesResumable: uploadFn } = getFirebaseStorageFunctions();
        const uploadTask = uploadFn(storageRef, blob);

        return new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot) => {
              const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              if (onProgress) {
                onProgress(progress);
              }
            },
            (error) => {
              reject(new Error(`Upload failed: ${error.message}`));
            },
            async () => {
              try {
                const { getDownloadURL: getDownloadUrlFn } = getFirebaseStorageFunctions();
                const downloadUrl = await getDownloadUrlFn(storageRef);
                const metadata = buildAttachmentMetadata({
                  userId,
                  feedbackId,
                  attachment,
                  storagePath,
                  downloadUrl,
                });
                resolve(metadata);
              } catch (error) {
                reject(new Error(`Failed to get download URL: ${error.message}`));
              }
            }
          );
        });
      } catch (error) {
        throw new Error(`Failed to fetch file: ${error.message}`);
      }
    },

    /**
     * Delete attachment from Firebase Storage
     * @param {string} storagePath - Storage path
     * @returns {Promise<void>}
     * @throws {Error} Throws "disabled" if flag is false
     */
    async deleteAttachment(storagePath) {
      if (!isUploadEnabled()) {
        throw new Error('Beta feedback upload is disabled.');
      }

      if (!storage) {
        throw new Error('Firebase Storage not configured.');
      }

      try {
        const { ref: storageRefFn, deleteObject: deleteFn } = getFirebaseStorageFunctions();
        const storageRef = storageRefFn(storage, storagePath);
        await deleteFn(storageRef);
      } catch (error) {
        throw new Error(`Failed to delete attachment: ${error.message}`);
      }
    },

    /**
     * Get download URL from Firebase Storage
     * @param {string} storagePath - Storage path
     * @returns {Promise<string>} Download URL
     * @throws {Error} Throws "disabled" if flag is false
     */
    async getDownloadUrl(storagePath) {
      if (!isUploadEnabled()) {
        throw new Error('Beta feedback upload is disabled.');
      }

      if (!storage) {
        throw new Error('Firebase Storage not configured.');
      }

      try {
        const { ref: storageRefFn, getDownloadURL: getDownloadUrlFn } = getFirebaseStorageFunctions();
        const storageRef = storageRefFn(storage, storagePath);
        const url = await getDownloadUrlFn(storageRef);
        return url;
      } catch (error) {
        throw new Error(`Failed to get download URL: ${error.message}`);
      }
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
