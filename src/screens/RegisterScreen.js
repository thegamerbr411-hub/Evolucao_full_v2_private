import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { AnimatedToast, AppCard, AppInput, PrimaryButton } from '../components/ui';
import { getOrCreateUserIdentity, saveUserIdentity } from '../services/appIdentityService';
import { auth, isFirebaseConfigured } from '../services/firebase';
import { setQaRuntimeAuth } from '../utils/qaTransport';
import { API_BASE_URL } from '../services/api';
import { requestPasswordReset } from '../services/authService';
import { loginWithGoogleToken } from '../services/authService';
import { colors, spacing } from '../theme';

const LOCAL_ACCOUNTS_KEY = 'auth.local.accounts.v1';
const TEMP_FALLBACK_PASSWORDS = new Set(['123456', '12345678', 'evolucao123', 'temp123456']);
const ALLOW_LOCAL_CODE_FALLBACK = typeof __DEV__ !== 'undefined' && __DEV__;
const AUTH_REQUEST_TIMEOUT_MS = 8000;
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

async function withTimeout(requestFactory, timeoutMs = AUTH_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), Math.max(2000, Number(timeoutMs || AUTH_REQUEST_TIMEOUT_MS)));
  try {
    return await requestFactory(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function sendCodeViaBackend(email) {
  try {
    const res = await withTimeout((signal) => fetch(`${API_BASE_URL}/auth/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      signal,
    }));
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error || 'Falha ao enviar código.' };
    return { ok: true, delivery: data.delivery, code: data.code };
  } catch {
    return { ok: false, error: 'Servidor de verificacao indisponivel ou sem resposta.' };
  }
}

async function verifyCodeViaBackend(email, code) {
  try {
    const res = await withTimeout((signal) => fetch(`${API_BASE_URL}/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
      signal,
    }));
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.error || 'Código inválido.' };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Servidor de verificacao indisponivel ou sem resposta.' };
  }
}

async function loadLocalAccounts() {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_ACCOUNTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveLocalAccounts(accounts) {
  await AsyncStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(Array.isArray(accounts) ? accounts : []));
}

