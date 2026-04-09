import { doc, increment, updateDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { logCriticalError } from './loggingService.js';

export const giveXP = async (userId, amount) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      xp: increment(Math.max(0, Number(amount || 0))),
    });
    return true;
  } catch (error) {
    await logCriticalError('adminService.giveXP', error, {
      userId: String(userId || ''),
      amount: Number(amount || 0),
    });
    return false;
  }
};

export const removeXP = async (userId, amount) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      xp: increment(-Math.max(0, Number(amount || 0))),
    });
    return true;
  } catch (error) {
    await logCriticalError('adminService.removeXP', error, {
      userId: String(userId || ''),
      amount: Number(amount || 0),
    });
    return false;
  }
};

export const createMission = (title, rewardXP) => ({
  id: Date.now().toString(),
  title,
  rewardXP,
});
