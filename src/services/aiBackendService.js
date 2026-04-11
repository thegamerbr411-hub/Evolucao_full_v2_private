import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase.js';
import { logCriticalError } from './loggingService.js';
import { logEvent } from '../core/logger.js';

export const parseWorkout = async ({ userId, text, imageUri, userAiUsageToday = 0 }) => {
  try {
    if (!functions) {
      return { name: 'Treino importado', exercises: [] };
    }
    if (Number(userAiUsageToday || 0) > 5) {
      throw new Error('Limite diário atingido');
    }

    const callable = httpsCallable(functions, 'parseWorkout');
    const response = await callable({ userId, text, imageUri });
    logEvent('ai_used');
    return response?.data || { name: 'Treino importado', exercises: [] };
  } catch (error) {
    await logCriticalError('aiBackendService.parseWorkout', error, {
      userId: String(userId || ''),
    });
    return { name: 'Treino importado', exercises: [] };
  }
};
