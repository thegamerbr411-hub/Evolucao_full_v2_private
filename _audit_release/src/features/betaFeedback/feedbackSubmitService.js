// src/features/betaFeedback/feedbackSubmitService.js

/**
 * Firestore submit service for Beta Feedback.
 * This file provides a service for submitting feedback reports to Firestore.
 * Submit is disabled by default behind EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_SUBMIT flag.
 */

import { db } from '../../services/firebase.js';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  validateFeedbackDraft,
  validateAttachmentCandidate,
} from './validation.js';

/**
 * Check if submit is enabled via environment flag
 * @returns {boolean} Always false until implemented
 */
export function isSubmitEnabled() {
  const flag = process.env.EXPO_PUBLIC_ENABLE_BETA_FEEDBACK_SUBMIT;
  return String(flag || '').trim() === '1';
}

/**
 * Create submit service with dependencies
 * @param {Object} dependencies
 * @param {Object} dependencies.db - Firestore instance
 * @param {Object} dependencies.auth - Auth instance
 * @returns {Object} Submit service
 */
export function createSubmitService({ db: firestoreDb, auth } = {}) {
  return {
    /**
     * Submit feedback report to Firestore
     * @param {Object} params
     * @param {string} params.userId - User ID
     * @param {Object} params.draft - Feedback draft
     * @param {Object[]} params.attachments - Attachment metadata
     * @returns {Promise<Object>} Submit result
     * @throws {Error} Throws "disabled" if flag is false
     */
    async submitFeedback({ userId, draft, attachments }) {
      if (!isSubmitEnabled()) {
        throw new Error('Beta feedback submit is disabled.');
      }

      if (!firestoreDb) {
        throw new Error('Firestore not configured.');
      }

      // Validate user ownership
      if (auth && auth.currentUser && auth.currentUser.uid !== userId) {
        throw new Error('User ID mismatch.');
      }

      // Validate draft
      const draftValidation = validateFeedbackDraft(draft);
      if (draftValidation.length > 0) {
        throw new Error(`Draft validation failed: ${draftValidation.map(e => e.message).join(', ')}`);
      }

      // Validate attachments
      for (const attachment of attachments) {
        const attachmentValidation = validateAttachmentCandidate(attachment);
        if (!attachmentValidation.valid) {
          throw new Error(`Attachment validation failed: ${attachmentValidation.error}`);
        }
      }

      // Generate feedback ID
      const feedbackId = `feedback-${userId}-${Date.now()}`;

      // Build feedback document
      const feedbackDoc = {
        id: feedbackId,
        userId,
        type: draft.type,
        severity: draft.severity,
        title: draft.title,
        description: draft.description,
        screenName: draft.screenName || null,
        stepsToReproduce: draft.stepsToReproduce || null,
        expectedResult: draft.expectedResult || null,
        actualResult: draft.actualResult || null,
        attachments: attachments.map(a => ({
          id: a.id,
          type: a.type,
          fileName: a.fileName,
          mimeType: a.mimeType,
          sizeBytes: a.sizeBytes,
          storagePath: a.storagePath || null,
          downloadUrl: a.downloadUrl || null,
        })),
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        appVersion: __APP_VERSION__ || null,
        buildNumber: __BUILD_NUMBER__ || null,
        platform: __PLATFORM__ || null,
        deviceModel: __DEVICE_MODEL__ || null,
        osVersion: __OS_VERSION__ || null,
      };

      try {
        const feedbackRef = doc(firestoreDb, 'betaFeedback', feedbackId);
        await setDoc(feedbackRef, feedbackDoc);

        return {
          success: true,
          feedbackId,
          status: 'open',
        };
      } catch (error) {
        throw new Error(`Failed to submit feedback: ${error.message}`);
      }
    },

    /**
     * Update feedback status
     * @param {string} feedbackId - Feedback ID
     * @param {string} status - New status
     * @returns {Promise<void>}
     * @throws {Error} Throws "disabled" if flag is false
     */
    async updateStatus(feedbackId, status) {
      if (!isSubmitEnabled()) {
        throw new Error('Beta feedback submit is disabled.');
      }

      if (!firestoreDb) {
        throw new Error('Firestore not configured.');
      }

      try {
        const feedbackRef = doc(firestoreDb, 'betaFeedback', feedbackId);
        await setDoc(feedbackRef, {
          status,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (error) {
        throw new Error(`Failed to update status: ${error.message}`);
      }
    },
  };
}

/**
 * Map submit error to user-friendly message
 * @param {Error} error
 * @returns {string} User-friendly error message
 */
export function mapSubmitError(error) {
  if (error.message.includes('disabled')) {
    return 'Envio está desabilitado.';
  }
  if (error.message.includes('not configured')) {
    return 'Firestore não configurado.';
  }
  if (error.message.includes('validation failed')) {
    return 'Validação falhou.';
  }
  if (error.message.includes('User ID mismatch')) {
    return 'Erro de autenticação.';
  }
  return 'Erro ao enviar feedback.';
}
