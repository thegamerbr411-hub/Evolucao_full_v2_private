import { getIdTokenResult, GoogleAuthProvider, sendPasswordResetEmail, signInAnonymously, signInWithCredential } from 'firebase/auth';
import * as AuthSession from 'expo-auth-session';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { auth } from './firebase.js';
import { logCriticalError } from './loggingService.js';
import api from './api';
import { useAuthStore } from '../stores/useAuthStore';
import { setQaRuntimeAuth } from '../utils/qaTransport';
import googleServices from '../../android/app/google-services.json';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const PKCE_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

function base64UrlEncode(input) {
  return String(input || '')
    .trim()
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function generateCodeVerifier(length = 96) {
  const safeLength = Math.max(43, Math.min(128, Math.floor(length)));
  const randomValues = new Uint8Array(safeLength);
  Crypto.getRandomValues(randomValues);

  let verifier = '';
  for (let index = 0; index < randomValues.length; index += 1) {
    verifier += PKCE_CHARSET[randomValues[index] % PKCE_CHARSET.length];
  }

  return verifier;
}

async function createCodeChallengeAsync(codeVerifier) {
  const safeVerifier = String(codeVerifier || '').trim();
  if (!safeVerifier) {
    return '';
  }

  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    safeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );

  return base64UrlEncode(digest);
}

class GooglePkceAuthRequest extends AuthSession.AuthRequest {
  async ensureCodeIsSetupAsync() {
    if (!this.usePKCE) {
      return;
    }

    if (this.codeVerifier && this.codeChallenge) {
      return;
    }

    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await createCodeChallengeAsync(codeVerifier);

    this.codeVerifier = codeVerifier;
    this.codeChallenge = codeChallenge;
  }
}

