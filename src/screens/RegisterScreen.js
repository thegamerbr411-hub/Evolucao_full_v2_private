import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { AnimatedToast, AppCard, AppInput, PrimaryButton } from '../components/ui';
import { getOrCreateUserIdentity, saveUserIdentity } from '../services/appIdentityService';
import { auth, isFirebaseConfigured } from '../services/firebase';
import {
  isGoogleAuthConfigured,
  loginWithGoogleToken,
  logoutGoogleSession,
  requestPasswordReset,
  useGoogleAuth,
} from '../services/authService';
import { setQaRuntimeAuth } from '../utils/qaTransport';
import { colors, spacing } from '../theme';
import { QA_ELEMENTS, QA_SCREENS, qaProps } from '../qa/selectorRegistry';
import { setQaAuthState, setQaLoadingState } from '../qa/qaAutomationState';

const FIREBASE_AUTH_TIMEOUT_MS = 8000;
const UI_LOADING_WATCHDOG_MS = 12000;

function startLoadingWatchdog(setLoading, setToast, timeoutMs = UI_LOADING_WATCHDOG_MS) {
  const safeTimeout = Math.max(8000, Number(timeoutMs || UI_LOADING_WATCHDOG_MS));
  const timerId = setTimeout(() => {
    setLoading(false);
    setToast('A operacao demorou mais do que o esperado. Tente novamente.');
  }, safeTimeout);

  return () => clearTimeout(timerId);
}

async function withPromiseTimeout(promise, timeoutMs = FIREBASE_AUTH_TIMEOUT_MS, timeoutMessage = 'Tempo limite de autenticacao excedido.') {
  const safeTimeout = Math.max(2000, Number(timeoutMs || FIREBASE_AUTH_TIMEOUT_MS));
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), safeTimeout);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

function logAuth(step, meta = {}) {
  if (__DEV__) {
    console.log('[AUTH_FLOW]', step, meta);
  }
}

function mapFirebaseAuthError(error) {
  const code = String(error?.code || '').toLowerCase();
  if (code.includes('auth/invalid-email')) return 'E-mail invalido.';
  if (code.includes('auth/user-not-found')) return 'Conta nao encontrada.';
  if (code.includes('auth/wrong-password')) return 'Senha incorreta.';
  if (code.includes('auth/invalid-credential')) return 'Credenciais invalidas.';
  if (code.includes('auth/email-already-in-use')) return 'Este e-mail ja esta em uso.';
  if (code.includes('auth/weak-password')) return 'Senha fraca. Use pelo menos 6 caracteres.';
  if (code.includes('auth/network-request-failed')) return 'Falha de rede. Verifique sua conexao e tente novamente.';
  if (code.includes('auth/too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  return String(error?.message || 'Falha na autenticacao. Tente novamente.');
}

async function runAuthOperation(label, operation, maxRetries = 1) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      return await operation();
    } catch (error) {
      const code = String(error?.code || '').toLowerCase();
      const isTransient = code.includes('network-request-failed') || code.includes('too-many-requests');
      if (!isTransient || attempt >= maxRetries) {
        throw error;
      }
      logAuth(`${label}_retry`, { attempt: attempt + 1, code });
    }
    attempt += 1;
  }

  throw new Error('AUTH_OPERATION_FAILED');
}

