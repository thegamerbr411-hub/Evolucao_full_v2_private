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
import { setQaRuntimeAuth } from '../utils/qaTransport';
import { requestPasswordReset, loginWithGoogleToken } from '../services/authService';
import { colors, spacing } from '../theme';

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
  const [toast, setToast] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleRequest = null;
  const googleResponse = null;
  const promptAsync = async () => ({ type: 'error' });
  const googleConfigured = false;

  React.useEffect(() => {
    const handleGoogleResponse = async () => {
      if (!googleResponse) {
        return;
      }

      if (googleResponse.type === 'error') {
        const reason = String(googleResponse?.error?.message || googleResponse?.params?.error_description || 'Falha no login Google.');
        setToast(`Erro Google: ${reason}`);
        return;
      }

      if (googleResponse.type !== 'success') {
        return;
      }

      setGoogleLoading(true);
      try {
        const authData = googleResponse.authentication || {};
        const idToken = authData.idToken || googleResponse?.params?.id_token || null;
        const loggedUser = await loginWithGoogleToken({
          accessToken: authData.accessToken,
          idToken,
        });

        if (!loggedUser?.id) {
          setToast('Falha no login Google. Tente novamente.');
          return;
        }

        await saveUserIdentity({ userId: loggedUser.id, source: loggedUser.source || 'google' });
        setQaRuntimeAuth({ userId: loggedUser.id });
        setUser({
          id: loggedUser.id,
          role: loggedUser.role || 'user',
          name: loggedUser.name || 'Usuario',
          email: loggedUser.email || null,
        });
        navigation.replace('Questionario');
      } catch (error) {
        setToast(`Erro no login Google: ${String(error?.message || 'nao foi possivel autenticar.')}`);
      } finally {
        setGoogleLoading(false);
      }
    };

    handleGoogleResponse();
  }, [googleResponse, navigation, setUser]);

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
        setToast(result?.message || 'Não foi possível enviar o e-mail de recuperação.');
        return;
      }

      setToast('Enviamos um link de recuperação para seu e-mail. Verifique inbox e spam.');
      setShowForgotPassword(false);
    } finally {
      clearWatchdog();
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const safeName = String(name || '').trim();
    const safeEmail = String(email || '').trim().toLowerCase();

    if (!safeEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeEmail)) {
      setToast('Informe um e-mail válido para continuar.');
      return;
    }

    if (!String(password || '').trim() || String(password || '').trim().length < 6) {
      setToast('Senha obrigatória com pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    const clearWatchdog = startLoadingWatchdog(setLoading, setToast);
    try {
      if (!isFirebaseConfigured || !auth) {
        setToast('Firebase nao configurado. Verifique as variaveis EXPO_PUBLIC_FIREBASE_* e tente novamente.');
        logAuth('firebase_not_configured', { safeEmail });
        return;
      }

      if (mode === 'login') {
        try {
          logAuth('login_start', { safeEmail });
          const signInResult = await runAuthOperation('login', () => withPromiseTimeout(
            signInWithEmailAndPassword(auth, safeEmail, String(password || '')),
            FIREBASE_AUTH_TIMEOUT_MS,
            'Login demorou para responder. Tente novamente.'
          ));

          const firebaseUser = signInResult?.user;
          if (!firebaseUser) {
            setToast('Falha no login. Tente novamente.');
            logAuth('login_failed_no_user', { safeEmail });
            return;
          }

          const identity = await getOrCreateUserIdentity();
          await saveUserIdentity({ userId: firebaseUser.uid || identity.userId, source: 'firebase_login' });
          setQaRuntimeAuth({ userId: firebaseUser.uid || identity.userId });

          setUser({
            id: firebaseUser.uid || identity.userId,
            role: 'user',
            name: String(firebaseUser.displayName || safeName || 'Usuario'),
            email: safeEmail,
          });

          logAuth('login_success', { uid: firebaseUser.uid, safeEmail });
          setToast('Login concluido com sucesso.');
          navigation.replace('MainTabs');
          return;
        } catch (error) {
          const message = mapFirebaseAuthError(error);
          setToast(message);
          logAuth('login_error', { safeEmail, code: String(error?.code || ''), message: String(error?.message || '') });
          return;
        }
      }

      if (!safeName) {
        setToast('Informe seu nome para continuar.');
        return;
      }

      try {
        logAuth('register_start', { safeEmail });
        const registerResult = await runAuthOperation('register', () => withPromiseTimeout(
          createUserWithEmailAndPassword(auth, safeEmail, String(password || '')),
          FIREBASE_AUTH_TIMEOUT_MS,
          'Cadastro demorou para responder. Tente novamente.'
        ));

        const firebaseUser = registerResult?.user;
        if (!firebaseUser) {
          setToast('Nao foi possivel criar a conta. Tente novamente.');
          logAuth('register_failed_no_user', { safeEmail });
          return;
        }

        await updateProfile(firebaseUser, { displayName: safeName }).catch(() => {
          logAuth('register_update_profile_failed', { safeEmail });
        });

        await sendEmailVerification(firebaseUser).then(() => {
          logAuth('register_verification_email_sent', { safeEmail });
        }).catch((error) => {
          logAuth('register_verification_email_failed', { safeEmail, code: String(error?.code || '') });
        });

        const identity = await getOrCreateUserIdentity();
        await saveUserIdentity({ userId: firebaseUser.uid || identity.userId, source: 'firebase_register' });
        setQaRuntimeAuth({ userId: firebaseUser.uid || identity.userId });

        setUser({
          id: firebaseUser.uid || identity.userId,
          role: 'user',
          name: safeName,
          email: safeEmail,
        });

        logAuth('register_success', { uid: firebaseUser.uid, safeEmail });
        setToast('Conta criada com sucesso.');
        navigation.replace('MainTabs');
      } catch (error) {
        const message = mapFirebaseAuthError(error);
        setToast(message);
        logAuth('register_error', { safeEmail, code: String(error?.code || ''), message: String(error?.message || '') });
      }
    } catch {
      setToast('Erro ao criar conta. Tente novamente.');
    } finally {
      clearWatchdog();
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AnimatedToast message={toast} onHide={() => setToast('')} />

          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoEmoji}>⚡</Text>
            </View>
            <Text style={styles.heroTitle}>Bem-vindo ao Evolução</Text>
            <Text style={styles.heroSubtitle}>
              Seu treinador pessoal com IA. Treinos, nutrição e progresso — tudo em um lugar.
            </Text>
          </View>

          {/* Benefícios */}
          <View style={styles.benefitsRow}>
            {[
              { icon: '💪', text: 'Treinos personalizados' },
              { icon: '🍗', text: 'Controle de nutrição' },
              { icon: '📈', text: 'Progresso em tempo real' },
            ].map((item) => (
              <View key={item.text} style={styles.benefitItem}>
                <Text style={styles.benefitIcon}>{item.icon}</Text>
                <Text style={styles.benefitText}>{item.text}</Text>
              </View>
            ))}
          </View>

          {/* Form */}
          <AppCard style={styles.card}>
            <View style={styles.modeSwitchRow}>
              <PrimaryButton
                title="Cadastrar"
                onPress={() => {
                  setMode('register');
                  setShowForgotPassword(false);
                }}
                style={mode === 'register' ? styles.modeSwitchActive : styles.modeSwitchInactive}
              />
              <PrimaryButton
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
              <Text style={styles.codeBoxHint}>
                Cadastro temporariamente padronizado em Firebase Auth para garantir estabilidade no QA.
              </Text>
            ) : null}
                          : 'Seu código de verificação'}
                      </Text>
                      {pendingVerification.delivery === 'email' && !pendingVerification.code ? (
                        <Text style={styles.codeBoxHint}>
                          Enviamos um código de 6 dígitos para {pendingVerification.email}.{'\n'}
                          Verifique sua caixa de entrada e spam.
                        </Text>
                      ) : (
                        <>
                          <Text style={styles.codeBoxValue}>{pendingVerification.code}</Text>
                          <Text style={styles.codeBoxHint}>
                            Copie o código acima e cole no campo abaixo para confirmar seu cadastro.
                          </Text>
                        </>
                      )}
                    </View>
                    <View style={styles.spacer} />
                    <AppInput
                      label="Código de verificação"
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      placeholder="Digite o código de 6 dígitos"
                      keyboardType="numeric"
                    />
                    <PrimaryButton
                      title={loading ? 'Verificando...' : 'Confirmar e entrar'}
                      onPress={handleVerifyEmail}
                      style={styles.btnInline}
                    />
                    <Text
                      style={styles.resendLink}
                      onPress={async () => {
                        const result = await sendCodeViaBackend(pendingVerification.email);
                        if (result.ok) {
                          if (result.delivery !== 'email' && !ALLOW_LOCAL_CODE_FALLBACK) {
                            setToast('Nao foi possivel reenviar por e-mail agora. Tente novamente mais tarde.');
                            return;
                          }

                          setPendingVerification((prev) => ({ ...prev, delivery: result.delivery, code: result.delivery === 'local' ? result.code : undefined }));
                          setVerificationCode('');
                          setToast(result.delivery === 'email' ? 'Novo código enviado por e-mail.' : 'Novo código gerado.');
                        } else {
                          if (!ALLOW_LOCAL_CODE_FALLBACK) {
                            setToast('Nao foi possivel reenviar codigo agora. Tente novamente mais tarde.');
                            return;
                          }

                          const newCode = String(Math.floor(100000 + Math.random() * 900000));
                          setPendingVerification((prev) => ({ ...prev, delivery: 'local', code: newCode }));
                          setVerificationCode('');
                        }
                      }}
                    >
                      Reenviar código
                    </Text>
                </>
              </>
            ) : null}
          </AppCard>

          <PrimaryButton
            title={loading ? 'Processando...' : mode === 'login' ? 'Entrar agora →' : 'Cadastrar →'}
            onPress={handleRegister}
            style={styles.btn}
          />

          {googleConfigured ? (
            <PrimaryButton
              title={googleLoading ? 'Conectando Google...' : 'Entrar com Google'}
              onPress={() => {
                if (googleLoading) return;
                if (!googleRequest) {
                  setToast('Google ainda nao inicializou. Reabra a tela e tente novamente.');
                  return;
                }
                promptAsync({ useProxy: false }).catch(() => {
                  setToast('Nao foi possivel abrir o login Google.');
                });
              }}
              style={styles.btn}
            />
          ) : null}

          <Text style={styles.terms}>
            Seus dados são armazenados localmente no seu dispositivo.{'\n'}
            Nenhuma informação é compartilhada sem sua autorização.
          </Text>
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
  logoContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  logoEmoji: {
    fontSize: 44,
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
  benefitsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.xl,
    gap: 8,
  },
  benefitItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  benefitIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  benefitText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textAlign: 'center',
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
  btnInline: {
    marginTop: spacing.sm,
  },
  spacer: {
    height: spacing.sm,
  },
  btn: {
    marginTop: spacing.md,
  },
  terms: {
    marginTop: spacing.md,
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 17,
  },
  codeBox: {
    backgroundColor: '#1a2233',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
  },
  codeBoxLabel: {
    color: '#93c5fd',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeBoxValue: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 8,
    marginBottom: spacing.sm,
  },
  codeBoxHint: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  resendLink: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
});
