import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { AnimatedToast, AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
import { colors, spacing } from '../theme';
import {
  addFriendFromApi,
  createChallengeFromApi,
  getSocialOverviewFromApi,
  joinChallengeFromApi,
  updateChallengeProgressFromApi,
} from '../services/socialApiService';

export default function SocialChallengesScreen() {
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

  const loadOverview = async () => {
    if (!myUserId) {
      return;
    }
    setLoading(true);
    const result = await getSocialOverviewFromApi({ userId: myUserId });
    setLoading(false);

    if (!result?.ok) {
      setToastMessage('Social indisponivel. Nao foi possivel carregar o painel social agora.');
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

  const mapSocialError = (code) => {
    const key = String(code || '').trim();
    if (key === 'cannot_add_self') return 'Voce nao pode adicionar seu proprio perfil.';
    if (key === 'friend_already_added') return 'Esse amigo ja foi adicionado.';
    if (key === 'missing_user_id') return 'Conecte um perfil antes de usar recursos sociais.';
    if (key === 'challenge_not_found') return 'Desafio nao encontrado ou encerrado.';
    if (key === 'invalid_progress_payload') return 'Valor de progresso invalido.';
    return 'Nao foi possivel concluir a acao agora.';
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
    const title = String(challengeTitle || '').trim();
    const target = Number(challengeTarget || 3);
    if (!title || !Number.isFinite(target) || target <= 0) {
      setToastMessage('Dados invalidos. Informe titulo e meta validos.');
      return;
    }

    const result = await createChallengeFromApi({
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
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
    <ScrollView testID="screen-social" contentContainerStyle={styles.container}>
      <View testID="screen-social-challenges" style={styles.hiddenMarker} />
      <AnimatedToast message={toastMessage} onHide={() => setToastMessage('')} />
      <ScreenHeader title="Social e Desafios" subtitle="Amigos, ranking e desafios semanais." />

      <AppCard>
        <Text style={styles.title}>Painel social</Text>
        <Text style={styles.line}>{myUserId || 'Perfil social ainda nao conectado'}</Text>
        {!myUserId ? <Text style={styles.meta}>Entre com um perfil para liberar amizades, ranking e desafios.</Text> : null}
        <Text style={styles.meta}>Amigos: {Number(overview?.friendsCount || 0)}</Text>
        <Text style={styles.meta}>Liga atual: {String(overview?.myLeague || 'bronze').toUpperCase()}</Text>
        {overview?.nextFriendToPass ? (
          <Text style={styles.goalLine}>
            Faltam {Number(overview?.xpToPassFriend || 0)} XP para passar {overview.nextFriendToPass.userId}
          </Text>
        ) : (
          <Text style={styles.goalLine}>Voce esta liderando sua rede de amigos no momento.</Text>
        )}
        <SecondaryButton title={loading ? 'Atualizando...' : 'Atualizar painel'} onPress={loadOverview} style={styles.secondary} />
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Adicionar amigo</Text>
        <TextInput
          testID="input-social-friend-userid"
          value={friendInput}
          onChangeText={setFriendInput}
          placeholder="user id do amigo"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <PrimaryButton testID="btn-social-add-friend" title="Adicionar" onPress={onAddFriend} />
        
        {Number(overview?.friendsCount || 0) === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={40} color={colors.primary} />
            <Text style={styles.emptyStateTitle}>Nenhum amigo adicionado ainda</Text>
            <Text style={styles.emptyStateText}>Convide amigos para competir, comparar XP e criar desafios juntos.</Text>
          </View>
        ) : null}
      </AppCard>

      <AppCard>
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
        <PrimaryButton title="Criar desafio" onPress={onCreateChallenge} />
      </AppCard>

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
              #{row.rank} {row.userId} • {metricLabel} {selectedMetric === 'xp' ? row.xpScore : selectedMetric === 'volume' ? row.volumeScore : selectedMetric === 'completed' ? row.completedScore : row.consistencyScore} • {String(row.league || '').toUpperCase()}
            </Text>
          ))
        ) : (
          <Text style={styles.meta}>Sem ranking social ainda. Adicione amigos e conclua treinos para ativar.</Text>
        )}
      </AppCard>

      <AppCard>
        <Text style={styles.title}>Desafios ativos</Text>
        <TextInput
          value={progressInput}
          onChangeText={setProgressInput}
          placeholder="Progresso para enviar"
          keyboardType="numeric"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        {loading ? <Text style={styles.meta}>Atualizando desafios...</Text> : null}
        {!loading && Array.isArray(overview?.activeChallenges) && overview.activeChallenges.length ? (
          overview.activeChallenges.map((challenge) => (
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
                <Text key={`${challenge.id}-${item.userId}`} style={styles.line}>#{item.rank} {item.userId}: {item.progress}</Text>
              )) : null}
            </View>
          ))
        ) : !loading ? (
          <View style={styles.emptyState}>
            <Ionicons name="flag-outline" size={40} color={colors.primary} />
            <Text style={styles.emptyStateTitle}>Nenhum desafio ativo</Text>
            <Text style={styles.emptyStateText}>Crie um novo desafio semanal para engajar sua rede de amigos em competições.</Text>
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