export default function RegisterScreen({ navigation }) {
  const { setUser } = useApp();
  const [mode, setMode] = useState('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [toast, setToast] = useState('');
  const { request, promptAsync, response } = useGoogleAuth();
  const googleConfigured = isGoogleAuthConfigured();

  const finalizeAuthenticatedSession = React.useCallback(async (nextUser, source = 'auth') => {
    const resolvedUser = nextUser || {};
    const resolvedId = String(resolvedUser.id || '').trim();
    const identity = resolvedId ? { userId: resolvedId } : await getOrCreateUserIdentity();
    const userId = resolvedId || identity.userId;

    await saveUserIdentity({ userId, source });
    setQaRuntimeAuth({ userId });
    setUser({
      id: userId,
      role: resolvedUser.role || 'user',
      name: resolvedUser.name || 'Usuario',
      email: resolvedUser.email || null,
    });
    navigation.replace('MainTabs');
  }, [navigation, setUser]);

  React.useEffect(() => {
    setQaAuthState({
      hydrated: true,
      hasAccount: false,
      userId: null,
    });
  }, []);

  React.useEffect(() => {
    setQaLoadingState(loading, loading ? `register_${mode}` : null);
  }, [loading, mode]);

  React.useEffect(() => {
    const handleGoogleResponse = async () => {
      if (!response || response.type !== 'success') {
        if (response?.type === 'error') {
          const responseError = String(response?.error?.message || response?.params?.error_description || response?.params?.error || 'Falha na autenticacao Google.');
          setToast(`Erro no login Google: ${responseError}`);
        }
        return;
      }

      setGoogleLoading(true);
      const clearWatchdog = startLoadingWatchdog(setGoogleLoading, setToast);
      try {
        const authData = response.authentication || {};
        const idToken = authData.idToken || response?.params?.id_token || null;
        const loggedUser = await loginWithGoogleToken({
          accessToken: authData.accessToken || null,
          idToken,
        });

        if (!loggedUser?.id) {
          setToast('Falha no login Google. Nao foi possivel obter usuario valido.');
          return;
        }

        await finalizeAuthenticatedSession({
          id: loggedUser.id,
          role: loggedUser.role || 'user',
          name: loggedUser.name || name || 'Usuario',
          email: loggedUser.email || String(email || '').trim().toLowerCase() || null,
        }, loggedUser.source || 'google');
      } catch (error) {
        setToast(`Erro no login Google: ${String(error?.message || 'Nao foi possivel autenticar agora.')}`);
      } finally {
        clearWatchdog();
        setGoogleLoading(false);
      }
    };

    handleGoogleResponse();
  }, [email, finalizeAuthenticatedSession, name, response]);

  const handleForgotPassword = async () => {
    const safeEmail = String(email || '').trim().toLowerCase();
    if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      setToast('Informe seu e-mail para recuperar a senha.');
      return;
    }

    setLoading(true);
    const clearWatchdog = startLoadingWatchdog(setLoading, setToast);
    try {
      const result = await requestPasswordReset(safeEmail);
      if (!result?.ok) {
        setToast(result?.message || 'Nao foi possivel enviar o e-mail de recuperacao.');
        return;
      }

      setToast('Enviamos um link de recuperacao para seu e-mail. Verifique inbox e spam.');
      setShowForgotPassword(false);
    } finally {
      clearWatchdog();
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const safeName = String(name || '').trim();
    const safeEmail = String(email || '').trim().toLowerCase();
    const safePassword = String(password || '').trim();

    if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      setToast('Informe um e-mail valido para continuar.');
      return;
    }

    if (!safePassword || safePassword.length < 6) {
      setToast('Senha obrigatoria com pelo menos 6 caracteres.');
      return;
    }

    if (mode === 'register' && !safeName) {
      setToast('Informe seu nome para continuar.');
      return;
    }

    setLoading(true);
    const clearWatchdog = startLoadingWatchdog(setLoading, setToast);
    try {
      if (!isFirebaseConfigured || !auth) {
        setToast('Firebase nao configurado. Verifique EXPO_PUBLIC_FIREBASE_* e tente novamente.');
        logAuth('firebase_not_configured', { safeEmail });
        return;
      }

      if (mode === 'login') {
        try {
          logAuth('login_start', { safeEmail });
          const signInResult = await runAuthOperation('login', () => withPromiseTimeout(
            signInWithEmailAndPassword(auth, safeEmail, safePassword),
            FIREBASE_AUTH_TIMEOUT_MS,
            'Login demorou para responder. Tente novamente.'
          ));

          const firebaseUser = signInResult?.user;
          if (!firebaseUser) {
            setToast('Falha no login. Tente novamente.');
            return;
          }

          await finalizeAuthenticatedSession({
            id: firebaseUser.uid,
            role: 'user',
            name: String(firebaseUser.displayName || safeName || 'Usuario'),
            email: safeEmail,
          }, 'firebase_login');

          logAuth('login_success', { uid: firebaseUser.uid, safeEmail });
          setToast('Login concluido com sucesso.');
          return;
        } catch (error) {
          setToast(mapFirebaseAuthError(error));
          logAuth('login_error', { safeEmail, code: String(error?.code || '') });
          return;
        }
      }

      try {
        logAuth('register_start', { safeEmail });
        const registerResult = await runAuthOperation('register', () => withPromiseTimeout(
          createUserWithEmailAndPassword(auth, safeEmail, safePassword),
          FIREBASE_AUTH_TIMEOUT_MS,
          'Cadastro demorou para responder. Tente novamente.'
        ));

        const firebaseUser = registerResult?.user;
        if (!firebaseUser) {
          setToast('Nao foi possivel criar a conta. Tente novamente.');
          return;
        }

        await updateProfile(firebaseUser, { displayName: safeName }).catch(() => {});
        await sendEmailVerification(firebaseUser).catch(() => {});

        await finalizeAuthenticatedSession({
          id: firebaseUser.uid,
          role: 'user',
          name: safeName,
          email: safeEmail,
        }, 'firebase_register');

        logAuth('register_success', { uid: firebaseUser.uid, safeEmail });
        setToast('Conta criada com sucesso.');
      } catch (error) {
        setToast(mapFirebaseAuthError(error));
        logAuth('register_error', { safeEmail, code: String(error?.code || '') });
      }
    } catch {
      setToast('Erro inesperado. Tente novamente.');
    } finally {
      clearWatchdog();
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView {...qaProps(mode === 'login' ? QA_SCREENS.login : QA_SCREENS.register)} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <AnimatedToast message={toast} onHide={() => setToast('')} />

          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Bem-vindo ao Evolucao</Text>
            <Text style={styles.heroSubtitle}>Treinos, nutricao e progresso em um lugar.</Text>
          </View>

          <AppCard style={styles.card}>
            <View style={styles.modeSwitchRow}>
              <PrimaryButton
                {...qaProps(QA_ELEMENTS.btnGoRegister)}
                title="Cadastrar"
                onPress={() => {
                  setMode('register');
                  setShowForgotPassword(false);
                }}
                style={mode === 'register' ? styles.modeSwitchActive : styles.modeSwitchInactive}
              />
              <PrimaryButton
                {...qaProps(QA_ELEMENTS.btnGoLogin)}
                title="Entrar"
                onPress={() => {
                  setMode('login');
                  setShowForgotPassword(false);
                }}
                style={mode === 'login' ? styles.modeSwitchActive : styles.modeSwitchInactive}
              />
            </View>

            <Text style={styles.cardTitle}>{mode === 'login' ? 'Entrar na conta' : 'Criar minha conta'}</Text>

            {mode === 'register' ? (
              <>
                <AppInput
                  {...qaProps(QA_ELEMENTS.inputName)}
                  label="Nome"
                  value={name}
                  onChangeText={setName}
                  placeholder="Seu nome"
                  autoCapitalize="words"
                />
                <View style={styles.spacer} />
              </>
            ) : null}

            <AppInput
              {...qaProps(QA_ELEMENTS.inputEmail)}
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="voce@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <View style={styles.spacer} />

            <AppInput
              {...qaProps(QA_ELEMENTS.inputPassword)}
              label="Senha"
              value={password}
              onChangeText={setPassword}
              placeholder="Minimo 6 caracteres"
              secureTextEntry
            />

            {mode === 'register' ? (
              <Text style={styles.helperText}>Fluxo de cadastro estabilizado em Firebase Auth.</Text>
            ) : (
              <Text style={styles.linkText} onPress={() => setShowForgotPassword((prev) => !prev)}>
                Esqueci minha senha
              </Text>
            )}

            {showForgotPassword && mode === 'login' ? (
              <PrimaryButton
                {...qaProps(QA_ELEMENTS.btnForgotPassword)}
                title={loading ? 'Enviando...' : 'Enviar link de recuperacao'}
                onPress={handleForgotPassword}
                style={styles.btnInline}
              />
            ) : null}
          </AppCard>

          <PrimaryButton
            {...qaProps(mode === 'login' ? QA_ELEMENTS.btnLogin : QA_ELEMENTS.btnRegister)}
            title={loading ? 'Processando...' : mode === 'login' ? 'Entrar agora' : 'Cadastrar'}
            onPress={handleSubmit}
            style={styles.btn}
          />

          {googleConfigured ? (
            <PrimaryButton
              {...qaProps(QA_ELEMENTS.btnGoogleLogin)}
              title={googleLoading ? 'Conectando Google...' : 'Entrar com Google'}
              onPress={() => {
                if (googleLoading) return;
                if (!request) {
                  setToast('Login Google indisponivel no momento. Reabra a tela e tente novamente.');
                  return;
                }

                promptAsync({ useProxy: false }).catch(() => {
                  setToast('Falha no login. Nao foi possivel abrir o fluxo do Google.');
                });
              }}
              style={styles.btnGoogle}
            />
          ) : (
            <PrimaryButton
              {...qaProps(QA_ELEMENTS.btnGoogleLogout)}
              title={googleLoading ? 'Sincronizando...' : 'Google indisponivel neste build'}
              onPress={async () => {
                if (googleLoading) return;
                setGoogleLoading(true);
                const clearWatchdog = startLoadingWatchdog(setGoogleLoading, setToast);
                try {
                  await logoutGoogleSession();
                  setToast('Google OAuth nao esta configurado neste build. Verifique google-services e IDs de cliente.');
                } finally {
                  clearWatchdog();
                  setGoogleLoading(false);
                }
              }}
              style={styles.btnGoogleDisabled}
            />
          )}

          <Text style={styles.terms}>Seus dados sao protegidos com Firebase Auth e persistencia local segura.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  modeSwitchRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  modeSwitchActive: {
    flex: 1,
  },
  modeSwitchInactive: {
    flex: 1,
    opacity: 0.7,
  },
  spacer: {
    height: spacing.sm,
  },
  helperText: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  linkText: {
    marginTop: spacing.sm,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  btnInline: {
    marginTop: spacing.sm,
  },
  btn: {
    marginTop: spacing.md,
  },
  btnGoogle: {
    marginTop: spacing.sm,
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  btnGoogleDisabled: {
    marginTop: spacing.sm,
    opacity: 0.82,
  },
  terms: {
    marginTop: spacing.md,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
});
