import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase.js';
import { logCriticalError } from './loggingService.js';
import { logEvent } from '../core/logger.js';
import { parseWorkoutText } from './aiWorkoutParser';

export const parseWorkout = async ({ userId, text, imageUri, userAiUsageToday = 0 }) => {
  const localFallback = () => parseWorkoutText(text);

  try {
    if (!functions) {
      return localFallback();
    }
    if (Number(userAiUsageToday || 0) > 5) {
      throw new Error('Limite diário atingido');
    }

    const callable = httpsCallable(functions, 'parseWorkout');
    const response = await callable({ userId, text, imageUri });
    logEvent('ai_used');

    const parsed = response?.data;
    if (Array.isArray(parsed?.exercises) && parsed.exercises.length > 0) {
      return parsed;
    }

    return localFallback();
  } catch (error) {
    await logCriticalError('aiBackendService.parseWorkout', error, {
      userId: String(userId || ''),
    });
    return localFallback();
  }
};
