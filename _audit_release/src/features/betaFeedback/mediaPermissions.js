// src/features/betaFeedback/mediaPermissions.js

/**
 * Media permissions wrapper for Beta Feedback.
 * This file handles permission requests for media library access.
 * Real permission handling will be added in a future phase.
 */

/**
 * Check if media picker is enabled via environment flag
 * @returns {boolean} Always false until implemented
 */
export function isMediaPickerEnabled() {
  const flag = process.env.EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_MEDIA_PICKER;
  return String(flag || '').trim() === '1';
}

/**
 * Check if media picker is available (library installed)
 * @returns {boolean} True if expo-image-picker is available
 */
export function isMediaPickerAvailable() {
  // expo-image-picker is now installed, but disabled by default
  return true;
}

/**
 * Request media library permission (not implemented yet)
 * @returns {Promise<{granted: boolean, canAskAgain: boolean}>}
 * @throws {Error} Always throws "not implemented"
 */
export async function requestMediaLibraryPermission() {
  throw new Error('Beta feedback media picker permissions are not implemented yet.');
}

/**
 * Map permission error to user-friendly message
 * @param {Error} error
 * @returns {string} User-friendly error message
 */
export function mapPermissionError(error) {
  if (error.message.includes('not implemented')) {
    return 'Permissões de mídia não estão implementadas ainda.';
  }
  return 'Erro ao solicitar permissão de mídia.';
}
