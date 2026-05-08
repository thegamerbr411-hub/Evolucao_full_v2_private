import React, { useRef, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { AnimatedToast, AppCard, AppInput, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { generateCoachInsight } from '../services/coachInsight';
import { colors, spacing } from '../theme';
import { APP_VERSION } from '../utils/appVersion';
import { cancelCreatineReminder, scheduleCreatineReminder } from '../utils/notifications';
import * as _authServiceModule from '../services/authService';
const { isGoogleAuthConfigured: _isGoogleAuthConfigured, loginWithGoogleToken: _loginWithGoogleToken, logoutGoogleSession: _logoutGoogleSession, useGoogleAuth: _useGoogleAuth } = _authServiceModule || {};
const isGoogleAuthConfigured = typeof _isGoogleAuthConfigured === 'function' ? _isGoogleAuthConfigured : () => false;
const loginWithGoogleToken = typeof _loginWithGoogleToken === 'function' ? _loginWithGoogleToken : async () => ({ id: null, isAdmin: false, role: 'user', source: 'unavailable' });
const logoutGoogleSession = typeof _logoutGoogleSession === 'function' ? _logoutGoogleSession : async () => ({ ok: false });
const useGoogleAuth = typeof _useGoogleAuth === 'function' ? _useGoogleAuth : () => ({ request: null, response: null, promptAsync: async () => {} });
import { getOrCreateUserIdentity, saveUserIdentity } from '../services/appIdentityService';
import { performFullSessionLogout } from '../services/sessionCleanupService';
import { setQaRuntimeAuth } from '../utils/qaTransport';

const ADMIN_EMAILS = ['thegamerbr411@gmail.com'];

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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [sessionLogoutLoading, setSessionLogoutLoading] = useState(false);
  const [creatineLoading, setCreatineLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const insets = useSafeAreaInsets();
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
  const googleConfigured = isGoogleAuthConfigured();
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin' || ADMIN_EMAILS.includes(String(user?.email || '').toLowerCase().trim());

  const gamification = getWorkoutGamification();
  const macroTargets = getDailyMacroTargets();

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

    const result = updateProfileSettings({
      goal,
      level,
      trainingDaysPerWeek: parsedDays,
      currentWeight: parsedWeight,
      targetWeight: parsedTargetWeight || parsedWeight,
      height: parsedHeight || 170,
      currentPain,
    });

    if (!result.ok) {
      setToastMessage(`Nao foi possivel salvar: ${String(result?.message || 'erro desconhecido')}`);
      return;
    }

    setToastMessage('Perfil atualizado. Configuracoes ativas no coach e nas rotinas.');
  };

  React.useEffect(() => {
    const handleGoogleResponse = async () => {
      if (!response) {
        return;
      }

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
        const idToken = authData.idToken || response?.params?.id_token || null;
        const loggedUser = await loginWithGoogleToken({
          accessToken: authData.accessToken,
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
  }, [response, setUser]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.screenWrapper}>
    <ScrollView
      testID="screen-perfil"
      style={styles.scrollArea}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.container}
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
        <Text style={styles.metric}>Sincronize sua conta para manter seu progresso seguro em qualquer dispositivo.</Text>
        {googleConfigured ? (
          <>
            <PrimaryButton
              testID="btn-profile-google-login"
              title={googleLoading ? 'Conectando Google...' : 'Entrar com Google'}
              onPress={() => {
                if (googleLoading) return;
                if (!request) {
                  setToastMessage('Login Google indisponivel no momento. Reabra a tela e tente novamente.');
                  return;
                }
                promptAsync({ useProxy: false }).catch(() => {
                  setToastMessage('Falha no login. Nao foi possivel abrir o fluxo do Google.');
                });
              }}
            />
            <SecondaryButton
              testID="btn-profile-google-logout"
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
            {!request ? <Text style={styles.metric}>Preparando acesso Google...</Text> : null}
          </>
        ) : (
          <Text style={styles.metric}>Google nao configurado nesta build. Ative EXPO_PUBLIC_GOOGLE_* para login no release.</Text>
        )}

        <SecondaryButton
          testID="btn-profile-session-logout"
          title={sessionLogoutLoading ? 'Encerrando sessao...' : 'Encerrar sessao completa'}
          onPress={async () => {
            if (sessionLogoutLoading) {
              return;
            }

            setSessionLogoutLoading(true);
            try {
              await performFullSessionLogout({ reason: 'profile_manual_logout' });
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Cadastro' }],
                })
              );
              setToastMessage('Sessao encerrada com limpeza completa do estado local.');
            } catch {
              setToastMessage('Falha ao encerrar a sessao por completo. Tente novamente.');
            } finally {
              setSessionLogoutLoading(false);
            }
          }}
          style={styles.secondaryButton}
        />

        <SecondaryButton
          title="Abrir painel Admin"
          onPress={() => navigation.navigate('Admin')}
          style={styles.secondaryButton}
        />

        {__DEV__ ? (
          <SecondaryButton
            title="Monitor ao vivo (debug)"
            onPress={() => navigation.navigate('DebugObservability')}
            style={styles.secondaryButton}
          />
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
          testID="btn-profile-creatine-enable"
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
          testID="btn-profile-creatine-disable"
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

      <Text style={styles.sectionHeading}>🤖 Coach IA</Text>

      <AppCard>
        <Text style={styles.metric}>Prioridade: {profileCoach.priority}</Text>
        <Text style={styles.metric}>{profileCoach.summary}</Text>
        {(profileCoach.actions || []).slice(0, 2).map((item) => (
          <Text key={item} style={styles.metric}>• {item}</Text>
        ))}
      </AppCard>


      <TouchableOpacity onPress={handleVersionTap} activeOpacity={0.7}>
        <Text style={styles.versionText}>v{APP_VERSION}</Text>
      </TouchableOpacity>
    </ScrollView>

    <View
      testID="btn-profile-save"
      accessibilityLabel="Salvar perfil"
      collapsable={false}
      style={[styles.stickyFooter, { paddingBottom: Math.max(spacing.md, insets.bottom + 8) }]}
    >
      <PrimaryButton title="Salvar perfil" onPress={saveProfile} />
    </View>
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
    flexGrow: 1,
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
