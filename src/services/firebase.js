import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

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

  try {
    return getAuth(app);
  } catch {
    try {
      return initializeAuth(app);
    } catch {
      return null;
    }
  }
}

export const auth = createAuthInstance();
export const db = app ? getFirestore(app) : null;
export const functions = app ? getFunctions(app) : null;

export default app;
