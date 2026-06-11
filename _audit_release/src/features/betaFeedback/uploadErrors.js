// src/features/betaFeedback/uploadErrors.js

/**
 * Upload error definitions for Beta Feedback.
 * This file defines typed errors for upload operations.
 */

/**
 * Upload error codes
 * @enum {string}
 */
export const UploadErrorCode = {
  DISABLED: 'UPLOAD_DISABLED',
  NOT_IMPLEMENTED: 'UPLOAD_NOT_IMPLEMENTED',
  STORAGE_NOT_PROVIDED: 'STORAGE_NOT_PROVIDED',
  INVALID_ATTACHMENT: 'INVALID_ATTACHMENT',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  UNSUPPORTED_TYPE: 'UNSUPPORTED_TYPE',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Create upload error
 * @param {string} code - Error code
 * @param {string} message - Error message
 * @param {Error} [originalError] - Original error
 * @returns {Object} Upload error
 */
export function createUploadError(code, message, originalError) {
  const error = new Error(message);
  error.code = code;
  error.originalError = originalError;
  return error;
}

/**
 * Check if error is upload error
 * @param {Error} error
 * @returns {boolean}
 */
export function isUploadError(error) {
  return Boolean(error && error.code && Object.values(UploadErrorCode).includes(error.code));
}

/**
 * Get user-friendly message for upload error
 * @param {Error} error
 * @returns {string}
 */
export function getUploadErrorMessage(error) {
  if (!isUploadError(error)) {
    return 'Erro desconhecido ao fazer upload.';
  }

  switch (error.code) {
    case UploadErrorCode.DISABLED:
      return 'Upload está desabilitado.';
    case UploadErrorCode.NOT_IMPLEMENTED:
      return 'Upload não está implementado ainda.';
    case UploadErrorCode.STORAGE_NOT_PROVIDED:
      return 'Firebase Storage não configurado.';
    case UploadErrorCode.INVALID_ATTACHMENT:
      return 'Anexo inválido.';
    case UploadErrorCode.FILE_TOO_LARGE:
      return 'Arquivo muito grande.';
    case UploadErrorCode.UNSUPPORTED_TYPE:
      return 'Tipo de arquivo não suportado.';
    case UploadErrorCode.PERMISSION_DENIED:
      return 'Permissão negada.';
    case UploadErrorCode.NETWORK_ERROR:
      return 'Erro de rede.';
    default:
      return 'Erro ao fazer upload.';
  }
}
