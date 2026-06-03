import { getIdTokenResult, GoogleAuthProvider, sendPasswordResetEmail, signInAnonymously, signInWithCredential } from 'firebase/auth';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as Application from 'expo-application';
import * as Sentry from '@sentry/react-native';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { useEffect, useRef } from 'react';
import { auth } from './firebase.js';
import { logCriticalError } from './loggingService.js';
import api, { API_BASE_URL } from './api';
import { useAuthStore } from '../stores/useAuthStore';
import { setQaRuntimeAuth } from '../utils/qaTransport';
import googleServices from '../../android/app/google-services.json';

WebBrowser.maybeCompleteAuthSession();

function getBundledGoogleClientConfig() {
  try {
    const clients = Array.isArray(googleServices?.client) ? googleServices.client : [];
    const oauthClients = [];

    for (const client of clients) {
      const clientOauth = Array.isArray(client?.oauth_client) ? client.oauth_client : [];
      oauthClients.push(...clientOauth);

      const otherOauth = Array.isArray(client?.services?.appinvite_service?.other_platform_oauth_client)
        ? client.services.appinvite_service.other_platform_oauth_client
        : [];
      oauthClients.push(...otherOauth);
    }

    const androidClientIds = oauthClients
      .filter((item) => Number(item?.client_type) === 1)
      .map((item) => String(item?.client_id || '').trim())
      .filter(Boolean);
    const webClientIds = oauthClients
      .filter((item) => Number(item?.client_type) === 3)
      .map((item) => String(item?.client_id || '').trim())
      .filter(Boolean);

    return {
      androidClientIds,
      webClientIds,
      androidClientId: androidClientIds[0] || '',
      webClientId: webClientIds[0] || '',
    };
  } catch {
    return {
      androidClientIds: [],
      webClientIds: [],
      androidClientId: '',
      webClientId: '',
    };
  }
}

function sanitizeGoogleClientId(value) {
  const safe = String(value || '').trim();
  if (!safe) return '';
  if (!safe.includes('.apps.googleusercontent.com')) return '';
  if (/replace_with|seu_|sua_|example/i.test(safe)) return '';
  return safe;
}

function getGoogleClientConfig() {
  const bundled = getBundledGoogleClientConfig();
  const sharedClientId = sanitizeGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '');
  const webClientId = sanitizeGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '');
  const androidClientId = sanitizeGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '');
  const expoClientId = sanitizeGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID || '');
  const iosClientId = sanitizeGoogleClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '');

  const firstBundledAndroidId = sanitizeGoogleClientId(bundled.androidClientId || bundled.androidClientIds?.[0] || '');
  const firstBundledWebId = sanitizeGoogleClientId(bundled.webClientId || bundled.webClientIds?.[0] || '');

  return {
    androidClientId: androidClientId || firstBundledAndroidId || sharedClientId,
    webClientId: webClientId || firstBundledWebId || sharedClientId,
    expoClientId: expoClientId || webClientId || firstBundledWebId || sharedClientId,
    iosClientId: iosClientId || '',
    sharedClientId,
    androidClientIds: bundled.androidClientIds,
    webClientIds: bundled.webClientIds,
  };
}

function getAndroidNativeRedirectUri(androidClientId) {
  const safeClientId = sanitizeGoogleClientId(androidClientId);
  if (!safeClientId) {
    return '';
  }

  const clientPrefix = safeClientId.replace('.apps.googleusercontent.com', '');
  if (!clientPrefix) {
    return '';
  }

  return `com.googleusercontent.apps.${clientPrefix}:/oauthredirect`;
}