export default function RegisterScreen({ navigation }) {
  const { setUser } = useApp();
  const [mode, setMode] = useState('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(null);
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
      const accounts = await loadLocalAccounts();

      if (mode === 'login') {
        if (TEMP_FALLBACK_PASSWORDS.has(String(password || '').trim().toLowerCase())) {
          setShowForgotPassword(true);
          setToast('Senha temporária detectada. Redefina sua senha para continuar.');
          return;
        }

        const account = accounts.find((item) => String(item?.email || '').toLowerCase() === safeEmail);
        if (account) {
          if (!account.emailVerified) {
            setToast('E-mail ainda não verificado. Conclua a verificação para entrar.');
            return;
          }

          if (String(account.password || '') !== String(password || '')) {
            setToast('Senha incorreta.');
            return;
          }

          const identity = await getOrCreateUserIdentity();
          await saveUserIdentity({ userId: account.userId || identity.userId, source: 'local_login' });
          setQaRuntimeAuth({ userId: account.userId || identity.userId });

          setUser({
            id: account.userId || identity.userId,
            role: 'user',
            name: account.name || safeName || 'Usuário',
            email: safeEmail,
          });
          navigation.replace('Questionario');
          return;
        }

        if (isFirebaseConfigured && auth) {
          try {
            const signInResult = await withPromiseTimeout(
              signInWithEmailAndPassword(auth, safeEmail, String(password || '')),
              FIREBASE_AUTH_TIMEOUT_MS,
              'Login demorou para responder. Tente novamente.'
            );
            const firebaseUser = signInResult?.user;
            if (!firebaseUser) {
              setToast('Falha no login. Tente novamente.');
              return;
            }

            await withPromiseTimeout(
              reload(firebaseUser),
              FIREBASE_AUTH_TIMEOUT_MS,
              'Nao foi possivel validar seu e-mail agora. Tente novamente.'
            );
            if (!firebaseUser.emailVerified) {
              setToast('E-mail ainda não verificado. Abra sua caixa de entrada e confirme o cadastro.');
              return;
            }

            const identity = await getOrCreateUserIdentity();
            await saveUserIdentity({ userId: firebaseUser.uid || identity.userId, source: 'firebase_login' });
            setQaRuntimeAuth({ userId: firebaseUser.uid || identity.userId });

            setUser({
              id: firebaseUser.uid || identity.userId,
              role: 'user',
              name: safeName || String(firebaseUser.displayName || 'Usuário'),
              email: safeEmail,
            });
            navigation.replace('Questionario');
            return;
          } catch {
            setToast('Falha no login online. Verifique e-mail/senha e sua conexão.');
            return;
          }
        }

        setToast('Conta não encontrada neste dispositivo. Faça cadastro primeiro.');
        return;
      }

      if (!safeName) {
        setToast('Informe seu nome para continuar.');
        return;
      }

      const duplicate = accounts.some((item) => String(item?.email || '').toLowerCase() === safeEmail);
      if (duplicate) {
        setToast('Já existe conta com esse e-mail. Use a opção Entrar.');
        return;
      }

      if (isFirebaseConfigured && auth) {
        try {
          const methods = await withPromiseTimeout(
            fetchSignInMethodsForEmail(auth, safeEmail),
            FIREBASE_AUTH_TIMEOUT_MS,
            'Nao foi possivel validar seu e-mail agora. Tente novamente.'
          );
          if (Array.isArray(methods) && methods.length > 0) {
            setToast('Este e-mail já possui conta. Use a opção Entrar.');
            return;
          }

          const created = await withPromiseTimeout(
            createUserWithEmailAndPassword(auth, safeEmail, String(password || '')),
            FIREBASE_AUTH_TIMEOUT_MS,
            'Cadastro demorou para responder. Tente novamente.'
          );
          const firebaseUser = created?.user;
          if (!firebaseUser) {
            setToast('Não foi possível criar conta no momento.');
            return;
          }

          await withPromiseTimeout(
            sendEmailVerification(firebaseUser),
            FIREBASE_AUTH_TIMEOUT_MS,
            'Nao foi possivel enviar o e-mail de confirmacao agora. Tente novamente.'
          );
          setPendingVerification({
            delivery: 'email',
            userId: firebaseUser.uid,
            name: safeName,
            email: safeEmail,
            password: String(password || ''),
          });
          setToast('Código enviado por e-mail. Verifique sua caixa de entrada e spam.');
          return;
        } catch {
          setToast('Falha no envio por e-mail. Usando verificação local neste dispositivo.');
        }
      }

      const identity = await getOrCreateUserIdentity();
      const backendResult = await sendCodeViaBackend(safeEmail);
      if (backendResult.ok) {
        if (backendResult.delivery !== 'email' && !ALLOW_LOCAL_CODE_FALLBACK) {
          setToast('Nao foi possivel enviar codigo por e-mail agora. Tente novamente em alguns instantes.');
          return;
        }

        setPendingVerification({
          delivery: backendResult.delivery,
          userId: identity.userId,
          name: safeName,
          email: safeEmail,
          password: String(password || ''),
          code: backendResult.delivery === 'local' ? backendResult.code : undefined,
        });
        if (backendResult.delivery === 'email') {
          setToast('Código enviado por e-mail. Verifique sua caixa de entrada e spam.');
        }
      } else {
        // Fallback local somente em ambiente de desenvolvimento.
        if (!ALLOW_LOCAL_CODE_FALLBACK) {
          setToast('Servico de envio de codigo indisponivel no momento. Tente novamente mais tarde.');
          return;
        }

        const code = String(Math.floor(100000 + Math.random() * 900000));
        setPendingVerification({
          delivery: 'local',
          userId: identity.userId,
          name: safeName,
          email: safeEmail,
          password: String(password || ''),
          code,
        });
      }
      // Código exibido permanentemente no card abaixo — não usa toast para não sumir
    } catch {
      setToast('Erro ao criar conta. Tente novamente.');
    } finally {
      clearWatchdog();
      setLoading(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!pendingVerification) {
      return;
    }

    setLoading(true);
    const clearWatchdog = startLoadingWatchdog(setLoading, setToast);
    try {
      // Firebase email verification (link-based)
      if (pendingVerification.delivery === 'email' && isFirebaseConfigured && auth && auth.currentUser) {
        const firebaseUser = auth.currentUser;
        if (!firebaseUser) {
          setToast('Sessão expirada. Faça o cadastro novamente.');
          return;
        }

        await reload(firebaseUser);
        if (!firebaseUser.emailVerified) {
          setToast('E-mail ainda não confirmado. Abra o link enviado no seu e-mail.');
          return;
        }

        const accounts = await loadLocalAccounts();
        const nextAccounts = [
          {
            userId: firebaseUser.uid,
            name: pendingVerification.name,
            email: pendingVerification.email,
            password: pendingVerification.password,
            emailVerified: true,
            provider: 'firebase_email',
            createdAt: new Date().toISOString(),
          },
          ...accounts.filter((item) => String(item?.email || '').toLowerCase() !== String(pendingVerification.email || '').toLowerCase()),
        ];
        await saveLocalAccounts(nextAccounts);
        await saveUserIdentity({ userId: firebaseUser.uid, source: 'firebase_email_verified' });
        setQaRuntimeAuth({ userId: firebaseUser.uid });

        setUser({
          id: firebaseUser.uid,
          role: 'user',
          name: pendingVerification.name,
          email: pendingVerification.email,
        });

        navigation.replace('Questionario');
        return;
      }

      // Backend email code verification (6-digit code sent by backend SMTP)
      const codeInput = String(verificationCode || '').trim();
      if (!codeInput) {
        setToast('Digite o código de verificação.');
        return;
      }

      if (pendingVerification.delivery === 'email' && !pendingVerification.code) {
        // Code was sent by backend SMTP — validate remotely
        const verifyResult = await verifyCodeViaBackend(pendingVerification.email, codeInput);
        if (!verifyResult.ok) {
          setToast(verifyResult.error || 'Código inválido.');
          return;
        }
      } else if (codeInput !== String(pendingVerification.code || '')) {
        setToast('Código inválido. Confira e tente novamente.');
        return;
      }

      const accounts = await loadLocalAccounts();
      const nextAccounts = [
        {
          userId: pendingVerification.userId,
          name: pendingVerification.name,
          email: pendingVerification.email,
          password: pendingVerification.password,
          emailVerified: true,
          createdAt: new Date().toISOString(),
        },
        ...accounts,
      ];
      await saveLocalAccounts(nextAccounts);
      await saveUserIdentity({ userId: pendingVerification.userId, source: 'local_verified' });
      setQaRuntimeAuth({ userId: pendingVerification.userId });

      setUser({
        id: pendingVerification.userId,
        role: 'user',
        name: pendingVerification.name,
        email: pendingVerification.email,
      });

      navigation.replace('Questionario');
    } catch {
      setToast('Falha ao verificar e-mail. Tente novamente.');
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
              <>
                <AppInput
                  label="Seu nome"
                  value={name}
                  onChangeText={setName}
                  placeholder="Como gostaria de ser chamado?"
                  autoCapitalize="words"
                  autoFocus
                />

                <View style={styles.spacer} />
              </>
            ) : null}

            <AppInput
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.spacer} />

            <AppInput
              label="Senha"
              value={password}
              onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            {mode === 'login' ? (
              <Text style={styles.resendLink} onPress={() => setShowForgotPassword((prev) => !prev)}>
                {showForgotPassword ? 'Cancelar recuperação de senha' : 'Esqueci minha senha'}
              </Text>
            ) : null}

            {mode === 'login' && showForgotPassword ? (
              <>
                <View style={styles.codeBox}>
                  <Text style={styles.codeBoxLabel}>Recuperação de senha</Text>
                  <Text style={styles.codeBoxHint}>
                    Vamos enviar um link de redefinição para {String(email || '').trim() || 'seu e-mail'}.
                  </Text>
                </View>
                <PrimaryButton
                  title={loading ? 'Enviando link...' : 'Enviar link de recuperação'}
                  onPress={handleForgotPassword}
                  style={styles.btnInline}
                />
              </>
            ) : null}

            {pendingVerification && mode === 'register' ? (
              <>
                <View style={styles.spacer} />
                {pendingVerification.delivery === 'email' && isFirebaseConfigured && auth?.currentUser ? (
                  <>
                    <View style={styles.codeBox}>
                      <Text style={styles.codeBoxLabel}>Verificação por e-mail</Text>
                      <Text style={styles.codeBoxHint}>
                        Enviamos um e-mail para {pendingVerification.email}. Abra sua caixa de entrada (e spam),
                        confirme o link e toque no botão abaixo.
                      </Text>
                    </View>
                    <PrimaryButton
                      title={loading ? 'Verificando...' : 'Já confirmei meu e-mail'}
                      onPress={handleVerifyEmail}
                      style={styles.btnInline}
                    />
                    <Text
                      style={styles.resendLink}
                      onPress={async () => {
                        try {
                          if (isFirebaseConfigured && auth?.currentUser) {
                            await sendEmailVerification(auth.currentUser);
                            setToast('E-mail reenviado. Confira inbox e spam.');
                            return;
                          }
                          setToast('Reenvio indisponível no momento.');
                        } catch {
                          setToast('Não foi possível reenviar agora. Tente novamente em instantes.');
                        }
                      }}
                    >
                      Reenviar e-mail de confirmação
                    </Text>
                  </>
                ) : (
                  <>
                    {/* Caixa do código — backend SMTP ou local */}
                    <View style={styles.codeBox}>
                      <Text style={styles.codeBoxLabel}>
                        {pendingVerification.delivery === 'email' && !pendingVerification.code
                          ? '📧 Código enviado por e-mail'
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
                )}
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
