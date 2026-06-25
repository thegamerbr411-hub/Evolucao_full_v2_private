import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import googleServices from '../../android/app/google-services.json';

const PLACEHOLDER_PATTERN = /^SEU_|^SUA_|^APP_ID$|^ID$|^replace_with/i;

function isRealConfigValue(value) {
  const safe = String(value || '').trim();
  return Boolean(safe && !PLACEHOLDER_PATTERN.test(safe));
}

function hasRealConfig(config = {}) {
  return [
    config.apiKey,
    config.authDomain,
    config.projectId,
    config.appId,
  ].every(isRealConfigValue);
}

function readEnvFirebaseConfig() {
  return {
    apiKey: process?.env?.EXPO_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process?.env?.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process?.env?.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process?.env?.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process?.env?.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process?.env?.EXPO_PUBLIC_FIREBASE_APP_ID || '',
  };
}

function readBundledFirebaseConfig() {
  try {
    const client = Array.isArray(googleServices?.client) ? googleServices.client[0] : null;
    const projectId = String(googleServices?.project_info?.project_id || '').trim();
    const apiKey = String(client?.api_key?.[0]?.current_key || '').trim();
    const appId = String(client?.client_info?.mobilesdk_app_id || '').trim();
    const messagingSenderId = String(googleServices?.project_info?.project_number || '').trim();
    const storageBucket = String(googleServices?.project_info?.storage_bucket || '').trim();
    const authDomain = projectId ? `${projectId}.firebaseapp.com` : '';

    return {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
    };
  } catch {
    return null;
  }
}

function resolveFirebaseConfig() {
  const envConfig = readEnvFirebaseConfig();
  if (hasRealConfig(envConfig)) {
    return { config: envConfig, source: 'env' };
  }

  const bundledConfig = readBundledFirebaseConfig();
  if (bundledConfig && hasRealConfig(bundledConfig)) {
    return { config: bundledConfig, source: 'google-services.json' };
  }

  return {
    config: {
      apiKey: envConfig.apiKey || 'SUA_KEY',
      authDomain: envConfig.authDomain || 'SEU_APP.firebaseapp.com',
      projectId: envConfig.projectId || 'SEU_ID',
      storageBucket: envConfig.storageBucket || 'SEU_BUCKET',
      messagingSenderId: envConfig.messagingSenderId || 'ID',
      appId: envConfig.appId || 'APP_ID',
    },
    source: 'placeholder',
  };
}

const resolvedFirebase = resolveFirebaseConfig();
const firebaseConfig = resolvedFirebase.config;
const firebaseConfigSource = resolvedFirebase.source;

export function getFirebaseConfigDiagnostics() {
  const envConfig = readEnvFirebaseConfig();
  const bundledConfig = readBundledFirebaseConfig();

  return {
    configured: hasRealConfig(firebaseConfig),
    source: firebaseConfigSource,
    hasEnvConfig: hasRealConfig(envConfig),
    hasBundledConfig: Boolean(bundledConfig && hasRealConfig(bundledConfig)),
    projectIdPresent: isRealConfigValue(firebaseConfig.projectId),
    rebuildRecommended: firebaseConfigSource === 'google-services.json',
  };
}

export const isFirebaseConfigured = hasRealConfig(firebaseConfig);

const app = isFirebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null;

function createAuthInstance() {
  if (!app) {
    return null;
  }

  const initializeAuth = FirebaseAuth?.initializeAuth;
  const getAuth = FirebaseAuth?.getAuth;
  const getReactNativePersistence = FirebaseAuth?.getReactNativePersistence;

  if (typeof initializeAuth !== 'function') {
    return typeof getAuth === 'function' ? getAuth(app) : null;
  }

  try {
    if (typeof getReactNativePersistence === 'function') {
      return initializeAuth(app, {
        persistence: getReactNativePersistence(ReactNativeAsyncStorage),
      });
    }

    return initializeAuth(app);
  } catch {
    return typeof getAuth === 'function' ? getAuth(app) : null;
  }
}

export const auth = createAuthInstance();

export function isFirebaseEmulatorAllowed() {
  const useEmulatorFlag = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === '1';

  if (!useEmulatorFlag) {
    return false;
  }

  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isTestEnv = nodeEnv === 'test';
  const isDevEnv = nodeEnv === 'development';
  const isProduction = nodeEnv === 'production';

  if (isDev || isTestEnv || isDevEnv) {
    return true;
  }

  if (isProduction) {
    console.warn('Firebase emulator connection blocked in production/release build. Using production Firebase instead.');
    return false;
  }

  return false;
}

let _db = null;
if (app) {
  _db = getFirestore(app);
  const useEmulator = isFirebaseEmulatorAllowed();
  if (useEmulator) {
    const host = process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
    const port = process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT || '8080';
    try {
      connectFirestoreEmulator(_db, host, parseInt(port, 10));
    } catch (error) {
      console.warn('Firestore emulator connection failed:', error.message);
    }
  }
}

let _storage = null;
if (app) {
  _storage = getStorage(app);
  const useEmulator = isFirebaseEmulatorAllowed();
  if (useEmulator) {
    const host = process.env.EXPO_PUBLIC_STORAGE_EMULATOR_HOST || '127.0.0.1';
    const port = process.env.EXPO_PUBLIC_STORAGE_EMULATOR_PORT || '9199';
    try {
      connectStorageEmulator(_storage, host, parseInt(port, 10));
    } catch (error) {
      console.warn('Storage emulator connection failed:', error.message);
    }
  }
}

export const db = _db;
export const functions = app ? getFunctions(app) : null;
export const storage = _storage;

export default app;
