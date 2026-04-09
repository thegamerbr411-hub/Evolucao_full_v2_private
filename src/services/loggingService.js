import { addDoc, collection } from 'firebase/firestore';
import { db } from './firebase.js';

export const logCriticalError = async (scope, error, meta = {}) => {
  try {
    await addDoc(collection(db, 'critical_logs'), {
      scope: String(scope || 'unknown'),
      message: String(error?.message || error || 'unknown_error'),
      stack: String(error?.stack || ''),
      meta,
      createdAt: Date.now(),
    });
  } catch {
    // silent
  }
};
