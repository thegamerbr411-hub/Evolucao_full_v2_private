import { getApp, getApps, initializeApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import googleServices from '../../android/app/google-services.json';

function getBundledFirebaseConfig() {
  try {
    const projectInfo = googleServices?.project_info || {};
    const client = Array.isArray(googleServices?.client) ? googleServices.client[0] : null;
    const apiKey = String(client?.api_key?.[0]?.current_key || '').trim();
    const appId = String(client?.client_info?.mobilesdk_app_id || '').trim();
    const projectId = String(projectInfo?.project_id || '').trim();
    const messagingSenderId = String(projectInfo?.project_number || '').trim()
      || String((appId.match(/^1:([^:]+)/) || [])[1] || '').trim();
    const storageBucket = String(projectInfo?.storage_bucket || '').trim();
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
    return {};
  }
}

const bundledConfig = getBundledFirebaseConfig();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || bundledConfig.apiKey || 'SUA_KEY',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || bundledConfig.authDomain || 'SEU_APP.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || bundledConfig.projectId || 'SEU_ID',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || bundledConfig.storageBucket || 'SEU_BUCKET',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || bundledConfig.messagingSenderId || 'ID',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || bundledConfig.appId || 'APP_ID',
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
export const db = app ? getFirestore(app) : null;
export const functions = app ? getFunctions(app) : null;

export default app;
