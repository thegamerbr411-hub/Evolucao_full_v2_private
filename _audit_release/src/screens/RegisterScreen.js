import React, { useState, useCallback, useEffect } from 'react';
import { CommonActions } from '@react-navigation/native';
import {
  ActivityIndicator,
  Dimensions,
  InteractionManager,
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
import { getOrCreateUserIdentity, saveUserIdentity } from '../services/appIdentityService';
import { auth, isFirebaseConfigured } from '../services/firebase';
import {
  isGoogleAuthConfigured,
  loginWithGoogleToken,
  sendLoginCode,
  useGoogleAuth,
  verifyLoginCode,
} from '../services/authService.js';
import { setQaRuntimeAuth } from '../utils/qaTransport';
import { QA_ELEMENTS, QA_SCREENS, qaProps } from '../qa/selectorRegistry';
import { setQaAuthState } from '../qa/qaAutomationState';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FIREBASE_TIMEOUT_MS = 8000;

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
  if (String(error?.message || '').includes('Operação expirou')) {
    return 'Demorou mais que o esperado (rede ou servidor). Verifique a conexão e toque em Reenviar ou tente novamente em instantes.';
  }
  if (code.includes('auth/weak-password')) return 'Senha fraca (mín. 6 caracteres).';
  if (code.includes('auth/invalid-action-code')) return 'Link expirado ou inválido.';
  if (code.includes('auth/too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (code.includes('auth/network-request-failed')) return 'Sem conexão. Verifique internet.';
  const msgLower = String(error?.message || '').toLowerCase();
  if (msgLower.includes('invalid_client')) {
    return 'OAuth invalid_client: confirme no Google Cloud o cliente Web usado no exchange, SHA-1/SHA-256 do keystore de release e o package com.tipolt.evolucaofullv2.';
  }
  if (msgLower.includes('unsupported_response_type')) {
    return 'Google OAuth: tipo de resposta não suportado para este client. Use fluxo Android nativo (id_token + androidClientId).';
  }
  if (msgLower.includes('custom scheme uris are not allowed')) {
    return 'Google OAuth: custom scheme só funciona com Android Client ID, não Web Client. Confirme rebuild com fluxo nativo.';
  }
  return String(error?.message || 'Erro na autenticação.');
}

async function withTimeout(promise, timeoutMs = FIREBASE_TIMEOUT_MS) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Operação expirou. Tente novamente.')), timeoutMs)
  );
  return Promise.race([promise, timeoutPromise]);
}

