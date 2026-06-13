// src/features/betaFeedback/validation.js

import { BETA_FEEDBACK_LIMITS } from './constants.js';

/**
 * Valida rascunho de feedback antes de enviar
 */
export function validateFeedbackDraft(draft) {
  const errors = [];

  if (!draft.title || draft.title.trim().length === 0) {
    errors.push({ field: 'title', message: 'Título é obrigatório' });
  }

  if (!draft.description || draft.description.trim().length === 0) {
    errors.push({ field: 'description', message: 'Descrição é obrigatória' });
  }

  if (draft.attachments.length > BETA_FEEDBACK_LIMITS.MAX_ATTACHMENTS_PER_REPORT) {
    errors.push({
      field: 'attachments',
      message: `Máximo de ${BETA_FEEDBACK_LIMITS.MAX_ATTACHMENTS_PER_REPORT} anexos por feedback`,
    });
  }

  // Validar cada anexo
  draft.attachments.forEach((attachment, index) => {
    const attachmentErrors = validateAttachmentCandidate(attachment);
    attachmentErrors.forEach((error) => {
      errors.push({
        field: `attachments[${index}].${error.field}`,
        message: error.message,
      });
    });
  });

  return errors;
}

/**
 * Valida candidato de anexo antes de upload
 */
export function validateAttachmentCandidate(file) {
  const errors = [];

  if (!file.name || file.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Nome do arquivo é obrigatório' });
  }

  if (!file.type || file.type.trim().length === 0) {
    errors.push({ field: 'type', message: 'Tipo MIME é obrigatório' });
  }

  if (file.size <= 0) {
    errors.push({ field: 'size', message: 'Arquivo vazio' });
  }

  const isImage = isSupportedImageMimeType(file.type);
  const isVideo = isSupportedVideoMimeType(file.type);

  if (!isImage && !isVideo) {
    errors.push({ field: 'type', message: 'Tipo de arquivo não suportado' });
  }

  if (isImage && file.size > BETA_FEEDBACK_LIMITS.MAX_IMAGE_SIZE_BYTES) {
    errors.push({
      field: 'size',
      message: `Imagem muito grande (máximo ${formatBytes(BETA_FEEDBACK_LIMITS.MAX_IMAGE_SIZE_BYTES)})`,
    });
  }

  if (isVideo && file.size > BETA_FEEDBACK_LIMITS.MAX_VIDEO_SIZE_BYTES) {
    errors.push({
      field: 'size',
      message: `Vídeo muito grande (máximo ${formatBytes(BETA_FEEDBACK_LIMITS.MAX_VIDEO_SIZE_BYTES)})`,
    });
  }

  return errors;
}

/**
 * Verifica se MIME type é de imagem suportada
 */
export function isSupportedImageMimeType(mime) {
  return BETA_FEEDBACK_LIMITS.SUPPORTED_IMAGE_MIME_TYPES.includes(mime);
}

/**
 * Verifica se MIME type é de vídeo suportado
 */
export function isSupportedVideoMimeType(mime) {
  return BETA_FEEDBACK_LIMITS.SUPPORTED_VIDEO_MIME_TYPES.includes(mime);
}

/**
 * Formata bytes para legível
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