function getBundledGoogleClientConfig() {
  try {
    const client = Array.isArray(googleServices?.client) ? googleServices.client[0] : null;
    const oauthClients = Array.isArray(client?.oauth_client) ? client.oauth_client : [];
    const androidClient = oauthClients.find((item) => Number(item?.client_type) === 1);
    const webClient = oauthClients.find((item) => Number(item?.client_type) === 3)
      || client?.services?.appinvite_service?.other_platform_oauth_client?.find((item) => Number(item?.client_type) === 3)
      || null;

    return {
      androidClientId: String(androidClient?.client_id || '').trim(),
      webClientId: String(webClient?.client_id || '').trim(),
    };
  } catch {
    return {
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

  return {
    androidClientId: androidClientId || sanitizeGoogleClientId(bundled.androidClientId) || sharedClientId,
    webClientId: webClientId || sanitizeGoogleClientId(bundled.webClientId) || sharedClientId,
    expoClientId: expoClientId || webClientId || sanitizeGoogleClientId(bundled.webClientId) || sharedClientId,
    iosClientId: iosClientId || '',
    sharedClientId,
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
  console.log('[AUTH][GOOGLE][CONFIGURED]', JSON.stringify({
    configured,
    hasAndroid: Boolean(cfg.androidClientId),
    hasWeb: Boolean(cfg.webClientId),
    hasExpo: Boolean(cfg.expoClientId),
    hasIos: Boolean(cfg.iosClientId),
    hasShared: Boolean(cfg.sharedClientId),
  }));
  return configured;
}

export function useGoogleAuth() {
  const cfg = getGoogleClientConfig();
  const androidNativeRedirectUri = getAndroidNativeRedirectUri(cfg.androidClientId);
  const defaultRedirectUri = AuthSession.makeRedirectUri({
    native: `${Application.applicationId}:/oauthredirect`,
  });
  console.log('[AUTH][GOOGLE][HOOK]', JSON.stringify({
    hasAndroid: Boolean(cfg.androidClientId),
    hasWeb: Boolean(cfg.webClientId),
    hasIos: Boolean(cfg.iosClientId),
    hasAndroidNativeRedirect: Boolean(androidNativeRedirectUri),
  }));

  const isAndroid = Platform.OS === 'android';
  const hasConfiguredClient = Boolean(cfg.androidClientId || cfg.webClientId || cfg.expoClientId || cfg.iosClientId || cfg.sharedClientId);

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

  const requestConfig = {
    scopes: ['openid', 'profile', 'email'],
    responseType: 'code',
    selectAccount: true,
    usePKCE: true,
    codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    redirectUri: isAndroid ? (androidNativeRedirectUri || defaultRedirectUri) : defaultRedirectUri,
    ...(isAndroid
      ? {
          androidClientId: cfg.androidClientId || cfg.sharedClientId || undefined,
          webClientId: cfg.webClientId || cfg.sharedClientId || undefined,
        }
      : {
          webClientId: cfg.webClientId || undefined,
          expoClientId: cfg.expoClientId || undefined,
          iosClientId: cfg.iosClientId || undefined,
        }),
  };

  const request = AuthSession.useLoadedAuthRequest(requestConfig, GOOGLE_DISCOVERY, GooglePkceAuthRequest);
  const [response, promptAsync] = AuthSession.useAuthRequestResult(request, GOOGLE_DISCOVERY, {
    windowFeatures: { width: 515, height: 680 },
  });
  const [fullResponse, setFullResponse] = useState(null);
  const shouldAutoExchangeCode = useMemo(() => {
    return response?.type === 'success' && response.params.code && !response.authentication;
  }, [response?.authentication, response?.params?.code, response?.type]);

  useEffect(() => {
    let isMounted = true;

    if (shouldAutoExchangeCode && response?.type === 'success' && response?.params?.code) {
      AuthSession.exchangeCodeAsync(
        {
          clientId: cfg.androidClientId || cfg.webClientId || cfg.expoClientId || cfg.iosClientId || cfg.sharedClientId,
          code: response.params.code,
          redirectUri: requestConfig.redirectUri,
          extraParams: {
            code_verifier: request?.codeVerifier || '',
          },
        },
        GOOGLE_DISCOVERY
      )
        .then((authentication) => {
          if (!isMounted) {
            return;
          }

          setFullResponse({
            ...response,
            params: {
              id_token: authentication?.idToken || '',
              access_token: authentication?.accessToken || '',
              ...response.params,
            },
            authentication,
          });
        })
        .catch(async (error) => {
          if (isMounted) {
            setFullResponse(response);
          }
          await logCriticalError('authService.useGoogleAuth.exchangeCode', error);
        });
    } else {
      setFullResponse(response);
    }

    return () => {
      isMounted = false;
    };
  }, [cfg.androidClientId, cfg.expoClientId, cfg.iosClientId, cfg.sharedClientId, cfg.webClientId, request?.codeVerifier, requestConfig.redirectUri, response, shouldAutoExchangeCode]);

  // Log request URL for OAuth debugging
  if (request) {
    console.log('[AUTH][GOOGLE][REQUEST_URL]', request.url || 'pending');
    console.log('[AUTH][GOOGLE][REDIRECT_URI]', request.redirectUri || 'none');
    console.log('[AUTH][GOOGLE][CLIENT_ID_USED]', requestConfig.androidClientId || requestConfig.webClientId || requestConfig.expoClientId || requestConfig.iosClientId);
    console.log('[AUTH][GOOGLE][PLATFORM_FLOW]', JSON.stringify({ platform: Platform.OS, isAndroid, usePKCE: requestConfig.usePKCE, hasCodeVerifier: Boolean(request.codeVerifier), hasCodeChallenge: Boolean(request.codeChallenge) }));
  }

  return { request, response: fullResponse, promptAsync };
}

export const exchangeGoogleAuthCode = async ({ code, redirectUri, codeVerifier }) => {
  const safeCode = String(code || '').trim();
  const safeRedirect = String(redirectUri || '').trim();
  if (!safeCode || !safeRedirect) {
    return null;
  }

  const cfg = getGoogleClientConfig();
  const clientId = cfg.androidClientId || cfg.sharedClientId || cfg.webClientId || '';
  if (!clientId) {
    return null;
  }

  try {
    const tokenResponse = await AuthSession.exchangeCodeAsync(
      {
        clientId,
        code: safeCode,
        redirectUri: safeRedirect,
        extraParams: codeVerifier ? { code_verifier: String(codeVerifier) } : undefined,
      },
      GOOGLE_DISCOVERY
    );

    const accessToken = String(tokenResponse?.accessToken || '').trim() || null;
    const idToken = String(tokenResponse?.idToken || '').trim() || null;
    console.log('[AUTH][GOOGLE][CODE_EXCHANGE_OK]', JSON.stringify({ hasAccessToken: Boolean(accessToken), hasIdToken: Boolean(idToken) }));
    return { accessToken, idToken };
  } catch (error) {
    await logCriticalError('authService.exchangeGoogleAuthCode', error);
    return null;
  }
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

    // Nenhum token util disponivel — rejeitar explicitamente.
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