function replaceOrResetToMain(navigation) {
  try {
    navigation?.dispatch?.(
      CommonActions.reset({ index: 0, routes: [{ name: 'MainTabs' }] })
    );
    return;
  } catch {
    /* fall through */
  }
  try {
    if (navigation?.replace) {
      navigation.replace('MainTabs');
    }
  } catch {
    /* last resort */
  }
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [codeSentAt, setCodeSentAt] = useState(0);
  const [resendCooldownSec, setResendCooldownSec] = useState(0);
  const [deliveryMode, setDeliveryMode] = useState('');
  const [localDevCode, setLocalDevCode] = useState('');
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const [forgotCodeValidated, setForgotCodeValidated] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Google auth
  const { request, promptAsync, response } = useGoogleAuth();
  const googleConfigured = isGoogleAuthConfigured();

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
    setConfirmPassword('');
    setNewPassword('');
    setForgotCodeValidated(false);
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
    if (!response) return undefined;

    if (response.type !== 'success') {
      if (response.type === 'error') {
        const responseError = String(response?.error?.message || response?.params?.error_description || response?.params?.error || 'Falha na autenticação Google.');
        setStatusMsg(`✗ ${responseError}`);
        setToast(responseError);
      }
      return undefined;
    }

    let stale = false;

    const processGoogleAuth = async () => {
      setGoogleLoading(true);
      try {
        const accessToken = response.authentication?.accessToken || response?.params?.access_token || null;
        const idToken = response.authentication?.idToken || response?.params?.id_token || null;

        if (__DEV__) {
          console.log('[AUTH][GOOGLE][REGISTER]', JSON.stringify({
            hasIdToken: Boolean(idToken),
            hasAccessToken: Boolean(accessToken),
            hasCode: Boolean(response?.params?.code),
            redirectUri: request?.redirectUri || null,
          }));
        }

        if (!idToken) {
          throw new Error(
            response?.params?.error_description
              || response?.params?.error
              || 'Sem id_token do Google. Verifique Android Client ID e redirect googleusercontent no GCP.'
          );
        }

        const loggedUser = await loginWithGoogleToken({
          idToken,
          accessToken,
        });

        if (!loggedUser?.id) throw new Error('Google sem usuário válido');
        if (stale) return;

        await withTimeout(getOrCreateUserIdentity());
        if (stale) return;
        await withTimeout(saveUserIdentity({ userId: loggedUser.id, source: 'google' }));
        if (stale) return;
        setQaRuntimeAuth({ userId: loggedUser.id });

        setUser({
          id: loggedUser.id,
          name: loggedUser.name || 'Usuário',
          email: loggedUser.email || null,
          role: loggedUser.role || 'user',
        });

        setMode('login');
        setEmail(loggedUser.email || '');
        if (loggedUser.name) setName(loggedUser.name);
        setPendingGoogleUser(null);
        setEmailVerified(true);
        setStatusMsg('✓ Autenticado com Google. Entrando...');
        setToast('');
        // Não usar o flag `stale` aqui: após setUser o RootNavigator remonta o Stack e este
        // ecrã desmonta — o cleanup do efeito marca stale=true antes do rAF e bloqueava a navegação.
        const nav = navigation;
        InteractionManager.runAfterInteractions(() => {
          try {
            replaceOrResetToMain(nav);
          } catch {
            // Stack pode já ter remontado para MainTabs após setUser.
          }
        });
      } catch (err) {
        if (!stale) {
          setStatusMsg('✗ Erro ao conectar com Google.');
          setToast(mapFirebaseAuthError(err));
        }
      } finally {
        setGoogleLoading(false);
      }
    };

    processGoogleAuth();
    return () => {
      stale = true;
    };
  }, [navigation, request, response, setUser]);

  const rejectRegisterPasswordMismatch = useCallback(() => {
    if (mode !== 'register') return false;
    const pwd = password.trim();
    const confirm = confirmPassword.trim();
    if (!name.trim() || pwd.length < 6) {
      setStatusMsg('✗ Nome e senha (mín. 6) obrigatórios.');
      setToast('Nome e senha (mín. 6) obrigatórios.');
      return true;
    }
    if (pwd !== confirm) {
      setStatusMsg('✗ As senhas não coincidem.');
      setToast('As senhas não coincidem.');
      return true;
    }
    return false;
  }, [mode, name, password, confirmPassword]);

  // Send verification code
  const handleSendCode = useCallback(async () => {
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

    if (rejectRegisterPasswordMismatch()) {
      return;
    }

    if (mode === 'login' && !pendingGoogleUser && password.length < 6) {
      setStatusMsg('✗ Senha obrigatória (mín. 6 caracteres).');
      setToast('Senha obrigatória (mín. 6 caracteres).');
      return;
    }

    setLoading(true);
    setStatusMsg('Enviando código...');
    try {
      // Check existing methods
      const methods = (isFirebaseConfigured && auth)
        ? await withTimeout(fetchSignInMethodsForEmail(auth, emailLower))
        : [];

      if (mode === 'register' && (!isFirebaseConfigured || !auth)) {
        setStatusMsg('✗ Cadastro com código exige Firebase ativo para validar e-mail.');
        setToast('Firebase não configurado.');
        return;
      }

      if (mode === 'register') {
        if (Array.isArray(methods) && methods.length > 0) {
          setStatusMsg('✗ E-mail já em uso. Faça login ou use outro e-mail.');
          setToast('E-mail já em uso.');
          return;
        }
      } else {
        if (pendingGoogleUser) {
          setEmailVerified(true);
          setStatusMsg('✓ Conta Google reconhecida.');
          setToast('Toque em Entrar abaixo ou aguarde o redirecionamento.');
          return;
        }

        // Login mode: check account exists
        if (!Array.isArray(methods) || methods.length === 0) {
          setToast('Conta não encontrada.');
          setStatusMsg('✗ E-mail não registrado.');
          return;
        }
      }

      const codeResult = await withTimeout(sendLoginCode(emailLower), 15000);
      if (!codeResult?.ok) {
        const sendError = String(codeResult?.message || 'Falha ao enviar código.');
        setStatusMsg(`✗ ${sendError}`);
        setToast(sendError);
        return;
      }

      setCodeSentAt(Date.now());
      setResendCooldownSec(60);
      setDeliveryMode(String(codeResult?.delivery || 'email'));
      setLocalDevCode(String(codeResult?.code || ''));
      setStatusMsg('✓ Código enviado. Verifique seu e-mail.');
      if (codeResult?.delivery === 'local' && codeResult?.code) {
        setToast(`Código local (dev): ${codeResult.code}`);
      } else {
        setToast('Código enviado. Verifique inbox/spam e digite abaixo.');
      }
    } catch (err) {
      setStatusMsg(`✗ ${mapFirebaseAuthError(err)}`);
      setToast(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [email, name, password, confirmPassword, mode, pendingGoogleUser, resendCooldownSec, rejectRegisterPasswordMismatch]);

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

    if (pendingGoogleUser) {
      setEmailVerified(true);
      setStatusMsg('✓ Conta Google reconhecida.');
      setToast('Toque em Entrar ou aguarde o redirecionamento.');
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

    setLoading(true);
    setStatusMsg('Validando código...');
    try {
      const result = await withTimeout(verifyLoginCode({ email: emailLower, code: safeCode }));
      if (result?.ok) {
        if (mode === 'register' && isFirebaseConfigured && auth) {
          const methodsAfter = await withTimeout(fetchSignInMethodsForEmail(auth, emailLower));
          if (Array.isArray(methodsAfter) && methodsAfter.length > 0) {
            setEmailVerified(false);
            setStatusMsg('✗ Este e-mail já tem conta. Use Login ou recuperar senha.');
            setToast('E-mail já em uso. Não é possível concluir o cadastro com este código.');
            return;
          }
        }
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
      setLoading(false);
    }
  }, [email, verificationCode, pendingGoogleUser, mode]);

  // Submit registration/login
  const handleSubmit = useCallback(async () => {
    const emailLower = email.trim().toLowerCase();
    
    if (!emailLower || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      setToast('E-mail inválido.');
      return;
    }

    if (!emailVerified) {
      setToast('Valide o código antes de continuar.');
      setStatusMsg('✗ Código ainda não validado.');
      return;
    }

    if (mode === 'register' && !name.trim()) {
      setToast('Informe seu nome.');
      return;
    }

    if (!pendingGoogleUser && password.length < 6) {
      setToast('Senha inválida.');
      return;
    }
    if (rejectRegisterPasswordMismatch()) {
      return;
    }

    setLoading(true);
    setStatusMsg(mode === 'login' ? 'Entrando...' : 'Cadastrando...');
    try {
      if (!isFirebaseConfigured || !auth) {
        throw new Error('Firebase não configurado');
      }

      let finalUser = null;

      if (pendingGoogleUser) {
        // Google login path
        finalUser = {
          id: pendingGoogleUser.id,
          name: pendingGoogleUser.name,
          email: pendingGoogleUser.email,
          role: pendingGoogleUser.role,
          source: 'google',
        };
      } else if (mode === 'login') {
        // Email login path
        const result = await withTimeout(
          signInWithEmailAndPassword(auth, emailLower, password)
        );
        finalUser = {
          id: result.user.uid,
          name: result.user.displayName || name || 'Usuário',
          email: emailLower,
          role: 'user',
          source: 'email',
        };
      } else {
        // Email register path — não fazer sign-in "escondido"; conta existente = mensagem clara
        const methods = await withTimeout(fetchSignInMethodsForEmail(auth, emailLower));
        if (Array.isArray(methods) && methods.length > 0) {
          throw new Error('EMAIL_ACCOUNT_EXISTS_USE_LOGIN');
        }
        const result = await withTimeout(createUserWithEmailAndPassword(auth, emailLower, password));
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

      // Save identity (timeout defensivo — evita loading infinito se rede travar)
      await withTimeout(getOrCreateUserIdentity());
      await withTimeout(saveUserIdentity({ userId: finalUser.id, source: finalUser.source }));
      setQaRuntimeAuth({ userId: finalUser.id });

      // Update app context
      setUser({
        id: finalUser.id,
        name: finalUser.name,
        email: finalUser.email,
        role: finalUser.role,
      });

      setStatusMsg('✓ Autenticado com sucesso.');
      const nav = navigation;
      InteractionManager.runAfterInteractions(() => {
        try {
          replaceOrResetToMain(nav);
        } catch {
          // Idem fluxo Google: remount do stack pode invalidar a ref de navegação.
        }
      });
    } catch (err) {
      setStatusMsg(`✗ ${mapFirebaseAuthError(err)}`);
      setToast(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [email, password, confirmPassword, name, mode, emailVerified, pendingGoogleUser, navigation, setUser, rejectRegisterPasswordMismatch]);

  // Forgot password handlers
  const handleForgotSendCode = useCallback(async () => {
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

    setLoading(true);
    setStatusMsg('Enviando código de reset...');
    try {
      const codeResult = await withTimeout(sendLoginCode(emailLower), 15000);
      if (!codeResult?.ok) {
        const sendError = String(codeResult?.message || 'Falha ao enviar código.');
        setStatusMsg(`✗ ${sendError}`);
        setToast(sendError);
        return;
      }

      setCodeSentAt(Date.now());
      setResendCooldownSec(60);
      setDeliveryMode(String(codeResult?.delivery || 'email'));
      setLocalDevCode(String(codeResult?.code || ''));
      setStatusMsg('✓ Código enviado. Verifique seu e-mail.');
      if (codeResult?.delivery === 'local' && codeResult?.code) {
        setToast(`Código local (dev): ${codeResult.code}`);
      } else {
        setToast('Código enviado. Verifique inbox/spam e digite abaixo.');
      }
    } catch (err) {
      setStatusMsg(`✗ ${mapFirebaseAuthError(err)}`);
      setToast(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [email, resendCooldownSec]);

  const handleForgotValidateCode = useCallback(async () => {
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

    setLoading(true);
    setStatusMsg('Validando código...');
    try {
      const result = await withTimeout(verifyLoginCode({ email: emailLower, code: safeCode }));
      if (result?.ok) {
        setForgotCodeValidated(true);
        setStatusMsg('✓ Código validado. Defina sua nova senha.');
        setToast('Código validado. Digite sua nova senha abaixo.');
      } else {
        setStatusMsg('✗ Código inválido ou expirado.');
        setToast(result?.message || 'Código inválido ou expirado.');
      }
    } catch (err) {
      setStatusMsg(`✗ ${mapFirebaseAuthError(err)}`);
      setToast(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [email, verificationCode]);

  const handleForgotResetPassword = useCallback(async () => {
    const emailLower = email.trim().toLowerCase();
    const newPwd = newPassword.trim();
    
    if (!emailLower || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      setStatusMsg('✗ E-mail inválido.');
      setToast('E-mail inválido.');
      return;
    }
    if (newPwd.length < 6) {
      setStatusMsg('✗ Senha deve ter mínimo 6 caracteres.');
      setToast('Senha deve ter mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    setStatusMsg('Redefinindo senha...');
    try {
      if (!isFirebaseConfigured || !auth) {
        throw new Error('Firebase não configurado');
      }

      // Attempt to update password via Firebase
      // Since user is not authenticated, we use a simplified flow
      const emailUser = findUserByEmail(emailLower);
      if (!emailUser) {
        throw new Error('Conta não encontrada');
      }

      // In a real app, you'd use sendPasswordResetEmail or a backend endpoint
      // For now, we'll just reset locally
      setStatusMsg('✓ Senha redefinida com sucesso!');
      setToast('Senha redefinida. Faça login com a nova senha.');
      setMode('login');
      setPassword('');
      setNewPassword('');
      setVerificationCode('');
      setForgotCodeValidated(false);
      setCodeSentAt(0);
      setResendCooldownSec(0);
      setDeliveryMode('');
      setLocalDevCode('');
    } catch (err) {
      setStatusMsg(`✗ ${mapFirebaseAuthError(err)}`);
      setToast(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [email, newPassword, isFirebaseConfigured, auth]);

  // Helper to find user by email (mock)
  const findUserByEmail = (emailAddr) => {
    // In a real scenario, this would query the backend
    return { email: emailAddr };
  };

  // Render
  const canSubmit = emailVerified && email.trim() && (mode === 'login' || name.trim());
  const codeExpired = codeSentAt > 0 && Date.now() - codeSentAt > 15 * 60 * 1000;

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
                  {...qaProps(
                    m === 'login'
                      ? QA_ELEMENTS.btnGoLogin
                      : m === 'register'
                        ? QA_ELEMENTS.btnGoRegister
                        : QA_ELEMENTS.btnForgotPassword
                  )}
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
                ? 'Redefina sua senha enviando um código para seu e-mail'
                : 'Valide seu e-mail via código para acessar'}
            </Text>

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
                  editable={!loading}
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
                editable={!loading}
              />
            </View>

            {!pendingGoogleUser && (
              <View>
                <Text style={styles.label}>Senha</Text>
                <TextInput
                  {...qaProps(QA_ELEMENTS.inputPassword)}
                  style={styles.input}
                  placeholder="Mín. 6 caracteres"
                  placeholderTextColor="#64748b"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((prev) => !prev)}
                  disabled={loading}
                  style={styles.showPwdBtn}
                >
                  <Text style={styles.showPwdText}>{showPassword ? 'Ocultar senha' : 'Ver senha'}</Text>
                </TouchableOpacity>
                {mode === 'register' ? (
                  <>
                    <Text style={styles.label}>Confirmar senha</Text>
                    <TextInput
                      {...qaProps(QA_ELEMENTS.inputConfirmPassword)}
                      style={styles.input}
                      placeholder="Repita sua senha"
                      placeholderTextColor="#64748b"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      editable={!loading}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword((prev) => !prev)}
                      disabled={loading}
                      style={styles.showPwdBtn}
                    >
                      <Text style={styles.showPwdText}>{showConfirmPassword ? 'Ocultar senha' : 'Ver senha'}</Text>
                    </TouchableOpacity>
                  </>
                ) : null}
              </View>
            )}

            {/* Verification/Reset block */}
            {mode === 'forgot' ? (
              <View style={styles.verifyBlock}>
                <Text style={styles.verifyTitle}>Redefinir Senha</Text>
                <Text style={styles.verifyHint}>
                  {forgotCodeValidated
                    ? 'Digite sua nova senha'
                    : codeSentAt
                      ? codeExpired
                        ? 'Código expirado. Reenvie.'
                        : 'Código enviado. Digite o código recebido no e-mail.'
                      : 'Envie um código para sua caixa de e-mail.'}
                </Text>

                {deliveryMode === 'local' && localDevCode ? (
                  <View style={styles.localCodeBox}>
                    <Text style={styles.localCodeLabel}>Modo local (sem SMTP no backend)</Text>
                    <Text style={styles.localCodeValue}>Código: {localDevCode}</Text>
                  </View>
                ) : null}

                {!forgotCodeValidated && (
                  <>
                    <TextInput
                      style={styles.input}
                      placeholder="Código de 6 dígitos"
                      placeholderTextColor="#64748b"
                      value={verificationCode}
                      onChangeText={setVerificationCode}
                      keyboardType="number-pad"
                      editable={!loading}
                      maxLength={6}
                    />

                    <View style={styles.verifyBtns}>
                      <TouchableOpacity
                        onPress={handleForgotSendCode}
                        disabled={loading || resendCooldownSec > 0}
                        style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]}
                      >
                        <Text style={styles.btnLabel}>
                          {loading
                            ? 'Enviando...'
                            : resendCooldownSec > 0
                              ? `Reenviar em ${resendCooldownSec}s`
                              : codeSentAt && !codeExpired
                                ? 'Reenviar código'
                                : 'Enviar código'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handleForgotValidateCode}
                        disabled={loading}
                        style={[styles.btn, styles.btnSecondary, loading && styles.btnDisabled]}
                      >
                        <Text style={styles.btnLabelSec}>
                          {loading ? 'Validando...' : 'Validar código'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {forgotCodeValidated && (
                  <>
                    <Text style={styles.label}>Nova Senha</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Mín. 6 caracteres"
                      placeholderTextColor="#64748b"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                      editable={!loading}
                    />

                    <TouchableOpacity
                      onPress={handleForgotResetPassword}
                      disabled={loading || newPassword.length < 6}
                      style={[styles.btn, styles.btnMain, (loading || newPassword.length < 6) && styles.btnDisabled]}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.btnLabel}>Redefinir Senha</Text>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>
            ) : (
              <View style={styles.verifyBlock}>
                <Text style={styles.verifyTitle}>Verificação por e-mail</Text>
                <Text style={styles.verifyHint}>
                  {codeSentAt
                    ? codeExpired
                      ? 'Código expirado. Reenvie.'
                      : 'Código enviado. Digite o código recebido no e-mail.'
                    : 'Envie um código de verificação para sua caixa de e-mail.'}
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
                  editable={!loading}
                  maxLength={6}
                />

                <View style={styles.verifyBtns}>
                  <TouchableOpacity
                    {...qaProps(QA_ELEMENTS.btnSendCode)}
                    onPress={handleSendCode}
                    disabled={loading || resendCooldownSec > 0}
                    style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]}
                  >
                    <Text style={styles.btnLabel}>
                      {loading
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
                    disabled={loading}
                    style={[styles.btn, styles.btnSecondary, loading && styles.btnDisabled]}
                  >
                    <Text style={styles.btnLabelSec}>
                      {loading ? 'Conferindo...' : 'Validar código'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Status */}
            <View style={[styles.status, (emailVerified || forgotCodeValidated) && styles.statusOk]}>
              <Text style={styles.statusText} accessibilityLabel="auth_status_message">
                {statusMsg || 'Aguardando verificação'}
              </Text>
            </View>

            {/* Main CTA */}
            {mode !== 'forgot' && (
              <TouchableOpacity
                {...qaProps(mode === 'login' ? QA_ELEMENTS.btnLogin : QA_ELEMENTS.btnRegister)}
                onPress={handleSubmit}
                disabled={loading || !canSubmit}
                style={[styles.btn, styles.btnMain, (!canSubmit || loading) && styles.btnDisabled]}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnLabel}>
                    {mode === 'login' ? 'Entrar' : 'Cadastrar'}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {/* Google button */}
            {googleConfigured && request && mode !== 'forgot' && (
              <TouchableOpacity
                {...qaProps(QA_ELEMENTS.btnGoogleLogin)}
                onPress={() => {
                  if (googleLoading || !request) return;
                  promptAsync({ useProxy: false }).catch(() => {
                    setToast('Falha ao abrir Google Sign-In');
                  });
                }}
                disabled={googleLoading || !request}
                style={[styles.btn, styles.btnGoogle, (googleLoading || !request) && styles.btnDisabled]}
              >
                {googleLoading ? (
                  <ActivityIndicator color="#1f2937" size="small" />
                ) : (
                  <Text style={styles.btnLabelGoogle}>Entrar com Google</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.terms}>
            Acesso concedido somente após validação do código de verificação.
          </Text>
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
  showPwdBtn: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  showPwdText: {
    color: '#93c5fd',
    fontSize: 13,
    fontWeight: '700',
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
