import { addToQueue } from '../../storage/syncQueue';
import { useGamificationStore } from '../../stores/useGamificationStore';
import { useSocialStore } from '../../stores/useSocialStore';
import { calculateXpFromVolume } from '../progression/xp';
import { fetchSocialState, postCompletedWorkout, SocialWorkoutPayload } from './socialApiClient';

function applyBackendSnapshot(snapshot: any) {
  const socialStore = useSocialStore.getState();
  const gamificationStore = useGamificationStore.getState();

  if (Array.isArray(snapshot?.ranking)) {
    socialStore.setRanking(snapshot.ranking);
  }

  if (Array.isArray(snapshot?.feed)) {
    socialStore.setFeed(snapshot.feed);
  }

  if (typeof snapshot?.xpTotal === 'number') {
    gamificationStore.updateGamification({ xp: snapshot.xpTotal });
  }
}

export async function processSocialWorkoutCompletion(payload: SocialWorkoutPayload) {
  const socialStore = useSocialStore.getState();
  const gamificationStore = useGamificationStore.getState();

  const backendResult = await postCompletedWorkout(payload);
  if (backendResult) {
    applyBackendSnapshot(backendResult);
    return {
      success: true,
      source: 'backend',
      xpGained: Number(backendResult.xpGained || 0),
      position: Number(backendResult.position || socialStore.getUserPosition(payload.userId) || 0),
    };
  }

  // Fallback local apenas para resiliencia offline.
  const xpGained = calculateXpFromVolume(payload.totalVolume);
  gamificationStore.addXp(xpGained);

  socialStore.addPostToFeed({
    id: `post_${payload.userId}_${Date.now()}`,
    userId: payload.userId,
    username: payload.username,
    workoutType: payload.workoutType,
    volume: payload.totalVolume,
    xpGained,
    exerciseCount: payload.exerciseCount,
    totalSets: payload.totalSets,
    createdAt: new Date().toISOString(),
  });

  addToQueue({
    type: 'other',
    data: {
      kind: 'social_workout_completed',
      payload,
      xpGained,
    },
  });

  return {
    success: true,
    source: 'offline-fallback',
    xpGained,
    position: socialStore.getUserPosition(payload.userId),
  };
}

export async function hydrateSocialFromBackend(userId: string): Promise<boolean> {
  const snapshot = await fetchSocialState(userId);
  if (!snapshot) {
    return false;
  }
  applyBackendSnapshot(snapshot);
  return true;
}
