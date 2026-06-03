import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocal, setLocal } from '../storage/mmkv';
import { getWorkoutTodayKey, useWorkoutStore } from '../stores/useWorkoutStore';
import { workoutDevLog } from '../utils/workoutDevLog';
import {
  WORKOUT_DRAFTS_STORAGE_KEY,
  WORKOUT_SET_COUNT_STORAGE_KEY,
} from '../screens/workout/useWorkoutDraftPersistence';
import { WORKOUT_UI_SESSION_STORAGE_KEY } from '../screens/workout/useWorkoutSessionUiPersistence';
import { WORKOUT_REST_END_STORAGE_KEY } from '../screens/workout/useWorkoutRestTimer';

const WORKOUT_STORE_KEY = 'workout.store.v1';
const WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY = '@workout:active-routine-id-v1';

export async function clearWorkoutQaStateForRuntimeAudit() {
  if (!__DEV__) {
    throw new Error('QA reset only in DEV');
  }

  await AsyncStorage.multiRemove([
    WORKOUT_DRAFTS_STORAGE_KEY,
    WORKOUT_SET_COUNT_STORAGE_KEY,
    WORKOUT_UI_SESSION_STORAGE_KEY,
    WORKOUT_REST_END_STORAGE_KEY,
    WORKOUT_ACTIVE_ROUTINE_STORAGE_KEY,
  ]);

  const todayKey = getWorkoutTodayKey();
  const state = useWorkoutStore.getState();
  const currentLogs = Array.isArray(state.workoutLogs) ? state.workoutLogs : [];
  const filteredLogs = currentLogs.filter((item) => String(item?.date || '') !== todayKey);
  const removedToday = Math.max(0, currentLogs.length - filteredLogs.length);
  state.setWorkoutLogs(filteredLogs);
  state.setCurrentExerciseState(null, 1);
  state.setRestingState(false);
  state.setWorkoutSessionId(null);

  const persisted = getLocal(WORKOUT_STORE_KEY);
  if (persisted && typeof persisted === 'object') {
    const persistedLogs = Array.isArray(persisted.workoutLogs) ? persisted.workoutLogs : [];
    setLocal(WORKOUT_STORE_KEY, {
      ...persisted,
      workoutLogs: persistedLogs.filter((item) => String(item?.date || '') !== todayKey),
    });
  }

  const payload = {
    scope: 'workout_draft_only',
    todayKey,
    todayLogsRemoved: removedToday,
  };
  workoutDevLog('QA_RESET', payload);
  return payload;
}