export function isGoogleAuthConfigured() {
  const cfg = getGoogleClientConfig();
  const configured = Boolean(cfg.androidClientId || cfg.webClientId || cfg.expoClientId || cfg.iosClientId || cfg.sharedClientId);
  if (__DEV__) {
    console.log('[AUTH][GOOGLE][CONFIGURED]', JSON.stringify({
      configured,
      hasAndroid: Boolean(cfg.androidClientId),
      hasWeb: Boolean(cfg.webClientId),
      hasExpo: Boolean(cfg.expoClientId),
      hasIos: Boolean(cfg.iosClientId),
      hasShared: Boolean(cfg.sharedClientId),
    }));
  }
  return configured;
}

export function useGoogleAuth() {
  const cfg = getGoogleClientConfig();
  const androidNativeRedirectUri = getAndroidNativeRedirectUri(cfg.androidClientId);
  const defaultRedirectUri = AuthSession.makeRedirectUri({
    native: `${Application.applicationId}:/oauthredirect`,
  });

  const isAndroid = Platform.OS === 'android';
  const hasConfiguredClient = Boolean(cfg.androidClientId || cfg.webClientId || cfg.expoClientId || cfg.iosClientId || cfg.sharedClientId);

  const lastGoogleDebugUrlRef = useRef('');

  if (!hasConfiguredClient) {
    return {
      request: null,
      response: null,
      promptAsync: async () => ({
        type: 'error',
        error: { message: 'Google auth indisponivel neste build.' },
      }),
    };
  }

  // Android: OAuth client tipo 1 + id_token implicit + scheme googleusercontent (sem PKCE/code).
  // Web client NÃO aceita custom scheme — erro "Custom scheme URIs are not allowed for WEB client type".
  const redirectUri = isAndroid
    ? (androidNativeRedirectUri || defaultRedirectUri)
    : undefined;

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: cfg.androidClientId || undefined,
    webClientId: cfg.webClientId || undefined,
    iosClientId: cfg.iosClientId || undefined,
    responseType: AuthSession.ResponseType.IdToken,
    shouldAutoExchangeCode: false,
    selectAccount: true,
    scopes: ['openid', 'profile', 'email'],
    redirectUri,
  });

  useEffect(() => {
    if (!__DEV__) {
      return;
    }
    console.log('[AUTH][GOOGLE][HOOK]', JSON.stringify({
      platform: Platform.OS,
      flow: isAndroid ? 'android_native_id_token' : 'id_token',
      hasAndroid: Boolean(cfg.androidClientId),
      hasWeb: Boolean(cfg.webClientId),
      redirectUri: redirectUri || request?.redirectUri || defaultRedirectUri,
      responseType: AuthSession.ResponseType.IdToken,
      usePKCE: false,
      shouldAutoExchangeCode: false,
    }));
  }, [cfg.androidClientId, cfg.webClientId, defaultRedirectUri, isAndroid, redirectUri, request?.redirectUri]);

  useEffect(() => {
    if (!__DEV__ || !request) {
      return;
    }
    const urlKey = String(request.url || request.redirectUri || 'pending');
    if (lastGoogleDebugUrlRef.current === urlKey) {
      return;
    }
    lastGoogleDebugUrlRef.current = urlKey;
    console.log('[AUTH][GOOGLE][REQUEST_URL]', request.url || 'pending');
    console.log('[AUTH][GOOGLE][REDIRECT_URI]', request.redirectUri || redirectUri || 'none');
    console.log('[AUTH][GOOGLE][CLIENT_ID_USED]', isAndroid ? cfg.androidClientId : (cfg.webClientId || cfg.iosClientId));
    console.log('[AUTH][GOOGLE][PLATFORM_FLOW]', JSON.stringify({
      platform: Platform.OS,
      responseType: AuthSession.ResponseType.IdToken,
      usePKCE: false,
    }));
  }, [cfg.androidClientId, cfg.iosClientId, cfg.webClientId, isAndroid, redirectUri, request]);

  useEffect(() => {
    if (!response || response.type !== 'error') {
      return;
    }
    const errMsg = String(
      response?.error?.message || response?.params?.error_description || response?.params?.error || ''
    );
    if (!errMsg) {
      return;
    }
    try {
      Sentry.captureMessage(`google_auth_error: ${errMsg}`, {
        level: 'warning',
        tags: { auth_step: 'google_authorize', layer: 'oauth' },
        contexts: {
          google_oauth: {
            platform: Platform.OS,
            redirectUri: redirectUri || request?.redirectUri,
            error: response?.params?.error,
            errorDescription: response?.params?.error_description,
          },
        },
      });
    } catch {}
  }, [redirectUri, request?.redirectUri, response]);

  return { request, response, promptAsync };
}

