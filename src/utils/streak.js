import { getDoc, setDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';

export async function updateStreak(userId) {
  const ref = doc(db, 'users', userId);
  const snap = await getDoc(ref);
  const today = new Date().toISOString().slice(0, 10);

  let { streak = 0, lastWorkout = null } = snap.exists() ? snap.data() : {};
  if (lastWorkout === today) return streak;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (lastWorkout === yesterday) streak += 1;
  else streak = 1;

  await setDoc(ref, { streak, lastWorkout: today }, { merge: true });
  return streak;
}
