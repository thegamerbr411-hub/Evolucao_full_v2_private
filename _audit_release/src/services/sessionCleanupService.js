import * as SecureStore from 'expo-secure-store';
import { signOut } from 'firebase/auth';
import { auth } from './firebase';
import { clearObservabilitySnapshot } from '../core/observability';
import { clearLocal } from '../storage/mmkv';
import { useAppStore } from '../stores/useAppStore';
import { useAuthStore } from '../stores/useAuthStore';
import { useGamificationStore } from '../stores/useGamificationStore';
import { useNutritionStore } from '../stores/useNutritionStore';
import { useUserStore } from '../stores/useUserStore';
import { useWorkoutStore } from '../stores/useWorkoutStore';
import { setQaRuntimeAuth } from '../utils/qaTransport';
import { logTaggedError, logTaggedEvent } from '../utils/runtimeLogger';

const APP_STORE_SECURE_KEY = 'app.store.secure.v1';
const SECURE_KEYS_TO_CLEAR = ['accessToken', 'refreshToken', APP_STORE_SECURE_KEY];

function resetInMemoryStores() {
  useAuthStore.setState({ user: null, isLogged: false, isLoading: false });
  useUserStore.setState({ user: null, profile: null, isHydrated: true });
  useAppStore.setState({
    isLoading: false,
    isHydrated: true,
    isOnline: true,
    isSyncing: false,
    monetization: { isProActive: false, isPro: false },
    hasCompletedQuestionnaire: false,
    userRoutines: [],
  });
  useWorkoutStore.setState({
    workout: { exercises: [] },
    workoutLogs: [],
    exerciseTargets: {},
    currentExercise: null,
    currentSet: 1,
    isResting: false,
    workoutSessionId: null,
  });
  useNutritionStore.setState({
    nutritionLogs: [],
    history: [],
    plan: null,
    hydration: null,
  });
  useGamificationStore.setState({ gamification: { xp: 0, streakDays: 0 } });
}

async function clearSecureEntries() {
  for (const key of SECURE_KEYS_TO_CLEAR) {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      logTaggedError('STORE', error, {
        action: 'delete_secure_key',
        key,
      });
    }
  }
}

export async function performFullSessionLogout({ reason = 'manual_profile_logout' } = {}) {
  logTaggedEvent('AUTH', 'logout_start', { reason });

  try {
    if (auth?.currentUser) {
      await signOut(auth);
    }
  } catch (error) {
    logTaggedError('AUTH', error, {
      action: 'firebase_signout',
      reason,
    });
  }

  await clearSecureEntries();

  try {
    clearLocal();
  } catch (error) {
    logTaggedError('STORE', error, {
      action: 'clear_local_storage',
      reason,
    });
  }

  try {
    clearObservabilitySnapshot();
  } catch (error) {
    logTaggedError('STORE', error, {
      action: 'clear_observability_snapshot',
      reason,
    });
  }

  resetInMemoryStores();
  setQaRuntimeAuth({ userId: null, jwt: null });

  logTaggedEvent('AUTH', 'logout_complete', {
    reason,
    clearedSecureKeys: SECURE_KEYS_TO_CLEAR.length,
  });

  return { ok: true };
}