import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { AppCard, PrimaryButton, ScreenHeader, SecondaryButton } from '../components/ui';
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

  const myUserId = useMemo(() => String(user?.id || '').trim(), [user?.id]);

  const loadOverview = async () => {
    if (!myUserId) {
      return;
    }
    setLoading(true);
    const result = await getSocialOverviewFromApi({ userId: myUserId });
    setLoading(false);

    if (!result?.ok) {
      Alert.alert('Social indisponivel', 'Nao foi possivel carregar o painel social agora.');
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

  const onAddFriend = async () => {
    const friendUserId = String(friendInput || '').trim();
    if (!friendUserId) {
      Alert.alert('Informe o ID', 'Digite o user ID do amigo.');
      return;
    }

    const result = await addFriendFromApi({ userId: myUserId, friendUserId });
    if (!result?.ok) {
      Alert.alert('Falha', 'Nao foi possivel adicionar amigo.');
      return;
    }

    setFriendInput('');
    await loadOverview();
  };

  const onCreateChallenge = async () => {
    const title = String(challengeTitle || '').trim();
    const target = Number(challengeTarget || 3);
    if (!title || !Number.isFinite(target) || target <= 0) {
      Alert.alert('Dados invalidos', 'Informe titulo e meta validos.');
      return;
    }

    const result = await createChallengeFromApi({
      userId: myUserId,
      title,
      target,
      type: 'workouts_count',
    });

    if (!result?.ok) {
      Alert.alert('Falha', 'Nao foi possivel criar desafio agora.');
      return;
    }

    await loadOverview();
  };

  const onJoinChallenge = async (challengeId) => {
    const result = await joinChallengeFromApi({ userId: myUserId, challengeId });
    if (!result?.ok) {
      Alert.alert('Falha', 'Nao foi possivel entrar no desafio.');
      return;
    }

    await loadOverview();
  };

  const onUpdateProgress = async (challengeId) => {
    const progress = Number(progressInput || 0);
    if (!Number.isFinite(progress) || progress < 0) {
      Alert.alert('Valor invalido', 'Informe um progresso numerico valido.');
      return;
    }

    const result = await updateChallengeProgressFromApi({
      userId: myUserId,
      challengeId,
      progress,
    });

    if (!result?.ok) {
      Alert.alert('Falha', 'Nao foi possivel atualizar progresso.');
      return;
    }

    await loadOverview();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="Social e Desafios" subtitle="Amigos, ranking e desafios semanais." />

      <AppCard>
        <Text style={styles.title}>Painel social</Text>
        <Text style={styles.line}>{myUserId || 'Sem user ID'}</Text>
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
          value={friendInput}
          onChangeText={setFriendInput}
          placeholder="user id do amigo"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />
        <PrimaryButton title="Adicionar" onPress={onAddFriend} />
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
          {['xp', 'consistency', 'volume', 'completed'].map((metric) => (
            <TouchableOpacity
              key={metric}
              style={[styles.metricTab, selectedMetric === metric ? styles.metricTabActive : null]}
              onPress={() => setSelectedMetric(metric)}
            >
              <Text style={[styles.metricTabText, selectedMetric === metric ? styles.metricTabTextActive : null]}>{metric}</Text>
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
        ) : (
          <Text style={styles.meta}>Nenhum desafio ativo por enquanto. Crie um novo desafio semanal para engajar sua rede.</Text>
        )}
      </AppCard>
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
  title: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 8,
  },
  line: {
    color: colors.textPrimary,
    fontSize: 13,
    marginBottom: 4,
    fontWeight: '600',
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#141922',
    color: colors.textPrimary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  secondary: {
    marginTop: spacing.sm,
  },
  goalLine: {
    color: '#A7F3D0',
    fontSize: 12,
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
    backgroundColor: '#141922',
  },
  metricTabActive: {
    borderColor: colors.secondary,
    backgroundColor: '#1D2B40',
  },
  metricTabText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '800',
  },
  metricTabTextActive: {
    color: '#BFDBFE',
  },
  challengeCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: '#111822',
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
    borderRadius: 8,
    backgroundColor: colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inlineBtnText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
});
