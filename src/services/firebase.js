import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: 'SUA_KEY',
  authDomain: 'SEU_APP.firebaseapp.com',
  projectId: 'SEU_ID',
  storageBucket: 'SEU_BUCKET',
  messagingSenderId: 'ID',
  appId: 'APP_ID',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
export const functions = getFunctions(app);

export default app;
