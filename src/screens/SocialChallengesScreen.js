import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useSafeBottomTabBarHeight } from '../hooks/useSafeBottomTabBarHeight';
import { AnimatedToast, AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';
import {
  addFriendFromApi,
  createChallengeFromApi,
  getSocialOverviewFromApi,
  joinChallengeFromApi,
  updateChallengeProgressFromApi,
} from '../services/socialApiService';
import { getSocialProfileLabel } from '../utils/profileDisplay';
import { formatSocialParticipantLabel } from '../utils/displayText';
import {
  isChallengeAdmin,
  CHALLENGE_ADMIN_REQUIRED_MESSAGE,
} from '../utils/challengePermissions';

export default function SocialChallengesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useSafeBottomTabBarHeight();
  const scrollBottomPadding = spacing.xl + tabBarHeight + Math.max(insets.bottom, 0);
  const { user } = useApp();
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [friendInput, setFriendInput] = useState('');
  const [challengeTitle, setChallengeTitle] = useState('Desafio semanal: 3 treinos');
  const [challengeTarget, setChallengeTarget] = useState('3');
  const [progressInput, setProgressInput] = useState('1');
  const [selectedMetric, setSelectedMetric] = useState('xp');
  const [toastMessage, setToastMessage] = useState('');

  const myUserId = useMemo(() => String(user?.id || '').trim(), [user?.id]);
  const canCreateChallenge = useMemo(() => isChallengeAdmin(user), [user]);

  const loadOverview = async () => {
    if (!myUserId) {
      return;
    }
    setLoading(true);
    const result = await getSocialOverviewFromApi({ userId: myUserId });
    setLoading(false);

    if (!result?.ok) {
      setToastMessage('Social indisponível. Não foi possível carregar o painel social agora.');
      return;
    }

    setOverview(result.data || null);
  };

  useEffect(() => {
    loadOverview();
  }, [myUserId]);

  const metricRows = useMemo(() => {
    const key = String(selectedMetric || 'xp');
    if (key === 'volume') {
      return Array.isArray(overview?.volumeLeaderboard) ? overview.volumeLeaderboard : [];
    }
    if (key === 'completed') {
      return Array.isArray(overview?.completedLeaderboard) ? overview.completedLeaderboard : [];
    }
    if (key === 'consistency') {
      return Array.isArray(overview?.consistencyLeaderboard) ? overview.consistencyLeaderboard : [];
    }
    return Array.isArray(overview?.friendsLeaderboard) ? overview.friendsLeaderboard : [];
  }, [overview, selectedMetric]);

  const metricLabel = useMemo(() => {
    const map = {
      xp: 'XP',
      consistency: 'Consistencia',
      volume: 'Volume',
      completed: 'Treinos concluidos',
    };
    return map[String(selectedMetric || 'xp')] || 'XP';
  }, [selectedMetric]);

  const metricTabs = useMemo(() => ([
    { key: 'xp', label: 'XP' },
    { key: 'consistency', label: 'Consistência' },
    { key: 'volume', label: 'Volume' },
    { key: 'completed', label: 'Concluídos' },
  ]), []);

  const visibleActiveChallenges = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = Array.isArray(overview?.activeChallenges) ? overview.activeChallenges : [];
    return rows.filter((challenge) => {
      if (!challenge || !challenge.id || !challenge.title) {
        return false;
      }
      const endDate = String(challenge.endDate || today);
      return endDate >= today;
    });
  }, [overview?.activeChallenges]);

  const mapSocialError = (code) => {
    const key = String(code || '').trim();
    if (key === 'cannot_add_self') return 'Você não pode adicionar seu próprio perfil.';
    if (key === 'friend_already_added') return 'Esse amigo já foi adicionado.';
    if (key === 'missing_user_id') return 'Conecte um perfil antes de usar recursos sociais.';
    if (key === 'challenge_not_found') return 'Desafio não encontrado ou encerrado.';
    if (key === 'invalid_progress_payload') return 'Valor de progresso inválido.';
    if (key === 'admin_required') return CHALLENGE_ADMIN_REQUIRED_MESSAGE;
    return 'Não foi possível concluir a ação agora.';
  };

  const onAddFriend = async () => {
    const friendUserId = String(friendInput || '').trim();
    if (!friendUserId) {
      setToastMessage('Informe o ID do amigo.');
      return;
    }

    const result = await addFriendFromApi({ userId: myUserId, friendUserId });
    if (!result?.ok) {
      setToastMessage(`Falha: ${mapSocialError(result?.error)}`);
      return;
    }

    setFriendInput('');
    await loadOverview();
  };

  const onCreateChallenge = async () => {
    if (!canCreateChallenge) {
      setToastMessage(CHALLENGE_ADMIN_REQUIRED_MESSAGE);
      return;
    }

    const title = String(challengeTitle || '').trim();
    const target = Number(challengeTarget || 3);
    if (!title || !Number.isFinite(target) || target <= 0) {
      setToastMessage('Dados invalidos. Informe titulo e meta validos.');
      return;
    }

    const result = await createChallengeFromApi({
      user,
      userId: myUserId,
      title,
      target,
      type: 'workouts_count',
    });

    if (!result?.ok) {
      setToastMessage(`Falha: ${mapSocialError(result?.error)}`);
      return;
    }

    await loadOverview();
  };

  const onJoinChallenge = async (challengeId) => {
    const result = await joinChallengeFromApi({ userId: myUserId, challengeId });
    if (!result?.ok) {
      setToastMessage(`Falha: ${mapSocialError(result?.error)}`);
      return;
    }

    await loadOverview();
  };

  const onUpdateProgress = async (challengeId) => {
    const progress = Number(progressInput || 0);
    if (!Number.isFinite(progress) || progress < 0) {
      setToastMessage('Valor invalido. Informe um progresso numerico valido.');
      return;
    }

    const result = await updateChallengeProgressFromApi({
      userId: myUserId,
      challengeId,
      progress,
    });

    if (!result?.ok) {
      setToastMessage(`Falha: ${mapSocialError(result?.error)}`);
      return;
    }

    await loadOverview();
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView testID="screen-social" contentContainerStyle={[styles.container, { paddingBottom: scrollBottomPadding }]}>
      <View testID="screen-social-challenges" style={styles.hiddenMarker} />
      <AnimatedToast message={toastMessage} onHide={() => setToastMessage('')} />
      <ScreenHeader title="Social e Desafios" subtitle="Amigos, ranking e desafios semanais." onBack={() => navigation.goBack()} />

      {__DEV__ ? (
        <View style={styles.devFeatureTagWrap}>
          <Text style={styles.devFeatureTag}>Social · ranking, desafios e amizades (dev)</Text>
        </View>
      ) : null}

      <AppCard>
        <Text style={styles.title}>Painel social</Text>
        <Text style={styles.line}>{getSocialProfileLabel(user)}</Text>
        {!myUserId ? <Text style={styles.meta}>Entre com um perfil para liberar amizades, ranking e desafios.</Text> : null}
        <Text style={styles.meta}>Amigos: {Number(overview?.friendsCount || 0)}</Text>
        <Text style={styles.meta}>Liga atual: {String(overview?.myLeague || 'bronze').toUpperCase()}</Text>
        {overview?.nextFriendToPass ? (
          <Text style={styles.goalLine}>
            Faltam {Number(overview?.xpToPassFriend || 0)} XP para passar o próximo amigo no ranking.
          </Text>
        ) : (
          <Text style={styles.goalLine}>Você está liderando sua rede de amigos no momento.</Text>
        )}
        <SecondaryButton title={loading ? 'Atualizando...' : 'Atualizar painel'} onPress={loadOverview} style={styles.secondary} />
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Adicionar amigo</Text>
        <TextInput
          testID="input-social-friend-userid"
          value={friendInput}
          onChangeText={setFriendInput}
          placeholder="Nome ou @usuário"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <PrimaryButton testID="btn-social-add-friend" title="Adicionar" onPress={onAddFriend} />
        
        {Number(overview?.friendsCount || 0) === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={40} color={colors.primary} />
            <Text style={styles.emptyStateTitle}>Nenhum amigo adicionado ainda</Text>
            <Text style={styles.emptyStateText}>Convide amigos para acompanhar desafios.</Text>
          </View>
        ) : null}
      </AppCard>

      {canCreateChallenge ? (
        <AppCard testID="card-social-create-challenge">
          <Text style={styles.title}>Criar desafio</Text>
          <TextInput
            value={challengeTitle}
            onChangeText={setChallengeTitle}
            placeholder="Titulo do desafio"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
          <TextInput
            value={challengeTarget}
            onChangeText={setChallengeTarget}
            placeholder="Meta (ex: 3)"
            keyboardType="numeric"
            placeholderTextColor={colors.textSecondary}
            style={styles.input}
          />
          <PrimaryButton testID="btn-social-create-challenge" title="Criar desafio" onPress={onCreateChallenge} />
        </AppCard>
      ) : null}

      <AppCard>
        <Text style={styles.title}>Ranking entre amigos</Text>
        <View style={styles.metricTabs}>
          {metricTabs.map((metric) => (
            <TouchableOpacity
              key={metric.key}
              style={[styles.metricTab, selectedMetric === metric.key ? styles.metricTabActive : null]}
              onPress={() => setSelectedMetric(metric.key)}
            >
              <Text style={[styles.metricTabText, selectedMetric === metric.key ? styles.metricTabTextActive : null]}>{metric.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {loading ? <Text style={styles.meta}>Carregando ranking...</Text> : null}
        {!loading && metricRows.length ? (
          metricRows.slice(0, 10).map((row) => (
            <Text key={`${row.userId}-${row.rank}`} style={styles.line}>
              #{row.rank} {formatSocialParticipantLabel(row.rank, row.displayName || row.name)} • {metricLabel} {selectedMetric === 'xp' ? row.xpScore : selectedMetric === 'volume' ? row.volumeScore : selectedMetric === 'completed' ? row.completedScore : row.consistencyScore} • {String(row.league || '').toUpperCase()}
            </Text>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="podium-outline" size={40} color={colors.primary} />
            <Text style={styles.emptyStateTitle}>Seu ranking aparece quando houver participantes</Text>
            <Text style={styles.meta}>Convide amigos para acompanhar desafios e comparar XP, volume e consistência.</Text>
          </View>
        )}
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Desafios ativos: {visibleActiveChallenges.length}</Text>
        <TextInput
          value={progressInput}
          onChangeText={setProgressInput}
          placeholder="Progresso para enviar"
          keyboardType="numeric"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        {loading ? <Text style={styles.meta}>Atualizando desafios...</Text> : null}
        {!loading && visibleActiveChallenges.length ? (
          visibleActiveChallenges.map((challenge) => (
            <View key={challenge.id} style={styles.challengeCard}>
              <Text style={styles.challengeTitle}>{challenge.title}</Text>
              <Text style={styles.meta}>Meta: {challenge.target} • Seu progresso: {challenge.myProgress}</Text>
              <Text style={styles.meta}>Prazo: {challenge.startDate} ate {challenge.endDate}</Text>
              <View style={styles.row}>
                <TouchableOpacity style={styles.inlineBtn} onPress={() => onJoinChallenge(challenge.id)}>
                  <Text style={styles.inlineBtnText}>Entrar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.inlineBtn} onPress={() => onUpdateProgress(challenge.id)}>
                  <Text style={styles.inlineBtnText}>Atualizar progresso</Text>
                </TouchableOpacity>
              </View>
              {Array.isArray(challenge.participants) ? challenge.participants.slice(0, 5).map((item) => (
                <Text key={`${challenge.id}-${item.userId}`} style={styles.line}>#{item.rank} {formatSocialParticipantLabel(item.rank)}: {item.progress}</Text>
              )) : null}
            </View>
          ))
        ) : !loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="flag-outline" size={40} color={colors.primary} />
            <Text style={styles.emptyStateTitle}>Nenhum desafio ativo</Text>
            <Text style={styles.emptyStateText}>
              {canCreateChallenge
                ? 'Crie um novo desafio semanal para engajar sua rede de amigos em competicoes.'
                : 'Participe dos desafios ativos da sua rede. Novos desafios sao publicados por administradores.'}
            </Text>
          </View>
        ) : null}
      </AppCard>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hiddenMarker: {
    width: 1,
    height: 1,
    opacity: 0,
  },
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  line: {
    color: colors.textPrimary,
    fontSize: 13,
    marginBottom: 4,
    fontWeight: '600',
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  secondary: {
    marginTop: spacing.sm,
  },
  goalLine: {
    color: colors.success,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  devFeatureTagWrap: {
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: '#0B1730',
    borderRadius: 999,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
  },
  devFeatureTag: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '800',
  },
  metricTabs: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  metricTab: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  metricTabActive: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondaryMuted,
  },
  metricTabText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  metricTabTextActive: {
    color: colors.textPrimary,
  },
  challengeCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  challengeTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  inlineBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inlineBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyState: {
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    marginTop: spacing.sm,
    letterSpacing: -0.3,
  },
  emptyStateText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: '85%',
  },
});
