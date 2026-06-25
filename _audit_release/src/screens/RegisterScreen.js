import React, { useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { AnimatedToast } from '../components/ui';
import { auth, getFirebaseConfigDiagnostics, isFirebaseConfigured } from '../services/firebase';
import {
  exchangeGoogleAuthCode,
  isGoogleAuthConfigured,
  loginWithGoogleToken,
  requestPasswordReset,
  sendLoginCode,
  useGoogleAuth,
  verifyLoginCode,
} from '../services/authService.js';
import {
  finalizeAuthenticatedSession,
  interpretSignInMethods,
  messageForSignInMethods,
} from '../services/authSessionFinalize';
import { QA_ELEMENTS, QA_SCREENS, qaProps } from '../qa/selectorRegistry';
import { setQaAuthState } from '../qa/qaAutomationState';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIREBASE_TIMEOUT_MS = 15000;
const CODE_TIMEOUT_MS = 20000;

// ============================================================================
// UTILITIES
// ============================================================================

function mapFirebaseAuthError(error) {
  const code = String(error?.code || '').toLowerCase();
  if (code.includes('auth/invalid-email')) return 'E-mail inválido.';
  if (code.includes('auth/user-not-found')) return 'Conta não encontrada.';
  if (code.includes('auth/wrong-password')) return 'Senha incorreta.';
  if (code.includes('auth/email-already-in-use')) return 'E-mail já em uso.';
  if (String(error?.message || '').includes('EMAIL_ACCOUNT_EXISTS_USE_LOGIN')) {
    return 'Este e-mail já tem conta. Use Login ou recuperar senha.';
  }
  if (code.includes('auth/weak-password')) return 'Senha fraca (mín. 6 caracteres).';
  if (code.includes('auth/invalid-action-code')) return 'Link expirado ou inválido.';
  if (code.includes('auth/too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (code.includes('auth/network-request-failed')) return 'Sem conexão. Verifique internet.';
  if (String(error?.message || '').includes('Operação expirou')) {
    return 'Demorou mais que o esperado. Verifique a conexão e tente novamente.';
  }
  if (String(error?.message || '').includes('AUTH_GOOGLE_TOKENS_MISSING')) {
    return 'Não recebemos confirmação do Google. Tente novamente.';
  }
  if (/invalid_client/i.test(String(error?.message || ''))) {
    return 'Login Google bloqueado (invalid_client). Confirme SHA-1/SHA-256 e OAuth Android no Firebase Console.';
  }
  if (String(error?.message || '').includes('Firebase não configurado')) {
    return 'Autenticação indisponível: Firebase não configurado neste build.';
  }
  return String(error?.message || 'Não foi possível concluir. Tente novamente.');
}

async function withTimeout(promise, timeoutMs = FIREBASE_TIMEOUT_MS) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Operação expirou. Tente novamente.')), timeoutMs)
  );
  return Promise.race([promise, timeoutPromise]);
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function RegisterScreen({ navigation }) {
  const { setUser } = useApp();
  
  // Auth state
  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [codeSentAt, setCodeSentAt] = useState(0);
  const [resendCooldownSec, setResendCooldownSec] = useState(0);
  const [deliveryMode, setDeliveryMode] = useState('');
  const [localDevCode, setLocalDevCode] = useState('');
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const [forgotSent, setForgotSent] = useState(false);
  const [authFlow, setAuthFlow] = useState('email'); // email | google | register | forgot
  
  // UI state — separate loading per action
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isEmailLoginLoading, setIsEmailLoginLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isForgotFlowLoading, setIsForgotFlowLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  
  const formBusy = isSendingCode || isVerifyingCode || isEmailLoginLoading
    || isRegistering || isGoogleLoading || isForgotFlowLoading;
  
  // Google auth
  const { request, promptAsync, response } = useGoogleAuth();
  const googleConfigured = isGoogleAuthConfigured();
  const firebaseDiagnostics = getFirebaseConfigDiagnostics();

  useEffect(() => {
    setQaAuthState({ hydrated: true, hasAccount: false, userId: null });
  }, []);

  // Reset state when mode/email changes
  useEffect(() => {
    setEmailVerified(false);
    setCodeSentAt(0);
    setVerificationCode('');
    setResendCooldownSec(0);
    setDeliveryMode('');
    setLocalDevCode('');
    setForgotSent(false);
    setPendingGoogleUser(null);
    if (mode === 'forgot') {
      setAuthFlow('forgot');
    } else if (mode === 'register') {
      setAuthFlow('register');
    } else {
      setAuthFlow('email');
    }
  }, [email, mode]);

  useEffect(() => {
    if (resendCooldownSec <= 0) return undefined;
    const timer = setInterval(() => {
      setResendCooldownSec((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldownSec]);

  // Handle Google response
  useEffect(() => {
    if (!response) return;

    if (response.type !== 'success') {
      if (response.type === 'error') {
        const responseError = String(response?.error?.message || response?.params?.error_description || response?.params?.error || 'Falha na autenticação Google.');
        setStatusMsg(`✗ ${responseError}`);
        setToast(responseError);
      }
      return;
    }

    const processGoogleAuth = async () => {
      setIsGoogleLoading(true);
      setAuthFlow('google');
      try {
        let accessToken = response.authentication?.accessToken || null;
        let idToken = response.authentication?.idToken || response?.params?.id_token || null;

        if ((!idToken && !accessToken) && response?.params?.code) {
          const exchanged = await exchangeGoogleAuthCode({
            code: response.params.code,
            redirectUri: request?.redirectUri,
            codeVerifier: request?.codeVerifier,
          });
          if (exchanged?.accessToken) {
            accessToken = exchanged.accessToken;
          }
          if (exchanged?.idToken) {
            idToken = exchanged.idToken;
          }
        }

        if (!idToken) throw new Error('Sem token do Google');

        const loggedUser = await loginWithGoogleToken({
          idToken,
          accessToken,
        });

        if (!loggedUser?.id) throw new Error('Google sem usuário válido');

        await finalizeAuthenticatedSession({
          navigation,
          setUser,
          user: {
            id: loggedUser.id,
            name: loggedUser.name || 'Usuário',
            email: loggedUser.email,
            role: loggedUser.role || 'user',
            source: loggedUser.source || 'google',
          },
          source: loggedUser.source || 'google',
        });

        setStatusMsg('✓ Entrada com Google concluída.');
        setToast('');
      } catch (err) {
        setAuthFlow('email');
        setStatusMsg('✗ Erro ao conectar com Google.');
        setToast(mapFirebaseAuthError(err));
      } finally {
        setIsGoogleLoading(false);
      }
    };

    processGoogleAuth();
  }, [exchangeGoogleAuthCode, navigation, request, response, setUser]);

  // Send verification code
  const handleSendCode = useCallback(async () => {
    if (mode !== 'register') {
      return;
    }

    const emailLower = email.trim().toLowerCase();
    if (!emailLower || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      setStatusMsg('✗ E-mail inválido.');
      setToast('E-mail inválido.');
      return;
    }

    if (resendCooldownSec > 0) {
      setStatusMsg(`✗ Reenviar disponível em ${resendCooldownSec}s.`);
      return;
    }

    if (!name.trim() || password.length < 6) {
      setStatusMsg('✗ Nome e senha (mín. 6) obrigatórios para cadastro.');
      setToast('Nome e senha (mín. 6) obrigatórios.');
      return;
    }

    setIsSendingCode(true);
    setStatusMsg('Enviando código opcional...');
    try {
      if (!isFirebaseConfigured || !auth) {
        setStatusMsg('✗ Cadastro indisponível. Firebase não configurado neste build.');
        setToast('Firebase não configurado. Rebuild com .env ou google-services.json.');
        return;
      }

      const methods = await withTimeout(fetchSignInMethodsForEmail(auth, emailLower), FIREBASE_TIMEOUT_MS);
      const providerInfo = interpretSignInMethods(methods);
      const registerMsg = messageForSignInMethods(providerInfo, 'register');
      if (registerMsg) {
        setStatusMsg(`✗ ${registerMsg}`);
        setToast(registerMsg);
        return;
      }

      const codeResult = await withTimeout(sendLoginCode(emailLower), CODE_TIMEOUT_MS);
      if (!codeResult?.ok) {
        const sendError = String(codeResult?.message || 'Falha ao enviar código.');
        setStatusMsg(`✗ ${sendError}`);
        setToast(`${sendError} Você ainda pode cadastrar direto pelo Firebase.`);
        return;
      }

      setCodeSentAt(Date.now());
      setResendCooldownSec(60);
      setDeliveryMode(String(codeResult?.delivery || 'email'));
      setLocalDevCode(String(codeResult?.code || ''));
      setStatusMsg('✓ Código enviado (opcional). Você também pode cadastrar sem validar.');
      if (codeResult?.delivery === 'local' && codeResult?.code) {
        setToast(`Código local (dev): ${codeResult.code}`);
      } else {
        setToast('Código enviado. Validação é opcional — cadastro direto também funciona.');
      }
    } catch (err) {
      setStatusMsg(`✗ ${mapFirebaseAuthError(err)}`);
      setToast(`${mapFirebaseAuthError(err)} Cadastro direto ainda disponível.`);
    } finally {
      setIsSendingCode(false);
    }
  }, [email, name, password, mode, resendCooldownSec]);

  // Validate verification code
  const handleCheckVerification = useCallback(async () => {
    const emailLower = email.trim().toLowerCase();
    const safeCode = verificationCode.trim();
    if (!emailLower || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      setStatusMsg('✗ E-mail inválido.');
      setToast('E-mail inválido.');
      return;
    }
    if (!safeCode) {
      setStatusMsg('✗ Informe o código de verificação.');
      setToast('Informe o código de verificação.');
      return;
    }

    if (mode === 'register' && isFirebaseConfigured && auth) {
      try {
        const methods = await withTimeout(fetchSignInMethodsForEmail(auth, emailLower));
        if (Array.isArray(methods) && methods.length > 0) {
          setStatusMsg('✗ Este e-mail já tem conta. Use Login ou recuperar senha.');
          setToast('E-mail já em uso.');
          return;
        }
      } catch (preErr) {
        setStatusMsg(`✗ ${mapFirebaseAuthError(preErr)}`);
        setToast(mapFirebaseAuthError(preErr));
        return;
      }
    }

    setIsVerifyingCode(true);
    setStatusMsg('Validando código...');
    try {
      const result = await withTimeout(
        verifyLoginCode({ email: emailLower, code: safeCode }),
        CODE_TIMEOUT_MS
      );
      if (result?.ok) {
        setEmailVerified(true);
        setStatusMsg('✓ Código validado. Acesso liberado.');
        setToast('Pronto para prosseguir.');
      } else {
        setStatusMsg('✗ Código inválido ou expirado.');
        setToast(result?.message || 'Código inválido ou expirado.');
      }
    } catch (err) {
      setStatusMsg(`✗ ${mapFirebaseAuthError(err)}`);
      setToast(mapFirebaseAuthError(err));
    } finally {
      setIsVerifyingCode(false);
    }
  }, [email, verificationCode, mode]);

  // Submit registration/login
  const handleSubmit = useCallback(async () => {
    const emailLower = email.trim().toLowerCase();

    if (!emailLower || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      setToast('E-mail inválido.');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setToast('Informe seu nome.');
      return;
    }

    if (!pendingGoogleUser && password.length < 6) {
      setToast('Senha inválida (mín. 6 caracteres).');
      return;
    }

    const setSubmitLoading = mode === 'register' ? setIsRegistering : setIsEmailLoginLoading;
    setSubmitLoading(true);
    setStatusMsg(mode === 'login' ? 'Entrando...' : 'Cadastrando...');
    try {
      if (!isFirebaseConfigured || !auth) {
        throw new Error('Firebase não configurado');
      }

      let finalUser = null;

      if (pendingGoogleUser) {
        finalUser = {
          id: pendingGoogleUser.id,
          name: pendingGoogleUser.name,
          email: pendingGoogleUser.email,
          role: pendingGoogleUser.role,
          source: 'google',
        };
      } else if (mode === 'login') {
        const methods = await withTimeout(fetchSignInMethodsForEmail(auth, emailLower), FIREBASE_TIMEOUT_MS);
        const providerInfo = interpretSignInMethods(methods);
        const loginMsg = messageForSignInMethods(providerInfo, 'login');
        if (loginMsg) {
          throw new Error(loginMsg);
        }

        const result = await withTimeout(
          signInWithEmailAndPassword(auth, emailLower, password),
          FIREBASE_TIMEOUT_MS
        );
        finalUser = {
          id: result.user.uid,
          name: result.user.displayName || name || 'Usuário',
          email: emailLower,
          role: 'user',
          source: 'email',
        };
      } else {
        const methods = await withTimeout(fetchSignInMethodsForEmail(auth, emailLower), FIREBASE_TIMEOUT_MS);
        const providerInfo = interpretSignInMethods(methods);
        const registerMsg = messageForSignInMethods(providerInfo, 'register');
        if (registerMsg) {
          throw new Error('EMAIL_ACCOUNT_EXISTS_USE_LOGIN');
        }
        const result = await withTimeout(
          createUserWithEmailAndPassword(auth, emailLower, password),
          FIREBASE_TIMEOUT_MS
        );
        if (name.trim()) {
          await updateProfile(result.user, { displayName: name }).catch(() => {});
        }
        finalUser = {
          id: result.user.uid,
          name: result.user.displayName || name,
          email: emailLower,
          role: 'user',
          source: 'email',
        };
      }

      await finalizeAuthenticatedSession({
        navigation,
        setUser,
        user: finalUser,
        source: finalUser.source,
      });

      setStatusMsg('✓ Autenticado com sucesso.');
      setToast('');
    } catch (err) {
      setStatusMsg(`✗ ${mapFirebaseAuthError(err)}`);
      setToast(mapFirebaseAuthError(err));
    } finally {
      setSubmitLoading(false);
    }
  }, [email, password, name, mode, pendingGoogleUser, navigation, setUser]);

  const handleForgotSendReset = useCallback(async () => {
    const emailLower = email.trim().toLowerCase();
    if (!emailLower || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      setStatusMsg('✗ E-mail inválido.');
      setToast('E-mail inválido.');
      return;
    }

    if (!isFirebaseConfigured || !auth) {
      setStatusMsg('✗ Recuperação indisponível. Firebase não configurado neste build.');
      setToast('Firebase não configurado. Rebuild com .env válido.');
      return;
    }

    setIsForgotFlowLoading(true);
    setStatusMsg('Enviando link de recuperação...');
    try {
      const resetResult = await withTimeout(requestPasswordReset(emailLower), FIREBASE_TIMEOUT_MS);
      if (!resetResult?.ok) {
        const resetError = String(resetResult?.message || 'Não foi possível enviar o e-mail de recuperação.');
        setStatusMsg(`✗ ${resetError}`);
        setToast(resetError);
        return;
      }

      setForgotSent(true);
      setStatusMsg('✓ Link de recuperação enviado. Verifique inbox/spam.');
      setToast('Se existir conta com este e-mail, você receberá um link para redefinir a senha.');
    } catch (err) {
      setStatusMsg(`✗ ${mapFirebaseAuthError(err)}`);
      setToast(mapFirebaseAuthError(err));
    } finally {
      setIsForgotFlowLoading(false);
    }
  }, [email]);

  // Render
  const canSubmitLogin = mode === 'login'
    && email.trim()
    && password.length >= 6
    && !googleFlowActive;
  const canSubmitRegister = mode === 'register'
    && email.trim()
    && name.trim()
    && password.length >= 6
    && !googleFlowActive;
  const canSubmit = canSubmitLogin || canSubmitRegister;
  const codeExpired = codeSentAt > 0 && Date.now() - codeSentAt > 15 * 60 * 1000;
  const googleFlowActive = authFlow === 'google' || isGoogleLoading;
  const submitLoading = mode === 'register' ? isRegistering : isEmailLoginLoading;

  const activeScreenId = mode === 'login' ? QA_SCREENS.login : QA_SCREENS.register;

  return (
    <SafeAreaView {...qaProps(activeScreenId)} style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <View
          {...qaProps(activeScreenId)}
          pointerEvents="none"
          style={styles.qaAnchor}
        />
        {/* Background blobs */}
        <View pointerEvents="none" style={styles.bgLayer}>
          <View style={[styles.blob, styles.blobTop]} />
          <View style={[styles.blob, styles.blobMid]} />
          <View style={[styles.blob, styles.blobBtm]} />
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <AnimatedToast message={toast} onHide={() => setToast('')} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Evolução</Text>
            <Text style={styles.subtitle}>Treinos, nutrição e progresso</Text>
          </View>

          {/* Auth Card */}
          <View style={styles.card}>
            {/* Mode tabs */}
            <View style={styles.tabs}>
              {['login', 'register', 'forgot'].map((m) => (
                <TouchableOpacity
                  key={m}
                  {...qaProps(m === 'login' ? QA_ELEMENTS.btnGoLogin : QA_ELEMENTS.btnGoRegister)}
                  onPress={() => {
                    setMode(m);
                    setEmailVerified(false);
                  }}
                  style={[styles.tab, mode === m && styles.tabActive]}
                >
                  <Text style={[styles.tabLabel, mode === m && styles.tabLabelActive]}>
                    {m === 'login' ? 'Entrar' : m === 'register' ? 'Cadastrar' : 'Esqueci'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.hint}>
              {mode === 'forgot'
                ? 'Enviaremos um link de recuperação via Firebase para seu e-mail'
                : googleFlowActive
                  ? 'Conectando com Google...'
                  : mode === 'login'
                    ? 'Entre com e-mail e senha ou use Google'
                    : 'Cadastre com e-mail/senha. Código backend é opcional.'}
            </Text>

            {!isFirebaseConfigured ? (
              <View style={styles.configBanner}>
                <Text style={styles.configBannerTitle}>Autenticação indisponível neste build</Text>
                <Text style={styles.configBannerText}>
                  Firebase não está configurado. Rebuild com `.env` válido ou confirme `google-services.json`.
                  {firebaseDiagnostics.rebuildRecommended ? ' Este build usa fallback bundled — rebuild recomendado.' : ''}
                </Text>
              </View>
            ) : null}

            {/* Form */}
            {mode === 'register' && (
              <View>
                <Text style={styles.label}>Nome</Text>
                <TextInput
                  {...qaProps(QA_ELEMENTS.inputName)}
                  style={styles.input}
                  placeholder="Seu nome"
                  placeholderTextColor="#64748b"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  editable={!formBusy}
                />
              </View>
            )}

            <View>
              <Text style={styles.label}>E-mail</Text>
              <TextInput
                {...qaProps(QA_ELEMENTS.inputEmail)}
                style={styles.input}
                placeholder="you@email.com"
                placeholderTextColor="#64748b"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!formBusy}
              />
            </View>

            {!googleFlowActive && mode !== 'forgot' && (
              <View>
                <Text style={styles.label}>Senha</Text>
                <TextInput
                  {...qaProps(QA_ELEMENTS.inputPassword)}
                  style={styles.input}
                  placeholder="Mín. 6 caracteres"
                  placeholderTextColor="#64748b"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!formBusy}
                />
              </View>
            )}

            {mode === 'forgot' ? (
              <View style={styles.verifyBlock}>
                <Text style={styles.verifyTitle}>Recuperar senha</Text>
                <Text style={styles.verifyHint}>
                  {forgotSent
                    ? 'Link enviado. Abra o e-mail e siga as instruções do Firebase.'
                    : 'Informe seu e-mail e toque em enviar link de recuperação.'}
                </Text>

                <TouchableOpacity
                  onPress={handleForgotSendReset}
                  disabled={isForgotFlowLoading || !email.trim()}
                  style={[styles.btn, styles.btnMain, (isForgotFlowLoading || !email.trim()) && styles.btnDisabled]}
                >
                  {isForgotFlowLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.btnLabel}>
                      {forgotSent ? 'Reenviar link' : 'Enviar link de recuperação'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : null}

            {mode === 'register' && !googleFlowActive ? (
              <View style={styles.verifyBlock}>
                <Text style={styles.verifyTitle}>Verificação opcional (backend)</Text>
                <Text style={styles.verifyHint}>
                  {codeSentAt
                    ? codeExpired
                      ? 'Código expirado. Reenvie ou cadastre direto.'
                      : 'Código enviado. Validação é opcional — cadastro direto também funciona.'
                    : 'Opcional: envie um código se o backend estiver disponível.'}
                </Text>

                {deliveryMode === 'local' && localDevCode ? (
                  <View style={styles.localCodeBox}>
                    <Text style={styles.localCodeLabel}>Modo local (sem SMTP no backend)</Text>
                    <Text style={styles.localCodeValue}>Código: {localDevCode}</Text>
                  </View>
                ) : null}

                <TextInput
                  style={styles.input}
                  placeholder="Código de 6 dígitos"
                  placeholderTextColor="#64748b"
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  editable={!isVerifyingCode && !isSendingCode}
                  maxLength={6}
                />

                <View style={styles.verifyBtns}>
                  <TouchableOpacity
                    onPress={handleSendCode}
                    disabled={isSendingCode || resendCooldownSec > 0}
                    style={[styles.btn, styles.btnPrimary, isSendingCode && styles.btnDisabled]}
                  >
                    <Text style={styles.btnLabel}>
                      {isSendingCode
                        ? 'Enviando...'
                      : resendCooldownSec > 0
                        ? `Reenviar em ${resendCooldownSec}s`
                        : codeSentAt && !codeExpired
                          ? 'Reenviar código'
                          : 'Enviar código'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleCheckVerification}
                    disabled={isVerifyingCode}
                    style={[styles.btn, styles.btnSecondary, isVerifyingCode && styles.btnDisabled]}
                  >
                    <Text style={styles.btnLabelSec}>
                      {isVerifyingCode ? 'Conferindo...' : 'Validar código'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Status */}
            <View style={[styles.status, (emailVerified || forgotSent) && styles.statusOk]}>
              <Text style={styles.statusText}>
                {statusMsg || (mode === 'login' ? 'Pronto para entrar' : mode === 'forgot' ? 'Aguardando e-mail' : 'Pronto para cadastrar')}
              </Text>
            </View>

            {/* Main CTA */}
            {mode !== 'forgot' && !googleFlowActive && (
              <TouchableOpacity
                {...qaProps(mode === 'login' ? QA_ELEMENTS.btnLogin : QA_ELEMENTS.btnRegister)}
                onPress={handleSubmit}
                disabled={submitLoading || !canSubmit}
                style={[styles.btn, styles.btnMain, (!canSubmit || submitLoading) && styles.btnDisabled]}
              >
                {submitLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnLabel}>
                    {mode === 'login' ? 'Entrar' : 'Cadastrar'}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* Google button */}
            {googleConfigured && mode !== 'forgot' && (
              <TouchableOpacity
                {...qaProps(QA_ELEMENTS.btnGoogleLogin)}
                onPress={() => {
                  if (isGoogleLoading || !request) return;
                  promptAsync({ useProxy: false }).catch(() => {
                    setToast('Falha ao abrir Google Sign-In');
                  });
                }}
                disabled={isGoogleLoading || !request}
                style={[styles.btn, styles.btnGoogle, (isGoogleLoading || !request) && styles.btnDisabled]}
              >
                {isGoogleLoading ? (
                  <ActivityIndicator color="#1f2937" size="small" />
                ) : (
                  <Text style={styles.btnLabelGoogle}>Entrar com Google</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {!googleFlowActive && mode !== 'forgot' && (
            <Text style={styles.terms}>
              Login usa e-mail/senha direto no Firebase. Cadastro não depende mais de código backend.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a0f1b',
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 60,
  },
  bgLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  qaAnchor: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 8,
    height: 8,
    opacity: 0.01,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobTop: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    right: -SCREEN_WIDTH * 0.25,
    top: -SCREEN_WIDTH * 0.3,
    backgroundColor: 'rgba(56,189,248,0.12)',
  },
  blobMid: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    left: -SCREEN_WIDTH * 0.3,
    top: SCREEN_WIDTH * 0.35,
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  blobBtm: {
    width: SCREEN_WIDTH * 0.9,
    height: SCREEN_WIDTH * 0.9,
    right: -SCREEN_WIDTH * 0.15,
    bottom: -SCREEN_WIDTH * 0.4,
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
    paddingVertical: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#f8fafc',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#cbd5e1',
  },
  card: {
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    backgroundColor: '#0b1220',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#1e293b',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
  },
  tabLabelActive: {
    color: '#f8fafc',
  },
  hint: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 20,
    fontWeight: '500',
  },
  configBanner: {
    borderWidth: 1,
    borderColor: '#f59e0b',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  configBannerTitle: {
    color: '#fde68a',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  configBannerText: {
    color: '#fcd34d',
    fontSize: 12,
    lineHeight: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0b1220',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 14,
    marginBottom: 16,
  },
  verifyBlock: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0b1220',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  verifyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#93c5fd',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  verifyHint: {
    fontSize: 12,
    color: '#cbd5e1',
    lineHeight: 18,
    marginBottom: 12,
    fontWeight: '500',
  },
  localCodeBox: {
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  localCodeLabel: {
    color: '#94a3b8',
    fontSize: 11,
    marginBottom: 4,
  },
  localCodeValue: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  verifyBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  status: {
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0b1220',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  statusOk: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16,185,129,0.1)',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e2e8f0',
    lineHeight: 19,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: '#0b1220',
    borderWidth: 1,
    borderColor: '#334155',
  },
  btnMain: {
    backgroundColor: '#0ea5e9',
    marginBottom: 12,
  },
  btnGoogle: {
    backgroundColor: '#f3f4f6',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  btnLabelSec: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
  },
  btnLabelGoogle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1f2937',
  },
  terms: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 16,
  },
});
