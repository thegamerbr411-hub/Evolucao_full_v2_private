import { addDoc, collection, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db } from './firebase.js';
import { logCriticalError } from './loggingService.js';

export const saveWorkoutCloud = async (userId, workout) => {
  try {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) {
      return null;
    }

    const ref = await addDoc(collection(db, 'users', safeUserId, 'workouts'), {
      version: 1,
      name: workout?.name || 'Treino',
      exercises: Array.isArray(workout?.exercises) ? workout.exercises : [],
      updatedAt: Date.now(),
      createdAt: Date.now(),
    });

    return ref.id;
  } catch (error) {
    await logCriticalError('cloudWorkoutService.saveWorkoutCloud', error, {
      userId: String(userId || ''),
    });
    return null;
  }
};

export const loadWorkoutCloud = async (userId) => {
  try {
    const safeUserId = String(userId || '').trim();
    if (!safeUserId) {
      return null;
    }

    const q = query(
      collection(db, 'users', safeUserId, 'workouts'),
      orderBy('updatedAt', 'desc'),
      limit(1)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data();
  } catch (error) {
    await logCriticalError('cloudWorkoutService.loadWorkoutCloud', error, {
      userId: String(userId || ''),
    });
    return null;
  }
};
