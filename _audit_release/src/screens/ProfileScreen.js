import React, { useEffect, useRef, useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { CommonActions } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { AnimatedToast, AppCard, AppInput, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { generateCoachInsight } from '../services/coachInsight';
import { exportBetaAnalysisToFile, getBetaAuthSourceLabel, getAuthProviderInfo } from '../utils/betaExport.js';
import { colors, spacing } from '../theme';
import { APP_VERSION, BUILD_VERSION } from '../utils/appVersion';
import { cancelCreatineReminder, scheduleCreatineReminder } from '../utils/notifications';
import * as _authServiceModule from '../services/authService.js';
const { isGoogleAuthConfigured: _isGoogleAuthConfigured, loginWithGoogleToken: _loginWithGoogleToken, logoutGoogleSession: _logoutGoogleSession, useGoogleAuth: _useGoogleAuth, exchangeGoogleAuthCode: _exchangeGoogleAuthCode } = _authServiceModule || {};
const isGoogleAuthConfigured = typeof _isGoogleAuthConfigured === 'function' ? _isGoogleAuthConfigured : () => false;
const loginWithGoogleToken = typeof _loginWithGoogleToken === 'function' ? _loginWithGoogleToken : async () => ({ id: null, isAdmin: false, role: 'user', source: 'unavailable' });
const logoutGoogleSession = typeof _logoutGoogleSession === 'function' ? _logoutGoogleSession : async () => ({ ok: false });
const useGoogleAuth = typeof _useGoogleAuth === 'function' ? _useGoogleAuth : () => ({ request: null, response: null, promptAsync: async () => {} });
const exchangeGoogleAuthCode = typeof _exchangeGoogleAuthCode === 'function' ? _exchangeGoogleAuthCode : async () => null;
import { getOrCreateUserIdentity, saveUserIdentity } from '../services/appIdentityService';
import { performFullSessionLogout } from '../services/sessionCleanupService';
import { auth } from '../services/firebase';
import { getLocal } from '../storage/mmkv';
import { setQaRuntimeAuth } from '../utils/qaTransport';
import { QA_ELEMENTS, QA_SCREENS, qaAliasProps, qaProps } from '../qa/selectorRegistry';

const ADMIN_EMAILS = ['thegamerbr411@gmail.com'];
const BETA_CODE = 'BETA2026';
const BETA_ENABLED_KEY = 'evolucao.beta.enabled.v1';
const BETA_SUGGESTIONS_KEY = 'evolucao.beta.suggestions.v1';
const ADMIN_LOCAL_EXERCISES_KEY = 'admin.local.exercises.v1';
const ADMIN_LOCAL_FOODS_KEY = 'admin.local.foods.v1';

const GOALS = [
  { key: 'emagrecer', label: 'Perda de gordura' },
  { key: 'ganhar_massa', label: 'Ganho de massa' },
  { key: 'recomposicao', label: 'Recomposicao corporal' },
];

const LEVELS = [
  { key: 'iniciante', label: 'Iniciante' },
  { key: 'intermediario', label: 'Intermediario' },
  { key: 'avancado', label: 'Avancado' },
];

function parseLocalizedNumber(value = '') {
  const sanitized = String(value || '').trim().replace(',', '.');
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseHeightCm(value = '') {
  const parsed = parseLocalizedNumber(value);
  if (!parsed) return 0;
  if (parsed > 0 && parsed <= 3) {
    return Math.round(parsed * 100);
  }
  return Math.round(parsed);
}

export default function ProfileScreen({ navigation }) {
  const {
    profile,
    user,
    plan,
    history,
    userRoutines,
    getWorkoutGamification,
    getDailyMacroTargets,
    updateProfileSettings,
    setUser,
  } = useApp();

  const [goal, setGoal] = useState(profile?.goal || 'recomposicao');
  const [level, setLevel] = useState(profile?.level || 'iniciante');
  const [trainingDays, setTrainingDays] = useState(String(profile?.trainingDaysPerWeek || 3));
  const [currentWeight, setCurrentWeight] = useState(String(profile?.currentWeight || 70));
  const [targetWeight, setTargetWeight] = useState(String(profile?.targetWeight || 70));
  const [height, setHeight] = useState(String(profile?.height || 170));
  const [currentPain, setCurrentPain] = useState(String(profile?.currentPain || profile?.pain || ''));
  const [recoveryEmail, setRecoveryEmail] = useState(String(profile?.recoveryEmail || '').trim());
  const [googleLoading, setGoogleLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [sessionLogoutLoading, setSessionLogoutLoading] = useState(false);
  const [creatineLoading, setCreatineLoading] = useState(false);
  const [betaKeyInput, setBetaKeyInput] = useState('');
  const [betaSuggestion, setBetaSuggestion] = useState('');
  const [betaEnabled, setBetaEnabled] = useState(false);
  const [betaLoading, setBetaLoading] = useState(false);
  const [betaExportLoading, setBetaExportLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const insets = useSafeAreaInsets();
  const safeBottomInset = Math.min(Number(insets.bottom || 0), 24);
  const stickyFooterPaddingBottom = spacing.md + safeBottomInset;
  const adminTapCount = useRef(0);
  const adminTapTimer = useRef(null);

  const handleVersionTap = () => {
    adminTapCount.current += 1;
    if (adminTapTimer.current) clearTimeout(adminTapTimer.current);
    adminTapTimer.current = setTimeout(() => { adminTapCount.current = 0; }, 3000);
    if (adminTapCount.current >= 5) {
      adminTapCount.current = 0;
      navigation.navigate('Admin');
    }
  };
  const { request, promptAsync, response } = useGoogleAuth();
  const lastGoogleResponseKeyRef = React.useRef('');
  const googleConfigured = isGoogleAuthConfigured();
  const googleReady = googleConfigured && typeof promptAsync === 'function';
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin' || ADMIN_EMAILS.includes(String(user?.email || '').toLowerCase().trim());
  const isBetaTester = isAdmin || betaEnabled;

  const gamification = getWorkoutGamification();
  const macroTargets = getDailyMacroTargets();
  const authSourceLabel = getBetaAuthSourceLabel();

  const bmi = useMemo(() => {
    const w = Number(profile?.currentWeight || currentWeight || 0);
    const h = Number(profile?.height || height || 170) / 100;
    if (!w || !h) return null;
    const val = w / (h * h);
    const label = val < 18.5 ? 'Abaixo do peso' : val < 25 ? 'Peso normal' : val < 30 ? 'Sobrepeso' : 'Obesidade';
    return { value: val.toFixed(1), label };
  }, [profile?.currentWeight, profile?.height, currentWeight, height]);

  const historySummary = useMemo(() => {
    const recent = history.slice(0, 7);
    const trainedDays = recent.filter((item) => item.trained).length;
    const avgProtein = recent.length
      ? Math.round(recent.reduce((acc, item) => acc + Number(item.protein || 0), 0) / recent.length)
      : 0;

    return {
      days: recent.length,
      trainedDays,
      avgProtein,
    };
  }, [history]);

  const totalWorkouts = useMemo(
    () => history.filter((item) => Boolean(item?.trained)).length,
    [history]
  );

  const weightEvolution = useMemo(() => {
    const current = Number(profile?.currentWeight || currentWeight || 0);
    const target = Number(profile?.targetWeight || targetWeight || current);
    const diff = Number((target - current).toFixed(1));
    return { current, target, diff };
  }, [profile?.currentWeight, profile?.targetWeight, currentWeight, targetWeight]);

  const profileCoach = useMemo(() => generateCoachInsight({
    trainedToday: historySummary.trainedDays > 0,
    protein: historySummary.avgProtein,
    proteinTarget: Number(macroTargets?.protein || 140),
    water: Number(plan?.waterLitersPerDay || 0) * 1000,
    waterTarget: Number(plan?.waterLitersPerDay || 0) * 1000,
    weeklyDone: historySummary.trainedDays,
    weeklyTarget: Number(trainingDays || profile?.trainingDaysPerWeek || 3),
    hasRoutine: Array.isArray(userRoutines) && userRoutines.length > 0,
    goal,
    level,
    pain: currentPain,
  }), [historySummary.trainedDays, historySummary.avgProtein, macroTargets?.protein, plan?.waterLitersPerDay, trainingDays, profile?.trainingDaysPerWeek, userRoutines, goal, level, currentPain]);

  const saveProfile = () => {
    const parsedDays = Math.round(parseLocalizedNumber(trainingDays || '3'));
    if (!parsedDays || parsedDays < 1 || parsedDays > 7) {
      setToastMessage('Frequencia invalida. Informe entre 1 e 7 dias por semana.');
      return;
    }
    const parsedWeight = parseLocalizedNumber(currentWeight || '70');
    if (!parsedWeight || parsedWeight < 30 || parsedWeight > 300) {
      setToastMessage('Peso invalido. Informe um peso entre 30 e 300 kg.');
      return;
    }
    const parsedTargetWeight = parseLocalizedNumber(targetWeight || '70');
    const parsedHeight = parseHeightCm(height || '170');

    if (!parsedHeight || parsedHeight < 120 || parsedHeight > 230) {
      setToastMessage('Altura invalida. Use 180, 1.80 ou 1,80.');
      return;
    }

    const recoveryTrim = String(recoveryEmail || '').trim().toLowerCase();
    if (recoveryTrim && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recoveryTrim)) {
      setToastMessage('E-mail de recuperacao invalido. Deixe em branco ou use um e-mail valido.');
      return;
    }

    const result = updateProfileSettings({
      goal,
      level,
      trainingDaysPerWeek: parsedDays,
      currentWeight: parsedWeight,
      targetWeight: parsedTargetWeight || parsedWeight,
      height: parsedHeight || 170,
      currentPain,
      recoveryEmail: recoveryTrim || null,
    });

    if (!result.ok) {
      setToastMessage(`Nao foi possivel salvar: ${String(result?.message || 'erro desconhecido')}`);
      return;
    }

    setToastMessage('Perfil atualizado. Configuracoes ativas no coach e nas rotinas.');
  };

  React.useEffect(() => {
    setRecoveryEmail(String(profile?.recoveryEmail || '').trim());
  }, [profile?.recoveryEmail]);

  React.useEffect(() => {
    const handleGoogleResponse = async () => {
      if (!response) {
        return;
      }

      const responseKey = [
        response.type || '',
        response?.params?.state || '',
        response?.params?.error || '',
        response?.params?.id_token || '',
      ].join('|');

      if (responseKey && lastGoogleResponseKeyRef.current === responseKey) {
        return;
      }
      lastGoogleResponseKeyRef.current = responseKey;

      if (response.type === 'error') {
        const responseError = String(response?.error?.message || response?.params?.error_description || response?.params?.error || 'Falha na autenticacao Google.');
        setToastMessage(`Erro no login Google: ${responseError}`);
        return;
      }

      if (response.type !== 'success') {
        return;
      }

      setGoogleLoading(true);
      try {
        const authData = response.authentication || {};
        let accessToken = authData.accessToken || null;
        let idToken = authData.idToken || response?.params?.id_token || null;

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

        const loggedUser = await loginWithGoogleToken({
          accessToken,
          idToken,
        });

        if (!loggedUser?.id) {
          setToastMessage('Falha no login. Nao foi possivel concluir o login Google.');
          return;
        }

        await saveUserIdentity({ userId: loggedUser.id, source: loggedUser.source || 'google' });
        setQaRuntimeAuth({ userId: loggedUser.id });
        setUser((prev) => ({
          ...prev,
          id: loggedUser.id,
          role: loggedUser.role || 'user',
          email: loggedUser.email || prev?.email || null,
          name: loggedUser.name || prev?.name || null,
        }));
        setToastMessage('Login concluido. Conta Google conectada com sucesso.');
      } catch (error) {
        setToastMessage(`Erro no login: ${String(error?.message || 'Nao foi possivel autenticar com Google.')}`);
      } finally {
        setGoogleLoading(false);
      }
    };

    handleGoogleResponse();
  }, [exchangeGoogleAuthCode, request, response, setUser]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const betaFlag = String((await AsyncStorage.getItem(BETA_ENABLED_KEY)) || '').trim() === '1';
        const savedSuggestion = String((await AsyncStorage.getItem(BETA_SUGGESTIONS_KEY)) || '').trim();
        if (!mounted) return;
        setBetaEnabled(betaFlag);
        if (savedSuggestion) {
          setBetaSuggestion(savedSuggestion);
        }
      } catch {
        if (mounted) {
          setBetaEnabled(false);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const handleActivateBeta = async () => {
    const safeCode = String(betaKeyInput || '').trim().toUpperCase();
    if (!safeCode) {
      setToastMessage('Informe a chave Beta para ativar.');
      return;
    }
    if (safeCode !== BETA_CODE) {
      setToastMessage('Chave Beta invalida.');
      return;
    }

    setBetaLoading(true);
    try {
      await AsyncStorage.setItem(BETA_ENABLED_KEY, '1');
      setBetaEnabled(true);
      setToastMessage('Modo Beta ativado neste dispositivo.');
    } finally {
      setBetaLoading(false);
    }
  };

  const handleExportImprovements = async () => {
    if (!isBetaTester) {
      setToastMessage('Ative o modo Beta para exportar melhorias.');
      return;
    }

    setBetaLoading(true);
    try {
      const suggestionsText = String(betaSuggestion || '').trim();
      if (suggestionsText) {
        await AsyncStorage.setItem(BETA_SUGGESTIONS_KEY, suggestionsText);
      }

      const localExercises = (getLocal(ADMIN_LOCAL_EXERCISES_KEY) || [])
        .filter((item) => item && item.name)
        .map((item) => ({
          id: item.id,
          name: item.name,
          primaryMuscle: item.primaryMuscle,
          equipment: item.equipment,
          createdAt: item.createdAt || null,
        }));

      const localFoods = (getLocal(ADMIN_LOCAL_FOODS_KEY) || [])
        .filter((item) => item && item.nome)
        .map((item) => ({
          id: item.id,
          nome: item.nome,
          porcao: item.porcao,
          kcal: item.kcal,
          carbo: item.carbo,
          prot: item.prot,
          gord: item.gord,
          createdAt: item.createdAt || null,
        }));

      const payload = {
        exportedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
        betaStatus: isBetaTester ? 'enabled' : 'disabled',
        user: {
          id: user?.id || null,
          name: user?.name || null,
          email: user?.email || null,
        },
        improvements: {
          exercises: localExercises,
          foods: localFoods,
          suggestions: suggestionsText
            ? suggestionsText.split('\n').map((item) => item.trim()).filter(Boolean)
            : [],
        },
      };

      const dir = `${FileSystem.documentDirectory}exports/`;
      const fileName = `tevo_melhorias_${Date.now()}.json`;
      const fileUri = `${dir}${fileName}`;

      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      await AsyncStorage.setItem('evolucao.beta.lastExport.v1', fileUri);

      await Share.share({
        title: 'Exportar melhorias T-Evo',
        message: `Arquivo JSON gerado: ${fileUri}`,
      });

      setToastMessage(`Exportacao concluida. Arquivo: ${fileName}`);
    } catch {
      setToastMessage('Falha ao exportar melhorias.');
    } finally {
      setBetaLoading(false);
    }
  };

  const handleBetaExport = async (kind) => {
    if (!isBetaTester) {
      setToastMessage('Ative o modo Beta para exportar a analise.');
      return;
    }

    setBetaExportLoading(true);
    try {
      const feedback = String(betaSuggestion || '').trim();
      if (feedback) {
        await AsyncStorage.setItem(BETA_SUGGESTIONS_KEY, feedback);
      }

      const result = await exportBetaAnalysisToFile({
        kind,
        feedback,
      });

      if (!result?.ok) {
        setToastMessage(`Falha ao exportar beta: ${String(result?.error || 'erro desconhecido')}`);
        return;
      }

      await Share.share({
        title: `Exportacao beta ${kind}`,
        message: `Exportacao concluida.\nJSON: ${result.jsonUri}\nTXT: ${result.txtUri}\nPacote: ${result.packageDir || 'n/d'}`,
      });

      setToastMessage(`Exportacao beta concluida: ${result.fileName}`);
    } catch (error) {
      setToastMessage(`Falha ao exportar beta: ${String(error?.message || 'erro desconhecido')}`);
    } finally {
      setBetaExportLoading(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screenWrapper}>
    <ScrollView
      {...qaAliasProps(QA_SCREENS.profile, 'screen-perfil')}
      style={styles.scrollArea}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={[styles.container, { paddingBottom: spacing.lg }]}
    >
      <AnimatedToast message={toastMessage} onHide={() => setToastMessage('')} />

      {/* Hero / Avatar */}
      <View style={styles.heroSection}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarEmoji}>👤</Text>
        </View>
        <Text style={styles.heroName}>{user?.name || 'Meu Perfil'}</Text>
        {user?.email ? <Text style={styles.heroEmail}>{user.email}</Text> : null}
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{gamification.level ?? 1}</Text>
            <Text style={styles.heroStatLabel}>Nível</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{gamification.xp ?? 0}</Text>
            <Text style={styles.heroStatLabel}>XP</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{gamification.streakDays ?? 0}</Text>
            <Text style={styles.heroStatLabel}>Streak</Text>
          </View>
        </View>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statCardValue}>{weightEvolution.current}kg</Text>
          <Text style={styles.statCardLabel}>Peso atual</Text>
          <Text style={[styles.statCardDiff, { color: weightEvolution.diff <= 0 ? colors.success : colors.warning }]}>
            {weightEvolution.diff < 0 ? `↓ ${Math.abs(weightEvolution.diff)}kg` : weightEvolution.diff > 0 ? `↑ ${weightEvolution.diff}kg` : '→ estável'}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statCardValue}>{totalWorkouts}</Text>
          <Text style={styles.statCardLabel}>Treinos</Text>
          <Text style={styles.statCardDiff}>{historySummary.trainedDays} últimos 7d</Text>
        </View>
        {bmi ? (
          <View style={styles.statCard}>
            <Text style={styles.statCardValue}>{bmi.value}</Text>
            <Text style={styles.statCardLabel}>IMC</Text>
            <Text style={[styles.statCardDiff, { color: bmi.label === 'Peso normal' ? colors.success : colors.warning }]}>{bmi.label}</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.sectionHeading}>⚙️ Configurações</Text>

      <AppCard>
        <Text style={styles.cardLabel}>Meta principal</Text>
        <View style={styles.chipsRow}>
          {GOALS.map((item) => (
            <TouchableOpacity key={item.key} style={[styles.chip, goal === item.key ? styles.chipActive : null]} onPress={() => setGoal(item.key)}>
              <Text style={[styles.chipText, goal === item.key ? styles.chipTextActive : null]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Nivel</Text>
        <View style={styles.chipsRow}>
          {LEVELS.map((item) => (
            <TouchableOpacity key={item.key} style={[styles.chip, level === item.key ? styles.chipActive : null]} onPress={() => setLevel(item.key)}>
              <Text style={[styles.chipText, level === item.key ? styles.chipTextActive : null]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </AppCard>

      <AppCard>
        <AppInput
          label="Frequencia semanal"
          value={trainingDays}
          onChangeText={setTrainingDays}
          keyboardType="numeric"
        />
      </AppCard>

      <AppCard>
        <AppInput
          label="Peso atual (kg)"
          testID="input-profile-current-weight"
          value={currentWeight}
          onChangeText={setCurrentWeight}
          keyboardType="numeric"
        />
      </AppCard>

      <AppCard>
        <AppInput
          label="Peso alvo (kg)"
          value={targetWeight}
          onChangeText={setTargetWeight}
          keyboardType="numeric"
        />
      </AppCard>

      <AppCard>
        <AppInput
          label="Altura (cm)"
          value={height}
          onChangeText={setHeight}
          keyboardType="numeric"
        />
      </AppCard>

      <AppCard>
        <AppInput
          label="Dor / limitação atual"
          value={currentPain}
          onChangeText={setCurrentPain}
          placeholder="Ex: ombro direito"
          autoCapitalize="sentences"
        />
      </AppCard>

      <Text style={styles.sectionHeading}>📊 Histórico</Text>

      <AppCard>
        <Text style={styles.cardLabel}>Atividade recente</Text>
        <Text style={styles.metric}>Dias com registro: {historySummary.days}</Text>
        <Text style={styles.metric}>Dias treinados: {historySummary.trainedDays}</Text>
        <Text style={styles.metric}>Proteína média: {historySummary.avgProtein}g/dia</Text>
        <Text style={styles.metric}>Rotinas salvas: {Array.isArray(userRoutines) ? userRoutines.length : 0}</Text>
      </AppCard>

      <Text style={styles.sectionHeading}>🍽️ Plano atual</Text>

      <AppCard>
        <Text style={styles.metric}>Calorias alvo: {Number(plan?.caloriesPerDay || 0)} kcal/dia</Text>
        <Text style={styles.metric}>Agua alvo: {Number(plan?.waterLitersPerDay || 0)}L/dia</Text>
        <Text style={styles.metric}>Estrategia: {String(plan?.strategy || 'recomposicao')}</Text>
      </AppCard>

      <Text style={styles.sectionHeading}>🔐 Conta</Text>

      <AppCard>
        <Text style={styles.cardLabel}>Identidade</Text>
        <Text style={styles.accountMeta}>ID no app: {String(user?.id || '—')}</Text>
        <Text style={styles.accountMeta}>UID Firebase: {String(auth?.currentUser?.uid || '—')}</Text>
        <Text style={styles.accountMeta}>Provedor: {getAuthProviderInfo().label}</Text>
        {getAuthProviderInfo().providerIds?.length ? (
          <Text style={styles.accountMetaHint}>
            Vinculos: {getAuthProviderInfo().providerIds.join(', ')}
          </Text>
        ) : null}
        <Text style={styles.accountMeta}>
          E-mail da sessao: {String(user?.email || auth?.currentUser?.email || '—')}
        </Text>
        <AppInput
          label="E-mail de recuperacao (opcional)"
          {...qaProps('input_profile_recovery_email')}
          value={recoveryEmail}
          onChangeText={setRecoveryEmail}
          placeholder="outro@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Text style={styles.accountHint}>
          Use um e-mail que voce acessa com frequencia. Ajuda em recuperacao e comunicacoes, inclusive com login Google.
        </Text>
        <Text style={styles.metric}>Sincronize sua conta para manter seu progresso seguro em qualquer dispositivo.</Text>
        <PrimaryButton
          {...qaAliasProps(QA_ELEMENTS.btnGoogleLogin, 'btn-profile-google-login')}
          title={googleLoading ? 'Conectando Google...' : (googleReady ? 'Entrar com Google' : 'Preparando Google...')}
          onPress={() => {
            if (googleLoading) return;
            if (!googleReady) {
              setToastMessage('Google ainda nao ficou pronto nesta sessao. Aguarde alguns segundos e tente novamente.');
              return;
            }
            promptAsync().catch(() => {
              setToastMessage('Falha no login. Nao foi possivel abrir o fluxo do Google.');
            });
          }}
        />
        <SecondaryButton
          {...qaAliasProps(QA_ELEMENTS.btnGoogleLogout, 'btn-profile-google-logout')}
          title={logoutLoading ? 'Trocando conta...' : 'Desconectar e usar identidade local'}
          onPress={async () => {
            if (logoutLoading) {
              return;
            }

            setLogoutLoading(true);
            try {
              await logoutGoogleSession();
              const localIdentity = await getOrCreateUserIdentity();
              await saveUserIdentity({ userId: localIdentity.userId, source: 'local' });
              setQaRuntimeAuth({ userId: localIdentity.userId });
              setUser((prev) => ({ ...prev, id: localIdentity.userId, role: 'user' }));
              setToastMessage('Conta local ativa. Sessao Google encerrada neste dispositivo.');
            } finally {
              setLogoutLoading(false);
            }
          }}
          style={styles.secondaryButton}
        />
        {!googleConfigured ? <Text style={styles.metric}>Google ainda nao ficou pronto nesta sessao. Tente novamente em alguns segundos.</Text> : null}
        {!request && googleConfigured ? <Text style={styles.metric}>Inicializando provedor Google...</Text> : null}

        <SecondaryButton
          {...qaAliasProps(QA_ELEMENTS.btnLogout, 'btn-profile-session-logout')}
          title={sessionLogoutLoading ? 'Encerrando sessao...' : 'Encerrar sessao completa'}
          onPress={async () => {
            if (sessionLogoutLoading) {
              return;
            }

            setSessionLogoutLoading(true);
            try {
              const result = await performFullSessionLogout({ reason: 'profile_manual_logout' });
              if (!result?.ok) {
                setToastMessage('Logout ja em andamento. Aguarde.');
                return;
              }

              const rootNavigation = navigation.getParent()?.getParent?.() || navigation.getParent?.() || navigation;
              rootNavigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Cadastro' }],
                })
              );
              setToastMessage('Sessao encerrada com limpeza completa do estado local.');
            } catch (error) {
              setToastMessage(`Falha ao encerrar a sessao: ${String(error?.message || 'erro desconhecido')}`);
            } finally {
              setSessionLogoutLoading(false);
            }
          }}
          style={styles.secondaryButton}
        />

        <SecondaryButton
          {...qaProps('btn_open_admin_profile')}
          title="Abrir painel Admin"
          onPress={() => navigation.navigate('Admin')}
          style={styles.secondaryButton}
        />

        {__DEV__ ? (
          <>
            <SecondaryButton
              {...qaProps('btn_open_debug_observability')}
              title="Monitor ao vivo (debug)"
              onPress={() => navigation.navigate('DebugObservability')}
              style={styles.secondaryButton}
            />
            <SecondaryButton
              {...qaProps('btn_open_debug_health')}
              title="QA health (debug)"
              onPress={() => navigation.navigate('DebugHealth')}
              style={styles.secondaryButton}
            />
          </>
        ) : null}

      </AppCard>

      {isAdmin ? (
        <AppCard>
          <Text style={styles.cardLabel}>Admin</Text>
          {__DEV__ ? <Text style={styles.devFeatureTag}>[F-Admin] Acesso privilegiado habilitado</Text> : null}
          <PrimaryButton title="Abrir configuracoes Admin" onPress={() => navigation.navigate('Admin')} />
        </AppCard>
      ) : null}

      <Text style={styles.sectionHeading}>🔔 Lembretes</Text>

      <AppCard>
        <Text style={styles.cardLabel}>Lembrete diario de creatina</Text>
        <Text style={styles.metric}>Ative um lembrete fixo para manter consistencia diaria.</Text>
        <SecondaryButton
          {...qaProps('btn_profile_creatine_enable')}
          title={creatineLoading ? 'Ativando lembrete...' : 'Ativar lembrete (09:00)'}
          onPress={async () => {
            if (creatineLoading) return;

            setCreatineLoading(true);
            try {
              const result = await scheduleCreatineReminder({ hour: 9, minute: 0 });
              if (!result?.ok) {
                setToastMessage('Nao foi possivel ativar. Verifique a permissao de notificacoes no dispositivo.');
                return;
              }
              setToastMessage('Lembrete ativo. Creatina diaria agendada para 09:00.');
            } finally {
              setCreatineLoading(false);
            }
          }}
        />
        <SecondaryButton
          {...qaProps('btn_profile_creatine_disable')}
          title={creatineLoading ? 'Desativando...' : 'Desativar lembrete'}
          onPress={async () => {
            if (creatineLoading) return;

            setCreatineLoading(true);
            try {
              await cancelCreatineReminder();
              setToastMessage('Lembrete desativado. O lembrete diario de creatina foi removido.');
            } finally {
              setCreatineLoading(false);
            }
          }}
          style={styles.secondaryButton}
        />
      </AppCard>

      <Text style={styles.sectionHeading}>🧪 Beta e Diagnóstico</Text>

      <AppCard>
        <Text style={styles.cardLabel}>Status Beta</Text>
        <Text style={styles.metric}>
          {isBetaTester ? 'Beta ativo' : 'Beta desativado'}
        </Text>
        <Text style={styles.metric}>Conta atual: {authSourceLabel}</Text>
        <Text style={styles.metric}>Sessão: {user?.email ? 'autenticada' : 'local/pendente'}</Text>
        <Text style={styles.metric}>Versão: v{APP_VERSION} · build {BUILD_VERSION}</Text>
        {!isBetaTester ? (
          <>
            <AppInput
              label="Chave Beta"
              value={betaKeyInput}
              onChangeText={setBetaKeyInput}
              placeholder="Ex.: BETA2026"
            />
            <PrimaryButton
              title={betaLoading ? 'Ativando...' : 'Ativar modo Beta'}
              onPress={handleActivateBeta}
            />
          </>
        ) : (
          <>
            <Text style={styles.metric}>
              Acesso liberado para:
            </Text>
            <Text style={styles.metric}>- Criar exercicios personalizados</Text>
            <Text style={styles.metric}>- Adicionar alimentos customizados</Text>
            <Text style={styles.metric}>- Exportar melhorias</Text>
            <Text style={styles.metric}>- Exportar analise, timeline e diagnostico</Text>
            <SecondaryButton
              title="Abrir painel Beta"
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Admin')}
            />
          </>
        )}
      </AppCard>

      <Text style={styles.sectionHeading}>📤 Exportar Beta</Text>

      <AppCard>
        <Text style={styles.cardLabel}>Pacote completo de uso</Text>
        <Text style={styles.metric}>
          Exporte exercicios, alimentos, refeicoes, desafios, amigos, timeline, erros, versao e contexto da sessao.
        </Text>
        <AppInput
          label="Sugestoes"
          value={betaSuggestion}
          onChangeText={setBetaSuggestion}
          placeholder="Descreva melhorias (uma por linha)"
          multiline
        />
        <PrimaryButton
          {...qaProps('btn_profile_beta_export_full')}
          title={betaExportLoading ? 'Exportando...' : 'Exportar análise beta'}
          onPress={() => handleBetaExport('full')}
        />
        <SecondaryButton
          {...qaProps('btn_profile_beta_export_report')}
          title={betaExportLoading ? 'Exportando...' : 'Exportar relatório beta'}
          onPress={() => handleBetaExport('report')}
          style={styles.secondaryButton}
        />
        <SecondaryButton
          {...qaProps('btn_profile_beta_export_timeline')}
          title={betaExportLoading ? 'Exportando...' : 'Exportar timeline do beta'}
          onPress={() => handleBetaExport('timeline')}
          style={styles.secondaryButton}
        />
        <SecondaryButton
          {...qaProps('btn_profile_beta_export_diagnostic')}
          title={betaExportLoading ? 'Exportando...' : 'Exportar diagnóstico do uso'}
          onPress={() => handleBetaExport('diagnostic')}
          style={styles.secondaryButton}
        />
        <SecondaryButton
          {...qaProps('btn_profile_beta_export_support_package')}
          title={betaExportLoading ? 'Exportando...' : 'Exportar pacote de suporte'}
          onPress={() => handleBetaExport('support')}
          style={styles.secondaryButton}
        />
        <PrimaryButton
          {...qaProps('btn_profile_beta_export_improvements')}
          title={betaLoading ? 'Exportando...' : 'Exportar melhorias'}
          onPress={handleExportImprovements}
          style={styles.primaryButtonTop}
        />
      </AppCard>

      <Text style={styles.sectionHeading}>Coach IA</Text>

      <AppCard>
        <Text style={styles.metric}>Prioridade: {profileCoach.priority}</Text>
        <Text style={styles.metric}>{profileCoach.summary}</Text>
        {(profileCoach.actions || []).slice(0, 2).map((item) => (
          <Text key={item} style={styles.metric}>• {item}</Text>
        ))}
      </AppCard>

      <View
        {...qaAliasProps(QA_ELEMENTS.btnSaveProfile, 'btn-profile-save')}
        collapsable={false}
        style={[styles.stickyFooter, { paddingBottom: stickyFooterPaddingBottom }]}
      >
        <PrimaryButton title="Salvar perfil" onPress={saveProfile} />
      </View>


      <TouchableOpacity onPress={handleVersionTap} activeOpacity={0.7}>
        <Text style={styles.versionText}>v{APP_VERSION}</Text>
      </TouchableOpacity>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  heroSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  avatarEmoji: {
    fontSize: 36,
  },
  heroName: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  heroEmail: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  heroStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  heroStat: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: '900',
    color: colors.primary,
  },
  heroStatLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  heroStatDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
  },
  statCardValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  statCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  statCardDiff: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 2,
  },
  screenWrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollArea: {
    flex: 1,
  },
  container: {
    backgroundColor: colors.background,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  stickyFooter: {
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    marginTop: spacing.sm,
  },
  primaryButtonTop: {
    marginTop: spacing.sm,
  },
  cardLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  sectionHeading: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 2,
    marginBottom: -2,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  chipActive: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  metric: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  accountMeta: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  accountMetaHint: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
  },
  accountHint: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  devFeatureTag: {
    color: '#BFDBFE',
    backgroundColor: '#0B1730',
    borderWidth: 1,
    borderColor: '#3B82F6',
    borderRadius: 999,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  versionText: {
    marginTop: spacing.md,
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: spacing.sm,
  },
});
