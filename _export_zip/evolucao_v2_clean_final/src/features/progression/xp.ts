export const MIN_WORKOUT_XP = 10;

export function calculateXpFromVolume(volume: number): number {
  const safeVolume = Number(volume || 0);
  if (!Number.isFinite(safeVolume) || safeVolume <= 0) {
    return MIN_WORKOUT_XP;
  }
  return Math.max(MIN_WORKOUT_XP, Math.round(safeVolume / 10));
}
