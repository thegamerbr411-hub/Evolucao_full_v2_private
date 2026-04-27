import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useSocialStore } from '../stores/useSocialStore';
import { colors, spacing } from '../theme';
import { AppCard, ScreenHeader } from '../components/ui';
import { trackEvent } from '../utils/analytics';
import { getSocialOverviewFromApi, addFriendFromApi } from '../services/socialApiService';

const RANK_MEDALS = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export default function SocialScreen({ navigation }) {
  const { user } = useApp();
  const { feed, ranking, friends, addFriend, removeFriend, isFriend } = useSocialStore();
  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'ranking'
  const [loading, setLoading] = useState(false);
  const [friendInput, setFriendInput] = useState('');

  const userId = useMemo(() => String(user?.id || ''), [user?.id]);
  const currentUserRanking = useMemo(() => ranking.find((e) => e.isCurrentUser), [ranking]);
  const nextRankingTarget = useMemo(() => {
    if (!currentUserRanking || !Array.isArray(ranking) || !ranking.length) {
      return null;
    }

    const sorted = ranking
      .filter((entry) => Number.isFinite(Number(entry?.xp)))
      .slice()
      .sort((a, b) => Number(b.xp || 0) - Number(a.xp || 0));
    const currentIndex = sorted.findIndex((entry) => entry.userId === currentUserRanking.userId);

    if (currentIndex <= 0) {
      return {
        gap: 0,
        label: 'Lideranca mantida. Continue registrando para ampliar vantagem.',
      };
    }

    const previous = sorted[currentIndex - 1];
    const gap = Math.max(0, Number(previous?.xp || 0) - Number(currentUserRanking?.xp || 0));
    return {
      gap,
      label: `Faltam ${gap} XP para subir para #${currentIndex}.`,
    };
  }, [currentUserRanking, ranking]);

  // Ordenar ranking
  const topPlayers = useMemo(() => {
    return ranking.slice(0, 10).map((entry, idx) => ({
      ...entry,
      position: idx + 1,
    }));
  }, [ranking]);

  // Feed filtrado (mostrar posts recentes)
  const recentPosts = useMemo(() => {
    return feed.slice(0, 20);
  }, [feed]);

  const onRefresh = async () => {
    setLoading(true);
    try {
      if (userId) {
        const result = await getSocialOverviewFromApi({ userId });
        if (result?.ok && result.data) {
          const entries = result.data.friendsLeaderboard || [];
          if (Array.isArray(entries) && entries.length) {
            useSocialStore.getState().setRanking(entries);
          }
        }
      }
    } catch (_) {
      // silent — dados locais continuam visíveis
    } finally {
      setLoading(false);
    }
  };

  const handleAddFriend = () => {
    const trimmedId = String(friendInput || '').trim();
    if (!trimmedId) {
      Alert.alert('Informe o ID', 'Digite o user ID do amigo');
      return;
    }

    if (trimmedId === userId) {
      Alert.alert('Ops!', 'Você não pode adicionar a si mesmo');
      setFriendInput('');
      return;
    }

    addFriend(trimmedId);
    trackEvent('friend_added', {
      screen: 'SocialScreen',
      meta: { friendId: trimmedId },
    });

    Alert.alert('Sucesso!', `${trimmedId} adicionado aos amigos`);
    setFriendInput('');
  };

  const handleRemoveFriend = (friendId) => {
    Alert.alert(
      'Remover amigo?',
      'Você não será mais competidor desse amigo',
      [
        { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
        {
          text: 'Remover',
          onPress: () => {
            removeFriend(friendId);
            trackEvent('friend_removed', {
              screen: 'SocialScreen',
              meta: { friendId },
            });
          },
          style: 'destructive',
        },
      ]
    );
  };

  // RENDERIZAR FEED
  const renderFeedPost = ({ item }) => {
    const postDate = new Date(item.createdAt);
    const timeAgo = getTimeAgo(postDate);
    const isBigWorkout = item.volume > 2000;
    const isTopXp = item.xpGained > 250;

    return (
      <AppCard
        style={[
          styles.feedCard,
          isBigWorkout && styles.feedCardBig,
          isTopXp && styles.feedCardHighXp,
        ]}
      >
        <View style={styles.feedHeader}>
          <View style={styles.feedUserSection}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatar}>
                {String(item.username || 'U').charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.feedUserInfo}>
              <Text style={styles.feedUsername}>{item.username}</Text>
              <Text style={styles.feedTime}>{timeAgo}</Text>
            </View>
          </View>

          {isBigWorkout && (
            <View style={styles.badge}>
              <Text style={styles.badgeEmoji}>🔥</Text>
            </View>
          )}
        </View>

        <View style={styles.feedContent}>
          <View style={styles.feedMetrics}>
            <View style={styles.metric}>
              <Ionicons name="barbell" size={14} color={colors.primary} />
              <Text style={styles.metricValue}>{item.volume.toLocaleString()}kg</Text>
              <Text style={styles.metricLabel}>Volume</Text>
            </View>

            <View style={styles.metric}>
              <Ionicons name="flame" size={14} color="#FF6B35" />
              <Text style={[styles.metricValue, { color: '#FF6B35' }]}>
                +{item.xpGained}
              </Text>
              <Text style={styles.metricLabel}>XP</Text>
            </View>

            <View style={styles.metric}>
              <Ionicons name="fitness" size={14} color={colors.secondary} />
              <Text style={styles.metricValue}>{item.totalSets}</Text>
              <Text style={styles.metricLabel}>Séries</Text>
            </View>
          </View>

          <Text style={styles.workoutType}>
            {item.workoutType || 'Treino de hoje'} • {item.exerciseCount} exercícios
          </Text>
        </View>
      </AppCard>
    );
  };

  // RENDERIZAR RANKING
  const renderRankingEntry = ({ item }) => {
    const isCurrentUser = item.userId === userId;
    const medal = RANK_MEDALS[item.position] || `#${item.position}`;
    const isFriendFlag = isFriend(item.userId);

    return (
      <TouchableOpacity
        key={item.userId}
        disabled={!isFriendFlag || isCurrentUser}
        onPress={() => {
          if (isFriendFlag && !isCurrentUser) {
            handleRemoveFriend(item.userId);
          }
        }}
      >
        <View
          style={[
            styles.rankingCard,
            isCurrentUser && styles.rankingCardMe,
            isFriendFlag && styles.rankingCardFriend,
          ]}
        >
          <View style={styles.rankingLeft}>
            <Text style={styles.rankingMedal}>{medal}</Text>
            <View style={styles.rankingUserInfo}>
              <Text
                style={[
                  styles.rankingUsername,
                  isCurrentUser && styles.rankingUsernameBold,
                ]}
                numberOfLines={1}
              >
                {isCurrentUser ? `${item.username} (você)` : item.username}
              </Text>
              <Text style={styles.rankingStreak}>
                <Ionicons name="flame" size={12} /> Streak: {item.streak}d
              </Text>
            </View>
          </View>

          <View style={styles.rankingRight}>
            <Text style={styles.rankingXp}>{item.xp.toLocaleString()} XP</Text>
            {isFriendFlag && !isCurrentUser && (
              <Text style={styles.friendBadge}>Amigo</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // RENDERIZAR SEÇÃO DE FEED TAB
  const renderFeedTab = () => (
    <FlatList
      data={recentPosts}
      renderItem={renderFeedPost}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="barbell-outline" size={48} color={colors.textSecondary} />
          <Text style={styles.emptyStateText}>
            Nenhum treino no feed ainda
          </Text>
          <Text style={styles.emptyStateSubtext}>
            Complete um treino para aparecer no ranking
          </Text>
        </View>
      }
    />
  );

  // RENDERIZAR SEÇÃO DE RANKING TAB
  const renderRankingTab = () => (
    <View style={styles.rankingContainer}>
      {/* Current User Card (destaque especial) */}
      {currentUserRanking && (
        <View style={styles.currentUserCard}>
          <Text style={styles.currentUserLabel}>SUA POSIÇÃO</Text>
          <View style={styles.currentUserContent}>
            <Text style={styles.currentUserMedal}>
              {RANK_MEDALS[currentUserRanking.position] || `#${currentUserRanking.position}`}
            </Text>
            <View style={styles.currentUserStats}>
              <Text style={styles.currentUserXp}>
                {currentUserRanking.xp.toLocaleString()} XP
              </Text>
              <Text style={styles.currentUserInfo}>
                {currentUserRanking.position === 1
                  ? '🔥 Você é o líder!'
                  : `👉 ${currentUserRanking.position} lugar`}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Top 10 Ranking */}
      <Text style={styles.rankingTitle}>🏆 Top 10</Text>
      <FlatList
        data={topPlayers}
        renderItem={renderRankingEntry}
        keyExtractor={(item) => `ranking_${item.userId}`}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.rankingSeparator} />}
      />
    </View>
  );

  // RENDERIZAR FRIENDS TAB (dentro de ranking)
  const renderFriendsTab = () => {
    const friendsList = ranking.filter((r) => isFriend(r.userId));

    return (
      <View style={styles.friendsContainer}>
        <View style={styles.addFriendSection}>
          <Text style={styles.sectionTitle}>Adicionar Amigo</Text>
          <View style={styles.addFriendInput}>
            <Ionicons
              name="search"
              size={18}
              color={colors.textSecondary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.inputField}
              placeholder="User ID do amigo"
              placeholderTextColor={colors.textSecondary}
              value={friendInput}
              onChangeText={setFriendInput}
            />
            <TouchableOpacity
              onPress={handleAddFriend}
              style={styles.addButton}
            >
              <Ionicons name="add-circle" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {friendsList.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Meus Amigos</Text>
            <FlatList
              data={friendsList}
              renderItem={renderRankingEntry}
              keyExtractor={(item) => `friends_${item.userId}`}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.rankingSeparator} />}
            />
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name="people-outline"
              size={48}
              color={colors.textSecondary}
            />
            <Text style={styles.emptyStateText}>Nenhum amigo adicionado</Text>
            <Text style={styles.emptyStateSubtext}>
              Adicione amigos para competir e ver o progresso deles
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View testID="screen-social" style={styles.container}>
      <ScreenHeader title="Social" showBackButton={false} />

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          onPress={() => {
            setActiveTab('feed');
            trackEvent('social_tab_changed', {
              screen: 'SocialScreen',
              tab: 'feed',
            });
          }}
          style={[
            styles.tab,
            activeTab === 'feed' && styles.tabActive,
          ]}
        >
          <Ionicons
            name="newspaper"
            size={20}
            color={activeTab === 'feed' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'feed' && styles.tabLabelActive,
            ]}
          >
            Feed
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setActiveTab('ranking');
            trackEvent('social_tab_changed', {
              screen: 'SocialScreen',
              tab: 'ranking',
            });
          }}
          style={[
            styles.tab,
            activeTab === 'ranking' && styles.tabActive,
          ]}
        >
          <Ionicons
            name="trophy"
            size={20}
            color={activeTab === 'ranking' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'ranking' && styles.tabLabelActive,
            ]}
          >
            Ranking
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setActiveTab('friends');
            trackEvent('social_tab_changed', {
              screen: 'SocialScreen',
              tab: 'friends',
            });
          }}
          style={[
            styles.tab,
            activeTab === 'friends' && styles.tabActive,
          ]}
        >
          <Ionicons
            name="people"
            size={20}
            color={activeTab === 'friends' ? colors.primary : colors.textSecondary}
          />
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'friends' && styles.tabLabelActive,
            ]}
          >
            Amigos
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <FlatList
        contentContainerStyle={styles.content}
        data={activeTab === 'feed' ? [{ id: 'feed' }] : [{ id: 'ranking' }]}
        ListHeaderComponent={
          <AppCard style={styles.retentionCard}>
            <Text style={styles.retentionTitle}>Proxima meta de evolucao</Text>
            <Text style={styles.retentionText}>
              {nextRankingTarget?.label || 'Registre treinos para entrar no ranking da semana.'}
            </Text>
            <Text style={styles.retentionSubtext}>
              Amigos ativos: {friends.length} • Feed recente: {recentPosts.length} posts
            </Text>
          </AppCard>
        }
        renderItem={() => {
          if (activeTab === 'feed') return renderFeedTab();
          if (activeTab === 'ranking') return renderRankingTab();
          if (activeTab === 'friends') return renderFriendsTab();
        }}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [key, value] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / value);
    if (interval >= 1) {
      return `há ${interval}${key[0]}`;
    }
  }

  return 'agora';
}

