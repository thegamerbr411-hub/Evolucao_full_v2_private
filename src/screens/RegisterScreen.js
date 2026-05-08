import React, { useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  applyActionCode,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  sendEmailVerification,
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
  useGoogleAuth,
} from '../services/authService.js';
import { setQaRuntimeAuth } from '../utils/qaTransport';
import { QA_SCREENS, qaProps } from '../qa/selectorRegistry';
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
  if (code.includes('auth/weak-password')) return 'Senha fraca (mín. 6 caracteres).';
  if (code.includes('auth/invalid-action-code')) return 'Link expirado ou inválido.';
  if (code.includes('auth/too-many-requests')) return 'Muitas tentativas. Aguarde alguns minutos.';
  if (code.includes('auth/network-request-failed')) return 'Sem conexão. Verifique internet.';
  return String(error?.message || 'Erro na autenticação.');
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
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [linkSentAt, setLinkSentAt] = useState(0);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  
  // UI state
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  
  // Google auth
  const { request, promptAsync, response } = useGoogleAuth();
  const googleConfigured = isGoogleAuthConfigured();

  setQaAuthState({ hydrated: true, hasAccount: false, userId: null });

  // Reset state when mode/email changes
  useEffect(() => {
    setEmailVerified(false);
    setLinkSentAt(0);
  }, [email, mode]);

  // Handle deep link from Firebase action link
  useEffect(() => {
    const handleDeepLink = async (url) => {
      const raw = String(url || '').trim();
      if (!raw || !raw.includes('oobCode')) return;

      const decoded = decodeURIComponent(raw);
      const modeMatch = decoded.match(/[?&#]mode=([^&#]+)/i);
      const codeMatch = decoded.match(/[?&#]oobCode=([^&#]+)/i);
      
      const actionMode = String(modeMatch?.[1] || '').trim();
      const oobCode = String(codeMatch?.[1] || '').trim();

      if (actionMode !== 'verifyEmail' || !oobCode) return;
      if (!isFirebaseConfigured || !auth) return;

      setLoading(true);
      try {
        await withTimeout(applyActionCode(auth, oobCode));
        if (auth.currentUser) {
          await auth.currentUser.reload().catch(() => {});
        }
        setEmailVerified(true);
        setStatusMsg('✓ E-mail verificado. Acesso liberado.');
        setToast('Link validado. Prossiga com o cadastro ou login.');
      } catch (err) {
        setStatusMsg('✗ Link expirado ou inválido.');
        setToast(mapFirebaseAuthError(err));
      } finally {
        setLoading(false);
      }
    };

    Linking.getInitialURL()
      .then((url) => url && handleDeepLink(url))
      .catch(() => {});

    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub?.remove?.();
  }, []);

  // Handle Google response
  useEffect(() => {
    if (!response || response.type !== 'success') return;

    const processGoogleAuth = async () => {
      setGoogleLoading(true);
      try {
        const idToken = response.authentication?.idToken;
        if (!idToken) throw new Error('Sem token do Google');

        const loggedUser = await loginWithGoogleToken({
          idToken,
          accessToken: response.authentication?.accessToken || null,
        });

        if (!loggedUser?.id) throw new Error('Google sem usuário válido');

        setMode('login');
        setEmail(loggedUser.email || '');
        if (loggedUser.name) setName(loggedUser.name);
        
        // Google users are pre-verified by the provider
        setPendingGoogleUser({
          id: loggedUser.id,
          name: loggedUser.name || 'Usuário',
          email: loggedUser.email,
          role: loggedUser.role || 'user',
        });
        setEmailVerified(true);
        setStatusMsg('✓ Google conectado e verificado.');
        setToast('Toque em Entrar para continuar.');
      } catch (err) {
        setStatusMsg('✗ Erro ao conectar com Google.');
        setToast(mapFirebaseAuthError(err));
      } finally {
        setGoogleLoading(false);
      }
    };

    processGoogleAuth();
  }, [response]);

  // Send verification link
  const handleSendLink = useCallback(async () => {
    const emailLower = email.trim().toLowerCase();
    if (!emailLower || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      setToast('E-mail inválido.');
      return;
    }

    if (mode === 'register' && (!name.trim() || password.length < 6)) {
      setToast('Nome e senha (mín. 6) obrigatórios.');
      return;
    }

    if (mode === 'login' && !pendingGoogleUser && password.length < 6) {
      setToast('Senha obrigatória (mín. 6 caracteres).');
      return;
    }

    if (!isFirebaseConfigured || !auth) {
      setToast('Firebase não configurado.');
      return;
    }

    setLoading(true);
    setStatusMsg('Enviando link...');
    try {
      let firebaseUser = null;

      // Check existing methods
      const methods = await withTimeout(fetchSignInMethodsForEmail(auth, emailLower));

      if (mode === 'register') {
        if (Array.isArray(methods) && methods.length > 0) {
          // Account exists, sign in
          const result = await withTimeout(
            signInWithEmailAndPassword(auth, emailLower, password)
          );
          firebaseUser = result.user;
        } else {
          // New account, create it
          const result = await withTimeout(
            createUserWithEmailAndPassword(auth, emailLower, password)
          );
          firebaseUser = result.user;
          if (name.trim()) {
            await updateProfile(firebaseUser, { displayName: name }).catch(() => {});
          }
        }
      } else {
        if (pendingGoogleUser) {
          setEmailVerified(true);
          setStatusMsg('✓ Google verificado. Prossiga.');
          setToast('Toque em Entrar para continuar.');
          return;
        }

        // Login mode: check account exists
        if (!Array.isArray(methods) || methods.length === 0) {
          setToast('Conta não encontrada.');
          setStatusMsg('✗ E-mail não registrado.');
          return;
        }

        // Sign in with password
        const result = await withTimeout(
          signInWithEmailAndPassword(auth, emailLower, password)
        );
        firebaseUser = result.user;
      }

      if (!firebaseUser) {
        throw new Error('Falha ao preparar conta');
      }

      // Check if already verified
      if (firebaseUser.emailVerified) {
        setEmailVerified(true);
        setStatusMsg('✓ E-mail já verificado. Prossiga.');
        setToast('Acesso liberado. Toque em Entrar/Cadastrar.');
        return;
      }

      // Send verification link
      await withTimeout(
        sendEmailVerification(firebaseUser, {
          handleCodeInApp: true,
          url: 'https://t-evo-b069a.firebaseapp.com/auth-complete',
          android: {
            packageName: 'com.tipolt.evolucaofullv2',
            installApp: true,
            minimumVersion: '1',
          },
        })
      );

      setLinkSentAt(Date.now());
      setStatusMsg('✓ Link enviado. Abra o e-mail.');
      setToast('Verifique inbox/spam. Toque no link e volte ao app.');
    } catch (err) {
      setStatusMsg(`✗ ${mapFirebaseAuthError(err)}`);
      setToast(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [email, name, password, mode, pendingGoogleUser]);

  // Check verification status
  const handleCheckVerification = useCallback(async () => {
    if (!isFirebaseConfigured || !auth) {
      setToast('Firebase não configurado.');
      return;
    }

    setLoading(true);
    setStatusMsg('Conferindo...');
    try {
      const emailLower = email.trim().toLowerCase();

      // If we need to sign in first
      if (!auth.currentUser && !pendingGoogleUser && mode === 'login' && password) {
        await withTimeout(signInWithEmailAndPassword(auth, emailLower, password));
      }

      if (pendingGoogleUser) {
        setEmailVerified(true);
        setStatusMsg('✓ Google verificado.');
        return;
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        setStatusMsg('✗ Sessão não encontrada. Abra o link novamente.');
        return;
      }

      await currentUser.reload().catch(() => {});
      if (currentUser.emailVerified) {
        setEmailVerified(true);
        setStatusMsg('✓ E-mail verificado. Acesso liberado.');
        setToast('Pronto para prosseguir.');
      } else {
        setStatusMsg('✗ E-mail ainda não verificado.');
        setToast('Abra o link recebido e volte ao app.');
      }
    } catch (err) {
      setStatusMsg(`✗ ${mapFirebaseAuthError(err)}`);
      setToast(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [email, password, mode, pendingGoogleUser]);

  // Submit registration/login
  const handleSubmit = useCallback(async () => {
    const emailLower = email.trim().toLowerCase();
    
    if (!emailLower || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      setToast('E-mail inválido.');
      return;
    }

    if (!emailVerified) {
      setToast('Valide o e-mail pelo link antes de continuar.');
      setStatusMsg('✗ E-mail não verificado.');
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
        if (!result?.user?.emailVerified) {
          throw new Error('E-mail não foi verificado após o login');
        }
        finalUser = {
          id: result.user.uid,
          name: result.user.displayName || name || 'Usuário',
          email: emailLower,
          role: 'user',
          source: 'email',
        };
      } else {
        // Email register path
        const methods = await withTimeout(fetchSignInMethodsForEmail(auth, emailLower));
        let result;
        
        if (Array.isArray(methods) && methods.length > 0) {
          result = await withTimeout(signInWithEmailAndPassword(auth, emailLower, password));
        } else {
          result = await withTimeout(createUserWithEmailAndPassword(auth, emailLower, password));
          if (name.trim()) {
            await updateProfile(result.user, { displayName: name }).catch(() => {});
          }
        }

        if (!result?.user?.emailVerified) {
          throw new Error('E-mail não foi verificado após cadastro');
        }

        finalUser = {
          id: result.user.uid,
          name: result.user.displayName || name,
          email: emailLower,
          role: 'user',
          source: 'email',
        };
      }

      // Save identity
      const identity = await getOrCreateUserIdentity();
      await saveUserIdentity({ userId: finalUser.id, source: finalUser.source });
      setQaRuntimeAuth({ userId: finalUser.id });

      // Update app context
      setUser({
        id: finalUser.id,
        name: finalUser.name,
        email: finalUser.email,
        role: finalUser.role,
      });

      setStatusMsg('✓ Autenticado com sucesso.');
      navigation.replace('MainTabs');
    } catch (err) {
      setStatusMsg(`✗ ${mapFirebaseAuthError(err)}`);
      setToast(mapFirebaseAuthError(err));
    } finally {
      setLoading(false);
    }
  }, [email, password, name, mode, emailVerified, pendingGoogleUser, navigation, setUser]);

  // Render
  const canSubmit = emailVerified && email.trim() && (mode === 'login' || name.trim());
  const linkExpired = linkSentAt > 0 && Date.now() - linkSentAt > 10 * 60 * 1000; // 10 min

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
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
              {['login', 'register'].map((m) => (
                <TouchableOpacity
                  key={m}
                  onPress={() => {
                    setMode(m);
                    setEmailVerified(false);
                  }}
                  style={[styles.tab, mode === m && styles.tabActive]}
                >
                  <Text style={[styles.tabLabel, mode === m && styles.tabLabelActive]}>
                    {m === 'login' ? 'Entrar' : 'Cadastrar'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.hint}>Valide seu e-mail via link para acessar</Text>

            {/* Form */}
            {mode === 'register' && (
              <View>
                <Text style={styles.label}>Nome</Text>
                <TextInput
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
                  style={styles.input}
                  placeholder="Mín. 6 caracteres"
                  placeholderTextColor="#64748b"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!loading}
                />
              </View>
            )}

            {/* Verification block */}
            <View style={styles.verifyBlock}>
              <Text style={styles.verifyTitle}>Verificação por e-mail</Text>
              <Text style={styles.verifyHint}>
                {linkSentAt
                  ? linkExpired
                    ? 'Link expirado. Reenvie.'
                    : 'Link enviado. Abra o e-mail e toque no link.'
                  : 'Envie um link de verificação para sua caixa de e-mail.'}
              </Text>

              <View style={styles.verifyBtns}>
                <TouchableOpacity
                  onPress={handleSendLink}
                  disabled={loading}
                  style={[styles.btn, styles.btnPrimary, loading && styles.btnDisabled]}
                >
                  <Text style={styles.btnLabel}>
                    {loading ? 'Enviando...' : linkSentAt && !linkExpired ? 'Reenviar' : 'Enviar link'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleCheckVerification}
                  disabled={loading}
                  style={[styles.btn, styles.btnSecondary, loading && styles.btnDisabled]}
                >
                  <Text style={styles.btnLabelSec}>
                    {loading ? 'Conferindo...' : 'Validei'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Status */}
            <View style={[styles.status, emailVerified && styles.statusOk]}>
              <Text style={styles.statusText}>{statusMsg || 'Aguardando verificação'}</Text>
            </View>

            {/* Main CTA */}
            <TouchableOpacity
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

            {/* Google button */}
            {googleConfigured && (
              <TouchableOpacity
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
            Acesso concedido somente após validação do link de verificação.
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
