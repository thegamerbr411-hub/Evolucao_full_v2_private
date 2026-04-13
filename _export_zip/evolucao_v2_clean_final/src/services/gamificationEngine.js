export function getLevelFromXp(xp = 0) {
  const safeXp = Math.max(0, Number(xp || 0));
  return Math.max(1, Math.floor(Math.sqrt(safeXp / 100)) + 1);
}

export function calculateXpForWorkout({ sets = 0, volume = 0, hitPr = false, streakDays = 0 } = {}) {
  const base = Number(sets || 0) * 6;
  const volumeBonus = Math.round(Number(volume || 0) / 250);
  const prBonus = hitPr ? 40 : 0;
  const streakBonus = Math.min(50, Math.max(0, Number(streakDays || 0)) * 4);
  return Math.max(0, base + volumeBonus + prBonus + streakBonus);
}

export function buildLocalRanking(users = []) {
  const safe = Array.isArray(users) ? users : [];
  return safe
    .map((user) => ({
      ...user,
      xp: Math.max(0, Number(user?.xp || 0)),
      level: getLevelFromXp(user?.xp || 0),
      streak: Math.max(0, Number(user?.streak || 0)),
    }))
    .sort((a, b) => b.xp - a.xp || b.streak - a.streak || String(a.name || '').localeCompare(String(b.name || '')))
    .map((user, index) => ({ ...user, rank: index + 1 }));
}
