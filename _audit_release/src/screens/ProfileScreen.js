import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
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
import { setQaRuntimeAuth } from '../utils/qaTransport';

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
  const [creatineLoading, setCreatineLoading] = useState(false);
  const { request, promptAsync, response } = useGoogleAuth();
  const googleConfigured = isGoogleAuthConfigured();

  const gamification = getWorkoutGamification();
  const macroTargets = getDailyMacroTargets();

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
    const parsedDays = Math.round(Number(String(trainingDays || '3').replace(',', '.')));
    if (!parsedDays || parsedDays < 1 || parsedDays > 7) {
      Alert.alert('Frequencia invalida', 'Informe entre 1 e 7 dias por semana.');
      return;
    }
    const parsedWeight = Number(String(currentWeight || '70').replace(',', '.'));
    if (!parsedWeight || parsedWeight < 30 || parsedWeight > 300) {
      Alert.alert('Peso invalido', 'Informe um peso entre 30 e 300 kg.');
      return;
    }
    const parsedTargetWeight = Number(String(targetWeight || '70').replace(',', '.'));
    const parsedHeight = Number(String(height || '170').replace(',', '.'));
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
      Alert.alert('Nao foi possivel salvar', result.message);
      return;
    }

    Alert.alert('Perfil atualizado', 'Suas configuracoes ja estao valendo no coach e nas rotinas.');
  };

  React.useEffect(() => {
    const handleGoogleResponse = async () => {
      if (!response || response.type !== 'success') {
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
          Alert.alert('Falha no login', 'Nao foi possivel concluir o login Google.');
          return;
        }

        await saveUserIdentity({ userId: loggedUser.id, source: loggedUser.source || 'google' });
        setQaRuntimeAuth({ userId: loggedUser.id });
        setUser((prev) => ({ ...prev, id: loggedUser.id, role: loggedUser.role || 'user' }));
        Alert.alert('Login concluido', 'Conta Google conectada com sucesso.');
      } catch (error) {
        Alert.alert('Erro no login', String(error?.message || 'Nao foi possivel autenticar com Google.'));
      } finally {
        setGoogleLoading(false);
      }
    };

    handleGoogleResponse();
  }, [response, setUser]);

  return (
    <ScrollView testID="screen-perfil" contentContainerStyle={styles.container}>
      <ScreenHeader title="Perfil" subtitle="Centro de controle da sua estrategia e evolucao." />

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
        <Text style={styles.cardLabel}>Frequencia semanal</Text>
        <TextInput value={trainingDays} onChangeText={setTrainingDays} keyboardType="numeric" style={styles.input} />
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Peso atual (kg)</Text>
        <TextInput testID="input-profile-current-weight" value={currentWeight} onChangeText={setCurrentWeight} keyboardType="numeric" style={styles.input} />
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Peso alvo (kg)</Text>
        <TextInput value={targetWeight} onChangeText={setTargetWeight} keyboardType="numeric" style={styles.input} />
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Altura (cm)</Text>
        <TextInput value={height} onChangeText={setHeight} keyboardType="numeric" style={styles.input} />
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Dor / limitação atual</Text>
        <TextInput value={currentPain} onChangeText={setCurrentPain} placeholder="Ex: ombro direito" placeholderTextColor="#8FA5CB" style={styles.input} />
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Historico recente</Text>
        <Text style={styles.metric}>Dias com registro: {historySummary.days}</Text>
        <Text style={styles.metric}>Dias treinados: {historySummary.trainedDays}</Text>
        <Text style={styles.metric}>Proteina media: {historySummary.avgProtein}g</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Evolucao e social (base)</Text>
        <Text style={styles.metric}>Nivel {gamification.level} · XP {gamification.xp}</Text>
        <Text style={styles.metric}>Streak: {gamification.streakDays} dias</Text>
        <Text style={styles.metric}>Rotinas salvas: {Array.isArray(userRoutines) ? userRoutines.length : 0}</Text>
        <Text style={styles.metric}>Comunidade: acompanhe sua evolucao e consistencia semanal.</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Plano atual</Text>
        <Text style={styles.metric}>Calorias alvo: {Number(plan?.caloriesPerDay || 0)} kcal/dia</Text>
        <Text style={styles.metric}>Agua alvo: {Number(plan?.waterLitersPerDay || 0)}L/dia</Text>
        <Text style={styles.metric}>Estrategia: {String(plan?.strategy || 'recomposicao')}</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Conta</Text>
        <Text style={styles.metric}>Status de acesso: {googleConfigured ? 'Google disponivel' : 'Modo local ativo'}</Text>
        {googleConfigured ? (
          <>
            <PrimaryButton
              testID="btn-profile-google-login"
              title={googleLoading ? 'Conectando Google...' : 'Entrar com Google'}
              onPress={() => {
                if (googleLoading) return;
                promptAsync().catch(() => {
                  Alert.alert('Falha no login', 'Nao foi possivel abrir o fluxo do Google.');
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
                  Alert.alert('Conta local ativa', 'Sessao Google encerrada neste dispositivo.');
                } finally {
                  setLogoutLoading(false);
                }
              }}
              style={styles.secondaryButton}
            />
            {!request ? <Text style={styles.metric}>Preparando acesso Google...</Text> : null}
          </>
        ) : (
          <Text style={styles.metric}>Você pode usar o app normalmente no modo local. O login Google pode ser ativado em builds configurados.</Text>
        )}
        {(__DEV__ ? true : false) ? (
          <>
            <Text style={styles.metric}>[DEV] User ID: {String(user?.id || 'local')}</Text>
            <Text style={styles.metric}>[DEV] Role: {String(user?.role || 'user')}</Text>
          </>
        ) : null}
      </AppCard>

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
                Alert.alert('Nao foi possivel ativar', 'Verifique a permissao de notificacoes no dispositivo.');
                return;
              }
              Alert.alert('Lembrete ativo', 'Creatina diaria agendada para 09:00.');
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
              Alert.alert('Lembrete desativado', 'O lembrete diario de creatina foi removido.');
            } finally {
              setCreatineLoading(false);
            }
          }}
          style={styles.secondaryButton}
        />
      </AppCard>

      <AppCard>
        <Text style={styles.cardLabel}>Coach sobre o seu perfil</Text>
        <Text style={styles.metric}>Prioridade: {profileCoach.priority}</Text>
        <Text style={styles.metric}>{profileCoach.summary}</Text>
        {(profileCoach.actions || []).slice(0, 2).map((item) => (
          <Text key={item} style={styles.metric}>• {item}</Text>
        ))}
      </AppCard>

      {(__DEV__ ? true : false) ? (
        <PrimaryButton title="Abrir Debug Metrics" onPress={() => navigation.navigate('DebugMetrics')} />
      ) : null}
      <PrimaryButton testID="btn-profile-save" title="Salvar perfil" onPress={saveProfile} />
      <Text style={styles.versionText}>Versao do app: v{APP_VERSION}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  cardLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
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