import { TextInput } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.xs,
  },

  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },

  tabActive: {
    borderBottomColor: colors.primary,
  },

  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  tabLabelActive: {
    color: colors.primary,
    fontWeight: '700',
  },

  content: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },

  retentionCard: {
    marginBottom: spacing.md,
  },

  retentionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },

  retentionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },

  retentionSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // FEED
  feedCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: spacing.md,
  },

  feedCardBig: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
  },

  feedCardHighXp: {
    backgroundColor: `${colors.primary}10`,
  },

  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },

  feedUserSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },

  avatar: {
    color: colors.card,
    fontSize: 16,
    fontWeight: 'bold',
  },

  feedUserInfo: {
    flex: 1,
  },

  feedUsername: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },

  feedTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  badge: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },

  badgeEmoji: {
    fontSize: 16,
  },

  feedContent: {
    marginTop: spacing.md,
  },

  feedMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
    borderRadius: 8,
  },

  metric: {
    alignItems: 'center',
  },

  metricValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },

  metricLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
    textTransform: 'uppercase',
  },

  workoutType: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },

  // RANKING
  rankingContainer: {
    marginBottom: spacing.md,
  },

  rankingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginVertical: spacing.md,
  },

  currentUserCard: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },

  currentUserLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },

  currentUserContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  currentUserMedal: {
    fontSize: 32,
    marginRight: spacing.md,
  },

  currentUserStats: {
    flex: 1,
  },

  currentUserXp: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },

  currentUserInfo: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },

  rankingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderRadius: 8,
  },

  rankingCardMe: {
    backgroundColor: `${colors.primary}10`,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },

  rankingCardFriend: {
    borderLeftWidth: 2,
    borderLeftColor: '#44D62C',
  },

  rankingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  rankingMedal: {
    fontSize: 20,
    marginRight: spacing.md,
  },

  rankingUserInfo: {
    flex: 1,
  },

  rankingUsername: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },

  rankingUsernameBold: {
    fontWeight: '700',
    color: colors.primary,
  },

  rankingStreak: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },

  rankingRight: {
    alignItems: 'flex-end',
  },

  rankingXp: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },

  friendBadge: {
    fontSize: 10,
    color: '#44D62C',
    fontWeight: '700',
    marginTop: 4,
    textTransform: 'uppercase',
  },

  rankingSeparator: {
    height: 1,
    backgroundColor: colors.border,
  },

  // FRIENDS
  friendsContainer: {
    marginBottom: spacing.md,
  },

  addFriendSection: {
    marginBottom: spacing.lg,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },

  addFriendInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  inputIcon: {
    marginRight: spacing.sm,
  },

  inputField: {
    flex: 1,
    paddingVertical: spacing.md,
    color: colors.text,
    fontSize: 14,
  },

  addButton: {
    padding: spacing.sm,
  },

  // EMPTY STATE
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },

  emptyStateText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.md,
  },

  emptyStateSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
    maxWidth: '80%',
  },
});
