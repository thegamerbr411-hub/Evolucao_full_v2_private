import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import { logCriticalError } from './loggingService.js';

export const createUserIfNotExists = async (user) => {
  try {
    const userId = String(user?.id || '').trim();
    if (!userId) {
      return null;
    }

    const ref = doc(db, 'users', userId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      await setDoc(ref, {
        id: userId,
        xp: 0,
        level: 1,
        role: 'user',
        createdAt: Date.now(),
        ...user,
      });
    }

    return userId;
  } catch (error) {
    await logCriticalError('userService.createUserIfNotExists', error, {
      userId: String(user?.id || ''),
    });
    return null;
  }
};
