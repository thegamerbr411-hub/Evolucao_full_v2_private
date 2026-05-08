import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  applyActionCode,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  verifyPasswordResetCode,
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
} from '../services/authService.js';
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
  if (code.includes('auth/operation-not-allowed')) return 'Metodo de login nao habilitado no Firebase Console.';
  if (code.includes('auth/invalid-action-code')) return 'Codigo invalido ou expirado. Solicite um novo codigo.';
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
  const [verificationCode, setVerificationCode] = useState('');
  const [codeMode, setCodeMode] = useState('verify_email');
  const [isCodeVerified, setIsCodeVerified] = useState(false);
  const [codeSentAt, setCodeSentAt] = useState(0);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [statusMessage, setStatusMessage] = useState('Preencha seus dados para continuar.');
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
    setStatusMessage('Autenticado com sucesso. Redirecionando...');
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
    setIsCodeVerified(false);
    setVerificationCode('');
    setCodeSentAt(0);
    setCodeMode(mode === 'register' ? 'verify_email' : 'password_reset');
    if (mode !== 'login') {
      setPendingGoogleUser(null);
    }
  }, [email, mode]);

  React.useEffect(() => {
    const handleGoogleResponse = async () => {
      if (!response || response.type !== 'success') {
        if (response?.type === 'error') {
          const responseError = String(response?.error?.message || response?.params?.error_description || response?.params?.error || 'Falha na autenticacao Google.');
          setToast(`Erro no login Google: ${responseError}`);
          setStatusMessage(`Erro Google: ${responseError}`);
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
          setStatusMessage('Google respondeu, mas sem usuario valido.');
          return;
        }

        const resolvedEmail = String(loggedUser.email || email || '').trim().toLowerCase();
        if (!resolvedEmail) {
          setToast('Google autenticou, mas nao retornou e-mail valido.');
          setStatusMessage('Google sem e-mail valido para verificacao por codigo.');
          return;
        }

        setMode('login');
        setEmail(resolvedEmail);
        if (loggedUser.name && !String(name || '').trim()) {
          setName(loggedUser.name);
        }
        setPendingGoogleUser({
          id: loggedUser.id,
          role: loggedUser.role || 'user',
          name: loggedUser.name || name || 'Usuario',
          email: resolvedEmail,
          source: loggedUser.source || 'google',
        });
        setCodeMode('password_reset');
        setIsCodeVerified(false);
        setCodeSentAt(0);
        setToast('Google conectado. Envie e valide o codigo do e-mail para concluir a entrada.');
        setStatusMessage('Google conectado. Falta validar o codigo recebido por e-mail.');
      } catch (error) {
        setToast(`Erro no login Google: ${String(error?.message || 'Nao foi possivel autenticar agora.')}`);
        setStatusMessage(`Erro Google: ${String(error?.message || 'nao foi possivel autenticar agora.')}`);
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
      setStatusMessage('Informe um e-mail valido para recuperar a senha.');
      return;
    }

    setLoading(true);
    const clearWatchdog = startLoadingWatchdog(setLoading, setToast);
    try {
      const result = await requestPasswordReset(safeEmail);
      if (!result?.ok) {
        setToast(result?.message || 'Nao foi possivel enviar o e-mail de recuperacao.');
        setStatusMessage(result?.message || 'Falha no envio de recuperacao.');
        return;
      }

      setToast('Enviamos um link de recuperacao para seu e-mail. Verifique inbox e spam.');
      setStatusMessage('Link de recuperacao enviado para o e-mail.');
      setShowForgotPassword(false);
    } finally {
      clearWatchdog();
      setLoading(false);
    }
  };

  const handleSendEmailCode = async () => {
    const safeName = String(name || '').trim();
    const safeEmail = String(email || '').trim().toLowerCase();
    const safePassword = String(password || '').trim();
    const requiresPasswordForCode = mode === 'register' || (mode === 'login' && !pendingGoogleUser);

    if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      setToast('Informe um e-mail valido para receber o codigo.');
      setStatusMessage('E-mail invalido para envio de codigo.');
      return;
    }

    if (requiresPasswordForCode && (!safePassword || safePassword.length < 6)) {
      setToast('Defina uma senha com pelo menos 6 caracteres antes de enviar o codigo.');
      setStatusMessage('Senha precisa ter ao menos 6 caracteres.');
      return;
    }

    if (mode === 'register' && !safeName) {
      setToast('Informe seu nome antes de enviar o codigo.');
      setStatusMessage('Preencha seu nome antes do envio de codigo.');
      return;
    }

    if (!isFirebaseConfigured || !auth) {
      setToast('Firebase nao configurado. Verifique EXPO_PUBLIC_FIREBASE_* e tente novamente.');
      setStatusMessage('Firebase nao configurado neste build.');
      return;
    }

    setLoading(true);
    setStatusMessage('Enviando codigo de verificacao...');
    const clearWatchdog = startLoadingWatchdog(setLoading, setToast);
    try {
      let firebaseUser = null;
      const methods = await withPromiseTimeout(
        fetchSignInMethodsForEmail(auth, safeEmail),
        FIREBASE_AUTH_TIMEOUT_MS,
        'Consulta de conta demorou para responder.'
      );

      if (Array.isArray(methods) && methods.length > 0) {
        await withPromiseTimeout(
          sendPasswordResetEmail(auth, safeEmail),
          FIREBASE_AUTH_TIMEOUT_MS,
          'Envio do codigo por e-mail demorou para responder.'
        );
        setCodeMode('password_reset');
        setIsCodeVerified(false);
        setCodeSentAt(Date.now());
        setToast('Codigo enviado para seu e-mail. Copie o oobCode do link e valide no app.');
        setStatusMessage('Codigo enviado para e-mail de conta existente. Valide o oobCode para continuar.');
        return;
      } else {
        if (mode === 'register') {
          const createResult = await withPromiseTimeout(
            createUserWithEmailAndPassword(auth, safeEmail, safePassword),
            FIREBASE_AUTH_TIMEOUT_MS,
            'Criacao da conta demorou para responder.'
          );
          firebaseUser = createResult?.user || null;
          setCodeMode('verify_email');
          if (firebaseUser) {
            await updateProfile(firebaseUser, { displayName: safeName }).catch(() => {});
          }
        } else {
          setToast('Conta nao encontrada para este e-mail.');
          setStatusMessage('Conta nao encontrada para envio de codigo.');
          return;
        }
      }

      if (!firebaseUser) {
        setToast('Nao foi possivel preparar a conta para envio do codigo.');
        setStatusMessage('Falha ao preparar conta para envio do codigo.');
        return;
      }

      if (firebaseUser.emailVerified) {
        setIsCodeVerified(true);
        setCodeSentAt(Date.now());
        setToast('Este e-mail ja esta verificado. Voce ja pode concluir.');
        setStatusMessage('E-mail ja verificado. Fluxo liberado.');
        return;
      }

      await withPromiseTimeout(
        sendEmailVerification(firebaseUser),
        FIREBASE_AUTH_TIMEOUT_MS,
        'Envio do codigo por e-mail demorou para responder.'
      );
      await signOut(auth).catch(() => {});

      setIsCodeVerified(false);
      setCodeSentAt(Date.now());
      setToast('Codigo enviado para seu e-mail. Copie o valor oobCode do link recebido e valide no app.');
      setStatusMessage('Codigo enviado. Agora valide o oobCode no campo abaixo.');
    } catch (error) {
      setToast(mapFirebaseAuthError(error));
      setStatusMessage(mapFirebaseAuthError(error));
      logAuth('send_code_error', { code: String(error?.code || ''), email: safeEmail });
    } finally {
      clearWatchdog();
      setLoading(false);
    }
  };

  const handleValidateEmailCode = async () => {
    const safeCode = String(verificationCode || '').trim();
    if (!safeCode) {
      setToast('Informe o codigo recebido por e-mail para validar.');
      setStatusMessage('Preencha o codigo recebido por e-mail.');
      return;
    }

    if (!isFirebaseConfigured || !auth) {
      setToast('Firebase nao configurado. Verifique EXPO_PUBLIC_FIREBASE_* e tente novamente.');
      setStatusMessage('Firebase nao configurado neste build.');
      return;
    }

    setLoading(true);
    setStatusMessage('Validando codigo...');
    const clearWatchdog = startLoadingWatchdog(setLoading, setToast);
    try {
      if (codeMode === 'password_reset') {
        await withPromiseTimeout(
          verifyPasswordResetCode(auth, safeCode),
          FIREBASE_AUTH_TIMEOUT_MS,
          'Validacao do codigo demorou para responder.'
        );
      } else {
        await withPromiseTimeout(
          applyActionCode(auth, safeCode),
          FIREBASE_AUTH_TIMEOUT_MS,
          'Validacao do codigo demorou para responder.'
        );
      }
      setIsCodeVerified(true);
      setToast('Codigo validado com sucesso. Fluxo liberado.');
      setStatusMessage(mode === 'login' ? 'Codigo validado. Toque em Entrar para concluir.' : 'Codigo validado. Toque em Cadastrar para concluir.');
    } catch (error) {
      setIsCodeVerified(false);
      const mapped = mapFirebaseAuthError(error);
      setToast(mapped);
      setStatusMessage(mapped);
      logAuth('verify_code_error', { code: String(error?.code || '') });
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
      setStatusMessage('Informe um e-mail valido.');
      return;
    }

    if (!pendingGoogleUser && (!safePassword || safePassword.length < 6)) {
      setToast('Senha obrigatoria com pelo menos 6 caracteres.');
      setStatusMessage('Senha invalida: minimo de 6 caracteres.');
      return;
    }

    if (mode === 'register' && !safeName) {
      setToast('Informe seu nome para continuar.');
      setStatusMessage('Preencha seu nome para continuar.');
      return;
    }

    if (!isCodeVerified) {
      setToast('Valide o codigo enviado para seu e-mail antes de cadastrar.');
      setStatusMessage('Valide o codigo de e-mail antes de concluir.');
      return;
    }

    setLoading(true);
    setStatusMessage(mode === 'login' ? 'Entrando na conta...' : 'Concluindo cadastro...');
    const clearWatchdog = startLoadingWatchdog(setLoading, setToast);
    try {
      if (!isFirebaseConfigured || !auth) {
        setToast('Firebase nao configurado. Verifique EXPO_PUBLIC_FIREBASE_* e tente novamente.');
        setStatusMessage('Firebase nao configurado neste build.');
        logAuth('firebase_not_configured', { safeEmail });
        return;
      }

      if (mode === 'login') {
        if (pendingGoogleUser) {
          await finalizeAuthenticatedSession({
            id: pendingGoogleUser.id,
            role: pendingGoogleUser.role || 'user',
            name: pendingGoogleUser.name || 'Usuario',
            email: pendingGoogleUser.email || safeEmail,
          }, pendingGoogleUser.source || 'google');

          setPendingGoogleUser(null);
          setToast('Login Google concluido com sucesso.');
          setStatusMessage('Login Google realizado com sucesso.');
          return;
        }

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
            setStatusMessage('Falha no login: usuario nao retornado.');
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
          setStatusMessage('Login realizado com sucesso.');
          return;
        } catch (error) {
          const mapped = mapFirebaseAuthError(error);
          setToast(mapped);
          setStatusMessage(mapped);
          logAuth('login_error', { safeEmail, code: String(error?.code || '') });
          return;
        }
      }

      try {
        logAuth('register_start', { safeEmail });
        const signInResult = await runAuthOperation('register_signin', () => withPromiseTimeout(
          signInWithEmailAndPassword(auth, safeEmail, safePassword),
          FIREBASE_AUTH_TIMEOUT_MS,
          'Cadastro demorou para responder. Tente novamente.'
        ));

        const firebaseUser = signInResult?.user;
        if (!firebaseUser) {
          setToast('Nao foi possivel concluir o cadastro.');
          setStatusMessage('Falha ao concluir cadastro.');
          return;
        }

        await firebaseUser.reload().catch(() => {});
        if (!firebaseUser.emailVerified) {
          setToast('Codigo ainda nao confirmado. Valide o codigo enviado no e-mail.');
          setStatusMessage('Codigo nao confirmado. Valide o codigo de e-mail.');
          return;
        }

        await finalizeAuthenticatedSession({
          id: firebaseUser.uid,
          role: 'user',
          name: safeName || firebaseUser.displayName || 'Usuario',
          email: safeEmail,
        }, 'firebase_register');

        logAuth('register_success', { uid: firebaseUser.uid, safeEmail });
        setToast('Conta criada com sucesso.');
        setStatusMessage('Cadastro concluido com sucesso.');
      } catch (error) {
        const mapped = mapFirebaseAuthError(error);
        setToast(mapped);
        setStatusMessage(mapped);
        logAuth('register_error', { safeEmail, code: String(error?.code || '') });
      }
    } catch {
      setToast('Erro inesperado. Tente novamente.');
      setStatusMessage('Erro inesperado. Tente novamente.');
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
              <TouchableOpacity
                {...qaProps(QA_ELEMENTS.btnGoRegister)}
                onPress={() => {
                  setMode('register');
                  setShowForgotPassword(false);
                  setStatusMessage('Modo cadastro ativo.');
                }}
                style={[styles.modeToggle, mode === 'register' ? styles.modeToggleActive : styles.modeToggleInactive]}
              >
                <Text style={[styles.modeToggleText, mode === 'register' ? styles.modeToggleTextActive : null]}>Cadastrar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                {...qaProps(QA_ELEMENTS.btnGoLogin)}
                onPress={() => {
                  setMode('login');
                  setShowForgotPassword(false);
                  setStatusMessage('Modo login ativo.');
                }}
                style={[styles.modeToggle, mode === 'login' ? styles.modeToggleActive : styles.modeToggleInactive]}
              >
                <Text style={[styles.modeToggleText, mode === 'login' ? styles.modeToggleTextActive : null]}>Entrar</Text>
              </TouchableOpacity>
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

            <View style={styles.spacer} />
            <AppInput
              label="Codigo de verificacao"
              value={verificationCode}
              onChangeText={setVerificationCode}
              placeholder="Digite o codigo recebido no e-mail"
              keyboardType="number-pad"
            />

            <View style={styles.codeActionsRow}>
              <PrimaryButton
                title={loading ? 'Enviando...' : 'Enviar codigo'}
                onPress={handleSendEmailCode}
                style={styles.codeActionButton}
              />

              <PrimaryButton
                title={loading ? 'Validando...' : 'Validar codigo'}
                onPress={handleValidateEmailCode}
                style={styles.codeActionButton}
              />
            </View>

            <Text style={styles.helperText}>
              {isCodeVerified
                ? mode === 'login'
                  ? 'Codigo validado. Toque em Entrar para concluir.'
                  : 'Codigo validado. Toque em Cadastrar para concluir.'
                : codeSentAt
                ? 'Codigo enviado. Valide o codigo para liberar o acesso.'
                : 'Primeiro envie e valide o codigo do seu e-mail.'}
            </Text>

            {mode === 'login' ? (
              <Text style={styles.linkText} onPress={() => setShowForgotPassword((prev) => !prev)}>
                Esqueci minha senha
              </Text>
            ) : null}

            <View style={styles.statusBox}>
              <Text style={styles.statusLabel}>Status</Text>
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>

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
            title={loading ? 'Processando...' : mode === 'login' ? 'Entrar' : 'Cadastrar'}
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
                  setToast('Google carregando. Aguarde alguns segundos e tente novamente.');
                  setStatusMessage('Aguardando inicializacao do Google Sign-In...');
                  return;
                }

                promptAsync({ useProxy: false }).catch(() => {
                  setToast('Falha no login. Nao foi possivel abrir o fluxo do Google.');
                  setStatusMessage('Falha ao abrir o fluxo Google.');
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
    alignItems: 'center',
    marginBottom: spacing.md,
    backgroundColor: '#edf2f7',
    borderRadius: 14,
    padding: 4,
  },
  modeToggle: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeToggleActive: {
    backgroundColor: '#0f172a',
  },
  modeToggleInactive: {
    backgroundColor: 'transparent',
  },
  modeToggleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  modeToggleTextActive: {
    color: '#f8fafc',
  },
  spacer: {
    height: spacing.sm,
  },
  codeActionsRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  codeActionButton: {
    flex: 1,
  },
  helperText: {
    marginTop: spacing.sm,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  statusBox: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
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
