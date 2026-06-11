import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process?.env?.EXPO_PUBLIC_FIREBASE_API_KEY || 'SUA_KEY',
  authDomain: process?.env?.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'SEU_APP.firebaseapp.com',
  projectId: process?.env?.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'SEU_ID',
  storageBucket: process?.env?.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'SEU_BUCKET',
  messagingSenderId: process?.env?.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'ID',
  appId: process?.env?.EXPO_PUBLIC_FIREBASE_APP_ID || 'APP_ID',
};

function hasRealConfig(config = {}) {
  const requiredValues = [
    config.apiKey,
    config.authDomain,
    config.projectId,
    config.appId,
  ];

  return requiredValues.every((value) => {
    const safe = String(value || '').trim();
    return safe && !/^SEU_|^SUA_|^APP_ID$|^ID$/.test(safe);
  });
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
    // Auth já inicializado, retorna a instância existente
    return typeof getAuth === 'function' ? getAuth(app) : null;
  }
}

export const auth = createAuthInstance();

// Initialize Firestore with emulator support if flag is set
let _db = null;
if (app) {
  _db = getFirestore(app);
  const useEmulator = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === '1';
  if (useEmulator) {
    const host = process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
    const port = process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT || '8080';
    try {
      connectFirestoreEmulator(_db, host, parseInt(port, 10));
    } catch (error) {
      // Emulator already connected or error connecting
      console.warn('Firestore emulator connection failed:', error.message);
    }
  }
}

// Initialize Storage with emulator support if flag is set
let _storage = null;
if (app) {
  _storage = getStorage(app);
  const useEmulator = process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === '1';
  if (useEmulator) {
    const host = process.env.EXPO_PUBLIC_STORAGE_EMULATOR_HOST || '127.0.0.1';
    const port = process.env.EXPO_PUBLIC_STORAGE_EMULATOR_PORT || '9199';
    try {
      connectStorageEmulator(_storage, host, parseInt(port, 10));
    } catch (error) {
      // Emulator already connected or error connecting
      console.warn('Storage emulator connection failed:', error.message);
    }
  }
}

export const db = _db;
export const functions = app ? getFunctions(app) : null;
export const storage = _storage;

export default app;
