import AsyncStorage from '@react-native-async-storage/async-storage';

export const WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY = '@workout:active-routine-id-v1';

export async function readActiveRoutineId() {
  try {
    const value = await AsyncStorage.getItem(WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY);
    const safe = String(value || '').trim();
    return safe || null;
  } catch {
    return null;
  }
}

export async function writeActiveRoutineId(routineId) {
  const safe = String(routineId || '').trim();
  if (!safe) {
    return;
  }

  await AsyncStorage.setItem(WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY, safe);
}

export async function clearActiveRoutineId() {
  await AsyncStorage.removeItem(WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY);
}

export async function resolveWorkoutContinueParams() {
  const workoutId = await readActiveRoutineId();
  return workoutId ? { workoutId } : undefined;
}
