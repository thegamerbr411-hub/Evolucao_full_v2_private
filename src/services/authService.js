import { getIdTokenResult, GoogleAuthProvider, sendPasswordResetEmail, signInAnonymously, signInWithCredential } from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { auth } from './firebase.js';
import { logCriticalError } from './loggingService.js';
import api from './api';
import { useAuthStore } from '../stores/useAuthStore';
import { setQaRuntimeAuth } from '../utils/qaTransport';

WebBrowser.maybeCompleteAuthSession();

function getGoogleClientConfig() {
  const sharedClientId = String(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
  const webClientId = String(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '').trim();
  const androidClientId = String(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '').trim();
  const expoClientId = String(process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || '').trim();
  const iosClientId = String(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim();

  return {
    androidClientId: androidClientId || sharedClientId,
    webClientId: webClientId || sharedClientId,
    expoClientId: expoClientId || sharedClientId,
    iosClientId: iosClientId || sharedClientId,
    sharedClientId,
  };
}

export function isGoogleAuthConfigured() {
  const cfg = getGoogleClientConfig();
  return Boolean(cfg.androidClientId || cfg.webClientId || cfg.expoClientId || cfg.iosClientId || cfg.sharedClientId);
}

export function useGoogleAuth() {
  const cfg = getGoogleClientConfig();
  const useIdTokenAuthRequestHook = Google && typeof Google.useIdTokenAuthRequest === 'function'
    ? Google.useIdTokenAuthRequest
    : null;

  if (!useIdTokenAuthRequestHook) {
    return {
      request: null,
      response: null,
      promptAsync: async () => ({
        type: 'error',
        error: { message: 'Google auth indisponivel neste build.' },
      }),
    };
  }

  // Evita erro de "custom scheme" em Android usando apenas client nativo no fluxo mobile.
  const safeAndroidClientId = cfg.androidClientId || undefined;
  const requestConfig = {
    androidClientId: safeAndroidClientId,
    iosClientId: cfg.iosClientId || undefined,
    scopes: ['openid', 'profile', 'email'],
    selectAccount: true,
  };

  if (Platform.OS === 'web') {
    requestConfig.webClientId = cfg.webClientId || undefined;
  }

  const [request, response, promptAsync] = useIdTokenAuthRequestHook(requestConfig);

  return { request, response, promptAsync };
}

export const logoutGoogleSession = async () => {
  try {
    if (auth?.currentUser) {
      await auth.signOut();
    }
    setQaRuntimeAuth({ jwt: '', userId: '' });
    return { ok: true };
  } catch (error) {
    await logCriticalError('authService.logoutGoogleSession', error);
    return { ok: false };
  }
};

export const loginWithGoogleToken = async ({ idToken, accessToken }) => {
  if (!idToken) {
    console.error('[INTEGRATION][AUTH] Google idToken ausente — login rejeitado.');
    setQaRuntimeAuth({ jwt: '' });
    throw new Error('AUTH_GOOGLE_IDTOKEN_MISSING');
  }

  try {
    console.log('[INTEGRATION][AUTH] Iniciando login Google no backend.');
    const backendResponse = await api.post('/auth/google', {
      token: idToken,
    });

    const { accessToken: apiAccessToken, refreshToken, user } = backendResponse?.data || {};
    if (apiAccessToken && refreshToken) {
      await useAuthStore.getState().setToken(apiAccessToken, refreshToken);
      setQaRuntimeAuth({ jwt: apiAccessToken });
    }

    if (user?.id) {
      useAuthStore.getState().setUser({
        id: String(user.id),
        email: String(user.email || ''),
        name: String(user.name || 'Usuario'),
        avatar: user.avatar ? String(user.avatar) : undefined,
      });
      setQaRuntimeAuth({ userId: String(user.id) });
    }

    console.log('[INTEGRATION][AUTH] Login Google backend OK.');
    return {
      id: user?.id || null,
      isAdmin: Boolean(user?.isAdmin),
      role: user?.role || (user?.isAdmin ? 'admin' : 'user'),
      email: user?.email || null,
      name: user?.name || null,
      source: 'google_backend',
    };
  } catch (backendError) {
    console.warn('[INTEGRATION][AUTH] Backend /auth/google falhou, tentando fallback Firebase.');
  }

  try {
    if (auth && idToken) {
      const credential = GoogleAuthProvider.credential(idToken, accessToken || undefined);
      const result = await signInWithCredential(auth, credential);
      const token = await getIdTokenResult(result.user, true);

      setQaRuntimeAuth({ userId: String(result.user.uid) });

      return {
        id: result.user.uid,
        isAdmin: Boolean(token?.claims?.admin),
        role: token?.claims?.admin ? 'admin' : 'user',
        email: result?.user?.email || null,
        name: result?.user?.displayName || null,
        source: 'google_firebase',
      };
    }

    // Nenhum provedor disponivel — rejeitar explicitamente.
    throw new Error('AUTH_PROVIDERS_UNAVAILABLE');
  } catch (error) {
    await logCriticalError('authService.loginWithGoogleToken', error);
    throw error;
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

export const requestPasswordReset = async (email) => {
  const safeEmail = String(email || '').trim().toLowerCase();
  if (!safeEmail) {
    return { ok: false, message: 'Informe um e-mail válido.' };
  }

  try {
    if (!auth) {
      return { ok: false, message: 'Serviço de autenticação indisponível.' };
    }

    await sendPasswordResetEmail(auth, safeEmail);
    return { ok: true };
  } catch (error) {
    await logCriticalError('authService.requestPasswordReset', error);
    return { ok: false, message: 'Não foi possível enviar o e-mail de recuperação agora.' };
  }
};

export const sendLoginCode = async (email) => {
  const safeEmail = String(email || '').trim().toLowerCase();
  if (!safeEmail) {
    return { ok: false, message: 'Informe um e-mail válido.' };
  }

  try {
    const response = await api.post('/auth/send-code', { email: safeEmail });
    const delivery = String(response?.data?.delivery || 'email').toLowerCase();
    const code = response?.data?.code ? String(response.data.code) : null;

    return {
      ok: Boolean(response?.data?.ok),
      delivery,
      code,
    };
  } catch (error) {
    await logCriticalError('authService.sendLoginCode', error);
    const message = String(error?.response?.data?.error || 'Não foi possível enviar o código agora.');
    return { ok: false, message };
  }
};

export const verifyLoginCode = async ({ email, code }) => {
  const safeEmail = String(email || '').trim().toLowerCase();
  const safeCode = String(code || '').trim();

  if (!safeEmail || !safeCode) {
    return { ok: false, message: 'Informe e-mail e código para validar.' };
  }

  try {
    const response = await api.post('/auth/verify-code', {
      email: safeEmail,
      code: safeCode,
    });

    return { ok: Boolean(response?.data?.ok) };
  } catch (error) {
    await logCriticalError('authService.verifyLoginCode', error);
    const message = String(error?.response?.data?.error || 'Código inválido ou expirado.');
    return { ok: false, message };
  }
};
