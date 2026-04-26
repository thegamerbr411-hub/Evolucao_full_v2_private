import { create } from 'zustand';

export type SocialFeedPost = {
  id: string;
  userId: string;
  username: string;
  workoutType: string;
  volume: number;
  xpGained: number;
  exerciseCount: number;
  createdAt: string;
  totalSets: number;
};

export type RankingEntry = {
  userId: string;
  username: string;
  xp: number;
  streak: number;
  position: number;
  isFriend?: boolean;
  isCurrentUser?: boolean;
};

type SocialStore = {
  feed: SocialFeedPost[];
  ranking: RankingEntry[];
  friends: string[];

  // Feed operations
  addPostToFeed: (post: SocialFeedPost) => void;
  setFeed: (posts: SocialFeedPost[]) => void;
  clearFeed: () => void;

  // Ranking operations
  updateRanking: (entries: RankingEntry[]) => void;
  setRanking: (entries: RankingEntry[]) => void;
  getCurrentUserRanking: () => RankingEntry | null;
  getUserPosition: (userId: string) => number;

  // Friends operations
  addFriend: (userId: string) => void;
  removeFriend: (userId: string) => void;
  setFriends: (friends: string[]) => void;
  isFriend: (userId: string) => boolean;
};

const calculateNewRanking = (existing: RankingEntry[], newPost: SocialFeedPost): RankingEntry[] => {
  const updated = [...existing];
  const userIndex = updated.findIndex((e) => e.userId === newPost.userId);

  if (userIndex >= 0) {
    updated[userIndex] = {
      ...updated[userIndex],
      xp: updated[userIndex].xp + newPost.xpGained,
    };
  } else {
    updated.push({
      userId: newPost.userId,
      username: newPost.username,
      xp: newPost.xpGained,
      streak: 1,
      position: 0,
      isFriend: false,
      isCurrentUser: false,
    });
  }

  // Re-sort and update positions
  updated.sort((a, b) => b.xp - a.xp);
  return updated.map((entry, idx) => ({
    ...entry,
    position: idx + 1,
  }));
};

export const useSocialStore = create<SocialStore>((set, get) => ({
  feed: [],
  ranking: [],
  friends: [],

  // Feed
  addPostToFeed: (post) =>
    set((state) => {
      const newFeed = [post, ...state.feed].slice(0, 100); // Keep latest 100 posts
      const newRanking = calculateNewRanking(state.ranking, post);
      return { feed: newFeed, ranking: newRanking };
    }),

  setFeed: (posts) => set({ feed: posts }),

  clearFeed: () => set({ feed: [] }),

  // Ranking
  updateRanking: (entries) =>
    set((state) => ({
      ranking: entries.map((entry, idx) => ({
        ...entry,
        position: idx + 1,
      })),
    })),

  setRanking: (entries) =>
    set({
      ranking: entries.map((entry, idx) => ({
        ...entry,
        position: idx + 1,
      })),
    }),

  getCurrentUserRanking: () => {
    const current = get().ranking.find((e) => e.isCurrentUser);
    return current || null;
  },

  getUserPosition: (userId: string) => {
    const entry = get().ranking.find((e) => e.userId === userId);
    return entry?.position || 0;
  },

  // Friends
  addFriend: (userId) =>
    set((state) => {
      if (state.friends.includes(userId)) return state;
      return { friends: [...state.friends, userId] };
    }),

  removeFriend: (userId) =>
    set((state) => ({
      friends: state.friends.filter((id) => id !== userId),
    })),

  setFriends: (friends) => set({ friends }),

  isFriend: (userId) => {
    return get().friends.includes(userId);
  },
}));
