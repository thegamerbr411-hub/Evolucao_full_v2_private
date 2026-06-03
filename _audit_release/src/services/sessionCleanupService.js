import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearUserIdentity } from './appIdentityService';
import { secureDeleteItemAsync } from './secureStorage';
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

let logoutInProgress = false;

export function isLogoutInProgress() {
  return logoutInProgress;
}

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

async function clearFirebaseAuthPersistence() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const authKeys = keys.filter(
      (key) =>
        String(key).startsWith('firebase:authUser:') ||
        String(key).startsWith('firebase:auth:') ||
        String(key).includes('firebaseAuth')
    );
    if (authKeys.length > 0) {
      await AsyncStorage.multiRemove(authKeys);
    }
  } catch (error) {
    logTaggedError('STORE', error, {
      action: 'clear_firebase_auth_persistence',
    });
  }
}

async function clearSecureEntries() {
  for (const key of SECURE_KEYS_TO_CLEAR) {
    try {
      await secureDeleteItemAsync(key);
    } catch (error) {
      logTaggedError('STORE', error, {
        action: 'delete_secure_key',
        key,
      });
    }
  }
}

export async function performFullSessionLogout({ reason = 'manual_profile_logout' } = {}) {
  if (logoutInProgress) {
    logTaggedEvent('AUTH', 'logout_skipped_already_in_progress', { reason });
    return { ok: false, reason: 'already_in_progress' };
  }

  logoutInProgress = true;
  logTaggedEvent('AUTH', 'logout_start', { reason });

  try {
    // Drop in-memory auth first so RootNavigator flips to guest before slow Firebase I/O.
    resetInMemoryStores();
    setQaRuntimeAuth({ userId: null, jwt: null });

    try {
      useUserStore.getState().logout();
    } catch (error) {
      logTaggedError('STORE', error, {
        action: 'user_store_logout',
        reason,
      });
    }

    try {
      const appStore = useAppStore.getState();
      appStore.setHasCompletedQuestionnaire(false);
      appStore.setUserRoutines([]);
    } catch (error) {
      logTaggedError('STORE', error, {
        action: 'app_store_logout_reset',
        reason,
      });
    }

    try {
      await useAuthStore.getState().logout();
    } catch (error) {
      logTaggedError('STORE', error, {
        action: 'auth_store_logout',
        reason,
      });
    }

    try {
      await clearUserIdentity();
    } catch (error) {
      logTaggedError('STORE', error, {
        action: 'clear_user_identity',
        reason,
      });
    }

    await clearFirebaseAuthPersistence();
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

    try {
      if (auth) {
        await signOut(auth);
      }
    } catch (error) {
      logTaggedError('AUTH', error, {
        action: 'firebase_signout',
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
  } finally {
    logoutInProgress = false;
  }
}