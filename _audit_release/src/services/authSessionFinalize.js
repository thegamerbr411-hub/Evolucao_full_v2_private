import { getOrCreateUserIdentity, saveUserIdentity } from './appIdentityService';
import { useAuthStore } from '../stores/useAuthStore';
import { setQaAuthState } from '../qa/qaAutomationState';
import { setQaRuntimeAuth } from '../utils/qaTransport';

/**
 * Single entry to persist identity + user stores + QA markers after successful auth.
 */
export async function finalizeAuthenticatedSession({
  navigation,
  setUser,
  user,
  source = 'unknown',
}) {
  if (!user?.id) {
    throw new Error('AUTH_FINALIZE_MISSING_USER');
  }

  const payload = {
    id: String(user.id),
    name: String(user.name || 'Usuário'),
    email: user.email ? String(user.email) : null,
    role: String(user.role || 'user'),
  };

  await getOrCreateUserIdentity();
  await saveUserIdentity({ userId: payload.id, source: source || user.source || 'unknown' });
  setQaRuntimeAuth({ userId: payload.id });

  const authStoreUser = useAuthStore.getState().user;
  if (!authStoreUser || authStoreUser.id !== payload.id) {
    useAuthStore.getState().setUser({
      id: payload.id,
      email: payload.email || '',
      name: payload.name,
    });
  }

  setUser(payload);
  setQaAuthState({
    hydrated: true,
    hasAccount: true,
    userId: payload.id,
  });

  if (navigation?.replace) {
    navigation.replace('MainTabs');
  }

  return payload;
}

export function interpretSignInMethods(methods) {
  const list = Array.isArray(methods) ? methods.map((m) => String(m).toLowerCase()) : [];
  const hasGoogle = list.some((m) => m.includes('google'));
  const hasPassword = list.includes('password');
  return {
    hasGoogle,
    hasPassword,
    isEmpty: list.length === 0,
    methods: list,
  };
}

export function messageForSignInMethods(info, mode = 'login') {
  if (!info || info.isEmpty) {
    if (mode === 'register') {
      return null;
    }
    return 'Não encontramos conta com este e-mail. Tente Google ou cadastre-se.';
  }
  if (info.hasGoogle && !info.hasPassword) {
    return 'Esta conta usa Google. Toque em Continuar com Google.';
  }
  if (info.hasGoogle && info.hasPassword) {
    return 'Este e-mail já tem conta. Entre com senha, Google ou recupere o acesso.';
  }
  if (mode === 'register') {
    return 'Este e-mail já tem conta. Entre com Login ou use outro e-mail.';
  }
  return null;
}
