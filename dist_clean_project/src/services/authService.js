import { getIdTokenResult, GoogleAuthProvider, signInAnonymously, signInWithCredential } from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { auth } from './firebase.js';
import { logCriticalError } from './loggingService.js';

WebBrowser.maybeCompleteAuthSession();

function getGoogleClientConfig() {
  const androidClientId = String(process?.env?.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '').trim();
  const expoClientId = String(process?.env?.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || '').trim();
  const iosClientId = String(process?.env?.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim();

  return {
    androidClientId,
    expoClientId,
    iosClientId,
  };
}

export function isGoogleAuthConfigured() {
  const cfg = getGoogleClientConfig();
  return Boolean(cfg.androidClientId || cfg.expoClientId || cfg.iosClientId);
}

export function useGoogleAuth() {
  const cfg = getGoogleClientConfig();

  // Evita crash em ambientes QA/E2E sem OAuth configurado; o botao de login continua desabilitado.
  const safeAndroidClientId = cfg.androidClientId || 'detox-placeholder.apps.googleusercontent.com';
  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: safeAndroidClientId,
    expoClientId: cfg.expoClientId || undefined,
    iosClientId: cfg.iosClientId || undefined,
  });

  return { request, response, promptAsync };
}

export const logoutGoogleSession = async () => {
  try {
    if (auth?.currentUser) {
      await auth.signOut();
    }
    return { ok: true };
  } catch (error) {
    await logCriticalError('authService.logoutGoogleSession', error);
    return { ok: false };
  }
};

export const loginWithGoogleToken = async ({ idToken, accessToken }) => {
  try {
    if (auth && idToken) {
      const credential = GoogleAuthProvider.credential(idToken, accessToken || undefined);
      const result = await signInWithCredential(auth, credential);
      const token = await getIdTokenResult(result.user, true);

      return {
        id: result.user.uid,
        isAdmin: Boolean(token?.claims?.admin),
        role: token?.claims?.admin ? 'admin' : 'user',
        source: 'google_firebase',
      };
    }

    // Fallback funcional quando Firebase/Auth ainda nao estiver totalmente configurado.
    const pseudoId = String(idToken || accessToken || `google_${Date.now()}`).slice(0, 36);
    return {
      id: `google_${pseudoId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
      isAdmin: false,
      role: 'user',
      source: 'google_fallback',
    };
  } catch (error) {
    await logCriticalError('authService.loginWithGoogleToken', error);
    return {
      id: null,
      isAdmin: false,
      role: 'user',
      source: 'google_failed',
    };
  }
};

export const loginAnonymous = async () => {
  try {
    const result = await signInAnonymously(auth);
    const token = await getIdTokenResult(result.user, true);

    return {
      id: result.user.uid,
      isAdmin: Boolean(token?.claims?.admin),
      role: token?.claims?.admin ? 'admin' : 'user',
    };
  } catch (error) {
    await logCriticalError('authService.loginAnonymous', error);
    return {
      id: null,
      isAdmin: false,
      role: 'user',
    };
  }
};

export const hasAdminClaim = async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return false;
    }

    const token = await getIdTokenResult(currentUser, true);
    return Boolean(token?.claims?.admin);
  } catch (error) {
    await logCriticalError('authService.hasAdminClaim', error);
    return false;
  }
};