/** @deprecated Fluxo PKCE/code removido — id_token nativo no redirect. Mantido só por compat de imports. */
export const exchangeGoogleAuthCode = async () => {
  if (__DEV__) {
    console.warn('[AUTH][GOOGLE][CODE_EXCHANGE_DEPRECATED]', 'Use id_token flow; exchangeCodeAsync desativado.');
  }
  return null;
};

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
  try {
    if (!idToken) {
      throw new Error('SKIP_BACKEND_NO_ID_TOKEN');
    }

    if (__DEV__) {
      console.log('[AUTH][GOOGLE][ID_TOKEN_RECEIVED]', JSON.stringify({
        hasIdToken: Boolean(idToken),
        hasAccessToken: Boolean(accessToken),
        idTokenLength: String(idToken || '').length,
      }));
    }

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
    console.warn('[INTEGRATION][AUTH][BACKEND_FAIL]', JSON.stringify({
      status: Number(backendError?.response?.status || 0),
      backendError: String(backendError?.response?.data?.error || backendError?.response?.data?.message || backendError?.message || 'unknown'),
      code: String(backendError?.code || ''),
    }));
    try {
      Sentry.captureException(backendError, {
        tags: { auth_step: 'backend_auth_google', layer: 'backend' },
        contexts: {
          backend_response: {
            status: Number(backendError?.response?.status || 0),
            data: backendError?.response?.data ?? null,
            code: String(backendError?.code || ''),
          },
        },
      });
    } catch {}
  }

  try {
    if (auth && (idToken || accessToken)) {
      const credential = GoogleAuthProvider.credential(idToken || null, accessToken || undefined);
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

    throw new Error('AUTH_GOOGLE_TOKENS_MISSING');
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
    console.log('[AUTH][CODE_SEND][REQUEST]', JSON.stringify({
      apiBaseUrl: API_BASE_URL,
      hasEmail: Boolean(safeEmail),
      emailDomain: safeEmail.split('@')[1] || null,
    }));

    const response = await api.post('/auth/send-code', { email: safeEmail });
    const delivery = String(response?.data?.delivery || 'email').toLowerCase();
    const code = response?.data?.code ? String(response.data.code) : null;

    console.log('[AUTH][CODE_SEND][RESPONSE]', JSON.stringify({
      status: response?.status || null,
      ok: Boolean(response?.data?.ok),
      delivery,
      hasLocalCode: Boolean(code),
    }));

    return {
      ok: Boolean(response?.data?.ok),
      delivery,
      code,
    };
  } catch (error) {
    await logCriticalError('authService.sendLoginCode', error);
    console.warn('[AUTH][CODE_SEND][ERROR]', JSON.stringify({
      apiBaseUrl: API_BASE_URL,
      status: Number(error?.response?.status || 0),
      code: String(error?.response?.data?.code || ''),
      message: String(error?.response?.data?.error || error?.message || 'unknown_error'),
      hasResponse: Boolean(error?.response),
      isTimeout: String(error?.code || '').toUpperCase() === 'ECONNABORTED',
    }));
    const status = Number(error?.response?.status || 0);
    if (status === 503 || status === 502 || status === 504) {
      return {
        ok: false,
        message: 'Servidor temporariamente indisponível. Aguarde ~1 min (Render acordando) e toque em Reenviar.',
      };
    }
    const message = String(error?.response?.data?.error || error?.message || 'Não foi possível enviar o código agora.');
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
