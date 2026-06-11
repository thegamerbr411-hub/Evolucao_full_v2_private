// src/features/betaFeedback/constants.js

import { BETA_FEEDBACK_TYPES, BETA_FEEDBACK_SEVERITIES, BETA_FEEDBACK_STATUSES } from './types.js';

export const BETA_FEEDBACK_TYPE_LABELS = {
  visual_bug: 'Bug visual',
  design_bug: 'Bug de design',
  functional_bug: 'Bug funcional',
  suggestion: 'Sugestão',
  improvement: 'Melhoria',
  other: 'Outro',
};

export const BETA_FEEDBACK_SEVERITY_LABELS = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

export const BETA_FEEDBACK_STATUS_LABELS = {
  new: 'Novo',
  triage: 'Em análise',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  duplicate: 'Duplicado',
  not_reproducible: 'Não reproduzido',
};

// Limites decididos por Felipe
export const BETA_FEEDBACK_LIMITS = {
  MAX_ATTACHMENTS_PER_REPORT: 5,
  MAX_IMAGE_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_VIDEO_SIZE_BYTES: 50 * 1024 * 1024, // 50 MB
  SUPPORTED_IMAGE_MIME_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  SUPPORTED_VIDEO_MIME_TYPES: ['video/mp4', 'video/quicktime', 'video/webm'],
};

// Firebase Storage path
export const BETA_FEEDBACK_STORAGE_PATH = 'beta-feedback/{uid}/{reportId}/{attachmentId}';

// Firestore collection
export const BETA_FEEDBACK_COLLECTION = 'betaFeedbackReports';
