import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './firebase.js';
import { logCriticalError } from './loggingService.js';

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// Public: Calculate user score for ranking
export const calculateUserScore = (user = {}) => {
  const xp = toNumber(user?.xp, 0);
  const streak = toNumber(user?.streakDays ?? user?.streak, 0);
  const totalWorkouts = toNumber(user?.totalWorkouts, 0);
  return xp + streak * 100 + totalWorkouts * 50;
};

// Public: Sort and assign ranks
export const sortRanking = (users = []) => {
  return [...(Array.isArray(users) ? users : [])]
    .map((user, index) => ({
      ...user,
      _originalIndex: index,
      score: calculateUserScore(user),
    }))
    .sort((a, b) => b.score - a.score || toNumber(b.xp, 0) - toNumber(a.xp, 0) || a._originalIndex - b._originalIndex)
    .map((user, idx) => ({
      ...user,
      rank: idx + 1,
      _originalIndex: undefined,
    }));
};

export const getUserRank = (users = [], userId = '') => {
  const ordered = sortRanking(users);
  const target = ordered.find((item) => String(item?.id || item?.userId || '') === String(userId || ''));
  return target ? target.rank : null;
};

export const getRanking = async () => {
  try {
    const q = query(collection(db, 'users'), orderBy('xp', 'desc'));
    const snapshot = await getDocs(q);
    const users = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    return sortRanking(users);
  } catch (error) {
    await logCriticalError('rankingService.getRanking', error);
    return [];
  }
};
