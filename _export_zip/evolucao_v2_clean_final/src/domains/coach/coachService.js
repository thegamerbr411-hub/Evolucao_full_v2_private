export function getRecoveryStatus({ score } = {}) {
  if (score == null || Number.isNaN(Number(score))) {
    return 'sem_dados';
  }

  const safeScore = Number(score);

  if (safeScore >= 80) {
    return 'otimo';
  }

  if (safeScore >= 50) {
    return 'moderado';
  }

  return 'baixo';
}
