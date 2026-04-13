import { getRecoveryStatus } from '../coachService.js';
import { DomainError } from '../../../core/errors/DomainError.js';
import { logError } from '../../../core/logger.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function getRecoveryInsightUseCase(input = {}) {
  try {
    const ratio = Number(input.proteinRatio || 0);
    const safeScore = Math.round(clamp(ratio * 100, 0, 100));
    return {
      recoveryStatus: getRecoveryStatus({ score: safeScore }),
      recoveryScore: safeScore,
    };
  } catch (error) {
    if (error instanceof DomainError) {
      logError(error, { useCase: 'getRecoveryInsightUseCase', screen: 'AppContext', action: 'getPerformanceRecoveryInsight' });
      return { error: error.code };
    }

    logError(error, { useCase: 'getRecoveryInsightUseCase', screen: 'AppContext', action: 'getPerformanceRecoveryInsight' });
    return { error: 'UNKNOWN_ERROR' };
  }
}
