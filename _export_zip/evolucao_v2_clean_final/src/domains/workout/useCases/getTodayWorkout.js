import { buildTodayWorkout } from '../workoutService.js';
import { DomainError } from '../../../core/errors/DomainError.js';
import { logError } from '../../../core/logger.js';

export function getTodayWorkoutUseCase(input) {
  try {
    return buildTodayWorkout(input);
  } catch (error) {
    if (error instanceof DomainError) {
      logError(error, { useCase: 'getTodayWorkoutUseCase', screen: 'AppContext', action: 'getTodayWorkout' });
      return { error: error.code };
    }

    logError(error, { useCase: 'getTodayWorkoutUseCase', screen: 'AppContext', action: 'getTodayWorkout' });
    return { error: 'UNKNOWN_ERROR' };
  }
}
